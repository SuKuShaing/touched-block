import type { AchievementId } from '@tb/engine';

/**
 * Valor de cada logro a partir de las estadísticas del catálogo (`CatalogStats`). Módulo aparte,
 * sin importar el catálogo ni las celebraciones (los dos lo usan: así no hay ciclo).
 * `mejorReto` es null si nunca participó en un reto diario (participar con 0 % ya cuenta).
 */
export function achievementValues(s: {
  bestStreak: number;
  runs: number;
  dailyStreakBest: number;
  bestDailyPct: number | null;
}): Record<AchievementId, number | null> {
  return { racha: s.bestStreak, partidas: s.runs, diasReto: s.dailyStreakBest, mejorReto: s.bestDailyPct };
}
