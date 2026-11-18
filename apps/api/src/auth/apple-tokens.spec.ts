import { generateKeyPairSync } from 'node:crypto';
import { decodeProtectedHeader, importSPKI, jwtVerify } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../config/app-config';
import type { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { StatsService } from '../stats/stats.service';
import {
  APPLE_ORIGIN,
  AppleTokensService,
  TokenCipher,
  missingAppleRevocationVars,
  packAppleToken,
  unpackAppleToken,
} from './apple-tokens';
import { parseAppleEvents } from './verifiers';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const P8 = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const SPKI = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const SECRET = 'secreto-de-prueba-de-al-menos-32-caracteres!!';

const baseConfig = {
  jwtSecret: SECRET,
  appleTeamId: 'TEAM123456',
  appleKeyId: 'KEY1234567',
  applePrivateKey: P8,
  appleClientId: 'app.touchedblock',
  appleAudiences: ['app.touchedblock', 'app.touchedblock.web'],
};
const cfg = (over: Partial<typeof baseConfig> = {}) => ({ ...baseConfig, ...over }) as unknown as AppConfig;

interface Call {
  url: string;
  params: URLSearchParams;
}

/** fetch simulado: registra cada llamada y responde con lo que diga `reply`. */
function fakeFetch(reply: (url: string) => { status: number; body?: unknown }) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, params: new URLSearchParams(String(init?.body ?? '')) });
    const r = reply(u);
    return new Response(r.body === undefined ? '' : JSON.stringify(r.body), { status: r.status });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

/** Prisma mínimo en memoria para las identidades. */
function fakePrisma(idents: { id: string; userId: string; provider: string; subject: string; providerRefreshToken: string | null }[]) {
  const deleted: string[] = [];
  const prisma = {
    authIdentity: {
      update: vi.fn(async ({ where, data }: { where: { provider_subject: { provider: string; subject: string } }; data: { providerRefreshToken: string } }) => {
        const i = idents.find((x) => x.provider === where.provider_subject.provider && x.subject === where.provider_subject.subject);
        if (!i) throw new Error('no existe');
        i.providerRefreshToken = data.providerRefreshToken;
        return i;
      }),
      findMany: vi.fn(async ({ where }: { where: { userId: string; provider: string } }) =>
        idents.filter((x) => x.userId === where.userId && x.provider === where.provider),
      ),
    },
    user: {
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        deleted.push(where.id);
        return {};
      }),
    },
  };
  return { prisma: prisma as unknown as PrismaService, deleted, idents };
}

describe('TokenCipher', () => {
  it('cifra y descifra; el texto cifrado no contiene el token', () => {
    const c = new TokenCipher(SECRET);
    const enc = c.encrypt('r.apple-refresh-token');
    expect(enc).not.toContain('apple-refresh-token');
    expect(enc.startsWith('v1:')).toBe(true);
    expect(c.decrypt(enc)).toBe('r.apple-refresh-token');
    // IV aleatorio: dos cifrados del mismo texto son distintos
    expect(c.encrypt('r.apple-refresh-token')).not.toBe(enc);
  });

  it('con otra clave o datos alterados devuelve null', () => {
    const enc = new TokenCipher(SECRET).encrypt('abc');
    expect(new TokenCipher('otro-secreto-distinto-de-32-caracteres-xx').decrypt(enc)).toBeNull();
    const [v, iv, tag, ct] = enc.split(':');
    expect(new TokenCipher(SECRET).decrypt([v, iv, tag, ct.slice(0, -2) + 'AA'].join(':'))).toBeNull();
    expect(new TokenCipher(SECRET).decrypt('basura')).toBeNull();
  });
});

describe('configuración de la revocación', () => {
  it('lista las variables que faltan', () => {
    expect(missingAppleRevocationVars(cfg())).toEqual([]);
    expect(missingAppleRevocationVars(cfg({ appleTeamId: '', applePrivateKey: '' }))).toEqual(['APPLE_TEAM_ID', 'APPLE_PRIVATE_KEY']);
  });
});

