import { type DayAgg, MISSIONS_POOL_FROM, RULES_VERSION, addDays, missionProgress, missionsFor } from '@tb/engine';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { utcDateKey } from '../src/common/dates';
import { MissionsService } from '../src/missions/missions.service';
import { type TestApp, type TestUser, bearer, createTestApp } from './helpers/app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
});
afterAll(async () => {
  await t?.app.close();
});

const today = utcDateKey(new Date());
const dayStart = Date.parse(`${today}T00:00:00Z`);

/** Partida válida terminada en `finishedAt` (directo en la base, para controlar la fecha). */
function insertRun(
  userId: string,
  d: { killed: number; ticks: number; bestStreak: number; finishedAt: Date; mode?: 'normal' | 'daily'; dailyDate?: string; config?: object },
) {
  return t.prisma.run.create({
    data: {
      userId,
      seed: 1,
      rulesVersion: RULES_VERSION,
      maxLives: 5,
      fieldW: 390,
      fieldH: 640,
      status: 'valid',
      killed: d.killed,
      missed: 0,
      ticks: d.ticks,
      bestStreak: d.bestStreak,
      finishedAt: d.finishedAt,
      mode: d.mode ?? 'normal',
      dailyDate: d.dailyDate ?? null,
      ...(d.config ? { config: d.config } : {}),
    },
  });
}

/**
 * Un día que cumple cualquier misión posible (las metas más altas del pool): 16 partidas, 601
 * bloques, racha 60, 400 s, el reto del día y un seguimiento nuevo.
 */
async function completeDay(user: TestUser, at: Date) {
  for (let i = 0; i < 15; i++) await insertRun(user.id, { killed: 40, ticks: 400 * 60, bestStreak: 60, finishedAt: at });
  await insertRun(user.id, { killed: 1, ticks: 60, bestStreak: 1, finishedAt: at, mode: 'daily', dailyDate: today });
  const other = await t.login(`seguido-${user.id}`, 'Seguido');
  await t.prisma.follow.create({ data: { followerId: user.id, followeeId: other.id, createdAt: at } });
}

