import { RULES_VERSION, tierRefForTicks } from '@tb/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { COMMON_FIELD, CommonFieldService } from '../src/runs/common-field.service';
import { type TestApp, type TestUser, bearer, createTestApp } from './helpers/app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
});
afterAll(async () => {
  await t?.app.close();
});

const CODE_RE = /^[A-HJKMNP-Z2-9]{8}$/;
const FALLBACK = COMMON_FIELD.fallback; // pocos datos en la base de tests: 360 × 540

describe('campo común', () => {
  it('con menos de 200 partidas usa 360 × 540; con más, el percentil 5 de las partidas normales válidas', async () => {
    const field = t.app.get(CommonFieldService);
    field.invalidate();
    expect(await field.get()).toEqual(FALLBACK);

    // 200 partidas: 190 de 400 × 700 y 10 de 330 × 500, más retos que no cuentan
    const base = { seed: 1, rulesVersion: RULES_VERSION, maxLives: 5, status: 'valid' as const, killed: 1, missed: 0, ticks: 60 };
    await t.prisma.run.createMany({
      data: [
        ...Array.from({ length: 190 }, () => ({ ...base, fieldW: 400, fieldH: 700 })),
        ...Array.from({ length: 10 }, () => ({ ...base, fieldW: 330, fieldH: 500 })),
        ...Array.from({ length: 50 }, () => ({ ...base, fieldW: 200, fieldH: 200, mode: 'duel' as const })),
        ...Array.from({ length: 50 }, () => ({ ...base, fieldW: 200, fieldH: 200, status: 'rejected' as const })),
      ],
    });
    const sample = await field.sample();
    expect(sample.runs).toBe(200);
    // percentile_cont(0.05) con 200 valores: posición 9,95 entre 330 (índice 9) y 400 (índice 10)
    expect(sample.w).toBeCloseTo(330 + 0.95 * 70, 6);
    expect(sample.h).toBeCloseTo(500 + 0.95 * 200, 6);
    field.invalidate();
    expect(await field.get()).toEqual({ fieldW: 396, fieldH: 690 });

    await t.prisma.run.deleteMany({ where: { userId: null } });
    field.invalidate();
    expect(await field.get()).toEqual(FALLBACK);
  });
});

