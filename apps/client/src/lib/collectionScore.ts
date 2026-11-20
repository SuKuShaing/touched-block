import type { CatalogStats } from '@/cosmetics/catalog';
import { ownedKeys } from '@/game/celebrations';
import { levelFor, xpOf } from './level';

/**
 * Cuentas del punto de novedad de la pestaña Colección (puras; los hooks están en
 * `collectionNews.ts`). "Cuánto hay" en la Colección: insignias, premios y niveles de logro
 * (`ownedKeys`, las mismas claves de las celebraciones) más el nivel del jugador.
 */
export function collectionScore(stats: CatalogStats, dailyPct: number | null): number {
  return ownedKeys(stats, dailyPct).length + levelFor(xpOf(stats)).level;
}

/** Hay novedad si lo actual supera lo último visto (y ya se sembró: -1 = sin medir). */
export function hasCollectionNews(score: number, seen: number): boolean {
  return seen >= 0 && score > seen;
}

/** Lo que se guarda al ver la Colección: el máximo, para que cerrar sesión no "borre" lo visto. */
export function seenAfterViewing(score: number, seen: number): number {
  return Math.max(score, seen);
}
