import { COLORS } from '@tb/engine';
import type { PaletteId, PaletteStyle } from './ids';

/**
 * Paletas de los bloques (premios cosméticos). El motor sigue asignando sus colores; el cliente
 * los traduce **por posición** en `COLORS` (9 colores) al dibujar el bloque y las partículas. Un
 * color que no está en `COLORS` (el corazón `#ff4d8d`, el gris del bloque que se apaga, etc.) no
 * cambia y se dibuja liso en todas.
 *
 * Una paleta es además un **estilo** de dibujo (`style`; la receta está en `blockPaint`). Los
 * translúcidos (cristal, contorno y esmerilado) van sobre un respaldo opaco `BLOCK_BACKING`: su
 * relleno se calcula ya mezclado, así el color no depende del fondo del campo y se ve igual en web
 * y app.
 *
 * Regla de no ventaja (plan, sección 2.4; la comprueba `palettes.test.ts`): ninguna paleta puede
 * hacer más visibles (ni menos) las trampas rojas. Se mide sobre el color que queda bajo el número
 * (`effectiveFills`; en el degradé, sobre cada extremo), no sobre el hex de la paleta. El motor
 * solo pone las trampas sobre las posiciones de `SAFE` (2, 3, 4, 5, 7 y 8), y el texto rojo
 * (`#ff2a2a`) se distingue sobre todo por el tono y, después, por la luminancia. Sobre esos seis
 * colores, comparado con la Clásica:
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
export type { PaletteId, PaletteStyle };

export interface Palette {
  id: PaletteId;
  style: PaletteStyle;
  /** 9 colores, en el mismo orden que `COLORS` del motor (en cristal y esmerilado son tintes). */
  colors: readonly string[];
  /** Brillo sutil sobre el bloque (Diamante). */
  shine?: boolean;
}

export const DEFAULT_PALETTE: PaletteId = 'clasica';

