import { useSyncExternalStore } from 'react';
import { storage } from '@/platform/storage';
import { BEST_KEY, HIST_KEY } from './historyKeys';

/**
 * Estadísticas de este dispositivo (clave `tb_stats1`). No dependen de la versión de reglas,
 * así que no se reinician si algún día cambian. Con sesión manda el servidor (`Me.stats`); para
 * la Colección de este dispositivo se usa el máximo de ambas (`mergeStats`).
 */
export const STATS_KEY = 'tb_stats1';

export interface LocalStats {
  /** Duración de la partida más larga, en ticks (60 por segundo). Define la insignia. */
  bestTicks: number;
  bestStreak: number;
  totalKilled: number;
  /** Partidas terminadas. */
  runs: number;
  /** Bloques extra para el nivel ganados con misiones (como invitado). */
  bonusXp: number;
}

export const EMPTY_STATS: LocalStats = { bestTicks: 0, bestStreak: 0, totalKilled: 0, runs: 0, bonusXp: 0 };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** Primera vez: parte de lo que haya en el historial y el récord locales. */
function fromHistory(): LocalStats {
  const out = { ...EMPTY_STATS };
  try {
    const h: unknown = JSON.parse(storage.get(HIST_KEY) || '[]');
    if (Array.isArray(h)) {
      for (const g of h) {
        if (!g || typeof g !== 'object') continue;
        out.runs++;
        out.totalKilled += num(g.k);
        out.bestTicks = Math.max(out.bestTicks, num(g.t));
        out.bestStreak = Math.max(out.bestStreak, num(g.s));
      }
    }
  } catch {}
  // el récord puede venir de una partida que ya salió del historial (máx. 30)
  const best = parseInt(storage.get(BEST_KEY) || '0', 10) || 0;
  if (best > 0 && out.runs === 0) out.runs = 1;
  out.totalKilled = Math.max(out.totalKilled, best);
  return out;
}

function read(): LocalStats {
  const raw = storage.get(STATS_KEY);
  if (raw === null) {
    const init = fromHistory();
    write(init);
    return init;
  }
  try {
    const o: unknown = JSON.parse(raw);
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('tb_stats1 inválido');
    const r = o as Record<string, unknown>;
    return {
      bestTicks: num(r.bestTicks),
      bestStreak: num(r.bestStreak),
      totalKilled: num(r.totalKilled),
      runs: num(r.runs),
      bonusXp: num(r.bonusXp),
    };
  } catch {
    // dañado: se reconstruye desde el historial en vez de partir en cero
    const init = fromHistory();
    write(init);
    return init;
  }
}

/** Máximo campo a campo (para no perder lo que otra pestaña ya guardó). */
function maxOf(a: LocalStats, b: LocalStats): LocalStats {
  return {
    bestTicks: Math.max(a.bestTicks, b.bestTicks),
    bestStreak: Math.max(a.bestStreak, b.bestStreak),
    totalKilled: Math.max(a.totalKilled, b.totalKilled),
    runs: Math.max(a.runs, b.runs),
    bonusXp: Math.max(a.bonusXp, b.bonusXp),
  };
}

function write(s: LocalStats) {
  try {
    storage.set(STATS_KEY, JSON.stringify(s));
  } catch {}
}

let current: LocalStats | null = null;
const listeners = new Set<() => void>();

export function loadStats(): LocalStats {
  if (!current) current = read();
  return current;
}

/**
 * Antes de escribir se vuelve a leer el almacenamiento: otra pestaña (o la web instalada) pudo
 * guardar más desde que esta leyó. Se toma el máximo con lo que hay en memoria, así tampoco se
 * pierde lo de esta sesión si el almacenamiento está bloqueado.
 */
function fresh(): LocalStats {
  const stored = read();
  return current ? maxOf(current, stored) : stored;
}

function set(s: LocalStats) {
  current = s;
  write(s);
  listeners.forEach((l) => l());
}

/** Lo que una partida terminada aporta a las estadísticas. */
export interface RunSummary {
  durationTicks: number;
  bestStreak: number;
  killed: number;
}

/**
 * Una partida sumada a unas estadísticas, con la misma regla que el servidor: solo las de modo
 * normal cuentan para la mejor duración y la mejor racha (las de reto repiten una semilla
 * conocida, decisión D6); todas suman bloques y partidas. Sirve para las de este dispositivo y
 * para las de la cuenta (`Me.stats`, donde las partidas se llaman `totalRuns`).
 */
export function withRun<T extends { bestTicks: number; bestStreak: number; totalKilled: number }>(
  s: T,
  r: RunSummary,
  normal: boolean,
  runsKey: 'runs' | 'totalRuns' = 'runs',
): T {
  const out: T = {
    ...s,
    bestTicks: normal ? Math.max(num(s.bestTicks), num(r.durationTicks)) : num(s.bestTicks),
    bestStreak: normal ? Math.max(num(s.bestStreak), num(r.bestStreak)) : num(s.bestStreak),
    totalKilled: num(s.totalKilled) + num(r.killed),
  };
  (out as Record<string, unknown>)[runsKey] = num((s as Record<string, unknown>)[runsKey]) + 1;
  return out;
}

/**
 * Suma una partida terminada (`withRun`) a las de este dispositivo. Devuelve las estadísticas de
 * antes y de después (para detectar premios desbloqueados).
 */
export function recordStats(r: RunSummary, opts: { normal: boolean } = { normal: true }): { before: LocalStats; after: LocalStats } {
  const before = fresh();
  const after = withRun(before, r, opts.normal);
  set(after);
  return { before, after };
}

/** Suma bloques extra (misiones completadas como invitado). */
export function addBonusXp(n: number) {
  const s = fresh();
  set({ ...s, bonusXp: s.bonusXp + num(n) });
}

/** Máximo campo a campo entre las de este dispositivo y las del servidor (con sesión). */
export function mergeStats(local: LocalStats, server?: Partial<LocalStats> | null): LocalStats {
  if (!server) return local;
  return {
    bestTicks: Math.max(local.bestTicks, num(server.bestTicks)),
    bestStreak: Math.max(local.bestStreak, num(server.bestStreak)),
    totalKilled: Math.max(local.totalKilled, num(server.totalKilled)),
    runs: Math.max(local.runs, num(server.runs)),
    bonusXp: Math.max(local.bonusXp, num(server.bonusXp)),
  };
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/** Hook: estadísticas locales, se vuelve a dibujar al cambiar. */
export function useLocalStats(): LocalStats {
  return useSyncExternalStore(subscribe, loadStats, loadStats);
}
