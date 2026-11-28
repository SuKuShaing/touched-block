/**
 * Nivel de experiencia del jugador según los bloques destruidos en total más los bloques extra de
 * las misiones (`totalKilled + bonusXp`). Es cosmético (Colección, Perfil y paletas): no cambia
 * las reglas ni los rankings.
 *
 * Provisorio: el nivel n empieza en `LEVEL_FACTOR · n · (n + 1)` bloques (nivel 0 = de 0 a 49,
 * 1 = 50, 2 = 150, 5 = 750, 10 = 2.750, 30 = 23.250).
 */
export const LEVEL_FACTOR = 25; // provisorio

export interface LevelInfo {
  /** Nivel actual (desde 0). */
  level: number;
  /** Bloques acumulados. */
  xp: number;
  /** Bloques con que empieza el nivel actual. */
  current: number;
  /** Bloques con que empieza el siguiente. */
  next: number;
  /** Avance dentro del nivel, 0–1. */
  progress: number;
}

/** Bloques con que empieza el nivel n. */
export function levelStart(n: number): number {
  const k = Math.max(0, Math.floor(n));
  return LEVEL_FACTOR * k * (k + 1);
}

/** Bloques que cuentan para el nivel. */
export function xpOf(s: { totalKilled: number; bonusXp?: number }): number {
  const v = (s.totalKilled || 0) + (s.bonusXp || 0);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function levelFor(xp: number): LevelInfo {
  const x = Number.isFinite(xp) && xp > 0 ? Math.floor(xp) : 0;
  // estimación con la fórmula cuadrática y ajuste exacto con enteros
  let n = Math.max(0, Math.floor((-1 + Math.sqrt(1 + (4 * x) / LEVEL_FACTOR)) / 2));
  while (n > 0 && levelStart(n) > x) n--;
  while (levelStart(n + 1) <= x) n++;
  const current = levelStart(n);
  const next = levelStart(n + 1);
  return { level: n, xp: x, current, next, progress: (x - current) / (next - current) };
}
