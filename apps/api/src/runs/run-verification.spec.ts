import { BASE_LIVES, RULES_VERSION, TICKS_PER_SECOND, type TapInput } from '@tb/engine';
import { describe, expect, it } from 'vitest';
import { playBot } from '../../test/helpers/bot';
import { type RunToVerify, WALL_CLOCK_SLACK_MS, exceedsRate, verifyRun } from './run-verification';

const FIELD = { fieldW: 390, fieldH: 640 };
const now = new Date('2026-11-09T12:00:00Z');
const run = (over: Partial<RunToVerify> = {}): RunToVerify => ({
  seed: 12345,
  maxLives: BASE_LIVES,
  ...FIELD,
  rulesVersion: RULES_VERSION,
  startedAt: new Date(now.getTime() - 10 * 60_000),
  ...over,
});

describe('exceedsRate', () => {
  const at = (...ticks: number[]): TapInput[] => ticks.map((t) => [t, 10, 10]);
  it('cuenta los toques dentro de la ventana', () => {
    expect(exceedsRate(at(0, 1, 2), 60, 3)).toBe(false);
    expect(exceedsRate(at(0, 1, 2, 3), 60, 3)).toBe(true);
    expect(exceedsRate(at(0, 30, 60, 90), 60, 2)).toBe(false);
    expect(exceedsRate([], 60, 0)).toBe(false);
  });
});

describe('verifyRun', () => {
  const r = run();
  const game = playBot({ seed: r.seed, maxLives: r.maxLives, ...FIELD }, { kills: 6 });

  it('el bot termina la partida', () => {
    expect(game.over).toBe(true);
    expect(game.killed).toBe(6);
  });

  it('acepta una partida honesta y devuelve la mejor racha y el motivo del final', () => {
    const v = verifyRun(r, game, now);
    expect(v).toEqual({
      valid: true,
      killed: 6,
      missed: game.missed,
      ticks: game.ticks,
      bestStreak: expect.any(Number),
      endReason: 'vidas',
    });
    expect(v.bestStreak).toBeGreaterThanOrEqual(1);
    expect(v.bestStreak).toBeLessThanOrEqual(6);
  });

  it('repite con los modificadores guardados en la partida (Run.config)', () => {
    const mods = { startAt: 140, lives: 3 };
    const g = playBot({ seed: r.seed, maxLives: 3, ...FIELD, mods }, { kills: 6 });
    expect(verifyRun(run({ maxLives: 3, config: mods }), g, now)).toMatchObject({ valid: true, killed: 6, missed: g.missed });
    // sin los modificadores es otra partida: no coincide
    expect(verifyRun(run({ maxLives: 3 }), g, now).valid).toBe(false);
  });

  it('rechaza un puntaje inflado', () => {
    const v = verifyRun(r, { ...game, killed: game.killed + 5 }, now);
    expect(v).toMatchObject({ valid: false, reason: 'mismatch', killed: 6 });
  });

  it('rechaza si la semilla no corresponde (toques de otra partida)', () => {
    const v = verifyRun(run({ seed: 999 }), game, now);
    expect(v.valid).toBe(false);
  });

  it('rechaza partidas enviadas más de 2 h después', () => {
    expect(verifyRun(run({ startedAt: new Date(now.getTime() - 2 * 3600_000 - 1) }), game, now)).toMatchObject({
      reason: 'expired',
    });
  });

  it('rechaza si la simulación dura más que el tiempo real', () => {
    const long = playBot({ seed: r.seed, maxLives: r.maxLives, ...FIELD }, { kills: 60 });
    expect(long.ticks).toBeGreaterThan(20 * 60);
    expect(verifyRun(run({ startedAt: new Date(now.getTime() - 10 * 60_000) }), long, now).valid).toBe(true);
    const v = verifyRun(run({ startedAt: new Date(now.getTime() - 1000) }), long, now);
    expect(v).toMatchObject({ valid: false, reason: 'not_finished' });
  });

  it('acepta una partida larga completa (bot perfecto, ~8–9 min) si el tiempo real alcanza', () => {
    // Sin tope de destruidos el bot juega hasta perder: con las reglas v2 eso toma varios minutos.
    const full = playBot({ seed: r.seed, maxLives: r.maxLives, ...FIELD });
    const playedMs = (full.ticks / TICKS_PER_SECOND) * 1000;
    expect(full.over).toBe(true);
    expect(playedMs).toBeGreaterThan(6 * 60_000);
    expect(playedMs).toBeLessThan(15 * 60_000);
    const atMs = (ms: number) => run({ startedAt: new Date(now.getTime() - ms) });
    // jugada en tiempo real (más unos segundos de red): válida
    expect(verifyRun(atMs(playedMs + 3_000), full, now)).toMatchObject({ valid: true, killed: full.killed });
    // dentro de la holgura de 5 s: válida
    expect(verifyRun(atMs(playedMs - WALL_CLOCK_SLACK_MS + 1_000), full, now).valid).toBe(true);
    // más rápida que el reloj real: rechazada
    expect(verifyRun(atMs(playedMs - WALL_CLOCK_SLACK_MS - 1_000), full, now)).toMatchObject({ reason: 'not_finished' });
  });

  it('rechaza otra versión de reglas', () => {
    expect(verifyRun(run({ rulesVersion: RULES_VERSION + 1 }), game, now)).toMatchObject({ reason: 'rules_version' });
  });

  it('rechaza toques inválidos, fuera del campo o demasiado rápidos', () => {
    expect(verifyRun(r, { ...game, inputs: [[5, 1, 1], [2, 1, 1]] }, now)).toMatchObject({ reason: 'invalid_inputs' });
    expect(verifyRun(r, { ...game, inputs: [[0, -5, 1]] }, now)).toMatchObject({ reason: 'out_of_bounds' });
    const spam: TapInput[] = Array.from({ length: 30 }, (_, i) => [i, 1, 1]);
    expect(verifyRun(r, { ...game, inputs: spam }, now)).toMatchObject({ reason: 'tap_rate' });
  });

  it('rechaza toques después del final', () => {
    const extra: TapInput[] = [...game.inputs, [game.ticks + 10, 1, 1]];
    expect(verifyRun(r, { ...game, inputs: extra }, now)).toMatchObject({ reason: 'unused_inputs' });
  });
});
