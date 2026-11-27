import { describe, expect, it } from 'vitest';
import { levelFor, levelStart, xpOf } from './level';

describe('levelStart', () => {
  it('sigue 25 · n · (n + 1)', () => {
    expect(levelStart(0)).toBe(0);
    expect(levelStart(1)).toBe(50);
    expect(levelStart(2)).toBe(150);
    expect(levelStart(3)).toBe(300);
    expect(levelStart(5)).toBe(750);
    expect(levelStart(10)).toBe(2750);
    expect(levelStart(30)).toBe(23250);
    expect(levelStart(-3)).toBe(0);
  });
});

describe('levelFor', () => {
  it('parte en el nivel 0', () => {
    expect(levelFor(0)).toEqual({ level: 0, xp: 0, current: 0, next: 50, progress: 0 });
  });

  it('cambia de nivel justo en el borde', () => {
    expect(levelFor(49).level).toBe(0);
    expect(levelFor(50).level).toBe(1);
    expect(levelFor(149).level).toBe(1);
    expect(levelFor(150).level).toBe(2);
    expect(levelFor(749).level).toBe(4);
    expect(levelFor(750).level).toBe(5);
    expect(levelFor(2749).level).toBe(9);
    expect(levelFor(2750).level).toBe(10);
    expect(levelFor(23249).level).toBe(29);
    expect(levelFor(23250).level).toBe(30);
    for (let n = 1; n < 300; n++) {
      expect(levelFor(levelStart(n)).level).toBe(n);
      expect(levelFor(levelStart(n) - 1).level).toBe(n - 1);
    }
  });

  it('calcula el avance dentro del nivel', () => {
    const l = levelFor(300); // nivel 3: 300 → 500
    expect(l).toMatchObject({ level: 3, current: 300, next: 500, progress: 0 });
    expect(levelFor(400).progress).toBeCloseTo(0.5);
  });

  it('es coherente en un rango amplio', () => {
    for (let xp = 0; xp < 60_000; xp += 37) {
      const l = levelFor(xp);
      expect(l.current).toBeLessThanOrEqual(xp);
      expect(l.next).toBeGreaterThan(xp);
      expect(l.progress).toBeGreaterThanOrEqual(0);
      expect(l.progress).toBeLessThan(1);
    }
  });

  it('ignora valores inválidos', () => {
    expect(levelFor(-5).level).toBe(0);
    expect(levelFor(Number.NaN).level).toBe(0);
    expect(levelFor(Infinity).level).toBe(0);
  });
});

describe('xpOf', () => {
  it('suma bloques destruidos y bloques extra', () => {
    expect(xpOf({ totalKilled: 120, bonusXp: 30 })).toBe(150);
    expect(xpOf({ totalKilled: 7 })).toBe(7);
  });
});
