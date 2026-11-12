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

  it('bordes exactos en ticks', () => {
    expect(tierForTicks(0)!.name).toBe('Madera I');
    for (const t of TIERS.slice(1)) {
      const at = t.at * TICKS_PER_SECOND;
      expect(tierForTicks(at - 1)!.index).toBe(t.index - 1);
      expect(tierForTicks(at)!.index).toBe(t.index);
    }
    expect(tierForTicks(10_000_000)!.tier).toBe('diamante');
  });

  it('umbrales: 40, 100, 140, 275, 350 y 440 s', () => {
    expect(TIERS.map((t) => t.at)).toEqual([0, 40, 100, 140, 275, 350, 440]);
  });

  it('referencia compacta de ida y vuelta', () => {
    const ref = tierRefForTicks(ADD_START * TICKS_PER_SECOND)!;
    expect(ref).toEqual({ tier: 'bronce', step: 1 });
    expect(tierIndexOf(ref)).toBe(3);
    expect(tierIndexOf(null)).toBe(-1);
    expect(tierIndexOf({ tier: 'madera', step: 9 })).toBe(-1);
  });
});
