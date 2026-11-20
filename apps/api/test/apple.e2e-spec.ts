import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AppleTokensService, type ExchangeOptions } from '../src/auth/apple-tokens';
import { type AppleNotification, AppleVerifier, type VerifiedIdentity } from '../src/auth/verifiers';
import { unauthorized } from '../src/common/errors';
import { PrismaService } from '../src/prisma/prisma.service';

/** identityToken falso: `apple:<sub>:<aud>` (aud = bundle ID en iOS, Services ID en la web). */
class FakeAppleVerifier extends AppleVerifier {
  async verify(token: string): Promise<VerifiedIdentity> {
    const m = /^apple:([^:]+):(.+)$/.exec(token);
    if (!m) throw unauthorized('Token inválido', 'invalid_provider_token');
    return { subject: m[1], email: `${m[1]}@privaterelay.appleid.com`, name: null, audience: m[2] };
  }
  /** Aviso falso: `notif:<type>:<sub>[:<event_time ms>]`. */
  async verifyNotification(payload: string): Promise<AppleNotification> {
    const m = /^notif:([^:]+):([^:]+)(?::([0-9]+))?$/.exec(payload);
    if (!m) throw unauthorized('no', 'invalid_provider_token');
    return { type: m[1], subject: m[2], eventTime: m[3] ? new Date(Number(m[3])) : null };
  }
}

/** Registra los canjes en vez de llamar a Apple. */
class RecordingAppleTokens {
  calls: { subject: string; code: string; opts: ExchangeOptions }[] = [];
  async storeFromCode(subject: string, code: string, opts: ExchangeOptions = {}) {
    this.calls.push({ subject, code, opts });
  }
  async revokeForUser() {}
}

let app: INestApplication;
let prisma: PrismaService;
const tokens = new RecordingAppleTokens();
const http = () => request(app.getHttpServer());
const SUB = 'e2e-apple-';

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(AppleVerifier)
    .useClass(FakeAppleVerifier)
    .overrideProvider(AppleTokensService)
    .useValue(tokens)
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  prisma = app.get(PrismaService);
});

beforeEach(async () => {
  tokens.calls = [];
  await prisma.user.deleteMany({ where: { identities: { some: { provider: 'apple', subject: { startsWith: SUB } } } } });
});

afterAll(async () => {
  await prisma?.user.deleteMany({ where: { identities: { some: { provider: 'apple', subject: { startsWith: SUB } } } } });
  await app?.close();
});

const displayName = async (userId: string) => (await prisma.user.findUnique({ where: { id: userId } }))?.displayName;

describe('POST /auth/apple: nombre', () => {
  it('guarda el nombre del primer login y los siguientes (sin nombre o con otro) no lo cambian', async () => {
    const first = await http()
      .post('/auth/apple')
      .send({ identityToken: `apple:${SUB}1:app.touchedblock`, fullName: 'Ana Pérez' })
      .expect(200);
    expect(first.body.isNew).toBe(true);
    expect(first.body.user.username).toBe('ana.perez');
    const id = first.body.user.id as string;
    expect(await displayName(id)).toBe('Ana Pérez');

    const again = await http().post('/auth/apple').send({ identityToken: `apple:${SUB}1:app.touchedblock` }).expect(200);
    expect(again.body).toMatchObject({ isNew: false, user: { id } });
    expect(await displayName(id)).toBe('Ana Pérez');

    await http().post('/auth/apple').send({ identityToken: `apple:${SUB}1:app.touchedblock`, fullName: 'Otra Persona' }).expect(200);
    expect(await displayName(id)).toBe('Ana Pérez');
  });

  it('si la cuenta quedó sin nombre, el reintento con el nombre lo completa', async () => {
    const first = await http().post('/auth/apple').send({ identityToken: `apple:${SUB}2:app.touchedblock` }).expect(200);
    const id = first.body.user.id as string;
    expect(await displayName(id)).toBeNull();
    await http().post('/auth/apple').send({ identityToken: `apple:${SUB}2:app.touchedblock`, fullName: 'Ana Pérez' }).expect(200);
    expect(await displayName(id)).toBe('Ana Pérez');
  });
});

describe('POST /auth/apple: canje del código', () => {
  it('iOS: canjea con el bundle ID y sin redirect_uri', async () => {
    await http()
      .post('/auth/apple')
      .send({ identityToken: `apple:${SUB}3:app.touchedblock`, authorizationCode: 'c.ios' })
      .expect(200);
    expect(tokens.calls).toEqual([{ subject: `${SUB}3`, code: 'c.ios', opts: { clientId: 'app.touchedblock', redirectUri: undefined } }]);
  });

  it('web: canjea con el Services ID (aud del token) y el redirectUri', async () => {
    await http()
      .post('/auth/apple')
      .send({
        identityToken: `apple:${SUB}4:app.touchedblock.web`,
        authorizationCode: 'c.web',
        redirectUri: 'https://web.touchedblock.app/',
        fullName: 'Ana',
      })
      .expect(200);
    expect(tokens.calls).toEqual([
      { subject: `${SUB}4`, code: 'c.web', opts: { clientId: 'app.touchedblock.web', redirectUri: 'https://web.touchedblock.app/' } },
    ]);
  });

  it('rechaza un redirectUri que no sea https', async () => {
    const res = await http()
      .post('/auth/apple')
      .send({ identityToken: `apple:${SUB}5:app.touchedblock.web`, redirectUri: 'http://localhost:8081/' })
      .expect(400);
    expect(res.body.code).toBe('validation_error');
  });
});

describe('POST /auth/apple/notifications', () => {
  const login = async (n: string) =>
    (await http().post('/auth/apple').send({ identityToken: `apple:${SUB}${n}:app.touchedblock` }).expect(200)).body.user.id as string;
  const notify = (payload: string) => http().post('/auth/apple/notifications').send({ payload });
  const exists = async (id: string) => !!(await prisma.user.findUnique({ where: { id } }));

  it('consent-revoked y account-delete eliminan la cuenta', async () => {
    const a = await login('n1');
    await notify(`notif:consent-revoked:${SUB}n1:${Date.now() + 1000}`).expect(200);
    expect(await exists(a)).toBe(false);
    const b = await login('n2');
    await notify(`notif:account-delete:${SUB}n2`).expect(200);
    expect(await exists(b)).toBe(false);
  });

  it('los demás avisos no borran nada, y una cuenta inexistente responde 200', async () => {
    const a = await login('n3');
    await notify(`notif:email-disabled:${SUB}n3`).expect(200);
    expect(await exists(a)).toBe(true);
    await notify(`notif:consent-revoked:${SUB}no-existe`).expect(200);
  });

  it('un aviso anterior a la cuenta actual (reintento del de la cuenta borrada) se ignora', async () => {
    const old = Date.now() - 60_000;
    const a = await login('n4');
    await notify(`notif:consent-revoked:${SUB}n4:${old}`).expect(200);
    expect(await exists(a)).toBe(true);
  });

  it('un aviso inválido responde 401', async () => {
    const res = await notify('basura-que-no-es-un-aviso').expect(401);
    expect(res.body.code).toBe('invalid_provider_token');
  });
});
