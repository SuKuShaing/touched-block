import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RULES_VERSION } from '@tb/engine';
import { RunsService } from '../src/runs/runs.service';
import { type TestApp, bearer, createTestApp } from './helpers/app';

let t: TestApp;

beforeAll(async () => {
  t = await createTestApp();
  await t.reset();
});
afterAll(async () => {
  await t?.app.close();
});

describe('partidas', () => {
  it('una partida válida se acepta y queda como récord en los 4 períodos', async () => {
    const u = await t.login('r-1', 'Rita', 'CL');
    const { start, game, finish } = await t.playRun(u, { kills: 5 });
    expect(start).toMatchObject({ maxLives: 5, rulesVersion: RULES_VERSION });
    expect(start.claimToken).toBeUndefined();
    expect(finish.status).toBe(200);
    expect(finish.body).toMatchObject({
      valid: true,
      killed: 5,
      missed: game.missed,
      isNewBest: true,
      newBestPeriods: ['week', 'month', 'year', 'all'],
      ranks: { world: 1, country: 1 },
    });
    const run = await t.prisma.run.findUnique({ where: { id: start.runId } });
    expect(run?.status).toBe('valid');

    // una peor no reemplaza el récord
    const worse = await t.playRun(u, { kills: 2 });
    expect(worse.finish.body).toMatchObject({ valid: true, killed: 2, isNewBest: false, newBestPeriods: [] });

    const hist = await t.http().get('/me/runs').query({ period: 'week' }).set(bearer(u)).expect(200);
    expect(hist.body.runs).toHaveLength(2);
    expect(hist.body.best).toMatchObject({ killed: 5, runId: start.runId });
    expect(hist.body.runs.find((r: { isBest: boolean }) => r.isBest).id).toBe(start.runId);
  });

  it('una partida manipulada (destruidos inflados) se rechaza', async () => {
    const u = await t.login('r-2', 'Tramposo');
    const { start, game, finish } = await t.playRun(u, { kills: 3, tamper: (g) => ({ killed: g.killed + 50 }) });
    expect(finish.status).toBe(200);
    expect(finish.body).toMatchObject({ valid: false, reason: 'mismatch', killed: game.killed });
    expect(finish.body.message).toMatch(/no coincide/);
    const run = await t.prisma.run.findUnique({ where: { id: start.runId } });
    expect(run).toMatchObject({ status: 'rejected', rejectReason: 'mismatch' });
    expect(await t.prisma.bestScore.count({ where: { userId: u.id } })).toBe(0);
  });

  it('rechaza una partida simulada más larga que el tiempo real', async () => {
    const u = await t.login('r-3', 'Rapido');
    const { finish } = await t.playRun(u, { kills: 40, backdateMin: 0 });
    expect(finish.body).toMatchObject({ valid: false, reason: 'not_finished' });
  });

  it('acepta una partida larga completa (bot sin tope, ~8–9 min simulados)', async () => {
    const u = await t.login('r-3b', 'Larga');
    // backdate de 12 min: el reloj real alcanza a la simulación del bot
    const { game, finish } = await t.playRun(u, { kills: Infinity, backdateMin: 12 });
    expect(game.ticks / 60).toBeGreaterThan(6 * 60);
    expect(finish.body).toMatchObject({ valid: true, killed: game.killed, missed: game.missed });
  });

  it('no se puede terminar dos veces ni terminar la de otro', async () => {
    const u = await t.login('r-4', 'Uno');
    const other = await t.login('r-5', 'Otro');
    const { start } = await t.playRun(u, { kills: 1 });
    const again = await t.http().post(`/runs/${start.runId}/finish`).set(bearer(u)).send({ inputs: [], killed: 0, missed: 0 });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('run_already_finished');

    const s2 = await t.http().post('/runs').set(bearer(u)).send({ fieldW: 390, fieldH: 640 }).expect(201);
    const steal = await t.http().post(`/runs/${s2.body.runId}/finish`).set(bearer(other)).send({ inputs: [], killed: 0, missed: 0 });
    expect(steal.status).toBe(403);
    await t.http().post('/runs/no-es-uuid/finish').send({ inputs: [], killed: 0, missed: 0 }).expect(404);
  });

  it('valida el tamaño del campo', async () => {
    const res = await t.http().post('/runs').send({ fieldW: 50, fieldH: 640 }).expect(400);
    expect(res.body.fields[0].field).toBe('fieldW');
  });
});

