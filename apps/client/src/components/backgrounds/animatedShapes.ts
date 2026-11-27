/**
 * Datos y cuentas puras de los fondos animados (`animated.tsx`): sin React Native, con test.
 * Los valores son los de la maqueta (`config_logros/extras-fondos.css`), en px del campo.
 *
 * Las animaciones usan **un valor compartido por capa** medido en vueltas (la parte entera no
 * importa), así pausar y seguir no da saltos.
 */

// ---------------------------------------------------------------- movimiento
// Las funciones marcadas 'worklet' corren en el hilo de interfaz; el orden importa (cada una
// se declara antes de usarse).

/** Parte fraccionaria de una vuelta, siempre en [0, 1). */
export function wrap(cycle: number): number {
  'worklet';
  return cycle - Math.floor(cycle);
}

/** Desplazamiento de una capa que cae: de 0 a un mosaico justo, así la vuelta no se nota. */
export function fallOffset(cycle: number, period: number): number {
  'worklet';
  return wrap(cycle) * period;
}

/** Luciérnagas: se encienden y avanzan hasta media vuelta y vuelven, con arranque y freno suaves. */
export function fireflyPose(cycle: number): { opacity: number; x: number; y: number } {
  'worklet';
  const p = wrap(cycle);
  const half = p < 0.5 ? p * 2 : 2 - p * 2;
  const g = 0.5 - 0.5 * Math.cos(Math.PI * half);
  return { opacity: 0.05 + 0.95 * g, x: 10 * g, y: -14 * g };
}

/** Opacidad de las luciérnagas quietas (movimiento reducido). */
export const FIREFLY_REST_OPACITY = 0.7;

// ---------------------------------------------------------------- lluvia

export const RAIN = {
  /** Mosaico de la lluvia; su alto es lo que baja la capa en cada vuelta. */
  w: 100,
  h: 150,
  ms: 1400,
  /** Escala del mosaico en la miniatura (34 × 51). */
  thumbScale: 0.34,
  path: 'M18 8l-4 22M64 52l-4 22M40 104l-4 22M86 126l-4 22',
} as const;

// ---------------------------------------------------------------- nieve

/** [x, y, radio, opacidad] */
export type Flake = readonly [number, number, number, number];

export interface SnowLayer {
  w: number;
  h: number;
  ms: number;
  color: string;
  flakes: readonly Flake[];
}

/** Copos grandes (los de atrás). */
export const SNOW_BIG: SnowLayer = {
  w: 160,
  h: 200,
  ms: 11000,
  color: '#eaf5ff',
  flakes: [
    [20, 30, 2.4, 0.75],
    [75, 12, 1.7, 0.6],
    [130, 48, 2.6, 0.8],
    [45, 88, 1.6, 0.55],
    [100, 110, 2.2, 0.7],
    [150, 150, 1.8, 0.6],
    [12, 140, 2.4, 0.75],
    [70, 172, 1.7, 0.55],
    [118, 190, 1.5, 0.55],
  ],
};

/** Copos chicos y más lentos (se dibujan encima). */
export const SNOW_SMALL: SnowLayer = {
  w: 110,
  h: 140,
  ms: 17000,
  color: '#cfe6ff',
  flakes: [
    [15, 20, 1.2, 0.5],
    [60, 50, 1.4, 0.55],
    [95, 15, 1, 0.45],
    [30, 80, 1.3, 0.5],
    [80, 105, 1.1, 0.45],
    [100, 70, 1.3, 0.5],
    [50, 125, 1, 0.4],
    [8, 110, 1.4, 0.55],
  ],
};

/** Escalas de la miniatura: copos a 0,4 y lomas a 0,5. */
export const SNOW_THUMB = { flakes: 0.4, ground: 0.5 } as const;

/** Nieve acumulada: dos lomas azules con la cresta clara. `sink` = cuánto baja del borde. */
export const SNOW_GROUND = {
  w: 200,
  h: 36,
  sink: 2,
  thumbSink: 1,
  hills: [
    { fill: '#2f4e77', crest: '#7fa6d0', line: 'M0 16C30 2 55 4 85 14S170 30 200 16' },
    { fill: '#3d5f8c', crest: '#a9c8ea', line: 'M0 28C40 16 70 20 105 26S160 40 200 28' },
  ],
  /** Cierra cada loma por abajo. */
  close: 'V36H0Z',
} as const;

// ---------------------------------------------------------------- luciérnagas

export const GRASS = {
  w: 80,
  h: 38,
  sink: 2,
  thumbSink: 1,
  thumbScale: 0.5,
  color: '#02140a',
  path: 'M0 36V26L4 12L7 26L11 18L14 28L20 4L23 27L29 16L31 28L36 22L40 10L43 28L50 14L52 27L58 20L62 6L65 28L71 17L74 27L80 26V36Z',
} as const;

