import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MATERIALS,
  achievementGoal,
  achievementLevel,
  achievementMaterial,
  achievementNext,
} from '../src';

describe('logros de cinco niveles', () => {
  it('materiales y umbrales de la tabla del plan', () => {
    expect(ACHIEVEMENT_MATERIALS).toEqual(['Madera', 'Bronce', 'Plata', 'Oro', 'Diamante']);
    expect(Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.thresholds]))).toEqual({
      racha: [10, 25, 50, 100, 200],
      bloques: [100, 500, 2000, 10000, 50000],
      diasReto: [3, 7, 14, 30, 100],
      mejorReto: [0, 50, 75, 90, 99],
    });
  });

  it('nivel en los bordes de cada umbral', () => {
    for (const a of ACHIEVEMENTS) {
      a.thresholds.forEach((t, i) => {
        if (t > 0) expect(achievementLevel(a.id, t - 1)).toBe(i);
        expect(achievementLevel(a.id, t)).toBe(i + 1);
      });
      expect(achievementLevel(a.id, 1e9)).toBe(5);
    }
    expect(achievementLevel('racha', 0)).toBe(0);
    expect(achievementLevel('bloques', 1999)).toBe(2);
  });

  it('mejor resultado en un reto: participar ya da Madera; null = nunca participó', () => {
    expect(achievementLevel('mejorReto', null)).toBe(0);
    expect(achievementLevel('mejorReto', undefined)).toBe(0);
    expect(achievementLevel('mejorReto', Number.NaN)).toBe(0);
    expect(achievementLevel('mejorReto', 0)).toBe(1);
    expect(achievementLevel('mejorReto', 49)).toBe(1);
    expect(achievementLevel('mejorReto', 50)).toBe(2);
    expect(achievementLevel('mejorReto', 98.9)).toBe(4);
    expect(achievementLevel('mejorReto', 99)).toBe(5);
    expect(achievementLevel('mejorReto', 100)).toBe(5);
  });

  it('siguiente umbral', () => {
    expect(achievementNext('racha', 0)).toBe(10);
    expect(achievementNext('racha', 30)).toBe(50);
    expect(achievementNext('racha', 200)).toBeNull();
    expect(achievementNext('mejorReto', null)).toBe(0);
    expect(achievementNext('mejorReto', 0)).toBe(50);
    expect(achievementNext('diasReto', 99)).toBe(100);
  });

  it('material y requisito en palabras', () => {
    expect(achievementMaterial(0)).toBeNull();
    expect(achievementMaterial(1)).toBe('Madera');
    expect(achievementMaterial(5)).toBe('Diamante');
    expect(achievementGoal('racha', 2)).toBe('Racha de 25');
    expect(achievementGoal('bloques', 3)).toBe('Destruye 2.000 bloques en total');
    expect(achievementGoal('bloques', 5)).toBe('Destruye 50.000 bloques en total');
    expect(achievementGoal('diasReto', 1)).toBe('Juega el reto 3 días seguidos');
    expect(achievementGoal('mejorReto', 1)).toBe('Participa en un reto diario');
    expect(achievementGoal('mejorReto', 4)).toBe('Mejor que el 90 % en un reto diario');
    expect(() => achievementGoal('racha', 0)).toThrow();
    expect(() => achievementGoal('racha', 6)).toThrow();
  });
});
