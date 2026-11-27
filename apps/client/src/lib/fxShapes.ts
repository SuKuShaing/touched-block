import type { EffectId } from '@/cosmetics/ids';

/**
 * Formas y movimiento de los efectos al destruir hechos de "piezas" (todos menos Clásico,
 * Chispas, Confeti y Corazones, que siguen en `components/Fx.tsx`). Módulo puro, sin React
 * Native: `makePieces` sortea las piezas de un estallido (datos planos) y `frameAt` dice cómo se
 * ve cada una en el momento `p` (0 a 1, lineal). `Fx.tsx` llama a `frameAt` en el hilo de la
 * interfaz, por eso lleva `'worklet'`, igual que sus auxiliares (que deben ir antes que ella).
 *
 * Son las mismas fórmulas, y en el mismo orden de sorteo, que `FX_NUEVOS` de
 * `config_logros/preview.js`, que el usuario aprobó viéndolas allí. Es solo decoración: el azar es
 * `Math.random` y nada de esto llega al motor.
 */

/** Efectos que se dibujan con piezas. */
export type ShapeEffect = Extract<
  EffectId,
  'burbujas' | 'emojis' | 'ondas' | 'rayos' | 'monedas' | 'pixeles' | 'fugaces' | 'fuegos'
>;

const SHAPE_EFFECTS: Record<ShapeEffect, true> = {
  burbujas: true,
  emojis: true,
  ondas: true,
  rayos: true,
  monedas: true,
  pixeles: true,
  fugaces: true,
  fuegos: true,
};

export function isShapeEffect(effect: string): effect is ShapeEffect {
  return Object.prototype.hasOwnProperty.call(SHAPE_EFFECTS, effect);
}

/**
 * Cuánto vive montado un estallido (ms): algo más que su pieza más larga (retraso + duración),
 * para que no se corten los últimos fotogramas.
 */
export const BURST_LIFETIME: Record<EffectId, number> = {
  normal: 750,
  chispas: 750,
  confeti: 750,
  corazones: 750,
  burbujas: 950,
  emojis: 850,
  ondas: 800,
  rayos: 500,
  monedas: 950,
  pixeles: 700,
  fugaces: 800,
  fuegos: 950,
};

/** Emojis de Unicode 6.1 o anterior: los dibuja cualquier teléfono. */
export const EMOJIS: readonly string[] = ['🎉', '⭐', '🔥', '💥', '😎', '😍', '💯', '✨'];

// ---------------------------------------------------------------- movimiento

/** Cómo se ve una pieza en un momento: desplazamiento (px), giro (grados), escala, escala horizontal extra y opacidad. */
export interface Frame {
  x: number;
  y: number;
  r: number;
  s: number;
  sx: number;
  o: number;
}

/** Trayectoria de una pieza (datos planos). `soft` = con "reducir movimiento". */
export type Motion =
  | { kind: 'burbuja'; rise: number; amp: number; freq: number; fase: number; soft: boolean }
  | { kind: 'emoji'; a: number; d: number; giro: number; soft: boolean }
  | { kind: 'anillo' }
  | { kind: 'gota'; a: number; d: number; soft: boolean }
  | { kind: 'moneda'; up: number; end: number; dx: number; vueltas: number; fase: number; soft: boolean }
  | { kind: 'trazo'; dir: number; ang: number; soft: boolean }
  /** Punto que crece (de `from` a `from + grow`) y se apaga: centro de Rayos y de Estrellas fugaces. */
  | { kind: 'destello'; from: number; grow: number }
  | { kind: 'estela'; rise: number }
  | { kind: 'chispa'; a: number; d: number; soft: boolean }
  | { kind: 'fogonazo' }
  | { kind: 'pixel'; vx: number; vy: number; g: number; fin: number; soft: boolean }
  | { kind: 'cola'; largo: number; d: number; soft: boolean }
  | { kind: 'estrella'; d: number; soft: boolean };

const TAU = Math.PI * 2;
/** Dirección de las estrellas fugaces (grados): hacia abajo a la izquierda. */
const FALL_DEG = 148;
const FALL_COS = Math.cos((FALL_DEG * Math.PI) / 180);
const FALL_SIN = Math.sin((FALL_DEG * Math.PI) / 180);
/** Píxeles: fracción de la animación que dura el apagado (rápido, pero sin cortar de golpe). */
const PIXEL_FADE = 0.08;

/** Salida suave (ease-out cuadrático). */
function easeOut(p: number): number {
  'worklet';
  return 1 - (1 - p) * (1 - p);
}

