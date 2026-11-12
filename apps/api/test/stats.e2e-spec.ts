import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RULES_VERSION, tierRefForTicks } from '@tb/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { backfillStreaks } from '../src/stats/backfill-streaks';
import { StatsService } from '../src/stats/stats.service';
import { type TestApp, bearer, createTestApp } from './helpers/app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
});
afterAll(async () => {
  await t?.app.close();
});

const EMPTY = { bestTicks: 0, bestStreak: 0, totalKilled: 0, totalRuns: 0, bonusXp: 0, bestDailyPct: null, dailyStreakBest: 0 };

/** Crea una partida terminada directamente en la base (para controlar ticks y fechas). */
function insertRun(data: { userId: string | null; status?: 'valid' | 'rejected'; killed: number; ticks: number; rulesVersion?: number }) {
  return t.prisma.run.create({
    data: {
      userId: data.userId,
      seed: 1,
      rulesVersion: data.rulesVersion ?? RULES_VERSION,
      maxLives: 5,
      fieldW: 390,
      fieldH: 640,
      status: data.status ?? 'valid',
      killed: data.killed,
      missed: 0,
      ticks: data.ticks,
      durationMs: Math.round((data.ticks * 1000) / 60),
      finishedAt: new Date(),
    },
  });
}

describe('estadísticas del jugador', () => {
  it('terminar con sesión las actualiza, guarda la racha y el motivo del final, y GET /me las muestra', async () => {
    const u = await t.login('st-1', 'Estela', 'CL');
    let me = await t.http().get('/me').set(bearer(u)).expect(200);
    expect(me.body.stats).toEqual(EMPTY);
    expect(me.body.tier).toBeNull();

    const a = await t.playRun(u, { kills: 6 });
    const runA = await t.prisma.run.findUniqueOrThrow({ where: { id: a.start.runId } });
    expect(runA).toMatchObject({ status: 'valid', mode: 'normal', endReason: 'vidas', config: null });
    expect(runA.bestStreak).toBeGreaterThanOrEqual(1);
    expect(a.finish.body).toMatchObject({ valid: true, isNewBest: true });
    expect(a.finish.body.stats).toEqual({
      ...EMPTY,
      bestTicks: runA.ticks,
      bestStreak: runA.bestStreak,
      totalKilled: 6,
      totalRuns: 1,
    });

    const b = await t.playRun(u, { kills: 2 });
    const runB = await t.prisma.run.findUniqueOrThrow({ where: { id: b.start.runId } });
    const expected = {
      ...EMPTY,
      bestTicks: Math.max(runA.ticks!, runB.ticks!),
      bestStreak: Math.max(runA.bestStreak!, runB.bestStreak!),
      totalKilled: 8,
      totalRuns: 2,
    };
    expect(b.finish.body.stats).toEqual(expected);
    me = await t.http().get('/me').set(bearer(u)).expect(200);
    expect(me.body.stats).toEqual(expected);
    expect(me.body.tier).toEqual(tierRefForTicks(expected.bestTicks));
    // el login también trae las estadísticas
    const login = await t.http().post('/auth/google').send({ idToken: 'fake:st-1:Estela' }).expect(200);
    expect(login.body.user.stats).toEqual(expected);
  });

  it('una partida rechazada no cuenta', async () => {
    const u = await t.login('st-2', 'Rechazo');
    const { finish } = await t.playRun(u, { kills: 3, tamper: (g) => ({ killed: g.killed + 9 }) });
    expect(finish.body.valid).toBe(false);
    expect(finish.body.stats).toBeUndefined();
    expect(await t.prisma.userStats.findUnique({ where: { userId: u.id } })).toBeNull();
  });

  it('reclamar una partida de invitado las actualiza (y la respuesta las trae)', async () => {
    const { start, finish } = await t.playRun(null, { kills: 4 });
    expect(finish.body.stats).toBeUndefined();
    const u = await t.login('st-3', 'Reclamo');
    const res = await t.http().post(`/runs/${start.runId}/claim`).set(bearer(u)).send({ claimToken: start.claimToken }).expect(200);
    const run = await t.prisma.run.findUniqueOrThrow({ where: { id: start.runId } });
    expect(res.body).toMatchObject({ valid: true, killed: 4, isNewBest: true });
    expect(res.body.stats).toEqual({ ...EMPTY, bestTicks: run.ticks, bestStreak: run.bestStreak, totalKilled: 4, totalRuns: 1 });
  });

  it('record es atómico con peticiones simultáneas', async () => {
    const u = await t.login('st-4', 'Concurrente');
    const stats = t.app.get(StatsService);
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => stats.record(u.id, { ticks: 100 + i, killed: 2, bestStreak: i, mode: 'normal' })),
    );
    // y algunas de reto, que no suben la mejor duración ni la racha
    await Promise.all(
      Array.from({ length: 5 }, () => stats.record(u.id, { ticks: 99_999, killed: 1, bestStreak: 999, mode: 'duel' })),
    );
    const row = await t.prisma.userStats.findUniqueOrThrow({ where: { userId: u.id } });
    expect(row).toMatchObject({ totalRuns: 30, totalKilled: 55, bestTicks: 124, bestStreak: 24 });
  });

  it('rankings y perfil público muestran la insignia', async () => {
    const u = await t.login('st-5', 'Insignia', 'CL');
    await t.playRun(u, { kills: 5 });
    const row = await t.prisma.userStats.findUniqueOrThrow({ where: { userId: u.id } });
    const tier = tierRefForTicks(row.bestTicks);
    const lb = await t.http().get('/leaderboards').query({ scope: 'world' }).set(bearer(u)).expect(200);
    const mine = lb.body.entries.find((e: { userId: string }) => e.userId === u.id);
    expect(mine.tier).toEqual(tier);
    expect(lb.body.me.tier).toEqual(tier);
    for (const e of lb.body.entries) expect(e.tier).toMatchObject({ tier: expect.any(String), step: expect.any(Number) });
    const profile = await t.http().get(`/users/${u.username}`).expect(200);
    expect(profile.body.tier).toEqual(tier);
    // sin partidas: sin insignia
    const nadie = await t.login('st-6', 'Sin Partidas');
    expect((await t.http().get(`/users/${nadie.username}`).expect(200)).body.tier).toBeNull();
  });
});

