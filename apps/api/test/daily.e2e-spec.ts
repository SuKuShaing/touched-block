import { DAILY_LIVES, addDays, dailyModsFor, dailyNumber } from '@tb/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isWithinDateWindow, utcDateKey } from '../src/common/dates';
import { DailyService, dailyClosesAt } from '../src/daily/daily.service';
import { RunsService } from '../src/runs/runs.service';
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
const yesterday = addDays(today, -1);
const rules = dailyModsFor(today);
const lives = rules.mods?.lives ?? DAILY_LIVES;
const number = dailyNumber(today);

type Start = { runId: string; seed: number; maxLives: number; fieldW: number; fieldH: number; mods: unknown; claimToken?: string };

describe('reto diario', () => {
  let ana: TestUser; // CL
  let beto: TestUser; // AR, sigue a Ana
  let carla: TestUser; // CL
  let seed: number;
  let abandoned: string;

  beforeAll(async () => {
    ana = await t.login('d-a', 'Ana', 'CL');
    beto = await t.login('d-b', 'Beto', 'AR');
    carla = await t.login('d-c', 'Carla', 'CL');
    await t.http().post(`/follows/${ana.id}`).set(bearer(beto)).expect(204);
  });

  it('GET /daily sin sesión: el reto de hoy, sin fijar todavía el campo', async () => {
    const res = await t.http().get('/daily').query({ date: today }).expect(200);
    expect(res.body).toEqual({
      date: today,
      number,
      title: rules.title,
      mods: rules.mods,
      fieldW: 360,
      fieldH: 540,
      attemptsMax: 1,
      attemptsUsed: 0,
      best: null,
      total: 0,
      streak: { current: 0, best: 0 },
      week: [],
      yesterday: null,
    });
    expect((await t.http().get('/daily').expect(200)).body.date).toBe(today);
    expect(await t.prisma.dailyChallenge.count()).toBe(0);
  });

  it('fechas: a no más de un día de la fecha UTC, obligatoria y solo en modo daily', async () => {
    for (const date of [addDays(today, 2), addDays(today, -2), '2026-02-30', 'hoy']) {
      expect((await t.startRun(ana, { mode: 'daily', date }).expect(400)).body.code).toBe('daily_date_invalid');
      expect((await t.http().get('/daily').query({ date }).expect(400)).body.code).toBe('daily_date_invalid');
    }
    // mañana solo se acepta si en alguna zona horaria real (UTC+14) ya es mañana: desde las 10:00 UTC
    const tomorrow = addDays(today, 1);
    const tomorrowOk = isWithinDateWindow(tomorrow, new Date());
    expect((await t.http().get('/daily').query({ date: tomorrow })).status).toBe(tomorrowOk ? 200 : 400);
    expect((await t.http().get('/daily/leaderboard').query({ date: tomorrow })).status).toBe(tomorrowOk ? 200 : 400);
    expect((await t.http().get('/daily/leaderboard').query({ date: addDays(today, 2) }).expect(400)).body.code).toBe('daily_date_invalid');
    expect((await t.startRun(ana, { mode: 'daily' }).expect(400)).body.code).toBe('daily_date_invalid');
    expect((await t.startRun(ana, { date: today }).expect(400)).body.code).toBe('validation_error');
    expect(await t.prisma.run.count({ where: { userId: ana.id } })).toBe(0);
  });

  it('3 intentos con cuenta, que se gastan al empezar; misma semilla y mismo campo para todos', async () => {
    const s1 = await t.startRun(ana, { mode: 'daily', date: today, fieldW: 412, fieldH: 915 }).expect(201);
    expect(s1.body).toMatchObject({
      mode: 'daily',
      mods: rules.mods,
      maxLives: lives,
      fieldW: 360,
      fieldH: 540,
      daily: { date: today, number, title: rules.title, attemptsMax: 3, attemptsUsed: 1 },
    });
    expect(s1.body.claimToken).toBeUndefined();
    seed = s1.body.seed;
    expect(await t.prisma.dailyChallenge.findUnique({ where: { date: today } })).toMatchObject({ fieldW: 360, fieldH: 540 });
    const run1 = await t.prisma.run.findUniqueOrThrow({ where: { id: s1.body.runId } });
    expect(run1).toMatchObject({ mode: 'daily', dailyDate: today, config: rules.mods, maxLives: lives });

    const f1 = await t.finishRun(ana, s1.body, { kills: 3 });
    expect(f1.finish.body).toMatchObject({
      valid: true,
      killed: 3,
      daily: {
        date: today,
        number,
        attemptsLeft: 2,
        isBestToday: true,
        rank: 1,
        total: 1,
        betterThanPct: 0,
        friends: { beaten: 0, total: 0 },
        streak: { current: 1, best: 1 },
      },
      stats: { totalRuns: 1, totalKilled: 3, bestTicks: 0, bestStreak: 0, dailyStreakBest: 1 },
    });
    expect(f1.finish.body.isNewBest).toBeUndefined();

    // el segundo intento se abandona: igual se gasta
    const s2 = await t.startRun(ana, { mode: 'daily', date: today }).expect(201);
    expect(s2.body).toMatchObject({ seed, daily: { attemptsUsed: 2 } });
    abandoned = s2.body.runId;

    const s3 = await t.startRun(ana, { mode: 'daily', date: today }).expect(201);
    expect(s3.body.daily.attemptsUsed).toBe(3);
    const f3 = await t.finishRun(ana, s3.body, { kills: 5 });
    expect(f3.finish.body.daily).toMatchObject({ attemptsLeft: 0, isBestToday: true, rank: 1, total: 1 });

    const s4 = await t.startRun(ana, { mode: 'daily', date: today }).expect(409);
    expect(s4.body).toMatchObject({ code: 'daily_attempts_exhausted', message: expect.stringMatching(/intentos/) });
    expect(await t.prisma.dailyEntry.findUnique({ where: { userId_date: { userId: ana.id, date: today } } })).toMatchObject({
      killed: 5,
      attempts: 3,
      country: 'CL',
      runId: s3.body.runId,
    });
  });

  it('intentos simultáneos no pasan de 3', async () => {
    const dani = await t.login('d-d', 'Dani');
    const all = await Promise.all(Array.from({ length: 6 }, () => t.startRun(dani, { mode: 'daily', date: today })));
    expect(all.map((r) => r.status).sort()).toEqual([201, 201, 201, 409, 409, 409]);
    expect(await t.prisma.run.count({ where: { userId: dani.id, mode: 'daily' } })).toBe(3);
  });

  it('un intento peor no reemplaza al mejor del día; amigos superados', async () => {
    const b1 = await t.startRun(beto, { mode: 'daily', date: today, fieldW: 320, fieldH: 480 }).expect(201);
    expect(b1.body).toMatchObject({ seed, fieldW: 360, fieldH: 540 });
    const f1 = await t.finishRun(beto, b1.body, { kills: 4 });
    expect(f1.finish.body.daily).toMatchObject({ isBestToday: true, rank: 2, total: 2, betterThanPct: 0, friends: { beaten: 0, total: 1 } });
    const f2 = await t.playRun(beto, { kills: 2, body: { mode: 'daily', date: today } });
    expect(f2.finish.body.daily).toMatchObject({ isBestToday: false, attemptsLeft: 1, rank: 2, total: 2 });
    expect(await t.prisma.dailyEntry.findUnique({ where: { userId_date: { userId: beto.id, date: today } } })).toMatchObject({
      killed: 4,
      attempts: 2,
      country: 'AR',
    });

    const ov = await t.http().get('/daily').query({ date: today }).set(bearer(ana)).expect(200);
    expect(ov.body).toMatchObject({
      attemptsMax: 3,
      attemptsUsed: 3,
      total: 2,
      best: { killed: 5, missed: 0, rank: 1, bestStreak: expect.any(Number), achievedAt: expect.any(String) },
      streak: { current: 1, best: 1 },
    });
  });

  it('ranking del día: mundo, país y amigos; no entra al ranking general', async () => {
    let res = await t.http().get('/daily/leaderboard').query({ date: today }).set(bearer(beto)).expect(200);
    expect(res.body).toMatchObject({ scope: 'world', date: today, number, total: 2, me: { rank: 2, killed: 4 } });
    expect(res.body.entries.map((e: { username: string }) => e.username)).toEqual(['ana', 'beto']);
    expect(res.body.entries[0]).toMatchObject({ rank: 1, userId: ana.id, country: 'CL', killed: 5, isMe: false, tier: { tier: 'madera', step: 1 } });
    expect(res.body.me.tier).toEqual({ tier: 'madera', step: 1 });

    res = await t.http().get('/daily/leaderboard').query({ date: today, scope: 'country' }).set(bearer(beto)).expect(200);
    expect(res.body).toMatchObject({ country: 'AR', total: 1, me: { rank: 1 } });
    res = await t.http().get('/daily/leaderboard').query({ date: today, scope: 'country', country: 'cl' }).set(bearer(beto)).expect(200);
    expect(res.body.entries.map((e: { username: string }) => e.username)).toEqual(['ana']);
    expect(res.body.me).toBeNull();
    res = await t.http().get('/daily/leaderboard').query({ date: today, scope: 'friends' }).set(bearer(beto)).expect(200);
    expect(res.body.entries.map((e: { username: string }) => e.username)).toEqual(['ana', 'beto']);
    await t.http().get('/daily/leaderboard').query({ date: today, scope: 'friends' }).expect(401);
    res = await t.http().get('/daily/leaderboard').query({ date: today }).expect(200);
    expect(res.body.me).toBeUndefined();
    expect(res.body.entries[0].isMe).toBeUndefined();
    res = await t.http().get('/daily/leaderboard').query({ date: '2026-01-01' }).expect(200);
    expect(res.body).toMatchObject({ total: 0, entries: [] });
    expect((await t.http().get('/daily/leaderboard').query({ date: 'ayer' }).expect(400)).body.code).toBe('daily_date_invalid');

    expect((await t.http().get('/leaderboards').expect(200)).body.total).toBe(0);
    expect((await t.http().get('/me/runs').set(bearer(ana)).expect(200)).body.runs).toEqual([]);
  });

  it('invitado: un intento, dónde habría quedado, y reclamar con y sin intentos', async () => {
    const g = await t.startRun(null, { mode: 'daily', date: today }).expect(201);
    expect(g.body).toMatchObject({ seed, claimToken: expect.any(String), daily: { attemptsMax: 1, attemptsUsed: 1 } });
    const { finish } = await t.finishRun(null, g.body as Start, { kills: 1 });
    expect(finish.body).toMatchObject({
      valid: true,
      claimable: true,
      daily: { date: today, number, rank: 3, total: 3, betterThanPct: 0 },
    });
    expect(Object.keys(finish.body.daily).sort()).toEqual(['betterThanPct', 'date', 'number', 'rank', 'total']);
    expect(await t.prisma.dailyEntry.count({ where: { date: today } })).toBe(2);

    const no = await t.http().post(`/runs/${g.body.runId}/claim`).set(bearer(ana)).send({ claimToken: g.body.claimToken }).expect(409);
    expect(no.body.code).toBe('daily_attempts_exhausted');
    expect((await t.prisma.run.findUniqueOrThrow({ where: { id: g.body.runId } })).userId).toBeNull();

    const ok = await t.http().post(`/runs/${g.body.runId}/claim`).set(bearer(carla)).send({ claimToken: g.body.claimToken }).expect(200);
    expect(ok.body).toMatchObject({
      valid: true,
      killed: 1,
      daily: { date: today, isBestToday: true, attemptsLeft: 2, rank: 3, total: 3 },
      stats: { totalRuns: 1, totalKilled: 1 },
    });
    expect(await t.prisma.dailyEntry.findUnique({ where: { userId_date: { userId: carla.id, date: today } } })).toMatchObject({
      killed: 1,
      country: 'CL',
      attempts: 1,
    });
  });

  it('reclamar: solo UNA partida diaria de invitado por cuenta y fecha, y solo si la cuenta no empezó el reto', async () => {
    // el ataque: N partidas de invitado con la misma semilla, para reclamar las mejores
    const guestRuns = [];
    for (const kills of [1, 4, 2]) {
      const g = await t.startRun(null, { mode: 'daily', date: today }).expect(201);
      expect(g.body.seed).toBe(seed);
      expect((await t.finishRun(null, g.body as Start, { kills })).finish.body.valid).toBe(true);
      guestRuns.push(g.body as Start);
    }
    const claim = (run: Start, user: TestUser) => t.http().post(`/runs/${run.runId}/claim`).set(bearer(user)).send({ claimToken: run.claimToken });

    const elena = await t.login('d-e', 'Elena');
    const ok = await claim(guestRuns[1], elena).expect(200);
    expect(ok.body).toMatchObject({ killed: 4, daily: { attemptsLeft: 2, isBestToday: true } });
    for (const other of [guestRuns[0], guestRuns[2]]) {
      const no = await claim(other, elena).expect(409);
      expect(no.body).toMatchObject({ code: 'daily_attempts_exhausted', message: expect.stringMatching(/invitado.*cuenta/) });
      expect((await t.prisma.run.findUniqueOrThrow({ where: { id: other.runId } })).userId).toBeNull();
    }
    // el flujo normal sigue: el intento de invitado fue el primero; le quedan 2 con la cuenta
    expect((await t.startRun(elena, { mode: 'daily', date: today }).expect(201)).body.daily.attemptsUsed).toBe(2);
    expect((await t.startRun(elena, { mode: 'daily', date: today }).expect(201)).body.daily.attemptsUsed).toBe(3);
    expect((await t.startRun(elena, { mode: 'daily', date: today }).expect(409)).body.code).toBe('daily_attempts_exhausted');
    expect(await t.prisma.run.count({ where: { userId: elena.id, mode: 'daily' } })).toBe(3);

    // una cuenta que ya empezó el reto de ese día no puede reclamar (aunque le queden intentos)
    const fede = await t.login('d-f', 'Fede');
    await t.startRun(fede, { mode: 'daily', date: today }).expect(201);
    expect((await claim(guestRuns[0], fede).expect(409)).body.code).toBe('daily_attempts_exhausted');

    // dos reclamos simultáneos de partidas distintas: solo uno pasa
    const gabi = await t.login('d-g', 'Gabi');
    const both = await Promise.all([claim(guestRuns[0], gabi), claim(guestRuns[2], gabi)]);
    expect(both.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await t.prisma.run.count({ where: { userId: gabi.id, mode: 'daily' } })).toBe(1);
  });

  it('ayer: mi posición, el total y el ganador; el mejor porcentaje se guarda solo cuando el día ya cerró', async () => {
    const players: TestUser[] = [];
    for (let i = 0; i < 10; i++) players.push(await t.login(`d-y${i}`, `Ayer ${i}`));
    const me = players[7]; // 8 bloques: 3.º de 10, mejor que 7 de los otros 9
    const entries = (date: string, killedOf: (i: number) => number, achievedAt: Date) =>
      t.prisma.dailyEntry.createMany({
        data: players.map((p, i) => ({ userId: p.id, date, killed: killedOf(i), missed: 0, ticks: 600, bestStreak: i, achievedAt })),
      });
    await entries(yesterday, (i) => i + 1, new Date(Date.now() - 86_400_000));
    // anteayer ya cerró siempre (cierra ayer a las 15:00 UTC)
    await entries(addDays(today, -2), (i) => i + 1, new Date(Date.now() - 2 * 86_400_000));

    const res = await t.http().get('/daily').query({ date: today }).set(bearer(me)).expect(200);
    expect(res.body.yesterday).toEqual({
      date: yesterday,
      rank: 3,
      total: 10,
      betterThanPct: 77,
      winner: { username: players[9].username, killed: 10 },
    });
    expect((await t.http().get('/me').set(bearer(me)).expect(200)).body.stats.bestDailyPct).toBe(77);

    // Con reloj fijo: un día todavía abierto no se guarda, aunque se pida la fecha de "mañana"
    // (válida para quien está en UTC+14). players[5]: 55 % el 10 (cerrado) y 100 % el 11 (abierto).
    const daily = t.app.get(DailyService);
    const p5 = players[5];
    await entries('2030-03-10', (i) => i + 1, new Date('2030-03-10T12:00:00Z'));
    await entries('2030-03-11', (i) => (i === 5 ? 11 : i + 1), new Date('2030-03-11T12:00:00Z'));
    expect(dailyClosesAt('2030-03-10').toISOString()).toBe('2030-03-11T15:00:00.000Z');
    const early = await daily.overview('2030-03-12', p5.id, new Date('2030-03-11T16:00:00Z'));
    expect(early.yesterday).toMatchObject({ date: '2030-03-11', rank: 1, betterThanPct: 100 });
    expect((await t.prisma.userStats.findUniqueOrThrow({ where: { userId: p5.id } })).bestDailyPct).toBe(55);
    await daily.overview('2030-03-12', p5.id, new Date('2030-03-12T14:59:59Z'));
    expect((await t.prisma.userStats.findUniqueOrThrow({ where: { userId: p5.id } })).bestDailyPct).toBe(55);
    await daily.overview('2030-03-12', p5.id, new Date('2030-03-12T15:00:00Z')); // el 11 cerró
    expect((await t.prisma.userStats.findUniqueOrThrow({ where: { userId: p5.id } })).bestDailyPct).toBe(100);

    // hoy (en curso) Ana va 1.ª, pero no se guarda nada hasta que cierre
    await t.http().get('/daily').query({ date: today }).set(bearer(ana)).expect(200);
    expect((await t.prisma.userStats.findUniqueOrThrow({ where: { userId: ana.id } })).bestDailyPct).toBeNull();

    // un día cerrado con menos de 10 jugadores solo cuenta como participación (0)
    await t.prisma.dailyEntry.create({
      data: { userId: ana.id, date: addDays(today, -4), killed: 9, missed: 0, ticks: 600, bestStreak: 9, achievedAt: new Date(Date.now() - 4 * 86_400_000) },
    });
    await t.http().get('/daily').query({ date: today }).set(bearer(ana)).expect(200);
    expect((await t.prisma.userStats.findUniqueOrThrow({ where: { userId: ana.id } })).bestDailyPct).toBe(0);

    // sin sesión: sin posición
    const anon = await t.http().get('/daily').query({ date: today }).expect(200);
    expect(anon.body.yesterday).toMatchObject({ rank: null, betterThanPct: null, total: 10 });
  });

  it('racha de días', async () => {
    await t.prisma.dailyEntry.createMany({
      data: [1, 2].map((d) => ({
        userId: ana.id,
        date: addDays(today, -d),
        killed: 1,
        missed: 0,
        ticks: 60,
        bestStreak: 1,
        achievedAt: new Date(Date.now() - d * 86_400_000),
      })),
    });
    const res = await t.http().get('/daily').query({ date: today }).set(bearer(ana)).expect(200);
    expect(res.body.streak).toEqual({ current: 3, best: 3 });
    // tira de la semana: días jugados en los 7 que terminan en `date` (el de hace 4 días también)
    expect(res.body.week).toEqual([addDays(today, -4), addDays(today, -2), yesterday, today]);
    // (con el servicio: después de las 12:00 UTC "ayer" ya no es una fecha válida para GET /daily)
    expect((await t.app.get(DailyService).overview(yesterday, ana.id)).week).toEqual([addDays(today, -4), addDays(today, -2), yesterday]);
    expect((await t.app.get(DailyService).overview(addDays(today, -3), ana.id)).week).toEqual([addDays(today, -4)]);
    expect((await t.app.get(DailyService).overview(addDays(today, -10), ana.id)).week).toEqual([]);
    expect((await t.http().get('/daily').query({ date: today }).expect(200)).body.week).toEqual([]);
    expect((await t.http().get('/me').set(bearer(ana)).expect(200)).body.stats.dailyStreakBest).toBe(3);
  });

  it('la limpieza conserva los intentos diarios abandonados de una cuenta hasta las 72 h', async () => {
    const guest = await t.startRun(null, { mode: 'daily', date: today }).expect(201);
    const normal = await t.startRun(carla, {}).expect(201);
    const hours = (h: number) => new Date(Date.now() - h * 3600_000);
    await t.prisma.run.updateMany({ where: { id: { in: [abandoned, guest.body.runId, normal.body.runId] } }, data: { startedAt: hours(25) } });
    await t.app.get(RunsService).cleanup();
    expect(await t.prisma.run.findUnique({ where: { id: abandoned } })).not.toBeNull();
    expect(await t.prisma.run.findUnique({ where: { id: guest.body.runId } })).toBeNull();
    expect(await t.prisma.run.findUnique({ where: { id: normal.body.runId } })).toBeNull();
    // el intento sigue gastado
    expect((await t.startRun(ana, { mode: 'daily', date: today }).expect(409)).body.code).toBe('daily_attempts_exhausted');

    // a las 72 h (la fecha ya cerró) se borra; las partidas diarias terminadas se conservan
    const finished = await t.prisma.run.findFirstOrThrow({ where: { userId: ana.id, mode: 'daily', status: 'valid' } });
    await t.prisma.run.updateMany({ where: { id: { in: [abandoned, finished.id] } }, data: { startedAt: hours(73) } });
    await t.app.get(RunsService).cleanup();
    expect(await t.prisma.run.findUnique({ where: { id: abandoned } })).toBeNull();
    expect(await t.prisma.run.findUnique({ where: { id: finished.id } })).not.toBeNull();
  });
});
