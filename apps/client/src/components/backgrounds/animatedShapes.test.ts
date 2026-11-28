import { describe, expect, it } from 'vitest';
import {
  fallOffset,
  FIREFLY_GROUPS,
  fireflyPose,
  GALAXY,
  GALAXY_ARMS,
  galaxySize,
  GLOW,
  GLOW_THUMB,
  RAIN,
  SNOW_BIG,
  SNOW_SMALL,
  wrap,
} from './animatedShapes';

describe('movimiento de los fondos animados', () => {
  it('wrap queda en [0, 1)', () => {
    for (const c of [-2.25, -1, 0, 0.4, 1, 7.999]) {
      expect(wrap(c)).toBeGreaterThanOrEqual(0);
      expect(wrap(c)).toBeLessThan(1);
    }
    expect(wrap(3.25)).toBeCloseTo(0.25);
  });

  it('una capa que cae avanza como mucho un mosaico y la vuelta empalma', () => {
    expect(fallOffset(0, RAIN.h)).toBe(0);
    expect(fallOffset(0.5, RAIN.h)).toBe(RAIN.h / 2);
    expect(fallOffset(1, RAIN.h)).toBe(0);
    expect(fallOffset(1.999999, RAIN.h)).toBeCloseTo(RAIN.h, 2);
  });

  it('las luciérnagas van de apagadas a encendidas y vuelven', () => {
    expect(fireflyPose(0)).toEqual({ opacity: 0.05, x: 0, y: -0 });
    const top = fireflyPose(0.5);
    expect(top.opacity).toBeCloseTo(1);
    expect(top.x).toBeCloseTo(10);
    expect(top.y).toBeCloseTo(-14);
    // simétrica y sin salto al cerrar la vuelta
    expect(fireflyPose(0.2).opacity).toBeCloseTo(fireflyPose(0.8).opacity);
    expect(fireflyPose(0.999999).opacity).toBeCloseTo(fireflyPose(1).opacity, 3);
    for (let i = 0; i <= 100; i++) {
      const { opacity } = fireflyPose(i / 37);
      expect(opacity).toBeGreaterThanOrEqual(0.05);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });
});

describe('datos de los fondos animados', () => {
  it('ningún copo queda cortado por el borde de su mosaico', () => {
    for (const layer of [SNOW_BIG, SNOW_SMALL]) {
      for (const [x, y, r] of layer.flakes) {
        expect(x - r).toBeGreaterThanOrEqual(0);
        expect(x + r).toBeLessThanOrEqual(layer.w);
        expect(y - r).toBeGreaterThanOrEqual(0);
        expect(y + r).toBeLessThanOrEqual(layer.h);
      }
    }
  });

  it('dos grupos de cinco luciérnagas y halos con paradas en orden', () => {
    expect(FIREFLY_GROUPS.map((g) => g.spots.length)).toEqual([5, 5]);
    for (const g of [GLOW, GLOW_THUMB]) {
      expect(g.core).toBeLessThan(g.mid);
      expect(g.mid).toBeLessThan(g.r);
    }
  });

  it('la galaxia ocupa 380 px en el campo y se achica en las vistas previas', () => {
    expect(galaxySize(44)).toBe(GALAXY.size);
    expect(galaxySize(100)).toBe(GALAXY.size);
    expect(galaxySize(14)).toBe(121);
    expect(galaxySize(0)).toBe(0);
  });

  it('los brazos anchos de la galaxia siguen atenuados', () => {
    for (const a of GALAXY_ARMS) {
      if (a.width >= 4) expect(a.opacity).toBeLessThanOrEqual(0.14);
    }
  });
});
