import type { EndReason, GameMods, TapInput } from '@tb/engine';

/**
 * Resultado de una partida, con todo lo necesario para repetirla en el servidor
 * (`replay({seed, maxLives, fieldW, fieldH, mods}, inputs)`).
 */
export interface GameResult {
  seed: number;
  maxLives: number;
  /** Tamaño lógico del campo: en la partida normal, px al empezar; en los retos, el del servidor. */
  fieldW: number;
  fieldH: number;
  /** Modificadores con que se jugó (null en las partidas normales y en los retos a un amigo). */
  mods: GameMods | null;
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
