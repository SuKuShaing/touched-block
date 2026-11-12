import type { GameResult } from '@/game/types';
import { storage } from '@/platform/storage';
import { type LocalStats, recordStats } from './stats';

import { BEST_KEY, HIST_KEY } from './historyKeys';

export { BEST_KEY, HIST_KEY };
export const HIST_MAX = 30;
export const HIST_SHOW = 10;

/**
 * Una partida del historial: destruidos, escapados, fecha en ms. `t` (duración en ticks) y `s`
 * (mejor racha) se agregaron después: las entradas antiguas no los tienen.
 */
export interface HistEntry {
  k: number;
  m: number;
  d: number;
  t?: number;
  s?: number;
}

export function loadBest(): number {
  return parseInt(storage.get(BEST_KEY) || '0', 10) || 0;
}

export function loadHist(): HistEntry[] {
  try {
    const h: unknown = JSON.parse(storage.get(HIST_KEY) || '[]');
    if (!Array.isArray(h)) return [];
    return h.filter(
      (g): g is HistEntry => !!g && typeof g === 'object' && typeof g.k === 'number' && typeof g.m === 'number' && typeof g.d === 'number',
    );
  } catch {
    return [];
  }
}

export interface RecordResult {
  best: number;
  isRecord: boolean;
  hist: HistEntry[];
  /** Estadísticas del dispositivo antes y después de esta partida (`tb_stats1`). */
  stats: { before: LocalStats; after: LocalStats };
}

/**
 * Guarda una partida terminada (la más reciente primero, máx. HIST_MAX), el récord si lo es y
 * las estadísticas del dispositivo.
 */
export function recordRun(r: GameResult, now = Date.now()): RecordResult {
  // Primero las estadísticas: si `tb_stats1` todavía no existe, se inicializan con el historial y
  // el récord de ANTES de esta partida (si no, la contarían dos veces).
  const stats = recordStats(r, { normal: true });
  let best = loadBest();
  const isRecord = r.killed > best;
  if (isRecord) {
    best = r.killed;
    storage.set(BEST_KEY, String(best));
  }
  const hist = loadHist();
  hist.unshift({ k: r.killed, m: r.missed, d: now, t: r.durationTicks, s: r.bestStreak });
  if (hist.length > HIST_MAX) hist.length = HIST_MAX;
  storage.set(HIST_KEY, JSON.stringify(hist));
  return { best, isRecord, hist, stats };
}