describe('misiones del día', () => {
  it('requiere sesión y valida la fecha y la zona horaria', async () => {
    await t.http().get('/missions').expect(401);
    const u = await t.login('m-0', 'Mision Cero');
    expect((await t.http().get('/missions').query({ date: '2020-01-01' }).set(bearer(u)).expect(400)).body.code).toBe('invalid_date');
    expect((await t.http().get('/missions').query({ tz: 900 }).set(bearer(u)).expect(400)).body.code).toBe('validation_error');
    const res = await t.http().get('/missions').set(bearer(u)).expect(200);
    expect(res.body.date).toBe(today);
    expect(res.body.bonusXp).toBe(0);
    expect(res.body.missions.map((m: { id: string }) => m.id)).toEqual(missionsFor(today).map((m) => m.id));
    for (const [i, m] of missionsFor(today).entries()) {
      expect(res.body.missions[i]).toEqual({
        id: m.id,
        kind: m.kind,
        title: m.title,
        target: m.target,
        value: 0,
        done: false,
        reward: m.reward,
        rewarded: false,
      });
    }
  });

  it('todas cumplidas: se premian una sola vez (bonusXp)', async () => {
    const u = await t.login('m-1', 'Mision Uno');
    await completeDay(u, new Date(dayStart + 3600_000));

    const total = missionsFor(today).reduce((s, m) => s + m.reward, 0);
    const first = await t.http().get('/missions').query({ date: today, tz: 0 }).set(bearer(u)).expect(200);
    expect(first.body.missions).toHaveLength(3);
    for (const m of first.body.missions) expect(m).toMatchObject({ done: true, rewarded: true, value: m.target });
    expect(first.body.bonusXp).toBe(total);
    expect(await t.prisma.missionReward.count({ where: { userId: u.id } })).toBe(3);

    const again = await t.http().get('/missions').query({ date: today, tz: 0 }).set(bearer(u)).expect(200);
    expect(again.body.bonusXp).toBe(total);
    expect((await t.http().get('/me').set(bearer(u)).expect(200)).body.stats.bonusXp).toBe(total);
  });

  it('peticiones simultáneas no premian dos veces', async () => {
    const u = await t.login('m-2', 'Mision Dos');
    await completeDay(u, new Date(dayStart + 3600_000));
    await Promise.all(Array.from({ length: 6 }, () => t.http().get('/missions').query({ date: today }).set(bearer(u)).expect(200)));
    const total = missionsFor(today).reduce((s, m) => s + m.reward, 0);
    expect((await t.prisma.userStats.findUniqueOrThrow({ where: { userId: u.id } })).bonusXp).toBe(total);
  });

  it('avance con las partidas del día local; los modificadores no cuentan para la racha ni la duración', async () => {
    const u = await t.login('m-3', 'Mision Tres');
    // 01:00 UTC: es "hoy" en UTC, pero "ayer" en Chile (UTC−3)
    await insertRun(u.id, { killed: 7, ticks: 90 * 60, bestStreak: 6, finishedAt: new Date(dayStart + 3600_000) });
    // 05:00 UTC: hoy en las dos
    await insertRun(u.id, { killed: 3, ticks: 30 * 60, bestStreak: 2, finishedAt: new Date(dayStart + 5 * 3600_000) });
    // con modificador: suma partidas y bloques, pero no racha ni duración
    await insertRun(u.id, {
      killed: 20,
      ticks: 500 * 60,
      bestStreak: 99,
      finishedAt: new Date(dayStart + 6 * 3600_000),
      mode: 'daily',
      dailyDate: today,
      config: { startAt: 140 },
    });

    const expectFor = (agg: Omit<DayAgg, 'followedToday'>) =>
      missionsFor(today).map((m) => ({ id: m.id, ...missionProgress(m, { ...agg, followedToday: false }) }));
    const pick = (body: { missions: { id: string; value: number; done: boolean }[] }) =>
      body.missions.map((m) => ({ id: m.id, value: m.value, done: m.done }));

    const utc = await t.http().get('/missions').query({ date: today, tz: 0 }).set(bearer(u)).expect(200);
    expect(pick(utc.body)).toEqual(expectFor({ runs: 3, killed: 30, bestStreak: 6, maxTicks: 90 * 60, playedDaily: true }));
    const chile = await t.http().get('/missions').query({ date: today, tz: -180 }).set(bearer(u)).expect(200);
    expect(pick(chile.body)).toEqual(expectFor({ runs: 2, killed: 23, bestStreak: 2, maxTicks: 30 * 60, playedDaily: true }));
  });
});

