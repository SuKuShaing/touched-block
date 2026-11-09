import { TICKS_PER_SECOND } from './constants';
import { type EndReason, type GameConfig, createGame, step, tap } from './game';

/**
 * Un toque registrado: [tick, x, y]. `tick` es la cantidad de pasos que llevaba la partida
 * cuando ocurrió el toque (se aplica antes del siguiente paso).
 */
export type TapInput = [tick: number, x: number, y: number];

export interface ReplayResult {
  killed: number;
  missed: number;
  bestStreak: number;
  ticks: number;
  over: boolean;
  endReason: EndReason | null;
  /** Toques que no se pudieron aplicar porque la partida ya había terminado. */
  unusedInputs: number;
}

export class InvalidInputsError extends Error {}

/** Tope de duración de una partida al repetirla (6 h de juego). */
export const MAX_REPLAY_TICKS = 6 * 60 * 60 * TICKS_PER_SECOND;

/**
 * Repite una partida a partir de su semilla y sus toques. Como el motor es determinista,
 * da exactamente el mismo resultado que obtuvo el jugador.
 */
export function replay(config: GameConfig, inputs: readonly TapInput[], maxTicks = MAX_REPLAY_TICKS): ReplayResult {
  validateInputs(inputs);
  const s = createGame(config);
  let i = 0;
  while (!s.over && s.tick < maxTicks) {
    while (i < inputs.length && inputs[i][0] === s.tick) {
      tap(s, inputs[i][1], inputs[i][2]);
      i++;
      if (s.over) break;
    }
    if (s.over) break;
    step(s);
  }
  return {
    killed: s.killed,
    missed: s.missed,
    bestStreak: s.bestStreak,
    ticks: s.tick,
    over: s.over,
    endReason: s.endReason,
    unusedInputs: inputs.length - i,
  };
}

export function validateInputs(inputs: readonly TapInput[]): void {
  if (!Array.isArray(inputs)) throw new InvalidInputsError('inputs debe ser un arreglo');
  let prev = 0;
  for (const inp of inputs) {
    if (!Array.isArray(inp) || inp.length !== 3) throw new InvalidInputsError('cada toque debe ser [tick, x, y]');
    const [t, x, y] = inp;
    if (!Number.isInteger(t) || t < 0) throw new InvalidInputsError('tick inválido');
    if (t < prev) throw new InvalidInputsError('los toques deben venir en orden');
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new InvalidInputsError('coordenadas inválidas');
    prev = t;
  }
}
