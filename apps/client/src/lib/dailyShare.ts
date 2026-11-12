import { TICKS_PER_SECOND, TIERS, type GameMods, type TierId, tierIndexForTicks } from '@tb/engine';
import { config } from '@/config';
import { PCT_MIN_PLAYERS, ordinal } from './daily';

/**
 * Texto para compartir el reto diario sin spoilers (plan 4.3): no dice qué bloques salieron,
 * solo hasta dónde llegó.
 *
 *   Touched Block · Reto #42
 *   58 bloques · racha 31
 *   🟫🟫🟫🟧⬜⬛⬛
 *   Mejor que el 72 %
 *   https://sukushaing.github.io/touched-block/?diario=1
 */

/** Enlace que abre el juego directo en el reto del día. */
export const DAILY_URL = `${config.siteUrl}?diario=1`;

/** Celda de cada paso de insignia alcanzado (madera ×3, bronce, plata, oro, diamante). */
export const TIER_CELL: Record<TierId, string> = { madera: '🟫', bronce: '🟧', plata: '⬜', oro: '🟨', diamante: '🟦' };
/** Celda de un paso no alcanzado. */
export const CELL_MISSING = '⬛';

/**
 * Una celda por paso de insignia (TIERS), llena hasta el último alcanzado en esa partida. Con
 * `mods.startAt` la partida empieza más adelante, así que cuenta la dificultad alcanzada
 * (segundos jugados + startAt), no solo el tiempo jugado.
 */
export function tierCells(durationTicks: number, mods?: GameMods | null): string {
  const ticks = Math.max(0, durationTicks || 0) + (mods?.startAt ?? 0) * TICKS_PER_SECOND;
  const reached = tierIndexForTicks(ticks);
  return TIERS.map((t, i) => (i <= reached ? TIER_CELL[t.tier] : CELL_MISSING)).join('');
}

export interface DailyShareInput {
  number: number;
  killed: number;
  /** Mejor racha de esa partida. */
  bestStreak: number;
  durationTicks: number;
  mods?: GameMods | null;
  /** Posición del día (de la respuesta de terminar); sin ella no hay línea de posición. */
  position?: { rank: number; total: number; betterThanPct: number } | null;
}

/** Línea de posición: "Mejor que el 72 %" con 10 jugadores o más; si no, "2.º de 4". */
export function sharePositionLine(p: { rank: number; total: number; betterThanPct: number }): string | null {
  if (!(p.total > 0) || !(p.rank > 0)) return null;
  if (p.total >= PCT_MIN_PLAYERS) return `Mejor que el ${p.betterThanPct} %`;
  return `${ordinal(p.rank)} de ${p.total}`;
}

/**
 * Texto para compartir. `text` va sin el enlace (para `share.shareText(text, url)`, que lo
 * agrega); `full` es todo junto, con el enlace en su propia línea (para copiarlo).
 */
export function dailyShareText(o: DailyShareInput): { text: string; url: string; full: string } {
  const lines = [
    `Touched Block · Reto #${o.number}`,
    `${o.killed} ${o.killed === 1 ? 'bloque' : 'bloques'} · racha ${o.bestStreak}`,
    tierCells(o.durationTicks, o.mods),
  ];
  const pos = o.position ? sharePositionLine(o.position) : null;
  if (pos) lines.push(pos);
  const text = lines.join('\n');
  return { text, url: DAILY_URL, full: `${text}\n${DAILY_URL}` };
}
