import { OP_SYMBOL, OP_WIDTH_RATIO } from '@tb/engine';

/**
 * Lógica de la vista previa de la Colección (`components/PreviewPanel.tsx`): nueve bloques de
 * muestra que se tocan, se destruyen y reaparecen. Es solo una demostración: no usa el juego del
 * motor (ni vidas, reloj o estadísticas) y el azar es decorativo. Módulo puro.
 */

export type PreviewKind = 'num' | 'op' | 'trap';
type Op = keyof typeof OP_SYMBOL;

/**
 * Qué hay en cada casilla del 3×3 (la posición es también su color en `COLORS`). El tipo no cambia
 * al reaparecer, así siempre hay números, operaciones y una trampa roja; la trampa va al centro
 * porque el motor solo pone trampas rojas sobre los colores de `SAFE`.
 */
export const PREVIEW_KINDS: readonly PreviewKind[] = ['num', 'op', 'num', 'op', 'trap', 'num', 'num', 'num', 'op'];

/** Lo que tarda en reaparecer un bloque destruido (ms). */
export const PREVIEW_RESPAWN_MS = 800;

export interface PreviewBlock {
  kind: PreviewKind;
  /** La operación ("2+3"); en los números y la trampa, su valor. */
  label: string;
  /** La operación leída en voz alta ("2 más 3"). */
  spoken: string;
  /** Toques que pide (su resultado). */
  total: number;
  left: number;
  alive: boolean;
  /** Sube al reaparecer: el bloque se vuelve a montar (con su animación de aparición). */
  gen: number;
}

export type PreviewState = readonly PreviewBlock[];

type Shape = Pick<PreviewBlock, 'label' | 'spoken' | 'total'>;

const number = (n: number): Shape => ({ label: String(n), spoken: String(n), total: n });

const WORD: Record<Op, string> = { add: 'más', sub: 'menos', mul: 'por', div: 'dividido en' };

const operation = (a: number, op: Op, b: number, total: number): Shape => ({
  label: `${a}${OP_SYMBOL[op]}${b}`,
  spoken: `${a} ${WORD[op]} ${b}`,
  total,
});

/** Valores posibles de cada tipo: resultados cortos, para destruir seguido. */
export const PREVIEW_SHAPES: Record<PreviewKind, readonly Shape[]> = {
  num: [1, 2, 3, 4, 5].map(number),
  op: [
    operation(2, 'add', 3, 5),
    operation(8, 'div', 2, 4),
    operation(3, 'sub', 1, 2),
    operation(2, 'mul', 2, 4),
    operation(1, 'add', 2, 3),
    operation(4, 'sub', 1, 3),
    operation(6, 'div', 3, 2),
    operation(1, 'add', 1, 2),
  ],
  trap: [2, 3, 4, 5].map(number),
};

/** Un bloque nuevo del tipo, distinto de `previous`. `random` devuelve [0, 1). */
function makeBlock(kind: PreviewKind, random: () => number, previous?: string, gen = 0): PreviewBlock {
  const options = PREVIEW_SHAPES[kind].filter((s) => s.label !== previous);
  const shape = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
  return { kind, ...shape, left: shape.total, alive: true, gen };
}

export function initialPreview(random: () => number): PreviewState {
  return PREVIEW_KINDS.map((kind) => makeBlock(kind, random));
}

export interface PreviewTap {
  /** El mismo objeto si el toque no hizo nada. */
  state: PreviewState;
  /** Toques dados al bloque, si suena como golpe. */
  hit: number | null;
  /** Si el toque lo destruyó, y cómo. */
  destroyed: 'kill' | 'trap' | null;
}

/**
 * Un toque en la casilla `i`, como en la partida: cada toque suena como golpe (también el último, que
 * además destruye); la trampa estalla al primer toque.
 */
export function previewStep(state: PreviewState, i: number): PreviewTap {
  const b = state[i];
  if (!b || !b.alive) return { state, hit: null, destroyed: null };
  const put = (next: PreviewBlock) => state.map((x, j) => (j === i ? next : x));
  if (b.kind === 'trap') return { state: put({ ...b, alive: false }), hit: null, destroyed: 'trap' };
  const left = b.left - 1;
  const alive = left > 0;
  return { state: put({ ...b, left, alive }), hit: b.total - left, destroyed: alive ? null : 'kill' };
}

/** Vuelve a poner un bloque (con otro valor) en la casilla `i` si estaba destruido. */
export function previewRespawn(state: PreviewState, i: number, random: () => number): PreviewState {
  const b = state[i];
  if (!b || b.alive) return state;
  return state.map((x, j) => (j === i ? makeBlock(b.kind, random, b.label, b.gen + 1) : x));
}

/** Repone de una vez todos los destruidos (al salir de la pantalla). */
export function previewReviveAll(state: PreviewState, random: () => number): PreviewState {
  return state.reduce<PreviewState>((s, _, i) => previewRespawn(s, i, random), state);
}

/** Texto del bloque: los números muestran los toques que faltan; operaciones y trampa, su etiqueta. */
export function previewText(b: PreviewBlock): string {
  return b.kind === 'num' ? String(b.left) : b.label;
}

/** Etiqueta de accesibilidad de la casilla. */
export function previewA11yLabel(b: PreviewBlock): string {
  if (!b.alive) return 'Bloque destruido';
  if (b.kind === 'trap') return 'Bloque trampa; aquí no hace daño';
  const left = b.left === 1 ? 'falta 1 toque' : `faltan ${b.left} toques`;
  return b.kind === 'op' ? `Operación ${b.spoken}, resultado ${b.total}, ${left}` : `Bloque, ${left}`;
}

// ---------------------------------------------------------------- disposición

const PAD_X = 10;
const PAD_TOP = 14;
/** Abajo sobra algo más: la sombra del bloque cae 5 px. */
const PAD_BOTTOM = 18;
const GAP_X = 10;
const GAP_Y = 14;

export interface PreviewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Campo de 3×3 para un ancho interior en px: cada casilla mide lo que un bloque de operación y el
 * bloque de número (cuadrado) va centrado en ella.
 */
export function previewLayout(width: number): { height: number; cells: PreviewRect[]; blocks: PreviewRect[] } {
  const w = Math.max(0, (width - 2 * PAD_X - 2 * GAP_X) / 3);
  const h = Math.round(w / OP_WIDTH_RATIO);
  const cells = PREVIEW_KINDS.map((_, i) => ({
    x: PAD_X + (i % 3) * (w + GAP_X),
    y: PAD_TOP + Math.floor(i / 3) * (h + GAP_Y),
    w,
    h,
  }));
  const blocks = cells.map((c, i) => (PREVIEW_KINDS[i] === 'op' ? c : { ...c, x: c.x + (c.w - h) / 2, w: h }));
  return { height: PAD_TOP + 3 * h + 2 * GAP_Y + PAD_BOTTOM, cells, blocks };
}
