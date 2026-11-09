import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { GoogleVerifier, type VerifiedIdentity } from '../../src/auth/verifiers';
import { unauthorized } from '../../src/common/errors';
import { PrismaService } from '../../src/prisma/prisma.service';
import { type BotResult, playBot } from './bot';

/**
 * Verificador de Google falso: acepta idTokens con la forma `fake:<sub>:<nombre>`.
 */
export class FakeGoogleVerifier extends GoogleVerifier {
  async verify(idToken: string): Promise<VerifiedIdentity> {
    const m = /^fake:([^:]+):(.*)$/.exec(idToken);
    if (!m) throw unauthorized('Token inválido', 'invalid_provider_token');
    return { subject: m[1], name: m[2] || null, email: `${m[1]}@example.com` };
  }
}

export interface TestUser {
  id: string;
  username: string;
  token: string;
  refreshToken: string;
}

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GoogleVerifier)
    .useClass(FakeGoogleVerifier)
    .compile();
  const app: INestApplication = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const prisma = app.get(PrismaService);
  const http = () => request(app.getHttpServer());

  /** Vacía todas las tablas. */
  async function reset() {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "BestScore", "Follow", "Run", "RefreshToken", "AuthIdentity", "User" RESTART IDENTITY CASCADE',
    );
  }

  async function login(sub: string, name: string, country?: string): Promise<TestUser> {
    const res = await http()
      .post('/auth/google')
      .send({ idToken: `fake:${sub}:${name}`, ...(country ? { country } : {}) })
      .expect(200);
    return {
      id: res.body.user.id,
      username: res.body.user.username,
      token: res.body.accessToken,
      refreshToken: res.body.refreshToken,
    };
  }

  /** Atrasa el inicio de una partida para que el reloj de pared alcance a la simulación del bot. */
  async function backdate(runId: string, minutes = 10) {
    await prisma.run.update({ where: { id: runId }, data: { startedAt: new Date(Date.now() - minutes * 60_000) } });
  }

  /**
   * Crea una partida, la juega con el bot y la envía.
   * `tamper` permite modificar lo que se envía (para probar trampas).
   */
  async function playRun(
    user: TestUser | null,
    opts: { kills?: number; tamper?: (g: BotResult) => Partial<BotResult>; backdateMin?: number } = {},
  ) {
    const auth = (r: request.Test) => (user ? r.set('Authorization', `Bearer ${user.token}`) : r);
    const start = await auth(http().post('/runs')).send({ fieldW: 390, fieldH: 640 }).expect(201);
    const { runId, seed, maxLives, claimToken } = start.body;
    if (opts.backdateMin !== 0) await backdate(runId, opts.backdateMin ?? 10);
    const game = playBot({ seed, maxLives, fieldW: 390, fieldH: 640 }, { kills: opts.kills ?? 5 });
    const sent = { ...game, ...(opts.tamper?.(game) ?? {}) };
    const finish = await auth(http().post(`/runs/${runId}/finish`)).send({
      inputs: sent.inputs,
      killed: sent.killed,
      missed: sent.missed,
      ...(claimToken ? { claimToken } : {}),
    });
    return { start: start.body, game, finish };
  }

  return { app, prisma, http, reset, login, backdate, playRun };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
export const bearer = (u: TestUser) => ({ Authorization: `Bearer ${u.token}` });