/** Rampa: 0 antes de `a`, 1 después de `b`. */
function ramp(p: number, a: number, b: number): number {
  'worklet';
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}

function frame(x: number, y: number, r: number, s: number, sx: number, o: number): Frame {
  'worklet';
  return { x, y, r, s, sx, o };
}

/** Estado de una pieza en `p` (tiempo lineal de 0 a 1 desde que termina su retraso). */
export function frameAt(m: Motion, p: number): Frame {
  'worklet';
  switch (m.kind) {
    case 'burbuja': {
      // sube con vaivén y al final revienta: crece un poco y se desvanece
      const pop = ramp(p, 0.78, 1);
      const s = (m.soft ? 1 : 0.5 + 0.5 * ramp(p, 0, 0.15)) + (m.soft ? 0 : 0.35 * pop);
      return frame(m.amp * Math.sin(TAU * m.freq * p + m.fase), -m.rise * easeOut(p), 0, s, 1, Math.min(1, p * 10) * (1 - pop));
    }
    case 'emoji': {
      // sale en abanico y salta: escala 0,4 → 1,2 → 1 → 0,85
      const q = easeOut(p);
      const s = p < 0.25 ? 0.4 + 0.8 * (p / 0.25) : p < 0.5 ? 1.2 - 0.2 * ramp(p, 0.25, 0.5) : 1 - 0.15 * ramp(p, 0.5, 1);
      const k = m.soft ? 0.5 : 1;
      return frame(Math.cos(m.a) * m.d * q * k, (Math.sin(m.a) * m.d - 14) * q * k, m.giro * q, m.soft ? 1 : s, 1, 1 - ramp(p, 0.6, 1));
    }
    case 'anillo':
      // solo cambia la escala (el borde crece con ella): nada de layout por fotograma
      return frame(0, 0, 0, 0.2 + 0.8 * easeOut(p), 1, Math.min(1, p * 20) * 0.95 * (1 - p));
    case 'gota': {
      const q = easeOut(p);
      const fall = (m.soft ? 0 : 22) * p * p;
      return frame(Math.cos(m.a) * m.d * q, Math.sin(m.a) * m.d * q + fall, 0, 1 - 0.6 * p, 1, 1 - p * p);
    }
    case 'moneda': {
      // parábola con gravedad: y(0) = 0, y(1) = end. El giro sobre su eje es la escala horizontal
      const k = m.soft ? 0.5 : 1;
      const sx = m.soft ? 1 : Math.max(0.12, Math.abs(Math.cos(TAU * m.vueltas * p + m.fase)));
      const y = (-m.up * p + (m.up + m.end) * p * p) * k;
      return frame(m.dx * p * k, y, 0, 1, sx, Math.min(1, p * 20) * (1 - ramp(p, 0.7, 1)));
    }
    case 'trazo': {
      // un solo parpadeo (menos de 3 destellos por segundo); sin él con movimiento reducido
      const o = m.soft ? 1 - p : p < 0.18 ? 1 : p < 0.34 ? 0.3 : p < 0.58 ? 1 : 1 - ramp(p, 0.58, 1);
      const q = easeOut(p);
      return frame(Math.cos(m.dir) * 10 * q, Math.sin(m.dir) * 10 * q, m.ang, 1, 1, o);
    }
    case 'destello':
      return frame(0, 0, 0, m.from + m.grow * easeOut(p), 1, (1 - p) * (1 - p));
    case 'estela':
      return frame(0, -m.rise * p, 0, 1, 1, p < 0.95 ? 1 : 0);
    case 'chispa': {
      const q = easeOut(p);
      const fall = (m.soft ? 0 : 18) * p * p;
      return frame(Math.cos(m.a) * m.d * q, Math.sin(m.a) * m.d * q + fall, 0, 1 - 0.5 * p, 1, Math.min(1, p * 14) * (1 - ramp(p, 0.75, 1)));
    }
    case 'fogonazo':
      return frame(0, 0, 0, 0.5 + 1.1 * easeOut(p), 1, Math.min(1, p * 30) * (1 - p));
    case 'pixel': {
      if (m.soft) return frame(m.vx * p * 0.35, (m.vy * p + m.g * p * p) * 0.35, 0, 1, 1, 1 - ramp(p, 0.3, 1));
      // movimiento continuo (antes iba a saltos de 8 pasos y se veía entrecortado en el teléfono);
      // lo "8 bits" queda en los cuadrados sin bordes redondos y el apagado rápido al llegar a `fin`
      return frame(m.vx * p, m.vy * p + m.g * p * p, 0, 1, 1, 1 - ramp(p, m.fin - PIXEL_FADE, m.fin));
    }
    case 'cola': {
      // la estela crece sin despegarse de la estrella
      const sx = m.soft ? 1 : 0.25 + 0.75 * ramp(p, 0, 0.45);
      const run = (m.soft ? p : 0.45 * p + 0.55 * p * p) * m.d + (m.largo / 2) * (1 - sx);
      return frame(FALL_COS * run, FALL_SIN * run, FALL_DEG, 1, sx, Math.min(1, p * 8) * (1 - ramp(p, 0.65, 1)));
    }
    case 'estrella': {
      // acelera, como un meteoro
      const run = (m.soft ? p : 0.45 * p + 0.55 * p * p) * m.d;
      const o = Math.min(1, p * 8) * (1 - ramp(p, 0.65, 1));
      return frame(FALL_COS * run, FALL_SIN * run, m.soft ? 0 : -150 * p, m.soft ? 1 : 1 - 0.35 * p, 1, o);
    }
  }
}

