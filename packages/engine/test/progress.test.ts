import { describe, expect, it } from 'vitest';
import {
  ADD_START,
  DT,
  LIFE_STAGE_START,
  LIFE_STAGE_STEP,
  MILESTONES,
  MUL_START,
  NUM_STEP,
  TICKS_PER_SECOND,
  TIERS,
  maxAddFor,
  maxMulFor,
  maxNumFor,
  milestoneIndexAt,
  missMultFor,
  stageLifeFor,
  tierForTicks,
  tierIndexForTicks,
  tierIndexOf,
  tierRefForTicks,
} from '../src';

describe('hitos', () => {
  it('coinciden con las constantes', () => {
    expect(MILESTONES.map((m) => m.at)).toEqual([
      NUM_STEP,
      2 * NUM_STEP,
      3 * NUM_STEP,
      4 * NUM_STEP,
      5 * NUM_STEP,
      6 * NUM_STEP,
      ADD_START,
      MUL_START,
      LIFE_STAGE_START,
      LIFE_STAGE_START + LIFE_STAGE_STEP,
      LIFE_STAGE_START + 2 * LIFE_STAGE_STEP,
      LIFE_STAGE_START + 3 * LIFE_STAGE_STEP,
    ]);
    expect(MILESTONES.map((m) => m.icon)).toEqual(['4', '5', '6', '7', '8', '9', '+ −', '× ÷', '4 s', '3 s', '2 s', '1 s']);
  });

  it('el índice sube exactamente cuando cambia el motor (con el reloj acumulado del motor)', () => {
    // played se acumula sumando DT, igual que en step(): el aviso debe coincidir con ese valor
    let played = 0;
    let prev = { idx: 0, num: maxNumFor(0), add: maxAddFor(0), mul: maxMulFor(0), life: stageLifeFor(0) };
    for (let t = 1; t <= 460 * TICKS_PER_SECOND; t++) {
      played += DT;
      const cur = { idx: milestoneIndexAt(played), num: maxNumFor(played), add: maxAddFor(played), mul: maxMulFor(played), life: stageLifeFor(played) };
      const engineChanged =
        cur.num > prev.num || (cur.add > 0 && prev.add === 0) || (cur.mul > 0 && prev.mul === 0) || cur.life !== prev.life;
      expect(cur.idx > prev.idx).toBe(engineChanged);
      prev = cur;
    }
    expect(prev.idx).toBe(MILESTONES.length);
  });

  it('el aviso de etapa usa el castigo de esa etapa', () => {
    const add = MILESTONES.find((m) => m.kind === 'add')!;
    const mul = MILESTONES.find((m) => m.kind === 'mul')!;
    expect(missMultFor(add)).toBe(6);
    expect(missMultFor(mul)).toBe(7);
  });
});

describe('insignias', () => {
  it('sin partidas no hay insignia', () => {
    expect(tierForTicks(null)).toBeNull();
    expect(tierForTicks(undefined)).toBeNull();
    expect(tierIndexForTicks(-1)).toBe(-1);
  });

  it('con menos de 20 s no hay insignia', () => {
    expect(tierIndexForTicks(0)).toBe(-1);
    expect(tierForTicks(20 * TICKS_PER_SECOND - 1)).toBeNull();
    expect(tierRefForTicks(0)).toBeNull();
    expect(tierIndexForTicks(Number.NaN)).toBe(-1);
    expect(tierForTicks(20 * TICKS_PER_SECOND)!.name).toBe('Papel');
  });

  it('bordes exactos en ticks', () => {
    for (const t of TIERS) {
      const at = t.at * TICKS_PER_SECOND;
      expect(tierIndexForTicks(at - 1)).toBe(t.index - 1);
      expect(tierForTicks(at)!.index).toBe(t.index);
    }
    expect(tierForTicks(10_000_000)!.tier).toBe('diamante');
  });

  it('umbrales: 20, 60, 100, 140, 275, 350 y 410 s', () => {
    expect(TIERS.map((t) => t.at)).toEqual([20, 60, 100, 140, 275, 350, 410]);
  });

  it('nombres y requisitos; tier y step (viajan en la API) no cambian', () => {
    expect(TIERS.map((t) => [t.index, t.tier, t.step, t.name, t.goal])).toEqual([
      [0, 'madera', 1, 'Papel', 'Llegar al 4'],
      [1, 'madera', 2, 'Cartón', 'Llegar al 6'],
      [2, 'madera', 3, 'Madera', 'Llegar al 8'],
      [3, 'bronce', 1, 'Bronce', 'Llegar a las sumas y restas'],
      [4, 'plata', 1, 'Plata', 'Llegar a las multiplicaciones y divisiones'],
      [5, 'oro', 1, 'Oro', 'Llegar a la etapa final'],
      [6, 'diamante', 1, 'Diamante', 'Llegar a los bloques de 2 s'],
    ]);
    const twoSeconds = MILESTONES.find((m) => m.kind === 'life' && m.value === 2)!;
    expect(TIERS[6].at).toBe(twoSeconds.at);
  });

  it('referencia compacta de ida y vuelta', () => {
    const ref = tierRefForTicks(ADD_START * TICKS_PER_SECOND)!;
    expect(ref).toEqual({ tier: 'bronce', step: 1 });
    expect(tierIndexOf(ref)).toBe(3);
    expect(tierIndexOf(null)).toBe(-1);
    expect(tierIndexOf({ tier: 'madera', step: 9 })).toBe(-1);
  });
});