/** Un punto en % del campo. */
export type Spot = readonly [number, number];

/** Los dos grupos que laten, cada uno con su ritmo; el segundo arranca adelantado 3 de sus 8 s. */
export const FIREFLY_GROUPS: readonly { ms: number; phase: number; spots: readonly Spot[] }[] = [
  {
    ms: 6000,
    phase: 0,
    spots: [
      [15, 70],
      [38, 34],
      [62, 78],
      [84, 48],
      [52, 18],
    ],
  },
  {
    ms: 8000,
    phase: 3 / 8,
    spots: [
      [24, 16],
      [70, 30],
      [90, 84],
      [30, 90],
      [56, 56],
    ],
  },
];

/** Una luz: radio del halo, núcleo pleno y arranque del halo (px). */
export interface Glow {
  r: number;
  core: number;
  mid: number;
  midOpacity: number;
}

export const GLOW: Glow = { r: 13, core: 1.8, mid: 3, midOpacity: 0.38 };
export const GLOW_THUMB: Glow = { r: 8, core: 1.4, mid: 2.2, midOpacity: 0.45 };
export const GLOW_CORE_COLOR = '#f4ff96';
export const GLOW_HALO_COLOR = '#dcf564';

/** Las cuatro luces fijas de la miniatura. */
export const THUMB_SPOTS: readonly Spot[] = [
  [18, 62],
  [40, 28],
  [66, 66],
  [82, 38],
];

// ---------------------------------------------------------------- galaxia

export const GALAXY = {
  /** Lado en el campo (px); en vistas previas se achica con `cell`. */
  size: 380,
  thumbSize: 46,
  ms: 90000,
  /** Altura del centro, en % del campo. */
  centerY: 45,
  coreRadius: 27,
} as const;

/** Lado de la galaxia según el mosaico de referencia (44 = campo de juego). */
export function galaxySize(cell: number): number {
  return Math.round(GALAXY.size * Math.min(1, Math.max(0, cell) / 44));
}

/** Estrellitas fijas del fondo: [x %, y %, radio, opacidad]. */
export const GALAXY_STARS: readonly (readonly [number, number, number, number])[] = [
  [10, 14, 1.1, 0.85],
  [82, 8, 0.85, 0.65],
  [90, 74, 1.1, 0.75],
  [16, 86, 0.85, 0.65],
  [56, 94, 0.85, 0.5],
  [6, 50, 0.85, 0.55],
];

// brazo en tres largos (el trazo largo, el corto y el medio)
const ARM_SHORT = 'M6-4C20-6 34 6 30 24C25 46-2 56-28 46';
const ARM_MID = `${ARM_SHORT}C-58 34-70 2-58-30`;
const ARM_LONG = `${ARM_MID}C-46-62-10-78 28-70`;

export interface ArmStroke {
  d: string;
  color: string;
  width: number;
  opacity: number;
  /** Separación de los puntos (trazo punteado que hace de estrellas). */
  gap?: number;
  /** Giro del primer brazo; el otro es el mismo a 180°. */
  turn: number;
  scale: number;
}

const arm = (d: string, color: string, width: number, opacity: number, gap?: number, turn = 0, scale = 1): ArmStroke => ({
  d,
  color,
  width,
  opacity,
  gap,
  turn,
  scale,
});

/**
 * Capas de la espiral, de abajo hacia arriba, en un `viewBox` de -100 a 100. Las opacidades están
 * atenuadas a propósito (los brazos no deben parecer un bloque): no subirlas.
 */
export const GALAXY_ARMS: readonly ArmStroke[] = [
  arm(ARM_SHORT, '#7a5cf0', 24, 0.07),
  arm(ARM_MID, '#7a5cf0', 15, 0.07),
  arm(ARM_MID, '#5f9cff', 9, 0.09),
  arm(ARM_LONG, '#5f9cff', 4, 0.14),
  arm(ARM_LONG, '#d8c8ff', 1.5, 0.38, 9, 52, 0.86),
  arm(ARM_LONG, '#cfe4ff', 1.2, 0.34),
  arm(ARM_LONG, '#ffffff', 2.2, 0.68, 13),
  arm(ARM_LONG, '#ff9be0', 1.8, 0.55, 19, 16, 1.08),
];

/** Núcleo cálido: [posición, color, opacidad]. */
export const GALAXY_CORE: readonly (readonly [number, string, number])[] = [
  [0, '#fff0d0', 0.34],
  [0.3, '#c79cf0', 0.1],
  [1, '#8a6cff', 0],
];