describe('reto a un amigo', () => {
  let ana: TestUser;
  let beto: TestUser;
  let carla: TestUser;
  let code: string;
  let seed: number;
  /** Partida de invitado de "unirse", que después reclama Carla. */
  let guestRun: { runId: string; claimToken: string };

  beforeAll(async () => {
    ana = await t.login('ch-a', 'Ana', 'CL');
    beto = await t.login('ch-b', 'Beto', 'AR');
    carla = await t.login('ch-c', 'Carla', 'CL');
    // a Ana la invitaron dos amigos: igual juega el reto con 5 vidas
    for (const sub of ['ch-i1', 'ch-i2']) {
      const g = await t.login(sub, `Invitado ${sub}`);
      await t.http().post('/me/inviter').set(bearer(g)).send({ username: ana.username }).expect(200);
    }
  });

  it('crear: semilla nueva, 5 vidas y campo = el menor entre el del creador y el común', async () => {
    const s = await t.startRun(ana, { mode: 'duel', fieldW: 412, fieldH: 915 }).expect(201);
    expect(s.body).toMatchObject({
      mode: 'duel',
      mods: null,
      maxLives: 5,
      rulesVersion: RULES_VERSION,
      fieldW: FALLBACK.fieldW,
      fieldH: FALLBACK.fieldH,
      challenge: { creator: null },
    });
    expect(s.body.claimToken).toBeUndefined();
    expect(s.body.challengeCode).toMatch(CODE_RE);
    expect(s.body.challenge.code).toBe(s.body.challengeCode);
    const days = (Date.parse(s.body.challenge.expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
    code = s.body.challengeCode;
    seed = s.body.seed;
    const ch = await t.prisma.challenge.findUniqueOrThrow({ where: { code } });
    expect(ch).toMatchObject({ seed, fieldW: 360, fieldH: 540, rulesVersion: RULES_VERSION, createdById: ana.id, creatorRunId: s.body.runId });

    // un creador con pantalla más chica que el campo común juega su propio campo
    const small = await t.startRun(beto, { mode: 'duel', fieldW: 330, fieldH: 500 }).expect(201);
    expect(small.body).toMatchObject({ fieldW: 330, fieldH: 500 });
    expect(small.body.seed === seed && small.body.challengeCode === code).toBe(false);

    // Ana termina su partida del reto
    const { finish } = await t.finishRun(ana, s.body, { kills: 4 });
    expect(finish.status).toBe(200);
    expect(finish.body).toMatchObject({ valid: true, killed: 4, stats: { totalRuns: 1, totalKilled: 4, bestTicks: 0, bestStreak: 0 } });
    expect(finish.body.isNewBest).toBeUndefined();
    expect(finish.body.ranks).toBeUndefined();
    expect(finish.body.challenge).toMatchObject({ code, playable: true, fieldW: 360, fieldH: 540 });
    expect(finish.body.challenge.entries).toEqual([
      { username: 'ana', tier: tierRefForTicks(0), killed: 4, missed: 0, isMe: true, isCreator: true, createdAt: expect.any(String) },
    ]);
  });

  it('no entra a los rankings, al récord ni al historial (D6)', async () => {
    expect(await t.prisma.bestScore.count({ where: { userId: ana.id } })).toBe(0);
    const lb = await t.http().get('/leaderboards').set(bearer(ana)).expect(200);
    expect(lb.body.total).toBe(0);
    expect(lb.body.me).toBeNull();
    const hist = await t.http().get('/me/runs').set(bearer(ana)).expect(200);
    expect(hist.body.runs).toEqual([]);
  });

  it('unirse desde una pantalla más grande y desde una más chica: misma semilla y mismo campo', async () => {
    const big = await t.startRun(beto, { mode: 'duel', challenge: ` ${code.toLowerCase()} `, fieldW: 412, fieldH: 915 }).expect(201);
    const small = await t.startRun(null, { mode: 'duel', challenge: code, fieldW: 320, fieldH: 480 }).expect(201);
    for (const s of [big.body, small.body]) {
      expect(s).toMatchObject({ seed, maxLives: 5, fieldW: 360, fieldH: 540, mode: 'duel', mods: null, challengeCode: code });
      expect(s.challenge).toEqual({
        code,
        expiresAt: expect.any(String),
        creator: { username: 'ana', tier: tierRefForTicks(0), killed: 4, missed: 0 },
      });
    }
    expect(small.body.claimToken).toEqual(expect.any(String));

    // misma partida: hasta su segundo bloque destruido, el bot toca exactamente lo mismo en las dos
    const b = await t.finishRun(beto, big.body, { kills: 6 });
    const g = await t.finishRun(null, small.body, { kills: 2 });
    const k = g.game.inputs.findIndex(([, x, y]) => x === 1 && y === 1);
    expect(k).toBeGreaterThan(0);
    expect(g.game.inputs.slice(0, k)).toEqual(b.game.inputs.slice(0, k));
    expect(b.finish.body).toMatchObject({ valid: true, killed: 6 });
    expect(b.finish.body.challenge.entries.map((e: { username: string | null; killed: number }) => [e.username, e.killed])).toEqual([
      ['beto', 6],
      ['ana', 4],
    ]);
    expect(g.finish.body).toMatchObject({ valid: true, killed: 2, claimable: true });
    const guestEntries = g.finish.body.challenge.entries as { username: string | null; killed: number; isMe: boolean }[];
    expect(guestEntries.filter((e) => e.isMe)).toEqual([expect.objectContaining({ username: null, killed: 2 })]);

    const view = await t.http().get(`/challenges/${code}`).set(bearer(beto)).expect(200);
    expect(view.body).toMatchObject({ code, playable: true, fieldW: 360, fieldH: 540, expiresAt: expect.any(String) });
    const killed = view.body.entries.map((e: { killed: number }) => e.killed);
    expect(killed).toEqual([...killed].sort((x: number, y: number) => y - x));
    expect(view.body.entries.filter((e: { isMe: boolean }) => e.isMe)).toEqual([expect.objectContaining({ username: 'beto', killed: 6, isCreator: false })]);
    expect(view.body.entries.find((e: { isCreator: boolean }) => e.isCreator)).toMatchObject({ username: 'ana' });

    // un invitado ve su resultado marcado si pasa su partida
    const asGuest = await t.http().get(`/challenges/${code.toLowerCase()}`).query({ runId: small.body.runId }).expect(200);
    expect(asGuest.body.entries.filter((e: { isMe: boolean }) => e.isMe)).toEqual([expect.objectContaining({ username: null, killed: 2 })]);
    guestRun = small.body;
  });

  it('con cuenta cuenta solo el primer intento', async () => {
    const again = await t.playRun(beto, { kills: 9, body: { mode: 'duel', challenge: code } });
    expect(again.finish.body).toMatchObject({ valid: true, killed: 9 });
    const mine = again.finish.body.challenge.entries.filter((e: { isMe: boolean }) => e.isMe);
    expect(mine).toEqual([expect.objectContaining({ username: 'beto', killed: 6 })]);
    expect(await t.prisma.challengeEntry.count({ where: { challengeCode: code, userId: beto.id } })).toBe(1);
    // igual suma a las estadísticas
    const me = await t.http().get('/me').set(bearer(beto)).expect(200);
    expect(me.body.stats).toMatchObject({ totalKilled: 15, totalRuns: 2, bestTicks: 0 });
  });

  it('un invitado que reclama su partida: el resultado pasa a su cuenta', async () => {
    const res = await t.http().post(`/runs/${guestRun.runId}/claim`).set(bearer(carla)).send({ claimToken: guestRun.claimToken }).expect(200);
    expect(res.body).toMatchObject({ valid: true, killed: 2, stats: { totalRuns: 1, totalKilled: 2 } });
    expect(res.body.isNewBest).toBeUndefined();
    expect(res.body.challenge.entries.filter((e: { isMe: boolean }) => e.isMe)).toEqual([
      expect.objectContaining({ username: 'carla', killed: 2, tier: tierRefForTicks(0) }),
    ]);
    expect(await t.prisma.challengeEntry.count({ where: { runId: guestRun.runId, userId: carla.id } })).toBe(1);
  });

  it('si ya tenía un resultado en el reto, al reclamar queda el del primer intento', async () => {
    const before = await t.prisma.challengeEntry.count({ where: { challengeCode: code } });
    const { start } = await t.playRun(null, { kills: 12, body: { mode: 'duel', challenge: code } });
    const res = await t.http().post(`/runs/${start.runId}/claim`).set(bearer(beto)).send({ claimToken: start.claimToken }).expect(200);
    expect(res.body.challenge.entries.filter((e: { isMe: boolean }) => e.isMe)).toEqual([expect.objectContaining({ username: 'beto', killed: 6 })]);
    expect(await t.prisma.challengeEntry.count({ where: { challengeCode: code } })).toBe(before);

    // al revés: el intento de invitado fue el primero y después jugó con cuenta
    const dani = await t.login('ch-d', 'Dani');
    const first = await t.playRun(null, { kills: 3, body: { mode: 'duel', challenge: code } });
    await t.playRun(dani, { kills: 7, body: { mode: 'duel', challenge: code } });
    const claim = await t.http().post(`/runs/${first.start.runId}/claim`).set(bearer(dani)).send({ claimToken: first.start.claimToken }).expect(200);
    expect(claim.body.challenge.entries.filter((e: { isMe: boolean }) => e.isMe)).toEqual([expect.objectContaining({ username: 'dani', killed: 3 })]);
    expect(await t.prisma.challengeEntry.count({ where: { challengeCode: code, userId: dani.id } })).toBe(1);
  });

  it('un invitado que crea un reto y lo reclama queda como su creador', async () => {
    const { start, finish } = await t.playRun(null, { kills: 5, body: { mode: 'duel' } });
    expect(finish.body.challenge.entries).toEqual([expect.objectContaining({ username: null, isCreator: true, isMe: true, killed: 5 })]);
    const join = await t.startRun(null, { mode: 'duel', challenge: start.challengeCode }).expect(201);
    expect(join.body.challenge.creator).toEqual({ username: null, tier: null, killed: 5, missed: 0 });
    const eva = await t.login('ch-e', 'Eva');
    await t.http().post(`/runs/${start.runId}/claim`).set(bearer(eva)).send({ claimToken: start.claimToken }).expect(200);
    expect((await t.prisma.challenge.findUniqueOrThrow({ where: { code: start.challengeCode } })).createdById).toBe(eva.id);
    const again = await t.startRun(null, { mode: 'duel', challenge: start.challengeCode }).expect(201);
    expect(again.body.challenge.creator).toMatchObject({ username: 'eva', killed: 5 });
  });

  it('reto inexistente, vencido o de otras reglas', async () => {
    for (const bad of ['ZZZZZZZZ', 'no-es-un-código', 'K7M2QX']) {
      const res = await t.startRun(null, { mode: 'duel', challenge: bad }).expect(404);
      expect(res.body.code).toBe('challenge_not_found');
      expect((await t.http().get(`/challenges/${encodeURIComponent(bad)}`).expect(404)).body.code).toBe('challenge_not_found');
    }

    await t.prisma.challenge.update({ where: { code }, data: { expiresAt: new Date(Date.now() - 1000) } });
    let res = await t.startRun(null, { mode: 'duel', challenge: code }).expect(410);
    expect(res.body).toMatchObject({ code: 'challenge_expired', message: expect.stringMatching(/venció/) });
    const view = await t.http().get(`/challenges/${code}`).expect(200);
    expect(view.body.playable).toBe(false);
    expect(view.body.entries.length).toBeGreaterThan(0);

    await t.prisma.challenge.update({ where: { code }, data: { expiresAt: new Date(Date.now() + 86_400_000), rulesVersion: RULES_VERSION - 1 } });
    res = await t.startRun(null, { mode: 'duel', challenge: code }).expect(410);
    expect(res.body.code).toBe('challenge_expired');
    expect((await t.http().get(`/challenges/${code}`).expect(200)).body.playable).toBe(false);
  });
});
