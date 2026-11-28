import { type AchievementMaterial, TIERS, type TierRef, type TierStep, tierIndexOf } from '@tb/engine';

/**
 * Color representativo de cada material (barras de avance de la Colección). Los logros usan los
 * siete materiales y las insignias tienen los mismos nombres y colores. El dibujo de las medallas
 * está en `cosmetics/medal.ts` y el de los iconos de logros en `cosmetics/achievementIcon.ts`.
 */
export const MATERIAL_COLOR: Record<AchievementMaterial, string> = {
  Papel: '#ece2cb',
  Cartón: '#c9a26c',
  Madera: '#c49a63',
  Bronce: '#db7a40',
  Plata: '#cfd6e0',
  Oro: '#ffcf47',
  Diamante: '#9be7ff',
};

/** En el orden de `TIERS` (Papel … Diamante). */
const TIER_COLORS: readonly string[] = Object.values(MATERIAL_COLOR);

/** Color de una insignia. */
export function tierColor(t: TierStep): string {
  return TIER_COLORS[t.index] ?? MATERIAL_COLOR.Madera;
}

/** Insignia completa de una referencia de la API (o null si no es válida). */
export function tierStepOf(ref: TierRef | null | undefined): TierStep | null {
  const i = tierIndexOf(ref);
  return i < 0 ? null : TIERS[i];
}