describe('seguir a un jugador (misión follow)', () => {
  const followed = async (u: TestUser, date = today, tz = 0) =>
    (await t.app.get(MissionsService).dayAgg(u.id, date, tz)).followedToday;
  const follow = (a: TestUser, b: TestUser) => t.http().post(`/follows/${b.id}`).set(bearer(a)).expect(204);
  const unfollow = (a: TestUser, b: TestUser) => t.http().delete(`/follows/${b.id}`).set(bearer(a)).expect(204);
  const invitedBy = (guest: TestUser, host: TestUser) =>
    t.http().post('/me/inviter').set(bearer(guest)).send({ username: host.username }).expect(200);

  it('cuenta un seguimiento normal; ser seguido o haber dejado de seguir, no', async () => {
    const a = await t.login('f-a', 'Fol A');
    const b = await t.login('f-b', 'Fol B');
    expect(await followed(a)).toBe(false);
    await follow(a, b);
    expect(await followed(a)).toBe(true);
    expect(await followed(b)).toBe(false);
    await unfollow(a, b);
    expect(await followed(a)).toBe(false);
  });

  it('no cuenta los seguimientos de una invitación, ni hacia el invitador ni hacia el invitado', async () => {
    const host = await t.login('f-host', 'Fol Host');
    const guest = await t.login('f-guest', 'Fol Guest');
    await invitedBy(guest, host);
    expect(await t.prisma.follow.count({ where: { followerId: { in: [host.id, guest.id] } } })).toBe(2);
    expect(await followed(host)).toBe(false);
    expect(await followed(guest)).toBe(false);
    // volver a seguirse a mano tampoco cuenta
    for (const [x, y] of [
      [host, guest],
      [guest, host],
    ]) {
      await unfollow(x, y);
      await follow(x, y);
    }
    expect(await followed(host)).toBe(false);
    expect(await followed(guest)).toBe(false);
    // seguir a cualquier otro sí: alguien sin invitador, o invitado por otra persona
    const free = await t.login('f-free', 'Fol Free');
    const other = await t.login('f-other', 'Fol Other');
    const others = await t.login('f-others', 'Fol Others');
    await invitedBy(others, other);
    await follow(host, free);
    await follow(guest, others);
    expect(await followed(host)).toBe(true);
    expect(await followed(guest)).toBe(true);
  });

  it('solo los creados ese día local', async () => {
    const a = await t.login('f-d1', 'Fol Dia');
    const b = await t.login('f-d2', 'Fol Dos');
    await follow(a, b);
    const at = (ms: number) => t.prisma.follow.updateMany({ where: { followerId: a.id }, data: { createdAt: new Date(ms) } });
    await at(dayStart - 1);
    expect(await followed(a)).toBe(false);
    expect(await followed(a, addDays(today, -1))).toBe(true);
    // 01:00 UTC: hoy en UTC, ayer en Chile (UTC−3)
    await at(dayStart + 3600_000);
    expect(await followed(a, today, 0)).toBe(true);
    expect(await followed(a, today, -180)).toBe(false);
  });

  it('GET /missions premia la misión el día que sale', async () => {
    let date = MISSIONS_POOL_FROM;
    while (!missionsFor(date).some((m) => m.kind === 'follow')) date = addDays(date, 1);
    const now = new Date(`${date}T12:00:00Z`);
    vi.useFakeTimers({ toFake: ['Date'], now });
    try {
      const a = await t.login('f-m1', 'Fol Mision');
      const b = await t.login('f-m2', 'Fol Meta');
      const sigue = async () => {
        const res = await t.http().get('/missions').query({ date, tz: 0 }).set(bearer(a)).expect(200);
        return { mission: res.body.missions.find((m: { id: string }) => m.id === 'sigue'), bonusXp: res.body.bonusXp };
      };
      expect(await sigue()).toMatchObject({ mission: { kind: 'follow', value: 0, done: false, rewarded: false }, bonusXp: 0 });
      await follow(a, b);
      await t.prisma.follow.updateMany({ where: { followerId: a.id }, data: { createdAt: now } });
      expect(await sigue()).toMatchObject({ mission: { value: 1, done: true, rewarded: true, reward: 20 }, bonusXp: 20 });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('eliminar la cuenta', () => {
  it('borra estadísticas, resultados de retos y del reto diario, y premios; los retos que creó quedan sin creador', async () => {
    const u: TestUser = await t.login('del-1', 'Borrar Todo', 'CL');
    const other = await t.login('del-2', 'Se Queda');
    await t.playRun(u, { kills: 2 });
    const duel = await t.playRun(u, { kills: 3, body: { mode: 'duel' } });
    const code = duel.start.challengeCode as string;
    await t.playRun(other, { kills: 1, body: { mode: 'duel', challenge: code } });
    await t.playRun(u, { kills: 2, body: { mode: 'daily', date: today } });
    await t.prisma.missionReward.create({ data: { userId: u.id, date: today, missionId: 'juega3', reward: 20 } });

    const counts = async () => ({
      stats: await t.prisma.userStats.count({ where: { userId: u.id } }),
      entries: await t.prisma.challengeEntry.count({ where: { userId: u.id } }),
      daily: await t.prisma.dailyEntry.count({ where: { userId: u.id } }),
      rewards: await t.prisma.missionReward.count({ where: { userId: u.id } }),
      runs: await t.prisma.run.count({ where: { userId: u.id } }),
    });
    expect(await counts()).toEqual({ stats: 1, entries: 1, daily: 1, rewards: 1, runs: 3 });

    await t.http().delete('/me').set(bearer(u)).expect(204);
    expect(await counts()).toEqual({ stats: 0, entries: 0, daily: 0, rewards: 0, runs: 0 });
    const ch = await t.prisma.challenge.findUniqueOrThrow({ where: { code } });
    expect(ch.createdById).toBeNull();
    // el reto sigue jugable y conserva el resultado del otro jugador
    const view = await t.http().get(`/challenges/${code}`).expect(200);
    expect(view.body.entries).toEqual([expect.objectContaining({ username: 'se.queda', killed: 1 })]);
  });
});
