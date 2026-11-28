import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_MATERIALS,
  achievementGoal,
  achievementLevel,
  achievementMaterial,
  achievementNext,
} from '../src';

describe('logros de siete niveles', () => {
  it('materiales y umbrales de la tabla del plan', () => {
    expect(ACHIEVEMENT_MATERIALS).toEqual(['Papel', 'Cartón', 'Madera', 'Bronce', 'Plata', 'Oro', 'Diamante']);
    expect(Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a.thresholds]))).toEqual({
      racha: [10, 25, 50, 100, 200, 300, 500],
      partidas: [10, 50, 150, 500, 1500, 3000, 6000],
      diasReto: [3, 7, 14, 30, 100, 200, 365],
      mejorReto: [0, 25, 50, 75, 90, 95, 99],
    });
    expect(ACHIEVEMENTS.map((a) => a.name)).toEqual([
      'Máximo combo',
      'Partidas jugadas',
      'Días seguidos de reto diario',
      'Mejor resultado en un reto diario',
    ]);
  });

  it('nivel en los bordes de cada umbral (0 a 7)', () => {
    for (const a of ACHIEVEMENTS) {
      a.thresholds.forEach((t, i) => {
        if (t > 0) expect(achievementLevel(a.id, t - 1)).toBe(i);
        expect(achievementLevel(a.id, t)).toBe(i + 1);
      });
      expect(achievementLevel(a.id, 1e9)).toBe(7);
    }
    expect(achievementLevel('racha', 0)).toBe(0);
    expect(achievementLevel('partidas', 149)).toBe(2);
  });

  it('mejor resultado en un reto: participar ya da Papel; null = nunca participó', () => {
    expect(achievementLevel('mejorReto', null)).toBe(0);
    expect(achievementLevel('mejorReto', undefined)).toBe(0);
    expect(achievementLevel('mejorReto', Number.NaN)).toBe(0);
    expect(achievementLevel('mejorReto', 0)).toBe(1);
    expect(achievementLevel('mejorReto', 24)).toBe(1);
    expect(achievementLevel('mejorReto', 25)).toBe(2);
    expect(achievementLevel('mejorReto', 98.9)).toBe(6);
    expect(achievementLevel('mejorReto', 99)).toBe(7);
    expect(achievementLevel('mejorReto', 100)).toBe(7);
  });

  it('siguiente umbral', () => {
    expect(achievementNext('racha', 0)).toBe(10);
    expect(achievementNext('racha', 30)).toBe(50);
    expect(achievementNext('racha', 200)).toBe(300);
    expect(achievementNext('racha', 500)).toBeNull();
    expect(achievementNext('mejorReto', null)).toBe(0);
    expect(achievementNext('mejorReto', 0)).toBe(25);
    expect(achievementNext('diasReto', 364)).toBe(365);
  });

  it('material y requisito en palabras', () => {
    expect(achievementMaterial(0)).toBeNull();
    expect(achievementMaterial(1)).toBe('Papel');
    expect(achievementMaterial(7)).toBe('Diamante');
    expect(achievementMaterial(8)).toBeNull();
    expect(achievementGoal('racha', 2)).toBe('Racha de 25');
    expect(achievementGoal('partidas', 1)).toBe('Juega 10 partidas');
    expect(achievementGoal('partidas', 7)).toBe('Juega 6.000 partidas');
    expect(achievementGoal('diasReto', 1)).toBe('Juega el reto 3 días seguidos');
    expect(achievementGoal('mejorReto', 1)).toBe('Participa en un reto diario');
    expect(achievementGoal('mejorReto', 5)).toBe('Mejor que el 90 % en un reto diario');
    expect(() => achievementGoal('racha', 0)).toThrow();
    expect(() => achievementGoal('racha', 8)).toThrow();
  });

  it('el logro de bloques ya no existe', () => {
    expect(ACHIEVEMENTS.some((a) => (a.id as string) === 'bloques')).toBe(false);
  });
});