describe('AppleTokensService', () => {
  it('firma el client_secret ES256 con iss=Team ID, sub=client_id, aud=appleid y kid=Key ID', async () => {
    const { prisma } = fakePrisma([]);
    const svc = new AppleTokensService(cfg(), prisma, fakeFetch(() => ({ status: 200 })).fn);
    const now = Math.floor(Date.now() / 1000);
    const jwt = await svc.clientSecret(now);
    expect(decodeProtectedHeader(jwt)).toMatchObject({ alg: 'ES256', kid: 'KEY1234567' });
    const { payload } = await jwtVerify(jwt, await importSPKI(SPKI, 'ES256'), {
      issuer: 'TEAM123456',
      subject: 'app.touchedblock',
      audience: APPLE_ORIGIN,
    });
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(180 * 86_400);
    // se reutiliza mientras no esté por vencer
    expect(await svc.clientSecret(now + 10)).toBe(jwt);
  });

  it('acepta la clave .p8 con los saltos de línea escritos como \\n (variable de entorno en una línea)', async () => {
    const prev = process.env.APPLE_PRIVATE_KEY;
    process.env.APPLE_PRIVATE_KEY = P8.replace(/\n/g, '\\n');
    process.env.DATABASE_URL ||= 'postgresql://x';
    process.env.JWT_SECRET ||= SECRET;
    try {
      const { AppConfig } = await import('../config/app-config.js');
      expect(new AppConfig().applePrivateKey).toBe(P8.trim());
    } finally {
      if (prev === undefined) delete process.env.APPLE_PRIVATE_KEY;
      else process.env.APPLE_PRIVATE_KEY = prev;
    }
  });

  it('canjea el authorizationCode y guarda el refresh token cifrado en la identidad', async () => {
    const { prisma, idents } = fakePrisma([{ id: 'i1', userId: 'u1', provider: 'apple', subject: 'sub1', providerRefreshToken: null }]);
    const f = fakeFetch(() => ({ status: 200, body: { access_token: 'a', refresh_token: 'r.secreto', id_token: 'x' } }));
    const svc = new AppleTokensService(cfg(), prisma, f.fn);
    await svc.storeFromCode('sub1', 'c.codigo');
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(`${APPLE_ORIGIN}/auth/token`);
    expect(f.calls[0].params.get('grant_type')).toBe('authorization_code');
    expect(f.calls[0].params.get('code')).toBe('c.codigo');
    expect(f.calls[0].params.get('client_id')).toBe('app.touchedblock');
    expect(f.calls[0].params.get('client_secret')?.split('.')).toHaveLength(3);
    const stored = idents[0].providerRefreshToken!;
    expect(stored).not.toContain('r.secreto');
    expect(unpackAppleToken(new TokenCipher(SECRET).decrypt(stored)!, 'x')).toEqual({ clientId: 'app.touchedblock', token: 'r.secreto' });
    // la app iOS no pide redirect_uri: no se manda
    expect(f.calls[0].params.has('redirect_uri')).toBe(false);
  });

  it('web: canjea con el Services ID (audiencia del token) y el redirect_uri, y lo guarda con ese client_id', async () => {
    const { prisma, idents } = fakePrisma([{ id: 'i1', userId: 'u1', provider: 'apple', subject: 'sub1', providerRefreshToken: null }]);
    const f = fakeFetch(() => ({ status: 200, body: { refresh_token: 'r.web' } }));
    const svc = new AppleTokensService(cfg(), prisma, f.fn);
    await svc.storeFromCode('sub1', 'c.web', { clientId: 'app.touchedblock.web', redirectUri: 'https://web.touchedblock.app/' });
    expect(f.calls[0].params.get('client_id')).toBe('app.touchedblock.web');
    expect(f.calls[0].params.get('redirect_uri')).toBe('https://web.touchedblock.app/');
    // el client_secret también lleva sub = Services ID
    const { payload } = await jwtVerify(f.calls[0].params.get('client_secret')!, await importSPKI(SPKI, 'ES256'), {
      issuer: 'TEAM123456',
      audience: APPLE_ORIGIN,
    });
    expect(payload.sub).toBe('app.touchedblock.web');
    // ...y al eliminar la cuenta se revoca con el mismo client_id
    const r = fakeFetch(() => ({ status: 200 }));
    await new AppleTokensService(cfg(), prisma, r.fn).revokeForUser('u1');
    expect(idents[0].providerRefreshToken).not.toContain('r.web');
    expect(r.calls).toHaveLength(1);
    expect(r.calls[0].params.get('client_id')).toBe('app.touchedblock.web');
    expect(r.calls[0].params.get('token')).toBe('r.web');
  });

  it('usa un client_secret distinto por client_id', async () => {
    const svc = new AppleTokensService(cfg(), fakePrisma([]).prisma, fakeFetch(() => ({ status: 200 })).fn);
    const now = Math.floor(Date.now() / 1000);
    const a = await svc.clientSecret(now, 'app.touchedblock');
    const b = await svc.clientSecret(now, 'app.touchedblock.web');
    expect(a).not.toBe(b);
    expect(await svc.clientSecret(now + 5, 'app.touchedblock.web')).toBe(b);
  });

  it('si Apple rechaza el código, no lanza ni guarda nada', async () => {
    const { prisma, idents } = fakePrisma([{ id: 'i1', userId: 'u1', provider: 'apple', subject: 'sub1', providerRefreshToken: null }]);
    const svc = new AppleTokensService(cfg(), prisma, fakeFetch(() => ({ status: 400, body: { error: 'invalid_grant' } })).fn);
    await expect(svc.storeFromCode('sub1', 'c.vencido')).resolves.toBeUndefined();
    expect(idents[0].providerRefreshToken).toBeNull();
    await expect(svc.exchangeCode('c.vencido')).rejects.toThrow(/400.*invalid_grant/);
  });

  it('sin las variables de Apple no llama a Apple (login sigue, revocación omitida)', async () => {
    const { prisma } = fakePrisma([{ id: 'i1', userId: 'u1', provider: 'apple', subject: 'sub1', providerRefreshToken: 'v1:a:b:c' }]);
    const f = fakeFetch(() => ({ status: 200, body: { refresh_token: 'r' } }));
    const svc = new AppleTokensService(cfg({ appleKeyId: '' }), prisma, f.fn);
    expect(svc.enabled).toBe(false);
    await svc.storeFromCode('sub1', 'c');
    await svc.revokeForUser('u1');
    expect(f.calls).toHaveLength(0);
  });

  it('revoca el refresh token guardado con token_type_hint=refresh_token', async () => {
    const enc = new TokenCipher(SECRET).encrypt('r.guardado');
    const { prisma } = fakePrisma([{ id: 'i1', userId: 'u1', provider: 'apple', subject: 'sub1', providerRefreshToken: enc }]);
    const f = fakeFetch(() => ({ status: 200 }));
    const svc = new AppleTokensService(cfg(), prisma, f.fn);
    await svc.revokeForUser('u1');
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe(`${APPLE_ORIGIN}/auth/revoke`);
    expect(f.calls[0].params.get('token')).toBe('r.guardado');
    expect(f.calls[0].params.get('token_type_hint')).toBe('refresh_token');
    expect(f.calls[0].params.get('client_id')).toBe('app.touchedblock');
  });

  it('cuentas de Google o de Apple sin token: no llama a Apple', async () => {
    const { prisma } = fakePrisma([
      { id: 'i1', userId: 'u1', provider: 'google', subject: 'g', providerRefreshToken: null },
      { id: 'i2', userId: 'u2', provider: 'apple', subject: 'a', providerRefreshToken: null },
    ]);
    const f = fakeFetch(() => ({ status: 200 }));
    const svc = new AppleTokensService(cfg(), prisma, f.fn);
    await svc.revokeForUser('u1');
    await svc.revokeForUser('u2');
    expect(f.calls).toHaveLength(0);
  });
});

