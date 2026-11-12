import { COLORS } from '@tb/engine';

/**
 * Paletas de los bloques (premios cosméticos). El motor sigue asignando sus colores; el cliente
 * los traduce **por posición** en `COLORS` (9 colores) al dibujar el bloque, las partículas y el
 * bloque que se apaga. Un color que no está en `COLORS` (el corazón `#ff4d8d`, el rojo de las
 * trampas, etc.) no cambia.
 *
 * Regla de no ventaja (plan, sección 2.4; la comprueba `palettes.test.ts`): ninguna paleta puede
 * hacer más visibles (ni menos) las trampas rojas. El motor solo las pone sobre las posiciones de
 * `SAFE` (2, 3, 4, 5, 7 y 8), y el texto rojo (`#ff2a2a`) se distingue sobre todo por el tono y,
 * después, por la luminancia. Sobre esos seis colores, comparado con la Clásica:
 * - Tono (HSL, distancia circular al rojo): cada uno dentro del rango de la Clásica ±5°; el caso
 *   más difícil (la menor distancia) a lo más 8° más fácil que el de la Clásica (su amarillo,
 *   42,5°); y la media dentro de la de la Clásica ±20° (ni todas fáciles ni todas difíciles).
 * - Contraste WCAG con el rojo: cada uno dentro del rango de la Clásica, y el mínimo (el caso
 *   más difícil) a lo más 0,1 sobre el de la Clásica.
 * - El texto blanco se lee igual o mejor que en la Clásica (≥ su mínimo), en los nueve colores.
 * En la práctica, en las posiciones SAFE: distancia de tono en [37,5°; 178°], al menos una
 * ≤ 50,5° (tono en [37,5°; 50,5°] o en [309,5°; 322,5°]) y media en [99,5°; 139,5°];
 * luminancia en [0,112; 0,193] o [0,275; 0,436], al menos una en [0,174; 0,193] o
 * [0,275; 0,303]. En todas, luminancia ≤ 0,436. Las posiciones 0, 1 y 6 nunca llevan trampa
 * roja: ahí va la identidad de cada paleta.
 */
export type PaletteId = 'clasica' | 'contraste' | 'pastel' | 'neon' | 'retro' | 'dorado' | 'diamante' | 'constancia';

export interface Palette {
  id: PaletteId;
  /** 9 colores, en el mismo orden que `COLORS` del motor. */
  colors: readonly string[];
  /** Brillo sutil sobre el bloque (Diamante). */
  shine?: boolean;
}

export const DEFAULT_PALETTE: PaletteId = 'clasica';

export const PALETTES: Record<PaletteId, Palette> = {
  clasica: { id: 'clasica', colors: COLORS },
  // Para daltónicos (decisión D9, misma regla que las demás). Tonos de Okabe-Ito. Las posiciones
  // donde caen trampas rojas son azules, violetas, verde azulado, pizarra y un rosa púrpura (el
  // caso difícil, en el puesto del amarillo de la Clásica: en tono está igual de cerca del rojo,
  // pero en deuteranopía y protanopía no se confunde con él); el bermellón y el amarillo quedan
  // en las posiciones que nunca llevan trampa roja, con luminancias distintas para no
  // confundirse entre sí.
  contraste: {
    id: 'contraste',
    colors: ['#ba4e00', '#cea500', '#d071b0', '#3ba0d8', '#6a52c8', '#00a88a', '#0072b2', '#5f6e98', '#b981c4'],
  },
  pastel: {
    id: 'pastel',
    colors: ['#d47a8c', '#d98a63', '#c79a3e', '#5fa889', '#5e95d6', '#8b8fd8', '#c477b0', '#4ea6a3', '#b884c8'],
  },
  neon: {
    id: 'neon',
    colors: ['#ff2e88', '#ff6a00', '#d9a800', '#00b85c', '#2398ff', '#5a3dff', '#f000b8', '#00a8a0', '#b026ff'],
  },
  retro: {
    id: 'retro',
    colors: ['#b84a2e', '#d27d2d', '#c49a2c', '#63a23d', '#3f78c0', '#6c4fa8', '#b4456f', '#34a392', '#8c5a9e'],
  },
  // Las aleaciones del oro: oro, cobre y oro rosa en las posiciones sin trampa roja; oro intenso
  // (el caso difícil), oro verde, oro blanco, oro azul, pátina y oro púrpura en las SAFE. Si todas
  // fueran doradas, todas las trampas serían difíciles: un premio no puede ser una desventaja.
  dorado: {
    id: 'dorado',
    colors: ['#b8860b', '#c47a2c', '#d4a017', '#8b9a3b', '#93a4b4', '#666fa9', '#b8737a', '#45a28b', '#b481be'],
  },
  // Fría y brillante: azules, cian, menta y violetas, con un diamante rosa como caso difícil.
  diamante: {
    id: 'diamante',
    colors: ['#4f7cff', '#3fa0e8', '#df67b7', '#32ac8d', '#1658ca', '#7761e3', '#d16ce5', '#1fa4b0', '#9a57d5'],
    shine: true,
  },
  // Exclusiva del reto diario (fase 4): tonos de piedras preciosas.
  constancia: {
    id: 'constancia',
    colors: ['#c2304f', '#e0782a', '#d9a400', '#21a868', '#2f6fd6', '#8e44c8', '#b8306a', '#1aa39c', '#5a4fd0'],
  },
};

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

const INDEX = new Map<string, number>(COLORS.map((c, i): [string, number] => [c.toLowerCase(), i]));

export function isPaletteId(id: string | null | undefined): id is PaletteId {
  return !!id && Object.prototype.hasOwnProperty.call(PALETTES, id);
}

/** Paleta por id (desconocida → Clásica). */
export function getPalette(id: string | null | undefined): Palette {
  return isPaletteId(id) ? PALETTES[id] : PALETTES[DEFAULT_PALETTE];
}

/** Color con que se dibuja un color del motor en la paleta elegida. */
export function paletteColor(engineColor: string, paletteId: string | null | undefined): string {
  if (!isPaletteId(paletteId) || paletteId === DEFAULT_PALETTE) return engineColor;
  const i = INDEX.get(engineColor.toLowerCase());
  return i === undefined ? engineColor : PALETTES[paletteId].colors[i];
}

// ---- tono y contraste WCAG (para el test de no ventaja y para elegir colores nuevos) ----

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Tono HSL de un color `#rrggbb`, en grados [0, 360). Un gris da 0. */
export function hue(hex: string): number {
  const [r255, g255, b255] = rgb(hex);
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

/** Distancia circular entre los tonos de dos colores, en grados [0, 180]. */
export function hueDistance(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b)) % 360;
  return d > 180 ? 360 - d : d;
}

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

/** Luminancia relativa WCAG de un color `#rrggbb`. */
export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Razón de contraste WCAG entre dos colores (1–21). */
export function contrastRatio(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