describe('partida de invitado', () => {
  it('se juega sin sesión y se reclama después de iniciar sesión', async () => {
    const { start, finish } = await t.playRun(null, { kills: 6 });
    expect(start).toMatchObject({ maxLives: 5 });
    expect(typeof start.claimToken).toBe('string');
    expect(finish.body).toMatchObject({ valid: true, killed: 6, claimable: true });
    expect(finish.body.ranks).toBeUndefined();

    const u = await t.login('guest-1', 'Invitada', 'PE');
    // claimToken equivocado
    const bad = await t.http().post(`/runs/${start.runId}/claim`).set(bearer(u)).send({ claimToken: 'x'.repeat(43) });
    expect(bad.status).toBe(403);
    // sin sesión
    await t.http().post(`/runs/${start.runId}/claim`).send({ claimToken: start.claimToken }).expect(401);

    const ok = await t.http().post(`/runs/${start.runId}/claim`).set(bearer(u)).send({ claimToken: start.claimToken }).expect(200);
    expect(ok.body).toMatchObject({ valid: true, killed: 6, isNewBest: true, ranks: { world: expect.any(Number), country: 1 } });
    const run = await t.prisma.run.findUnique({ where: { id: start.runId } });
    expect(run?.userId).toBe(u.id);

    // no se puede reclamar dos veces
    const twice = await t.http().post(`/runs/${start.runId}/claim`).set(bearer(u)).send({ claimToken: start.claimToken });
    expect(twice.status).toBe(409);
  });

  it('terminar sin claimToken falla; una partida rechazada no se puede reclamar', async () => {
    const s = await t.http().post('/runs').send({ fieldW: 390, fieldH: 640 }).expect(201);
    const no = await t.http().post(`/runs/${s.body.runId}/finish`).send({ inputs: [], killed: 0, missed: 0 });
    expect(no.status).toBe(403);
    expect(no.body.code).toBe('invalid_claim_token');

    const { start, finish } = await t.playRun(null, { kills: 2, tamper: () => ({ missed: 99 }) });
    expect(finish.body).toMatchObject({ valid: false, reason: 'mismatch' });
    const u = await t.login('guest-2', 'Otra');
    const res = await t.http().post(`/runs/${start.runId}/claim`).set(bearer(u)).send({ claimToken: start.claimToken });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('run_not_valid');
  });

  it('no se puede reclamar después de 1 hora', async () => {
    const { start } = await t.playRun(null, { kills: 1 });
    await t.prisma.run.update({ where: { id: start.runId }, data: { finishedAt: new Date(Date.now() - 61 * 60_000) } });
    const u = await t.login('guest-3', 'Tarde');
    const res = await t.http().post(`/runs/${start.runId}/claim`).set(bearer(u)).send({ claimToken: start.claimToken });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('claim_expired');
  });

  it('la limpieza borra partidas de invitado de más de 24 h', async () => {
    const { start } = await t.playRun(null, { kills: 1 });
    await t.prisma.run.update({ where: { id: start.runId }, data: { startedAt: new Date(Date.now() - 25 * 3600_000) } });
    const r = await t.app.get(RunsService).cleanup();
    expect(r.runs).toBeGreaterThanOrEqual(1);
    expect(await t.prisma.run.findUnique({ where: { id: start.runId } })).toBeNull();
  });
});
