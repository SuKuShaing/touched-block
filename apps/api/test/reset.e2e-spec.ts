import { RULES_VERSION } from '@tb/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { utcDateKey } from '../src/common/dates';
import { RESET_ID, resetProgress } from '../src/maintenance/reset-progress';
import { type TestApp, type TestUser, bearer, createTestApp } from './helpers/app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t?.app.close();
});

const today = utcDateKey(new Date());
const OUTDATED = { statusCode: 409, code: 'client_outdated', message: 'Actualiza Touched Block para jugar el reto.' };

const run = (apply: boolean, log: string[] = []) => resetProgress(t.prisma, { apply, log: (m) => log.push(m) });

/** Todo lo que el reinicio borra o pone en cero. */
async function progress() {
  const p = t.prisma;
  return {
    runs: await p.run.findMany({ orderBy: { id: 'asc' } }),
    bestScores: await p.bestScore.findMany({ orderBy: [{ userId: 'asc' }, { periodType: 'asc' }] }),
    dailyEntries: await p.dailyEntry.findMany({ orderBy: [{ userId: 'asc' }, { date: 'asc' }] }),
    challenges: await p.challenge.findMany({ orderBy: { code: 'asc' } }),
    challengeEntries: await p.challengeEntry.findMany({ orderBy: { id: 'asc' } }),
    missionRewards: await p.missionReward.findMany({ orderBy: [{ userId: 'asc' }, { missionId: 'asc' }] }),
    userStats: await p.userStats.findMany({ orderBy: { userId: 'asc' } }),
    users: await p.user.findMany({ orderBy: { id: 'asc' } }),
  };
}

/** Lo que debe quedar igual. */
async function kept() {
  const p = t.prisma;
  return {
    users: (await p.user.findMany({ orderBy: { id: 'asc' } })).map(({ invitedById: _by, invitedAt: _at, ...u }) => u),
    identities: await p.authIdentity.findMany({ orderBy: { id: 'asc' } }),
    tokens: await p.refreshToken.findMany({ orderBy: { id: 'asc' } }),
    follows: await p.follow.findMany({ orderBy: [{ followerId: 'asc' }, { followeeId: 'asc' }] }),
    blocks: await p.block.findMany({ orderBy: [{ blockerId: 'asc' }, { blockedId: 'asc' }] }),
    reports: await p.report.findMany({ orderBy: { id: 'asc' } }),
    dailyChallenges: await p.dailyChallenge.findMany({ orderBy: { date: 'asc' } }),
  };
}

/** Dos cuentas con progreso de todos los tipos, una que no jugó, una invitada y partidas sin cuenta. */
async function seed() {
  await t.reset();
  const ana = await t.login('rs-a', 'Reset Ana', 'CL');
  const beto = await t.login('rs-b', 'Reset Beto', 'AR');
  const carla = await t.login('rs-c', 'Reset Carla');
  await t.http().post('/me/inviter').set(bearer(beto)).send({ username: ana.username }).expect(200);
  await t.playRun(ana, { kills: 4 });
  const duel = await t.playRun(ana, { kills: 3, body: { mode: 'duel' } });
  const code = duel.start.challengeCode as string;
  await t.playRun(beto, { kills: 2, body: { mode: 'duel', challenge: code } });
  await t.playRun(ana, { kills: 2, body: { mode: 'daily', date: today } });
  // una partida vieja de la misma cuenta: no cuenta en "últimos 7 días"
  await t.playRun(beto, { kills: 1 });
  await t.prisma.run.updateMany({ where: { userId: beto.id }, data: { startedAt: new Date(Date.now() - 30 * 86_400_000) } });
  const guest = await t.playRun(null, { kills: 5 });
  await t.prisma.missionReward.create({ data: { userId: ana.id, date: today, missionId: 'juega3', reward: 20 } });
  await t.prisma.userStats.update({ where: { userId: ana.id }, data: { bonusXp: 20, bestDailyPct: 90 } });
  await t.http().post(`/users/${beto.username}/report`).set(bearer(carla)).send({ reason: 'other' }).expect((r) => {
    if (r.status >= 300) throw new Error(`reporte: ${r.status}`);
  });
  await t.http().post(`/users/${beto.username}/block`).set(bearer(carla)).expect((r) => {
    if (r.status >= 300) throw new Error(`bloqueo: ${r.status}`);
  });
  return { ana, beto, carla, code, guest: guest.start as { runId: string; claimToken: string } };
}