// ---------------------------------------------------------------- piezas

/** Dibujo de una pieza: una caja (`view`) o un carácter (`text`). */
export type Look =
  | {
      type: 'view';
      color?: string;
      radius: number;
      borderWidth?: number;
      borderColor?: string;
      /** `linear-gradient(...)` de la estela de una estrella fugaz. */
      gradient?: string;
      /** Lado del reflejo blanco de una burbuja (hijo de la pieza). */
      glint?: number;
    }
  | { type: 'text'; text: string; fontSize: number; color?: string };

export interface Piece {
  w: number;
  h: number;
  /** Centro de la pieza respecto al centro del bloque. */
  ox: number;
  oy: number;
  /** ms antes de empezar a moverse (mientras tanto se ve como en p = 0). */
  delay: number;
  /** ms de la animación. */
  dur: number;
  look: Look;
  motion: Motion;
}

const WHITE = '#ffffff';
const PALE_YELLOW = '#fff3b0';

/** `#rrggbb` → [r, g, b]. */
function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Mezcla `hex` con blanco (`to` = 255) o negro (`to` = 0) en la proporción `t`, por canal. */
function mix(hex: string, to: number, t: number): string {
  return `#${channels(hex)
    .map((v) => Math.round(v * (1 - t) + to * t).toString(16).padStart(2, '0'))
    .join('')}`;
}

type Rand = () => number;
type Range = (a: number, b: number) => number;
type Maker = (color: string, soft: boolean, rand: Rand, range: Range) => Piece[];

const times = <T>(n: number, fn: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => fn(i));

/** Copia desordenada. */
const shuffled = <T>(list: readonly T[], rand: Rand): T[] =>
  list
    .map((v) => [rand(), v] as const)
    .sort((a, b) => a[0] - b[0])
    .map((x) => x[1]);

/** Caja redonda de un color. */
const dot = (w: number, color: string, rest: Omit<Piece, 'w' | 'h' | 'look'>): Piece => ({
  ...rest,
  w,
  h: w,
  look: { type: 'view', color, radius: w / 2 },
});