describe('formato del token guardado', () => {
  it('empaqueta el client_id con el token y lee los guardados antes a secas (client_id por defecto)', () => {
    expect(unpackAppleToken(packAppleToken({ clientId: 'app.touchedblock.web', token: 'r.1' }), 'app.touchedblock')).toEqual({
      clientId: 'app.touchedblock.web',
      token: 'r.1',
    });
    expect(unpackAppleToken('r.viejo', 'app.touchedblock')).toEqual({ clientId: 'app.touchedblock', token: 'r.viejo' });
    expect(unpackAppleToken('{no json', 'app.touchedblock')).toEqual({ clientId: 'app.touchedblock', token: '{no json' });
  });
});

describe('UsersService.deleteMe con Apple', () => {
  let enc: string;
  beforeEach(() => {
    enc = new TokenCipher(SECRET).encrypt('r.guardado');
  });

  const make = (reply: () => { status: number; body?: unknown } | never) => {
    const db = fakePrisma([{ id: 'i1', userId: 'u1', provider: 'apple', subject: 'sub1', providerRefreshToken: enc }]);
    const f = fakeFetch(reply);
    const tokens = new AppleTokensService(cfg(), db.prisma, f.fn);
    const users = new UsersService(db.prisma, {} as StatsService, tokens);
    return { users, f, db };
  };

  it('revoca en Apple antes de borrar', async () => {
    const order: string[] = [];
    const { users, f, db } = make(() => {
      order.push('revoke');
      return { status: 200 };
    });
    (db.prisma.user.delete as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      order.push('delete');
      return {};
    });
    await users.deleteMe('u1');
    expect(f.calls.map((c) => c.url)).toEqual([`${APPLE_ORIGIN}/auth/revoke`]);
    expect(order).toEqual(['revoke', 'delete']);
  });

  it('si Apple responde con error, borra la cuenta igual', async () => {
    const { users, db } = make(() => ({ status: 500, body: { error: 'server_error' } }));
    await users.deleteMe('u1');
    expect(db.deleted).toEqual(['u1']);
  });

  it('si la red falla (fetch lanza), borra la cuenta igual', async () => {
    const { users, db } = make(() => {
      throw new Error('ECONNRESET');
    });
    await users.deleteMe('u1');
    expect(db.deleted).toEqual(['u1']);
  });

  it('con revokeApple: false (aviso de Apple) no llama a Apple', async () => {
    const { users, f, db } = make(() => ({ status: 200 }));
    await users.deleteMe('u1', { revokeApple: false });
    expect(f.calls).toHaveLength(0);
    expect(db.deleted).toEqual(['u1']);
  });
});

describe('avisos servidor a servidor de Apple', () => {
  it('lee events como texto JSON o como objeto', () => {
    expect(parseAppleEvents(JSON.stringify({ type: 'consent-revoked', sub: 's1', event_time: 1 }))).toEqual({
      type: 'consent-revoked',
      subject: 's1',
    });
    expect(parseAppleEvents({ type: 'account-delete', sub: 's2' })).toEqual({ type: 'account-delete', subject: 's2' });
    // el nombre que usan los ejemplos de la documentación de Apple
    expect(parseAppleEvents({ type: 'account-deleted', sub: 's3' })).toEqual({ type: 'account-deleted', subject: 's3' });
  });

  it('rechaza events sin type o sin sub', () => {
    expect(() => parseAppleEvents(undefined)).toThrow();
    expect(() => parseAppleEvents('{"type":"account-delete"}')).toThrow();
    expect(() => parseAppleEvents('no es json')).toThrow();
  });
});
