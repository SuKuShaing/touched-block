import { storage } from '@/platform/storage';

// Las claves cambian cuando cambian las reglas, para no comparar récords incompatibles
// (tb_best1/tb_hist1 = reglas de legacy/game.js y v1, tb_best2/tb_hist2 = reglas v2; se dejan como estaban, sin borrarlas).
export const BEST_KEY = 'tb_best4';
export const HIST_KEY = 'tb_hist4';
export const HIST_MAX = 30;
export const HIST_SHOW = 10;

/** Una partida del historial: destruidos, escapados, fecha en ms. */
export interface HistEntry {
  k: number;
  m: number;
  d: number;
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
}

/** Guarda una partida terminada (la más reciente primero, máx. HIST_MAX) y el récord si lo es. */
export function recordRun(killed: number, missed: number, now = Date.now()): RecordResult {
  let best = loadBest();
  const isRecord = killed > best;
  if (isRecord) {
    best = killed;
    storage.set(BEST_KEY, String(best));
  }
  const hist = loadHist();
  hist.unshift({ k: killed, m: missed, d: now });
  if (hist.length > HIST_MAX) hist.length = HIST_MAX;
  storage.set(HIST_KEY, JSON.stringify(hist));
  return { best, isRecord, hist };
}
