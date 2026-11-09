import type { EndReason, TapInput } from '@tb/engine';

/**
 * Resultado de una partida, con todo lo necesario para repetirla en el servidor
 * (`replay({seed, maxLives, fieldW, fieldH}, inputs)`). En la fase 3 se envía a la API.
 */
export interface GameResult {
  seed: number;
  maxLives: number;
  /** Tamaño lógico del campo (px al empezar la partida). */
  fieldW: number;
  fieldH: number;
  /** Toques [tick, x, y] en coordenadas lógicas del campo. */
  inputs: TapInput[];
  killed: number;
  missed: number;
  /** Mejor racha de la partida (bloques destruidos seguidos sin errores). */
  bestStreak: number;
  endReason: EndReason;
  /** Pasos de simulación jugados (TICKS_PER_SECOND por segundo). */
  durationTicks: number;
  rulesVersion: number;
}