const COUNTS = {
  users: 3,
  usersWithRuns: 2,
  usersWithRuns7d: 1,
  usersWithStats: 2,
  runsWithUser: 5,
  runsGuest: 1,
  dailyEntries: 1,
  challenges: 1,
  challengeEntries: 2,
  missionRewards: 1,
  invitations: 1,
};

describe('reinicio de registros (reset A)', () => {
  let s: Awaited<ReturnType<typeof seed>>;

  beforeAll(async () => {
    s = await seed();
    // una partida de invitado de las reglas anteriores, todavía por reclamar
    await t.prisma.run.update({ where: { id: s.guest.runId }, data: { rulesVersion: RULES_VERSION - 1 } });
  });

  it('la simulación cuenta y no cambia nada', async () => {
    const before = { progress: await progress(), kept: await kept() };
    const log: string[] = [];
    const report = await run(false, log);
    expect(report).toMatchObject({ applied: false, alreadyApplied: null, counts: COUNTS });
    expect(report.counts.bestScores).toBeGreaterThanOrEqual(4);
    expect(log).toContain('Partidas: 6 (con cuenta: 5, sin cuenta: 1)');
    expect(log).toContain('Cuentas con partidas: 2 (en los últimos 7 días: 1)');
    expect(log.at(-1)).toBe('Simulación: no se cambió nada.');
    expect({ progress: await progress(), kept: await kept() }).toEqual(before);
    expect(await t.prisma.dataReset.count()).toBe(0);
  });

  it('aplicar borra el progreso, pone las estadísticas en cero y conserva las cuentas', async () => {
    const before = await kept();
    expect(before.reports).toHaveLength(1);
    expect(before.blocks).toHaveLength(1);
    expect(before.follows).toHaveLength(2);
    expect(before.dailyChallenges).toHaveLength(1);

    const log: string[] = [];
    const report = await run(true, log);
    expect(report).toMatchObject({ applied: true, alreadyApplied: null, counts: COUNTS });
    expect(log.at(-1)).toMatch(/aplicado/);

    const after = await progress();
    expect(after).toMatchObject({ runs: [], bestScores: [], dailyEntries: [], challenges: [], challengeEntries: [], missionRewards: [] });
    expect(after.userStats).toHaveLength(2);
    for (const row of after.userStats) {
      expect(row).toMatchObject({ bestTicks: 0, bestStreak: 0, totalKilled: 0, totalRuns: 0, bonusXp: 0, bestDailyPct: null });
    }
    for (const u of after.users) expect(u).toMatchObject({ invitedById: null, invitedAt: null });
    expect(await kept()).toEqual(before);

    const mark = await t.prisma.dataReset.findUniqueOrThrow({ where: { id: RESET_ID } });
    expect(mark.details).toEqual(report.counts);
  });

  it('después: rankings vacíos, sesión viva, nada revive y se puede volver a indicar quién invitó', async () => {
    const { ana, beto, code, guest } = s;
    const me = await t.http().get('/me').set(bearer(ana)).expect(200);
    expect(me.body).toMatchObject({
      tier: null,
      maxLives: 5,
      stats: { bestTicks: 0, bestStreak: 0, totalKilled: 0, totalRuns: 0, bonusXp: 0, bestDailyPct: null, dailyStreakBest: 0 },
    });
    expect((await t.http().get('/leaderboards').expect(200)).body.total).toBe(0);
    expect((await t.http().get('/me/runs').set(bearer(ana)).expect(200)).body.runs).toEqual([]);
    // el porcentaje se recalcula desde DailyEntry: sin filas, no vuelve
    const daily = await t.http().get('/daily').query({ date: today }).set(bearer(ana)).expect(200);
    expect(daily.body).toMatchObject({ attemptsUsed: 0, best: null, total: 0 });
    expect((await t.http().get('/me').set(bearer(ana)).expect(200)).body.stats.bestDailyPct).toBeNull();
    await t.http().get(`/challenges/${code}`).expect(404);
    // una partida anterior reclamada tarde ya no existe
    const claim = await t.http().post(`/runs/${guest.runId}/claim`).set(bearer(ana)).send({ claimToken: guest.claimToken }).expect(404);
    expect(claim.body.code).toBe('run_not_found');
    await t.http().post('/auth/refresh').send({ refreshToken: ana.refreshToken }).expect(200);
    await t.http().post('/me/inviter').set(bearer(beto)).send({ username: ana.username }).expect(200);
  });

  it('una segunda aplicación no hace nada, aunque haya datos nuevos', async () => {
    const { ana } = s;
    await t.playRun(ana, { kills: 3 });
    await t.playRun(ana, { kills: 2, body: { mode: 'daily', date: today } });
    const before = { progress: await progress(), kept: await kept() };
    expect(before.progress.runs).toHaveLength(2);
    const mark = await t.prisma.dataReset.findUniqueOrThrow({ where: { id: RESET_ID } });

    for (const apply of [true, false]) {
      const log: string[] = [];
      const report = await run(apply, log);
      expect(report).toMatchObject({ applied: false, alreadyApplied: mark.appliedAt, counts: { runsWithUser: 2, invitations: 1 } });
      expect(log.at(-1)).toMatch(/ya se aplicó/);
    }
    expect({ progress: await progress(), kept: await kept() }).toEqual(before);
    expect(await t.prisma.dataReset.findMany()).toEqual([mark]);
  });

  it('dos aplicaciones a la vez: solo una borra', async () => {
    await seed();
    const both = await Promise.all([run(true), run(true)]);
    expect(both.map((r) => r.applied).sort()).toEqual([false, true]);
    expect(await t.prisma.run.count()).toBe(0);
    expect(await t.prisma.dataReset.count()).toBe(1);
  });
});

