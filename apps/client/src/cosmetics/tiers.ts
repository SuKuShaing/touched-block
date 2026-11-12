import { TIERS, type TierId, type TierRef, type TierStep, tierIndexOf } from '@tb/engine';

/**
 * Aspecto de cada material de insignia. Lo usan `components/TierBadge.tsx` (con `View`) y la
 * tarjeta de compartir (`platform/share.web.ts`, en `<canvas>`), para que se vean iguales.
 */
export interface TierLook {
  /** Cara de la medalla. */
  face: string;
  /** Borde. */
  rim: string;
  /** Número romano / estrella. */
  ink: string;
  /** Marco y brillo exterior (solo Oro y Diamante: el "marco en el ranking"). */
  frame?: string;
  glow?: string;
}

export const TIER_LOOK: Record<TierId, TierLook> = {
  madera: { face: '#a8713f', rim: '#6b4423', ink: '#ffe9c7' },
  bronce: { face: '#d38a45', rim: '#8a4f1d', ink: '#fff1df' },
  plata: { face: '#cfd6e0', rim: '#7b8696', ink: '#3a4250' },
  oro: { face: '#ffcf47', rim: '#b8860b', ink: '#6b4a00', frame: '#ffe597', glow: 'rgba(255,207,71,0.55)' },
  diamante: { face: '#9be7ff', rim: '#2b8fc9', ink: '#0b3a55', frame: '#e3f9ff', glow: 'rgba(155,231,255,0.65)' },
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** Insignia completa de una referencia de la API (o null si no es válida). */
export function tierStepOf(ref: TierRef | null | undefined): TierStep | null {
  const i = tierIndexOf(ref);
  return i < 0 ? null : TIERS[i];
}

/** Lo que va dentro de la medalla: número romano en madera, estrella en las demás, nada en diamante. */
export function tierGlyph(t: TierRef): string {
  if (t.tier === 'madera') return ROMAN[t.step] ?? '';
  return t.tier === 'diamante' ? '' : '★';
}
