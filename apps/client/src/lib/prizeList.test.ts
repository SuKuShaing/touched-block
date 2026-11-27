import { describe, expect, it } from 'vitest';
import { LIST_ROWS, prizeListHeight } from './prizeList';

describe('alto de las tarjetas de premios', () => {
  it('con cuatro filas o menos no se limita', () => {
    expect(prizeListHeight(LIST_ROWS, [60, 60, 60, 60], 900)).toBeUndefined();
    expect(prizeListHeight(0, [], 900)).toBeUndefined();
  });

  it('muestra cuatro filas y media de la quinta, con sus altos medidos', () => {
    expect(prizeListHeight(14, [80, 60, 70, 60, 90], 900)).toBe(80 + 60 + 70 + 60 + 45);
  });

  it('antes de medir usa un alto supuesto (también en los huecos)', () => {
    expect(prizeListHeight(20, [], 900)).toBe(297);
    const heights: number[] = [];
    heights[1] = 100;
    expect(prizeListHeight(20, heights, 900)).toBe(297 - 66 + 100);
  });

  it('no pasa del 60 % de la pantalla (letra muy grande)', () => {
    expect(prizeListHeight(9, [160, 160, 160, 160, 160], 800)).toBe(480);
  });

  it('sin alto de pantalla conocido no recorta de más', () => {
    expect(prizeListHeight(9, [60, 60, 60, 60, 60], 0)).toBe(270);
  });
});
