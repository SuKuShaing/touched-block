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
  async verifyNotification(): Promise<AppleNotification> {
    throw unauthorized('no', 'invalid_provider_token');
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
