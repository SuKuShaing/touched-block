import {
  type EndReason,
  type GameMods,
  InvalidInputsError,
  MAX_REPLAY_TICKS,
  RULES_VERSION,
  TICKS_PER_SECOND,
  type TapInput,
  replay,
  validateInputs,
} from '@tb/engine';

/** Tiempo máximo entre crear la partida y enviarla. */
export const MAX_RUN_AGE_MS = 2 * 60 * 60 * 1000;
/** Holgura para el reloj de pared al comparar con la duración simulada. */
export const WALL_CLOCK_SLACK_MS = 5_000;
/** Toques por segundo sostenidos como máximo (ventana de 3 s). */
export const MAX_TAPS_PER_SEC = 15;
export const RATE_WINDOW_TICKS = 3 * TICKS_PER_SECOND;
/** Ráfaga máxima en 1 s. */
export const MAX_BURST_PER_SEC = 25;
export const MAX_INPUTS = 50_000;

export type RejectReason =
  | 'rules_version'
  | 'expired'
  | 'invalid_inputs'
  | 'out_of_bounds'
  | 'tap_rate'
  | 'not_finished'
  | 'unused_inputs'
  | 'mismatch';

export const REJECT_MESSAGES: Record<RejectReason, string> = {
  rules_version: 'La partida se jugó con otra versión de las reglas.',
  expired: 'La partida se envió demasiado tarde.',
  invalid_inputs: 'Los toques enviados no son válidos.',
  out_of_bounds: 'Hay toques fuera del campo de juego.',
  tap_rate: 'Demasiados toques por segundo.',
  not_finished: 'La partida no terminó según el servidor.',
  unused_inputs: 'Hay toques después del final de la partida.',
  mismatch: 'El resultado no coincide con la repetición de la partida.',
};

/** ¿Hay más de `max` toques dentro de alguna ventana de `windowTicks`? */
export function exceedsRate(inputs: readonly TapInput[], windowTicks: number, max: number): boolean {
  let lo = 0;
  for (let hi = 0; hi < inputs.length; hi++) {
    while (inputs[hi][0] - inputs[lo][0] >= windowTicks) lo++;
    if (hi - lo + 1 > max) return true;
  }
  return false;
}

export interface RunToVerify {
  seed: number;
  maxLives: number;
  fieldW: number;
  fieldH: number;
  rulesVersion: number;
  startedAt: Date;
  /** Modificadores guardados al crear la partida (Run.config); null o ausente si no tiene. */
  config?: unknown;
}

export interface Claimed {
  inputs: TapInput[];
  killed: number;
  missed: number;
}

/** Lo que calcula la repetición. */
export interface Replayed {
  killed: number;
  missed: number;
  ticks: number;
  bestStreak: number;
  endReason: EndReason | null;
}

export type Verification =
  | ({ valid: true } & Replayed)
  | ({ valid: false; reason: RejectReason } & Partial<Replayed>);

/** Los modificadores de Run.config tal como se pasan al motor (los escribe solo el servidor). */
export function modsOf(config: unknown): GameMods | null {
  return config && typeof config === 'object' && !Array.isArray(config) ? (config as GameMods) : null;
}

/**
 * Valida una partida repitiéndola con el motor. El resultado del servidor manda: si lo que
 * dice el cliente no coincide, se rechaza.
 */
export function verifyRun(run: RunToVerify, claimed: Claimed, now = new Date()): Verification {
  if (run.rulesVersion !== RULES_VERSION) return { valid: false, reason: 'rules_version' };
  const elapsedMs = now.getTime() - run.startedAt.getTime();
  if (elapsedMs > MAX_RUN_AGE_MS) return { valid: false, reason: 'expired' };

  const inputs = claimed.inputs;
  try {
    if (inputs.length > MAX_INPUTS) throw new InvalidInputsError('demasiados toques');
    validateInputs(inputs);
  } catch (e) {
    if (e instanceof InvalidInputsError) return { valid: false, reason: 'invalid_inputs' };
    throw e;
  }
  for (const [, x, y] of inputs) {
    if (x < 0 || y < 0 || x > run.fieldW || y > run.fieldH) return { valid: false, reason: 'out_of_bounds' };
  }
  if (
    exceedsRate(inputs, RATE_WINDOW_TICKS, MAX_TAPS_PER_SEC * (RATE_WINDOW_TICKS / TICKS_PER_SECOND)) ||
    exceedsRate(inputs, TICKS_PER_SECOND, MAX_BURST_PER_SEC)
  ) {
    return { valid: false, reason: 'tap_rate' };
  }

  // La simulación no puede durar más que el tiempo real transcurrido (el cliente usa paso fijo
  // con dt acotado, así que el tiempo de juego nunca adelanta al reloj).
  const allowedTicks = Math.min(
    MAX_REPLAY_TICKS,
    Math.ceil(((Math.max(0, elapsedMs) + WALL_CLOCK_SLACK_MS) / 1000) * TICKS_PER_SECOND),
  );
  const mods = modsOf(run.config);
  const r = replay(
    { seed: run.seed, maxLives: run.maxLives, fieldW: run.fieldW, fieldH: run.fieldH, ...(mods ? { mods } : {}) },
    inputs,
    allowedTicks,
  );
  const result: Replayed = {
    killed: r.killed,
    missed: r.missed,
    ticks: r.ticks,
    bestStreak: r.bestStreak,
    endReason: r.endReason,
  };
  if (!r.over) return { valid: false, reason: 'not_finished', ...result };
  if (r.unusedInputs > 0) return { valid: false, reason: 'unused_inputs', ...result };
  if (r.killed !== claimed.killed || r.missed !== claimed.missed) return { valid: false, reason: 'mismatch', ...result };
  return { valid: true, ...result };
}