const MAKERS: Record<ShapeEffect, Maker> = {
  // 6 burbujas (o 3), cada una con su reflejo (2 nodos), que suben y revientan
  burbujas: (color, soft, _rand, range) =>
    times(soft ? 3 : 6, () => {
      const size = Math.round(range(14, 26));
      const rise = range(70, 125);
      const amp = soft ? 0 : range(4, 9);
      const freq = range(1, 2);
      const fase = range(0, TAU);
      return {
        w: size,
        h: size,
        ox: range(-34, 34),
        oy: range(-5, 5),
        delay: soft ? 0 : range(0, 100),
        dur: range(520, 760) * (soft ? 0.7 : 1),
        look: {
          type: 'view',
          color: rgba(color, 0.25),
          radius: size / 2,
          borderWidth: 1.5,
          borderColor: 'rgba(255, 255, 255, 0.75)',
          glint: Math.max(3, Math.round(size * 0.22)),
        },
        motion: { kind: 'burbuja', rise, amp, freq, fase, soft },
      };
    }),

  // 6 emojis (o 3) distintos de un grupo de 8, en abanico; cada uno con su propio color
  emojis: (_color, soft, rand, range) => {
    const n = soft ? 3 : 6;
    return shuffled(EMOJIS, rand)
      .slice(0, n)
      .map((text, i) => {
        const a = (i / n) * TAU + range(-0.4, 0.4);
        const d = range(35, 85);
        const size = Math.round(range(20, 26));
        const giro = soft ? 0 : range(-25, 25);
        return {
          w: Math.round(size * 1.3),
          h: Math.round(size * 1.3),
          ox: 0,
          oy: 0,
          delay: 0,
          dur: range(550, 750) * (soft ? 0.7 : 1),
          look: { type: 'text', text, fontSize: size },
          motion: { kind: 'emoji', a, d, giro, soft },
        };
      });
  },

  // 3 anillos (color, blanco, color) que nacen cada 90 ms y 6 gotas; reducido: 1 anillo y 3 gotas
  ondas: (color, soft, _rand, range) => {
    const rings = times(soft ? 1 : 3, (i): Piece => ({
      w: 96,
      h: 96,
      ox: 0,
      oy: 0,
      delay: i * 90,
      dur: soft ? 380 : 520,
      look: { type: 'view', radius: 48, borderWidth: 4, borderColor: i === 1 ? 'rgba(255, 255, 255, 0.85)' : color },
      motion: { kind: 'anillo' },
    }));
    const n = soft ? 3 : 6;
    const drops = times(n, (i) => {
      const a = (i / n) * TAU + range(-0.3, 0.3);
      const d = range(40, 75) * (soft ? 0.6 : 1);
      const dur = range(450, 600) * (soft ? 0.7 : 1);
      return dot(6, color, { ox: 0, oy: 0, delay: 0, dur, motion: { kind: 'gota', a, d, soft } });
    });
    return rings.concat(drops);
  },

  // 6 monedas doradas (o 3): suben, caen y giran sobre su eje
  monedas: (_color, soft, _rand, range) =>
    times(soft ? 3 : 6, () => {
      const up = range(260, 320); // impulso hacia arriba
      const end = range(50, 90); // cuánto más abajo que el bloque termina
      const dx = range(-60, 60);
      const vueltas = range(2.5, 4);
      const fase = range(0, 3);
      return {
        w: 18,
        h: 18,
        ox: 0,
        oy: 0,
        delay: soft ? 0 : range(0, 80),
        dur: range(600, 760) * (soft ? 0.7 : 1),
        look: { type: 'view', color: '#ffc933', radius: 9, borderWidth: 2, borderColor: '#c98a00' },
        motion: { kind: 'moneda', up, end, dx, vueltas, fase, soft },
      };
    }),

  // 5 rayos (o 2) en zigzag de 2 trazos y un destello central
  rayos: (color, soft, rand, range) => {
    const n = soft ? 2 : 5;
    // `angle`: hacia dónde apunta el trazo; `dir`: hacia dónde deriva (la del rayo, en sus dos trazos)
    const stroke = (cx: number, cy: number, len: number, angle: number, dir: number, tone: string): Piece => ({
      w: Math.round(len),
      h: 4,
      ox: cx,
      oy: cy,
      delay: 0,
      dur: soft ? 300 : 420,
      look: { type: 'view', color: tone, radius: 2 },
      motion: { kind: 'trazo', dir, ang: (angle * 180) / Math.PI, soft },
    });
    const pieces: Piece[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + range(-0.4, 0.4);
      const la = range(22, 30);
      const lb = range(16, 24);
      const b = a + (rand() < 0.5 ? -1 : 1) * range(0.6, 1.05);
      const sx = Math.cos(a) * 8;
      const sy = Math.sin(a) * 8;
      const ex = sx + Math.cos(a) * la;
      const ey = sy + Math.sin(a) * la;
      pieces.push(stroke(sx + (Math.cos(a) * la) / 2, sy + (Math.sin(a) * la) / 2, la, a, a, WHITE));
      pieces.push(stroke(ex + (Math.cos(b) * lb) / 2, ey + (Math.sin(b) * lb) / 2, lb, b, a, color));
    }
    pieces.push(dot(24, WHITE, { ox: 0, oy: 0, delay: 0, dur: 180, motion: { kind: 'destello', from: 0.3, grow: 0.9 } }));
    return pieces;
  },

  // un cohete sube 46 px y estalla en 10 chispas de dos anillos con un fogonazo; reducido: solo 5 chispas
  fuegos: (color, soft, _rand, range) => {
    const rise = 46;
    const pieces: Piece[] = [];
    if (!soft) {
      pieces.push({
        w: 3,
        h: 12,
        ox: 0,
        oy: 0,
        delay: 0,
        dur: 290,
        look: { type: 'view', color: PALE_YELLOW, radius: 2 },
        motion: { kind: 'estela', rise },
      });
    }
    const n = soft ? 5 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + range(-0.15, 0.15);
      const d = (i % 2 ? range(30, 42) : range(52, 68)) * (soft ? 0.6 : 1); // anillo grande (pares) y chico
      pieces.push(
        dot(7, i % 3 === 0 ? WHITE : color, {
          ox: 0,
          oy: -rise,
          delay: soft ? 0 : 290,
          dur: (soft ? 0.7 : 1) * 560,
          motion: { kind: 'chispa', a, d, soft },
        }),
      );
    }
    if (!soft) pieces.push(dot(16, WHITE, { ox: 0, oy: -rise, delay: 290, dur: 160, motion: { kind: 'fogonazo' } }));
    return pieces;
  },

  // 12 píxeles (rejilla de 4×3, o 3×2) en tres tonos del color del bloque, que saltan y caen
  pixeles: (color, soft, rand, range) => {
    const cols = soft ? 3 : 4;
    const rows = soft ? 2 : 3;
    const tones = [color, mix(color, 255, 0.55), mix(color, 0, 0.18)];
    return times(cols * rows, (i): Piece => {
      const ox = ((i % cols) - (cols - 1) / 2) * 15;
      const oy = (Math.floor(i / cols) - (rows - 1) / 2) * 15;
      const vx = ox * range(2.6, 4.4) + range(-16, 16);
      const vy = oy * range(2, 3.4) - range(50, 90);
      const g = range(110, 160);
      const fin = 0.625 + 0.125 * Math.floor(rand() * 3); // se apaga al 62,5 %, 75 % u 87,5 % de la animación
      return {
        w: 13,
        h: 13,
        ox,
        oy,
        delay: 0,
        dur: soft ? 450 : 640,
        look: { type: 'view', color: tones[(i + Math.floor(i / cols)) % 3], radius: 0 },
        motion: { kind: 'pixel', vx, vy, g, fin, soft },
      };
    });
  },

  // 5 estrellas (o 2) con estela que cruzan el bloque en diagonal, una tras otra, y un destello
  fugaces: (color, soft, rand, range) => {
    const n = soft ? 2 : 5;
    const order = shuffled(times(n, (i) => i), rand);
    const pieces: Piece[] = [];
    for (let i = 0; i < n; i++) {
      const side = (i - (n - 1) / 2) * 21 + range(-5, 5); // separación perpendicular a la trayectoria
      const back = range(25, 52); // nace un poco antes del bloque
      const x0 = -FALL_COS * back - FALL_SIN * side;
      const y0 = -FALL_SIN * back + FALL_COS * side;
      const d = range(115, 155) * (soft ? 0.5 : 1);
      const largo = Math.round(range(48, 70));
      const size = Math.round(range(19, 25));
      const delay = soft ? 0 : order[i] * 55 + range(0, 20);
      const dur = range(400, 520) * (soft ? 0.7 : 1);
      const golden = i % 2 === 0;
      const tint = golden ? '#ffe27a' : mix(color, 255, 0.45);
      pieces.push(
        {
          w: largo,
          h: 5,
          ox: x0 - (FALL_COS * largo) / 2,
          oy: y0 - (FALL_SIN * largo) / 2,
          delay,
          dur,
          look: { type: 'view', radius: 2, gradient: `linear-gradient(90deg, ${rgba(tint, 0)}, ${rgba(tint, 0.95)})` },
          motion: { kind: 'cola', largo, d, soft },
        },
        {
          w: Math.round(size * 1.2),
          h: Math.round(size * 1.2),
          ox: x0,
          oy: y0,
          delay,
          dur,
          look: { type: 'text', text: '★', fontSize: size, color: golden ? PALE_YELLOW : WHITE },
          motion: { kind: 'estrella', d, soft },
        },
      );
    }
    if (!soft) pieces.push(dot(30, PALE_YELLOW, { ox: 0, oy: 0, delay: 0, dur: 170, motion: { kind: 'destello', from: 0.35, grow: 1.05 } }));
    return pieces;
  },
};

/**
 * Piezas de un estallido. `color`: el del bloque, ya traducido a la paleta (`#rrggbb`).
 * `reduced`: con "reducir movimiento" hay menos piezas, más cortas y sin giros, vaivén ni parpadeo.
 * El número de piezas es fijo por efecto (no usa el `count` del estallido).
 */
export function makePieces(effect: ShapeEffect, color: string, reduced: boolean, rand: Rand = Math.random): Piece[] {
  const range: Range = (a, b) => a + rand() * (b - a);
  return MAKERS[effect](color, reduced, rand, range);
}
