import { useSyncExternalStore } from 'react';
import { session } from '@/api/session';
import type { Me } from '@/api/types';
import { type DailyLocal, loadDailyLocal, localStreakBest, subscribeDailyLocal } from '@/lib/daily';
import { type Settings, getSettings, subscribeSettings } from '@/lib/settings';
import { type LocalStats, loadStats, mergeStats, useLocalStats } from '@/lib/stats';
import { type CatalogStats, type Selection, resolveSelection } from './catalog';

/**
 * Premios en uso en este dispositivo: lo elegido en `tb_set1`, validado contra las estadísticas
 * (las locales y, con sesión, el máximo con las del servidor). Si algo elegido ya no está
 * desbloqueado (p. ej. después de cerrar sesión), se usa el valor por defecto.
 */

/**
 * Estadísticas para el catálogo: `mergeStats` de las locales y las de `Me`, más invitados y reto
 * diario. La mejor racha de días del reto es el máximo entre la de la cuenta y la jugada en este
 * dispositivo (`tb_daily1`; así también la gana un invitado).
 */
export function catalogStatsFor(local: LocalStats, me: Me | null | undefined, localDailyStreakBest = 0): CatalogStats {
  const server = me?.stats ? { ...me.stats, runs: me.stats.totalRuns } : null;
  return {
    ...mergeStats(local, server),
    invitedCount: me?.invitedCount ?? 0,
    dailyStreakBest: Math.max(me?.stats?.dailyStreakBest ?? 0, localDailyStreakBest),
  };
}

export interface ActiveCosmetics extends Selection {
  stats: CatalogStats;
}

let cache: { settings: Settings; local: LocalStats; user: Me | null; daily: DailyLocal; value: ActiveCosmetics } | null = null;

/** Premios en uso ahora (mismo objeto mientras no cambie nada). */
export function getActiveCosmetics(): ActiveCosmetics {
  const settings = getSettings();
  const local = loadStats();
  const user = session.get().user;
  const daily = loadDailyLocal();
  if (cache && cache.settings === settings && cache.local === local && cache.user === user && cache.daily === daily) return cache.value;
  const stats = catalogStatsFor(local, user, localStreakBest(daily));
  const value = { ...resolveSelection(settings, stats), stats };
  cache = { settings, local, user, daily, value };
  return value;
}

function subscribe(fn: () => void): () => void {
  const a = subscribeSettings(fn);
  const b = session.subscribe(fn);
  const c = subscribeDailyLocal(fn);
  return () => {
    a();
    b();
    c();
  };
}

/** Hook: premios en uso y estadísticas del catálogo; se vuelve a dibujar si cambia algo. */
export function useActiveCosmetics(): ActiveCosmetics {
  useLocalStats(); // también al terminar una partida (cambian las estadísticas locales)
  return useSyncExternalStore(subscribe, getActiveCosmetics, getActiveCosmetics);
}

// Selectores baratos para lo que se dibuja muchas veces (bloques, partículas): devuelven un
// string, así que solo vuelven a dibujar cuando cambia ese premio.
const paletteSnap = () => getActiveCosmetics().palette;
const effectSnap = () => getActiveCosmetics().effect;
const backgroundSnap = () => getActiveCosmetics().background;

export const useActivePalette = () => useSyncExternalStore(subscribe, paletteSnap, paletteSnap);
export const useActiveEffect = () => useSyncExternalStore(subscribe, effectSnap, effectSnap);
export const useActiveBackground = () => useSyncExternalStore(subscribe, backgroundSnap, backgroundSnap);
