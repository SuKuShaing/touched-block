import { describe, expect, it } from 'vitest';
import type { EffectId } from '@/cosmetics/ids';
import { BURST_LIFETIME, EMOJIS, type Piece, type ShapeEffect, frameAt, isShapeEffect, makePieces } from './fxShapes';

/** Piezas por efecto: [normal, con movimiento reducido]. */
const PIECES: Record<ShapeEffect, [number, number]> = {
  burbujas: [6, 3],
  emojis: [6, 3],
  ondas: [9, 4],
  rayos: [11, 5],
  monedas: [6, 3],
  pixeles: [12, 6],
  fugaces: [11, 4],
  fuegos: [12, 5],
};
const SHAPES = Object.keys(PIECES) as ShapeEffect[];
const COLOR = '#0091ff';

/** Generador determinista (LCG) para repetir muchos sorteos. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Extremos del azar (todo 0, todo casi 1) y varios sorteos. */
const RANDS: (() => () => number)[] = [() => () => 0, () => () => 0.999999, ...Array.from({ length: 40 }, (_, i) => () => seeded(i + 1))];

function eachBurst(fn: (effect: ShapeEffect, reduced: boolean, pieces: Piece[]) => void) {
  for (const effect of SHAPES) {
    for (const reduced of [false, true]) {
      for (const rand of RANDS) fn(effect, reduced, makePieces(effect, COLOR, reduced, rand()));
    }
  }
}

/** Nodos dibujados: la burbuja lleva además su reflejo. */
const nodes = (pieces: Piece[]) => pieces.reduce((n, p) => n + (p.look.type === 'view' && p.look.glint ? 2 : 1), 0);

