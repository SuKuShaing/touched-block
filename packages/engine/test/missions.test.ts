import { describe, expect, it } from 'vitest';
import {
  ADD_START,
  type DayAgg,
  MILESTONES,
  MISSION_POOL,
  MISSIONS_PER_DAY,
  MUL_START,
  NUM_STEP,
  TICKS_PER_SECOND,
  addDays,
  missionProgress,
  missionsFor,
} from '../src';

const EMPTY: DayAgg = { runs: 0, killed: 0, bestStreak: 0, maxTicks: 0, playedDaily: false };
const byId = (id: string) => MISSION_POOL.find((m) => m.id === id)!;

describe('misiones posibles', () => {
  it('ids únicos, premios entre 20 y 60 y metas positivas', () => {
    expect(new Set(MISSION_POOL.map((m) => m.id)).size).toBe(MISSION_POOL.length);
    expect(MISSION_POOL.length).toBeGreaterThanOrEqual(10);
    for (const m of MISSION_POOL) {
      expect(m.reward).toBeGreaterThanOrEqual(20);
      expect(m.reward).toBeLessThanOrEqual(60);
      expect(m.target).toBeGreaterThan(0);
      expect(m.title.length).toBeGreaterThan(0);
    }
  });

  it('las de llegar usan los hitos del camino', () => {
    expect(byId('llega5')).toMatchObject({ kind: 'reach', target: 2 * NUM_STEP, title: 'Llega al 5' });
    expect(byId('llega8')).toMatchObject({ kind: 'reach', target: 5 * NUM_STEP, title: 'Llega al 8' });
    expect(byId('llegaSumas')).toMatchObject({ kind: 'reach', target: ADD_START, title: 'Llega a las sumas y restas' });
    expect(byId('llegaMult')).toMatchObject({
      kind: 'reach',
      target: MUL_START,
      title: 'Llega a las multiplicaciones y divisiones',
    });
    const ats = new Set(MILESTONES.map((m) => m.at));
    for (const m of MISSION_POOL) if (m.kind === 'reach') expect(ats.has(m.target)).toBe(true);
  });

  it('hay una sola misión de jugar el reto', () => {
    expect(MISSION_POOL.filter((m) => m.kind === 'daily')).toHaveLength(1);
  });
});

describe('misiones del día', () => {
  const days = Array.from({ length: 730 }, (_, i) => addDays('2026-11-12', i));

  it('tres misiones distintas, de tipos distintos, como máximo una de jugar el reto', () => {
    for (const d of days) {
      const ms = missionsFor(d);
      expect(ms).toHaveLength(MISSIONS_PER_DAY);
      expect(new Set(ms.map((m) => m.id)).size).toBe(MISSIONS_PER_DAY);
      expect(new Set(ms.map((m) => m.kind)).size).toBe(MISSIONS_PER_DAY);
      expect(ms.filter((m) => m.kind === 'daily').length).toBeLessThanOrEqual(1);
    }
  });

  it('deterministas por fecha, y cambian de un día a otro', () => {
    expect(missionsFor('2026-11-12')).toEqual(missionsFor('2026-11-12'));
    const sets = new Set(days.map((d) => missionsFor(d).map((m) => m.id).join(',')));
    expect(sets.size).toBeGreaterThan(20);
    // con el tiempo aparecen todas
    const seen = new Set(days.flatMap((d) => missionsFor(d).map((m) => m.id)));
    expect(seen.size).toBe(MISSION_POOL.length);
  });

  it('valor fijo para una fecha (si cambia, cambian las misiones publicadas de ese día)', () => {
    // guarda la elección de un día concreto: cambiar el algoritmo o el orden del pool la altera
    expect(missionsFor('2026-11-12').map((m) => m.id)).toEqual(['llega5', 'destruye30', 'reto']);
  });

  it('rechaza fechas inválidas', () => {
    expect(() => missionsFor('2026-02-30')).toThrow();
  });
});

describe('avance de una misión', () => {
  it('racha, bloques del día, partidas y reto', () => {
    expect(missionProgress(byId('racha15'), { ...EMPTY, bestStreak: 9 })).toEqual({ value: 9, done: false });
    expect(missionProgress(byId('racha15'), { ...EMPTY, bestStreak: 15 })).toEqual({ value: 15, done: true });
    expect(missionProgress(byId('racha15'), { ...EMPTY, bestStreak: 40 })).toEqual({ value: 15, done: true });
    expect(missionProgress(byId('destruye60'), { ...EMPTY, killed: 59 })).toEqual({ value: 59, done: false });
    expect(missionProgress(byId('destruye60'), { ...EMPTY, killed: 200 })).toEqual({ value: 60, done: true });
    expect(missionProgress(byId('juega3'), { ...EMPTY, runs: 2 })).toEqual({ value: 2, done: false });
    expect(missionProgress(byId('juega3'), { ...EMPTY, runs: 3 })).toEqual({ value: 3, done: true });
    expect(missionProgress(byId('reto'), EMPTY)).toEqual({ value: 0, done: false });
    expect(missionProgress(byId('reto'), { ...EMPTY, playedDaily: true })).toEqual({ value: 1, done: true });
  });

  it('llegar: compara ticks enteros en el borde exacto', () => {
    const m = byId('llega8');
    const at = m.target * TICKS_PER_SECOND;
    expect(missionProgress(m, { ...EMPTY, maxTicks: at - 1 })).toEqual({ value: m.target - 1, done: false });
    expect(missionProgress(m, { ...EMPTY, maxTicks: at })).toEqual({ value: m.target, done: true });
    expect(missionProgress(m, { ...EMPTY, maxTicks: at * 3 })).toEqual({ value: m.target, done: true });
    expect(missionProgress(m, EMPTY)).toEqual({ value: 0, done: false });
  });

  it('valores raros no rompen el avance', () => {
    expect(missionProgress(byId('racha10'), { ...EMPTY, bestStreak: -3 })).toEqual({ value: 0, done: false });
    expect(missionProgress(byId('racha10'), { ...EMPTY, bestStreak: Number.NaN })).toEqual({ value: 0, done: false });
  });
});
