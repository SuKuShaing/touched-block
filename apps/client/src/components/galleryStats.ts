import { type AchievementId, TICKS_PER_SECOND, TIERS, achievementById } from '@tb/engine';
import { type CatalogStats, EMPTY_CATALOG_STATS } from '@/cosmetics/catalog';
import type { PrizeRef } from './PrizeModal';

/** Estadística que mide cada logro. */
const STAT_OF = {
  racha: 'bestStreak',
  partidas: 'runs',
  diasReto: 'dailyStreakBest',
  mejorReto: 'bestDailyPct',
} as const satisfies Record<AchievementId, keyof CatalogStats>;

/**
 * Estadísticas inventadas para la ventana abierta desde la galería de prueba: justo las que dan el
 * nivel que se mira (con todo al máximo, un logro Plata diría que ya tiene el material más alto).
 */
export function galleryStats(prize: PrizeRef): CatalogStats {
  if (prize.kind === 'tier') {
    const at = TIERS[prize.index]?.at ?? 0;
    return { ...EMPTY_CATALOG_STATS, bestTicks: at * TICKS_PER_SECOND };
  }
  // nivel 0 (vacío): sin nada; en el reto, ni siquiera ha participado (null)
  if (prize.level <= 0) return EMPTY_CATALOG_STATS;
  return { ...EMPTY_CATALOG_STATS, [STAT_OF[prize.id]]: achievementById(prize.id).thresholds[prize.level - 1] };
}
