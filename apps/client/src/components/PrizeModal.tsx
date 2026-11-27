import type { AchievementId } from '@tb/engine';
import type { CatalogStats } from '@/cosmetics/catalog';

/** Qué se mira en grande: una insignia (−1 = todavía ninguna) o un escalón de un logro (0 = vacío). */
export type PrizeRef =
  | { kind: 'tier'; index: number }
  | { kind: 'achievement'; id: AchievementId; level: number };

/**
 * Ventana de una insignia o un logro en grande, con compartir. `prize` null = cerrada.
 * Provisorio: todavía no dibuja nada.
 */
export function PrizeModal(_props: { prize: PrizeRef | null; stats: CatalogStats; onClose(): void }) {
  return null;
}