describe('fxShapes', () => {
  it('distingue los efectos de piezas de los cuatro de siempre', () => {
    for (const e of SHAPES) expect(isShapeEffect(e)).toBe(true);
    for (const e of ['normal', 'chispas', 'confeti', 'corazones', 'toString', 'otro']) expect(isShapeEffect(e)).toBe(false);
  });

  it('cada efecto tiene su vida', () => {
    const all: EffectId[] = [...SHAPES, 'normal', 'chispas', 'confeti', 'corazones'];
    expect(Object.keys(BURST_LIFETIME).sort()).toEqual([...all].sort());
    for (const e of ['normal', 'chispas', 'confeti', 'corazones'] as const) expect(BURST_LIFETIME[e]).toBe(750);
    for (const e of ['burbujas', 'monedas', 'fuegos'] as const) expect(BURST_LIFETIME[e]).toBeGreaterThanOrEqual(950);
    expect(BURST_LIFETIME.emojis).toBe(850);
    expect(BURST_LIFETIME.ondas).toBe(800);
    expect(BURST_LIFETIME.rayos).toBe(500);
    expect(BURST_LIFETIME.pixeles).toBeGreaterThanOrEqual(700);
    expect(BURST_LIFETIME.fugaces).toBeGreaterThanOrEqual(800);
  });

  it('número fijo de piezas, también con movimiento reducido, y pocos nodos', () => {
    eachBurst((effect, reduced, pieces) => {
      expect(pieces.length, `${effect} ${reduced}`).toBe(PIECES[effect][reduced ? 1 : 0]);
      expect(nodes(pieces)).toBeLessThanOrEqual(12);
    });
  });

  it('ninguna pieza dura más que la vida de su estallido', () => {
    eachBurst((effect, _reduced, pieces) => {
      for (const p of pieces) {
        expect(p.delay).toBeGreaterThanOrEqual(0);
        expect(p.dur).toBeGreaterThan(0);
        expect(p.delay + p.dur, effect).toBeLessThanOrEqual(BURST_LIFETIME[effect]);
      }
    });
  });

  it('Píxeles dura 640 ms y las estrellas fugaces a lo más 760', () => {
    eachBurst((effect, reduced, pieces) => {
      if (effect === 'pixeles') for (const p of pieces) expect(p.dur).toBe(reduced ? 450 : 640);
      if (effect === 'fugaces') for (const p of pieces) expect(p.delay + p.dur).toBeLessThanOrEqual(760);
    });
  });

  it('valores finitos, opacidad entre 0 y 1 y escalas positivas en todo el recorrido', () => {
    // se juntan los fallos: un `expect` por valor haría el test muy lento
    const bad: string[] = [];
    eachBurst((effect, reduced, pieces) => {
      for (const piece of pieces) {
        if (![piece.w, piece.h, piece.ox, piece.oy].every(Number.isFinite)) bad.push(`${effect} ${reduced} caja`);
        for (let k = 0; k <= 40; k++) {
          const f = frameAt(piece.motion, k / 40);
          const ok = Object.values(f).every(Number.isFinite) && f.o >= 0 && f.o <= 1 && f.s > 0 && f.sx > 0;
          if (!ok) bad.push(`${effect} ${reduced} p=${k / 40} ${JSON.stringify(f)}`);
        }
      }
    });
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('las piezas con retraso esperan invisibles y todas terminan casi invisibles', () => {
    eachBurst((effect, _reduced, pieces) => {
      for (const piece of pieces) {
        if (piece.delay > 0) expect(frameAt(piece.motion, 0).o, effect).toBe(0);
        expect(frameAt(piece.motion, 1).o, effect).toBeCloseTo(0, 6);
      }
    });
  });

  it('con movimiento reducido no hay giros, vaivén ni monedas que se voltean', () => {
    eachBurst((_effect, reduced, pieces) => {
      if (!reduced) return;
      for (const { motion } of pieces) {
        const frames = [0, 0.3, 0.7, 1].map((p) => frameAt(motion, p));
        // el ángulo puede ser fijo (trazos y estelas), pero no cambia
        expect(new Set(frames.map((f) => f.r + 0)).size).toBe(1);
        expect(frames.every((f) => f.sx === 1)).toBe(true);
        if (motion.kind === 'burbuja') expect(frames.every((f) => f.x === 0)).toBe(true);
      }
    });
  });

  it('los píxeles se mueven de forma continua (sin saltos) y se apagan rápido antes del final', () => {
    for (const { motion } of makePieces('pixeles', COLOR, false, seeded(7))) {
      if (motion.kind !== 'pixel') throw new Error('se esperaba un píxel');
      const a = frameAt(motion, 0.26);
      const b = frameAt(motion, 0.27);
      expect(a.x === b.x && a.y === b.y).toBe(false);
      for (let k = 0; k < 80; k++) {
        const f = frameAt(motion, k / 80);
        const g = frameAt(motion, (k + 1) / 80);
        // a 60 fps, ningún fotograma salta más de unos pocos px
        expect(Math.hypot(g.x - f.x, g.y - f.y)).toBeLessThan(8);
      }
      expect(frameAt(motion, motion.fin - 0.1).o).toBe(1);
      expect(frameAt(motion, motion.fin).o).toBe(0);
      expect(frameAt(motion, 1).o).toBe(0);
    }
  });

  it('los emojis de un estallido no se repiten y salen del grupo de 8', () => {
    eachBurst((effect, _reduced, pieces) => {
      if (effect !== 'emojis') return;
      const texts = pieces.map((p) => (p.look.type === 'text' ? p.look.text : ''));
      expect(new Set(texts).size).toBe(texts.length);
      for (const t of texts) expect(EMOJIS).toContain(t);
    });
  });

  it('los colores derivados del bloque son válidos', () => {
    for (const color of ['#000000', '#ffffff', '#e5484d']) {
      for (const effect of SHAPES) {
        const json = JSON.stringify(makePieces(effect, color, false, seeded(3)));
        expect(json).not.toMatch(/NaN|undefined/);
      }
    }
  });
});
