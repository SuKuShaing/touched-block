import { describe, expect, it } from 'vitest';
import { OP_WIDTH_RATIO, SAFE, COLORS } from '@tb/engine';
import { PALETTES, getPalette } from '@/cosmetics/palettes';
import {
  PREVIEW_KINDS,
  PREVIEW_SHAPES,
  type PreviewKind,
  type PreviewState,
  initialPreview,
  previewA11yLabel,
  previewLayout,
  previewRespawn,
  previewReviveAll,
  previewStep,
  previewText,
} from './previewStep';

const zero = () => 0;
const indexOf = (kind: PreviewKind) => PREVIEW_KINDS.indexOf(kind);

/** Toca la casilla `i` hasta destruirla. */
function destroy(state: PreviewState, i: number): PreviewState {
  let s = state;
  while (s[i].alive) s = previewStep(s, i).state;
  return s;
}

describe('initialPreview', () => {
  it('nueve bloques: números, operaciones y una sola trampa sobre un color SAFE', () => {
    const s = initialPreview(zero);
    expect(s).toHaveLength(9);
    expect(s.every((b) => b.alive && b.left === b.total && b.total > 0)).toBe(true);
    expect(s.filter((b) => b.kind === 'trap')).toHaveLength(1);
    expect(s.some((b) => b.kind === 'num')).toBe(true);
    expect(s.some((b) => b.kind === 'op')).toBe(true);
    expect(SAFE as readonly string[]).toContain(COLORS[indexOf('trap')]);
  });
  it('aguanta un azar en el borde', () => {
    expect(initialPreview(() => 0.999999).every((b) => b.total > 0)).toBe(true);
  });
  it('cada operación vale lo que dice', () => {
    for (const { label, total } of PREVIEW_SHAPES.op) {
      const [, a, op, b] = /^(\d+)(\D)(\d+)$/.exec(label)!;
      const x = Number(a);
      const y = Number(b);
      expect({ '+': x + y, '−': x - y, '×': x * y, '÷': x / y }[op], label).toBe(total);
    }
  });
});

describe('previewStep', () => {
  it('un número baja su contador y suena con los toques dados', () => {
    const i = indexOf('num');
    const s = initialPreview(() => 0.5); // 3
    const t = previewStep(s, i);
    expect(t).toMatchObject({ hit: 1, destroyed: null });
    expect(t.state[i]).toMatchObject({ left: 2, alive: true });
    expect(previewText(t.state[i])).toBe('2');
    expect(t.state.filter((b, j) => b !== s[j])).toHaveLength(1);
    expect(s[i].left).toBe(3); // no muta
  });
  it('el último toque suena como golpe y destruye', () => {
    const i = indexOf('num');
    const t = previewStep(initialPreview(zero), i); // 1
    expect(t).toMatchObject({ hit: 1, destroyed: 'kill' });
    expect(t.state[i].alive).toBe(false);
  });
  it('una operación se toca tantas veces como su resultado y sigue mostrando la operación', () => {
    const i = indexOf('op');
    let s = initialPreview(zero); // 2+3
    for (let n = 1; n <= 4; n++) {
      const t = previewStep(s, i);
      expect(t).toMatchObject({ hit: n, destroyed: null });
      s = t.state;
      expect(previewText(s[i])).toBe('2+3');
    }
    expect(previewStep(s, i)).toMatchObject({ hit: 5, destroyed: 'kill' });
  });
  it('la trampa estalla al primer toque, sin golpe', () => {
    const i = indexOf('trap');
    const t = previewStep(initialPreview(zero), i);
    expect(t).toMatchObject({ hit: null, destroyed: 'trap' });
    expect(t.state[i].alive).toBe(false);
  });
  it('tocar un destruido o una casilla que no existe no hace nada', () => {
    const i = indexOf('num');
    const s = destroy(initialPreview(zero), i);
    for (const j of [i, -1, 9]) {
      const t = previewStep(s, j);
      expect(t.state).toBe(s);
      expect(t).toMatchObject({ hit: null, destroyed: null });
    }
  });
});

describe('reaparición', () => {
  it('vuelve entero, del mismo tipo, con otro valor y otra generación', () => {
    for (const i of PREVIEW_KINDS.keys()) {
      const first = initialPreview(zero);
      const dead = destroy(first, i);
      const back = previewRespawn(dead, i, zero);
      expect(back[i]).toMatchObject({ kind: first[i].kind, alive: true, gen: 1 });
      expect(back[i].left).toBe(back[i].total);
      expect(back[i].label).not.toBe(first[i].label);
    }
  });
  it('no toca un bloque vivo', () => {
    const s = initialPreview(zero);
    expect(previewRespawn(s, 0, zero)).toBe(s);
    expect(previewReviveAll(s, zero)).toBe(s);
  });
  it('previewReviveAll repone todos los destruidos', () => {
    const s = destroy(destroy(initialPreview(zero), 0), 4);
    expect(previewReviveAll(s, zero).every((b) => b.alive)).toBe(true);
  });
});

describe('accesibilidad', () => {
  const s = initialPreview(zero);
  it('describe cada tipo', () => {
    expect(previewA11yLabel(s[indexOf('num')])).toBe('Bloque, falta 1 toque');
    expect(previewA11yLabel(s[indexOf('op')])).toBe('Operación 2 más 3, resultado 5, faltan 5 toques');
    expect(previewA11yLabel(s[indexOf('trap')])).toBe('Bloque trampa; aquí no hace daño');
    expect(previewA11yLabel(destroy(s, 0)[0])).toBe('Bloque destruido');
  });
});

describe('previewLayout', () => {
  it('tres columnas dentro del ancho; las operaciones miden 1,7:1 y los números son cuadrados', () => {
    for (const width of [254, 294, 446]) {
      const { height, cells, blocks } = previewLayout(width);
      for (const [i, b] of blocks.entries()) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(width);
        expect(b.y + b.h).toBeLessThan(height);
        if (PREVIEW_KINDS[i] === 'op') expect(b.w / b.h).toBeCloseTo(OP_WIDTH_RATIO, 1);
        else expect(b.w).toBe(b.h);
        expect(b.x + b.w / 2).toBeCloseTo(cells[i].x + cells[i].w / 2, 6);
      }
    }
  });
});

describe('paleta de la vista previa', () => {
  it('una desconocida cae en la Clásica', () => {
    expect(getPalette('no-existe')).toBe(PALETTES.clasica);
  });
});
