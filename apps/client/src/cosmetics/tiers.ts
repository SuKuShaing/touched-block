import { TIERS, type TierId, type TierRef, type TierStep, tierIndexOf } from '@tb/engine';

/**
 * Color representativo de cada material de insignia (barras de avance de la Colección). El dibujo
 * de las medallas está en `cosmetics/medal.ts`.
 */
export interface TierLook {
  /** Color del material. */
  face: string;
}

export const TIER_LOOK: Record<TierId, TierLook> = {
  madera: { face: '#c49a63' },
  bronce: { face: '#db7a40' },
  plata: { face: '#cfd6e0' },
  oro: { face: '#ffcf47' },
  diamante: { face: '#9be7ff' },
};

/** Insignia completa de una referencia de la API (o null si no es válida). */
export function tierStepOf(ref: TierRef | null | undefined): TierStep | null {
  const i = tierIndexOf(ref);
  return i < 0 ? null : TIERS[i];
}
