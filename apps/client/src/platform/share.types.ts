import type { AchievementId, TierRef } from '@tb/engine';
import type { CosmeticType } from '@/cosmetics/catalog';

/** Datos de la tarjeta de resultado que se comparte como imagen. */
export interface ResultCard {
  /** null = invitado. */
  username: string | null;
  killed: number;
  worldRank?: number | null;
  countryRank?: number | null;
  /** Nombre del país (para "#3 en Chile"). */
  countryName?: string | null;
  /**
   * Insignia que se dibuja arriba a la derecha (opcional). Con sesión, la pública (`Me.tier` o la
   * de `RunResult.stats`); como invitado, la de este dispositivo.
   */
  tier?: TierRef | null;
  /** Etapa alcanzada, ya en palabras (opcional): `stageText(durationTicks)` de `lib/shareText.ts`. */
  stage?: string | null;
}

/** Un premio que se puede compartir. */
export type PrizeShareItem =
  /** Insignia (posición en `TIERS`). */
  | { kind: 'tier'; index: number }
  /** Escalón de un logro (1 = Papel … 7 = Diamante). */
  | { kind: 'achievement'; id: AchievementId; level: number }
  /** Premio del catálogo: su tarjeta lleva solo texto. */
  | { kind: 'item'; type: CosmeticType; id: string };

/** Datos de la tarjeta de un premio. `username` null = invitado (la tarjeta va sin nombre). */
export type PrizeShareCard = PrizeShareItem & { username: string | null };

/** shared: se abrió la hoja de compartir; copied: se copió al portapapeles; cancelled: el usuario la cerró. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface Share {
  /** Prepara la imagen de antemano (para no perder el gesto del usuario al compartir). */
  prepareCard(card: ResultCard): void;
  /** Comparte la tarjeta (PNG) con texto y link; si no se puede, solo el texto; si no, lo copia. */
  shareResult(card: ResultCard, text: string, url: string): Promise<ShareOutcome>;
  /** Como `prepareCard`, para la tarjeta de un premio. */
  preparePrize(card: PrizeShareCard): void;
  /** Como `shareResult`, para la tarjeta de un premio. */
  sharePrize(card: PrizeShareCard, text: string, url: string): Promise<ShareOutcome>;
  /** Comparte un texto y un link; si no se puede, lo copia. */
  shareText(text: string, url: string): Promise<ShareOutcome>;
  copyText(text: string): Promise<boolean>;
}