describe('relleno de estadísticas', () => {
  it('el relleno inicial de la migración suma las partidas válidas de cada cuenta', async () => {
    const a = await t.login('bf-a', 'Relleno A');
    const b = await t.login('bf-b', 'Relleno B');
    await insertRun({ userId: a.id, killed: 3, ticks: 100 });
    await insertRun({ userId: a.id, killed: 7, ticks: 500 });
    await insertRun({ userId: a.id, killed: 50, ticks: 9999, status: 'rejected' });
    await insertRun({ userId: a.id, killed: 2, ticks: 800, rulesVersion: RULES_VERSION - 1 });
    await insertRun({ userId: b.id, killed: 1, ticks: 50 });
    await insertRun({ userId: null, killed: 9, ticks: 900 });
    const before = await t.prisma.userStats.count();

    const sql = readFileSync(path.resolve('prisma/migrations/20261112044434_add_user_stats/migration.sql'), 'utf8');
    const insert = sql.slice(sql.indexOf('INSERT INTO "UserStats"'));
    expect(insert).toMatch(/ON CONFLICT \("userId"\) DO NOTHING;\s*$/);
    await t.prisma.$executeRawUnsafe(insert.trim().replace(/;$/, ''));

    expect(await t.prisma.userStats.findUnique({ where: { userId: a.id } })).toMatchObject({
      bestTicks: 800,
      bestStreak: 0,
      totalKilled: 12,
      totalRuns: 3,
      bonusXp: 0,
      bestDailyPct: null,
    });
    expect(await t.prisma.userStats.findUnique({ where: { userId: b.id } })).toMatchObject({ bestTicks: 50, totalKilled: 1, totalRuns: 1 });
    // las cuentas que ya tenían estadísticas no se tocan
    expect(await t.prisma.userStats.count()).toBe(before + 2);
  });

  it('el script de relleno de rachas repite las partidas de las reglas actuales (idempotente)', async () => {
    const u = await t.login('bf-c', 'Rachas');
    const r1 = await t.playRun(u, { kills: 8 });
    const r2 = await t.playRun(u, { kills: 3 });
    const ids = [r1.start.runId, r2.start.runId];
    const original = await t.prisma.run.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    const best = Math.max(...original.map((r) => r.bestStreak!));
    // como antes de la fase 2: sin racha guardada y UserStats en 0
    await t.prisma.run.updateMany({ where: { id: { in: ids } }, data: { bestStreak: null, endReason: null } });
    await t.prisma.userStats.update({ where: { userId: u.id }, data: { bestStreak: 0 } });
    // una partida de otras reglas no se puede repetir y queda como está
    const old = await insertRun({ userId: u.id, killed: 1, ticks: 60, rulesVersion: RULES_VERSION - 1 });
    // una que no coincide con su repetición tampoco se toca
    const bad = await t.playRun(u, { kills: 2 });
    await t.prisma.run.update({ where: { id: bad.start.runId }, data: { bestStreak: null, killed: 99 } });

    const dry = await backfillStreaks(t.prisma, { dryRun: true });
    expect(dry.updated).toBe(2);
    expect(await t.prisma.run.count({ where: { id: { in: ids }, bestStreak: null } })).toBe(2);

    const rep = await backfillStreaks(t.prisma, { batchSize: 1 });
    // las partidas insertadas a mano en el test anterior (sin toques) tampoco coinciden
    expect(rep).toMatchObject({ updated: 2, failed: 0 });
    expect(rep.mismatched).toBeGreaterThanOrEqual(1);
    expect(rep.usersUpdated).toBeGreaterThanOrEqual(1);
    expect((await t.prisma.run.findUniqueOrThrow({ where: { id: bad.start.runId } })).bestStreak).toBeNull();
    const after = await t.prisma.run.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } });
    expect(after.map((r) => [r.bestStreak, r.endReason])).toEqual(original.map((r) => [r.bestStreak, r.endReason]));
    expect((await t.prisma.userStats.findUniqueOrThrow({ where: { userId: u.id } })).bestStreak).toBe(best);
    expect((await t.prisma.run.findUniqueOrThrow({ where: { id: old.id } })).bestStreak).toBeNull();

    const again = await backfillStreaks(t.prisma);
    expect(again).toMatchObject({ updated: 0, usersUpdated: 0 });
  });
});