describe('clientes de reglas anteriores', () => {
  let u: TestUser;

  beforeAll(async () => {
    await t.reset();
    u = await t.login('old-1', 'Cliente Viejo');
  });

  const rows = async () => ({
    runs: await t.prisma.run.count(),
    challenges: await t.prisma.challenge.count(),
    daily: await t.prisma.dailyChallenge.count(),
  });

  it('reto diario y desafío sin la versión actual: 409 client_outdated, sin filas ni intentos gastados', async () => {
    for (const rulesVersion of [undefined, RULES_VERSION - 1, String(RULES_VERSION), null]) {
      for (const user of [u, null]) {
        for (const body of [
          { mode: 'daily', date: today },
          { mode: 'duel' },
          { mode: 'duel', challenge: 'ABCDEFGH' },
        ]) {
          const res = await t.startRun(user, { ...body, rulesVersion }).expect(409);
          expect(res.body).toEqual(OUTDATED);
        }
      }
    }
    expect(await rows()).toEqual({ runs: 0, challenges: 0, daily: 0 });
    const daily = await t.startRun(u, { mode: 'daily', date: today }).expect(201);
    expect(daily.body.daily.attemptsUsed).toBe(1);
  });

  it('tampoco se une a un desafío existente', async () => {
    const duel = await t.startRun(u, { mode: 'duel' }).expect(201);
    const before = await rows();
    await t.startRun(null, { mode: 'duel', challenge: duel.body.challengeCode, rulesVersion: undefined }).expect(409);
    expect(await rows()).toEqual(before);
    await t.startRun(null, { mode: 'duel', challenge: duel.body.challengeCode }).expect(201);
  });

  it('la partida normal empieza igual (la versión se ignora) y dice las reglas actuales', async () => {
    for (const body of [{}, { rulesVersion: RULES_VERSION - 1 }, { mode: 'normal' }, { rulesVersion: RULES_VERSION }]) {
      expect((await t.startRun(u, body).expect(201)).body.rulesVersion).toBe(RULES_VERSION);
    }
  });

  it('terminar una partida de las reglas anteriores se rechaza (rules_version)', async () => {
    const start = (await t.startRun(u).expect(201)).body;
    await t.prisma.run.update({ where: { id: start.runId }, data: { rulesVersion: RULES_VERSION - 1 } });
    const { finish } = await t.finishRun(u, start, { kills: 2 });
    expect(finish.body).toMatchObject({ valid: false, reason: 'rules_version' });
    expect((await t.http().get('/me').set(bearer(u)).expect(200)).body.stats.totalRuns).toBe(0);
  });
});