/** En el orden de la Colección (el del catálogo). */
export const PALETTES: Record<PaletteId, Palette> = {
  clasica: { id: 'clasica', style: 'solid', colors: COLORS },
  // Para daltónicos (decisión D9, misma regla que las demás). Tonos de Okabe-Ito. Las posiciones
  // donde caen trampas rojas son azules, violetas, verde azulado, pizarra y un rosa púrpura (el
  // caso difícil, en el puesto del amarillo de la Clásica: en tono está igual de cerca del rojo,
  // pero en deuteranopía y protanopía no se confunde con él); el bermellón y el amarillo quedan
  // en las posiciones que nunca llevan trampa roja, con luminancias distintas para no
  // confundirse entre sí.
  contraste: {
    id: 'contraste',
    style: 'solid',
    colors: ['#ba4e00', '#cea500', '#d071b0', '#3ba0d8', '#6a52c8', '#00a88a', '#0072b2', '#5f6e98', '#b981c4'],
  },
  pastel: {
    id: 'pastel',
    style: 'solid',
    colors: ['#d47a8c', '#d98a63', '#c79a3e', '#5fa889', '#5e95d6', '#8b8fd8', '#c477b0', '#4ea6a3', '#b884c8'],
  },
  neon: {
    id: 'neon',
    style: 'solid',
    colors: ['#ff2e88', '#ff6a00', '#d9a800', '#00b85c', '#2398ff', '#5a3dff', '#f000b8', '#00a8a0', '#b026ff'],
  },
  // Relleno: la Clásica atenuada (mismo tono, luminancia fija); el borde es el color del motor.
  tenue: {
    id: 'tenue',
    style: 'soft',
    colors: ['#c97e81', '#c98156', '#b18f3a', '#57a17d', '#5399cd', '#968cc2', '#c17ea9', '#3fa196', '#a487bc'],
  },
  // Vidrio: tintes claros que se ven al `GLASS_FILL` sobre el respaldo.
  cristal: {
    id: 'cristal',
    style: 'glass',
    colors: ['#ff9fb5', '#ffb88a', '#ffd666', '#94f0c2', '#85cbff', '#a8a7ff', '#ff9be0', '#6fe3d0', '#c79bff'],
  },
  retro: {
    id: 'retro',
    style: 'solid',
    colors: ['#b84a2e', '#d27d2d', '#c49a2c', '#63a23d', '#3f78c0', '#6c4fa8', '#b4456f', '#34a392', '#8c5a9e'],
  },
  // Relieve de botón (sombras interiores); colores "caramelo".
  boton: {
    id: 'boton',
    style: 'inset',
    colors: ['#ed417d', '#e16a2f', '#c9a32f', '#1aaf6a', '#1b76c3', '#8c56e1', '#e873c5', '#13c4a4', '#b63bd7'],
  },
  // Borde del color pleno y relleno al `OUTLINE_FILL` sobre el respaldo.
  contorno: {
    id: 'contorno',
    style: 'outline',
    colors: ['#ff4d6d', '#ff8a1f', '#ffc400', '#19e68c', '#3ab0ff', '#a89bff', '#ff3fb4', '#00e0c6', '#d484ff'],
  },
  // Degradé vertical muy sutil entre dos tonos del mismo color (más intenso no cabe en la regla).
  degrade: {
    id: 'degrade',
    style: 'gradient',
    colors: ['#d34566', '#ee7e0f', '#cea017', '#39aa62', '#2373da', '#8259ca', '#cb64c5', '#2eb79c', '#9c3eb9'],
  },
  // Las aleaciones del oro: oro, cobre y oro rosa en las posiciones sin trampa roja; oro intenso
  // (el caso difícil), oro verde, oro blanco, oro azul, pátina y oro púrpura en las SAFE. Si todas
  // fueran doradas, todas las trampas serían difíciles: un premio no puede ser una desventaja.
  dorado: {
    id: 'dorado',
    style: 'solid',
    colors: ['#b8860b', '#c47a2c', '#d4a017', '#8b9a3b', '#93a4b4', '#666fa9', '#b8737a', '#45a28b', '#b481be'],
  },
  // Vidrio esmerilado: cada tinte apenas se insinúa en una capa blanco azulada.
  esmerilado: {
    id: 'esmerilado',
    style: 'frosted',
    colors: ['#f4282e', '#c74710', '#d59a0a', '#2ebf6e', '#4893f4', '#7e66d6', '#f91395', '#19c4be', '#8534db'],
  },
  // Fría y brillante: azules, cian, menta y violetas, con un diamante rosa como caso difícil.
  diamante: {
    id: 'diamante',
    style: 'solid',
    colors: ['#4f7cff', '#3fa0e8', '#df67b7', '#32ac8d', '#1658ca', '#7761e3', '#d16ce5', '#1fa4b0', '#9a57d5'],
    shine: true,
  },
  // "Amistad" (conserva su id): tonos de piedras preciosas.
  constancia: {
    id: 'constancia',
    style: 'solid',
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

/** Color crudo de la paleta para un color del motor (partículas); el bloque usa `blockPaint`. */
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

// ---- estilos de dibujo ----

/** Respaldo opaco de los estilos translúcidos (el color de fondo de la app). */
const BLOCK_BACKING = '#12121a';
const GLASS_FILL = 0.5;
const OUTLINE_FILL = 0.55;
const GRADIENT_MIX = 0.035;
const FROSTED_BASE = '#dde8ff';
const FROSTED_TINT = 0.35;
const FROSTED_ALPHA = 0.7;
/** Brillo diagonal de Esmerilado: blanco de `from` (0 %) a `to` (en `end`). */
const FROSTED_SHINE = { from: 0.3, to: 0.08, end: 0.6 };
/** Opacidad de ese brillo en el centro del bloque, donde va el número (≈ 0,117). */
const FROSTED_CENTER_SHINE = FROSTED_SHINE.from - (FROSTED_SHINE.from - FROSTED_SHINE.to) * (0.5 / FROSTED_SHINE.end);

/** `base` con `over` encima a la opacidad `t` (por canal en sRGB, redondeado). */
function mixHex(base: string, over: string, t: number): string {
  const a = rgb(base);
  const b = rgb(over);
  return `#${a.map((v, i) => Math.round(v * (1 - t) + b[i] * t).toString(16).padStart(2, '0')).join('')}`;
}

/** Los dos tonos del degradé de un color: [arriba, abajo]. */
const gradientStops = (hex: string): [string, string] => [
  mixHex(hex, '#ffffff', GRADIENT_MIX),
  mixHex(hex, '#000000', GRADIENT_MIX),
];

/** Capa de vidrio de Esmerilado para un tinte, ya compuesta sobre el respaldo (sin el brillo). */
const frostedLayer = (tint: string) => mixHex(BLOCK_BACKING, mixHex(FROSTED_BASE, tint, FROSTED_TINT), FROSTED_ALPHA);

/**
 * Color(es) que quedan bajo el número en la posición `pos` de `COLORS`: uno, o los dos extremos
 * en el degradé. Es lo que mide la regla de no ventaja.
 */
export function effectiveFills(p: Palette, pos: number): readonly string[] {
  const c = p.colors[pos];
  switch (p.style) {
    case 'glass':
      return [mixHex(BLOCK_BACKING, c, GLASS_FILL)];
    case 'outline':
      return [mixHex(BLOCK_BACKING, c, OUTLINE_FILL)];
    case 'gradient':
      return gradientStops(c);
    case 'frosted':
      return [mixHex(frostedLayer(c), '#ffffff', FROSTED_CENTER_SHINE)];
    default:
      return [c];
  }
}

/** Estilo de un bloque (sirve igual en react-native-web y en la app). */
export interface BlockPaint {
  backgroundColor: string;
  backgroundImage?: string;
  borderWidth?: number;
  borderColor?: string;
  boxShadow: string;
}

const white = (a: number) => `rgba(255,255,255,${a})`;
const DROP_SHADOW = '0 5px 0 rgba(0,0,0,0.35)';
const GLASS_SHINE = `linear-gradient(160deg, ${white(0.38)} 0%, ${white(0)} 55%)`;
const GLASS_LIGHT = `inset 0 1px 0 ${white(0.5)}`;
const FROSTED_GRADIENT = `linear-gradient(135deg, ${white(FROSTED_SHINE.from)} 0%, ${white(FROSTED_SHINE.to)} ${FROSTED_SHINE.end * 100}%)`;
const FROSTED_DROP = '0 8px 24px rgba(0,0,0,0.35)';
const FROSTED_LIGHT = `inset 0 1px 0 ${white(0.6)}`;
const BUTTON_RELIEF = `inset 3px 3px 4px ${white(0.32)}, inset -3px -4px 5px rgba(0,0,0,0.3)`;
/** Para Android anterior a la API 29, que no dibuja sombras interiores: luz arriba y sombra abajo. */
const BUTTON_FALLBACK = `linear-gradient(180deg, ${white(0.22)} 0%, ${white(0)} 25%, rgba(0,0,0,0) 75%, rgba(0,0,0,0.25) 100%)`;

/**
 * Cómo se pinta un bloque de color `engineColor` con la paleta. `insetShadows: false` es para las
 * plataformas sin sombras interiores. Un color que no está en `COLORS` (corazón, bloque que se
 * apaga) sale liso en todas las paletas. El texto (también el rojo de la trampa) no depende de esto.
 */
export function blockPaint(paletteId: string | null | undefined, engineColor: string, insetShadows = true): BlockPaint {
  const i = INDEX.get(engineColor.toLowerCase());
  if (i === undefined) return { backgroundColor: engineColor, boxShadow: DROP_SHADOW };
  const p = getPalette(paletteId);
  const color = paletteColor(engineColor, p.id);
  switch (p.style) {
    case 'solid':
      return { backgroundColor: color, boxShadow: DROP_SHADOW };
    case 'soft':
      // el borde es el color del motor: una trampa movida a un color SAFE lleva el borde SAFE
      return { backgroundColor: color, borderWidth: 5, borderColor: engineColor, boxShadow: DROP_SHADOW };
    case 'glass':
      return {
        backgroundColor: effectiveFills(p, i)[0],
        backgroundImage: GLASS_SHINE,
        borderWidth: 1.5,
        borderColor: white(0.55),
        boxShadow: `${DROP_SHADOW}, ${GLASS_LIGHT}`,
      };
    case 'outline':
      return { backgroundColor: effectiveFills(p, i)[0], borderWidth: 3, borderColor: color, boxShadow: DROP_SHADOW };
    case 'gradient':
      return {
        backgroundColor: color,
        backgroundImage: `linear-gradient(180deg, ${gradientStops(color).join(', ')})`,
        boxShadow: DROP_SHADOW,
      };
    case 'frosted':
      // la capa va de color base y el brillo como degradado encima (sin desenfoque)
      return {
        backgroundColor: frostedLayer(color),
        backgroundImage: FROSTED_GRADIENT,
        borderWidth: 1,
        borderColor: white(0.45),
        boxShadow: `${FROSTED_DROP}, ${FROSTED_LIGHT}`,
      };
    case 'inset':
      return insetShadows
        ? { backgroundColor: color, boxShadow: `${DROP_SHADOW}, ${BUTTON_RELIEF}` }
        : { backgroundColor: color, backgroundImage: BUTTON_FALLBACK, boxShadow: DROP_SHADOW };
  }
}

/** Borde máximo de una muestra, como fracción de su lado (en la rejilla 3×3 quedan más finos). */
const SWATCH_BORDER_MAX = 0.31;
/** Desde este lado la muestra de Botón usa el relieve del bloque; más chica, uno reducido. */
const SWATCH_BIG = 24;
const BUTTON_RELIEF_SMALL = `inset 1px 1px 1px ${white(0.35)}, inset -1px -2px 2px rgba(0,0,0,0.3)`;
const SWATCH_SHINE = `linear-gradient(135deg, ${white(0.45)} 0%, ${white(0)} 55%)`;

/** Como `blockPaint`, para una muestra de lado `size`: sin sombra exterior y con bordes a escala. */
export function swatchPaint(
  paletteId: string | null | undefined,
  engineColor: string,
  size: number,
  insetShadows = true,
): Omit<BlockPaint, 'boxShadow'> & { boxShadow?: string } {
  const { boxShadow: _blockShadow, borderWidth, ...paint } = blockPaint(paletteId, engineColor, insetShadows);
  const { style, shine } = getPalette(paletteId);
  let inner: string | undefined;
  if (style === 'glass') inner = GLASS_LIGHT;
  else if (style === 'frosted') inner = FROSTED_LIGHT;
  else if (style === 'inset' && insetShadows) inner = size < SWATCH_BIG ? BUTTON_RELIEF_SMALL : BUTTON_RELIEF;
  return {
    ...paint,
    ...(borderWidth ? { borderWidth: Math.min(borderWidth, size * SWATCH_BORDER_MAX) } : null),
    ...(shine ? { backgroundImage: SWATCH_SHINE } : null),
    ...(inner ? { boxShadow: inner } : null),
  };
}