describe('compatibilidad con la web anterior', () => {
  it('POST /runs con solo { fieldW, fieldH } responde lo de antes más campos opcionales', async () => {
    const u = await t.login('cmp-1', 'Compat');
    const res = await t.http().post('/runs').set(bearer(u)).send({ fieldW: 390, fieldH: 640 }).expect(201);
    expect(Object.keys(res.body).sort()).toEqual(
      ['runId', 'seed', 'maxLives', 'rulesVersion', 'fieldW', 'fieldH', 'startedAt', 'mode', 'mods'].sort(),
    );
    expect(res.body).toMatchObject({ maxLives: 5, rulesVersion: RULES_VERSION, fieldW: 390, fieldH: 640, mode: 'normal', mods: null });
    const guest = await t.http().post('/runs').send({ fieldW: 412.5, fieldH: 700 }).expect(201);
    expect(guest.body).toMatchObject({ fieldW: 412.5, fieldH: 700, mode: 'normal', mods: null, claimToken: expect.any(String) });
    // modo normal explícito: igual
    await t.http().post('/runs').send({ fieldW: 390, fieldH: 640, mode: 'normal' }).expect(201);
    // modo desconocido o campos de otro modo
    await t.http().post('/runs').send({ fieldW: 390, fieldH: 640, mode: 'torneo' }).expect(400);
    const ch = await t.http().post('/runs').send({ fieldW: 390, fieldH: 640, challenge: 'ABCDEFGH' }).expect(400);
    expect(ch.body).toMatchObject({ code: 'validation_error', fields: [{ field: 'challenge', problems: ['mode'] }] });
    const d = await t.http().post('/runs').send({ fieldW: 390, fieldH: 640, mode: 'duel', date: '2026-11-12' }).expect(400);
    expect(d.body.fields[0].field).toBe('date');
  });

  it('terminar una partida normal responde lo de antes más stats', async () => {
    const u = await t.login('cmp-2', 'Compat Dos', 'AR');
    const { finish } = await t.playRun(u, { kills: 3 });
    expect(Object.keys(finish.body).sort()).toEqual(
      ['runId', 'valid', 'killed', 'missed', 'durationMs', 'isNewBest', 'newBestPeriods', 'ranks', 'stats'].sort(),
    );
    const { finish: guest } = await t.playRun(null, { kills: 2 });
    expect(Object.keys(guest.body).sort()).toEqual(['runId', 'valid', 'killed', 'missed', 'durationMs', 'claimable', 'claimExpiresAt'].sort());
  });
});
