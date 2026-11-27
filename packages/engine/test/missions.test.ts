import { describe, expect, it } from 'vitest';
import {
  ADD_START,
  DAILY_CYCLE_FROM,
  type DayAgg,
  LIFE_STAGE_START,
  MILESTONES,
  MISSION_POOL,
  MISSIONS_PER_DAY,
  MISSIONS_POOL_FROM,
  type MissionKind,
  MUL_START,
  NUM_STEP,
  TICKS_PER_SECOND,
  addDays,
  missionProgress,
  missionsFor,
} from '../src';

const EMPTY: DayAgg = { runs: 0, killed: 0, bestStreak: 0, maxTicks: 0, playedDaily: false, followedToday: false };
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

  it('son 28, repartidas por tipo', () => {
    expect(MISSION_POOL).toHaveLength(28);
    const count: Partial<Record<MissionKind, number>> = {};
    for (const m of MISSION_POOL) count[m.kind] = (count[m.kind] ?? 0) + 1;
    expect(count).toEqual({ streak: 7, reach: 7, killDay: 7, runsDay: 5, daily: 1, follow: 1 });
  });

  it('las 15 nuevas, en orden, con sus metas y premios', () => {
    expect(MISSION_POOL.slice(13).map((m) => [m.id, m.kind, m.target, m.title, m.reward])).toEqual([
      ['sigue', 'follow', 1, 'Sigue a un jugador hoy', 20],
      ['racha20', 'streak', 20, 'Racha de 20', 40],
      ['racha40', 'streak', 40, 'Racha de 40', 60],
      ['llega9', 'reach', 120, 'Llega al 9', 40],
      ['llegaFinal', 'reach', LIFE_STAGE_START, 'Llega a los bloques de 4 s', 60],
      ['destruye90', 'killDay', 90, 'Destruye 90 bloques hoy', 40],
      ['destruye250', 'killDay', 250, 'Destruye 250 bloques hoy', 60],
      ['juega6', 'runsDay', 6, 'Juega 6 partidas hoy', 30],
      ['racha30', 'streak', 30, 'Racha de 30', 50],
      ['racha50', 'streak', 50, 'Racha de 50', 60],
      ['llega7', 'reach', 80, 'Llega al 7', 30],
      ['destruye180', 'killDay', 180, 'Destruye 180 bloques hoy', 50],
      ['destruye400', 'killDay', 400, 'Destruye 400 bloques hoy', 60],
      ['juega10', 'runsDay', 10, 'Juega 10 partidas hoy', 40],
      ['juega15', 'runsDay', 15, 'Juega 15 partidas hoy', 50],
    ]);
  });
});

describe('misiones del día', () => {
  // dos años que cruzan MISSIONS_POOL_FROM
  const days = Array.from({ length: 760 }, (_, i) => addDays('2026-11-12', i));

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

// calculados con el motor al ampliar el pool: cliente y API deben coincidir
const FIRST_DAYS = ['destruye180,reto,racha30', 'llega9,destruye250,racha25', 'llega9,racha20,juega15'];

describe('desde MISSIONS_POOL_FROM', () => {
  const newIds = new Set(MISSION_POOL.slice(13).map((m) => m.id));
  const from = Array.from({ length: 730 }, (_, i) => addDays(MISSIONS_POOL_FROM, i));

  it('parte el mismo lunes que el ciclo de retos', () => {
    expect(MISSIONS_POOL_FROM).toBe('2026-12-07');
    expect(MISSIONS_POOL_FROM).toBe(DAILY_CYCLE_FROM);
  });

  it('ningún día anterior usa una misión nueva', () => {
    for (let i = 1; i <= 400; i++) {
      const d = addDays(MISSIONS_POOL_FROM, -i);
      expect(missionsFor(d).some((m) => newIds.has(m.id)), d).toBe(false);
    }
  });

  it('valores fijos de los primeros días con las 28', () => {
    expect(from.slice(0, 3).map((d) => missionsFor(d).map((m) => m.id).join(','))).toEqual(FIRST_DAYS);
  });

  it('con el tiempo aparecen todas', () => {
    const seen = new Set(from.flatMap((d) => missionsFor(d).map((m) => m.id)));
    expect(seen.size).toBe(MISSION_POOL.length);
  });
});

describe('antes del pool nuevo', () => {
  // Salidas del pool de 13, registradas con el código anterior a la ampliación: los días ya
  // jugados (y los clientes sin actualizar) no pueden cambiar.
  const PUBLISHED: Readonly<Record<string, string>> = {
    '2000-01-01': 'reto,llegaSumas,destruye60',
    '2025-01-01': 'juega5,racha25,llega8',
    '2026-11-01': 'destruye120,llega5,racha25',
    '2026-11-02': 'juega5,llega5,reto',
    '2026-11-03': 'destruye30,racha15,llegaMult',
    '2026-11-04': 'llega8,racha10,destruye30',
    '2026-11-05': 'llegaSumas,destruye120,juega3',
    '2026-11-06': 'racha25,llega5,juega5',
    '2026-11-07': 'llega8,racha10,destruye30',
    '2026-11-08': 'destruye30,juega3,racha10',
    '2026-11-09': 'racha10,destruye120,llega8',
    '2026-11-10': 'reto,destruye60,llega8',
    '2026-11-11': 'racha10,llega5,juega3',
    '2026-11-12': 'llega5,destruye30,reto',
    '2026-11-13': 'llegaSumas,racha10,destruye30',
    '2026-11-14': 'llega5,reto,destruye30',
    '2026-11-15': 'racha10,llega5,juega3',
    '2026-11-16': 'destruye120,racha10,juega3',
    '2026-11-17': 'juega5,reto,destruye120',
    '2026-11-18': 'racha10,llegaMult,juega5',
    '2026-11-19': 'reto,racha25,destruye60',
    '2026-11-20': 'racha25,juega3,destruye30',
    '2026-11-21': 'destruye60,racha25,llega8',
    '2026-11-22': 'llegaSumas,destruye30,racha25',
    '2026-11-23': 'llegaMult,destruye120,juega3',
    '2026-11-24': 'llegaMult,destruye60,racha25',
    '2026-11-25': 'llegaMult,juega5,racha25',
    '2026-11-26': 'racha25,reto,juega5',
    '2026-11-27': 'llega8,juega3,destruye120',
    '2026-11-28': 'llega8,destruye60,racha25',
    '2026-11-29': 'llegaSumas,reto,juega3',
    '2026-11-30': 'racha15,llegaSumas,destruye60',
    '2026-12-01': 'destruye120,llega5,juega5',
    '2026-12-02': 'racha25,destruye60,reto',
    '2026-12-03': 'destruye60,llega8,racha25',
    '2026-12-04': 'destruye30,llegaMult,juega3',
    '2026-12-05': 'racha10,reto,destruye60',
    '2026-12-06': 'llegaMult,destruye30,juega3',
  };

  it('las misiones de cada fecha son idénticas a las publicadas', () => {
    for (const [d, ids] of Object.entries(PUBLISHED)) {
      expect(missionsFor(d).map((m) => m.id).join(','), d).toBe(ids);
    }
  });

  it('las 13 originales no cambian (orden, metas, textos y premios)', () => {
    expect(MISSION_POOL.slice(0, 13).map((m) => [m.id, m.kind, m.target, m.title, m.reward])).toEqual([
      ['racha10', 'streak', 10, 'Racha de 10', 20],
      ['racha15', 'streak', 15, 'Racha de 15', 30],
      ['racha25', 'streak', 25, 'Racha de 25', 50],
      ['llega5', 'reach', 40, 'Llega al 5', 20],
      ['llega8', 'reach', 100, 'Llega al 8', 30],
      ['llegaSumas', 'reach', 140, 'Llega a las sumas y restas', 50],
      ['llegaMult', 'reach', 275, 'Llega a las multiplicaciones y divisiones', 60],
      ['destruye30', 'killDay', 30, 'Destruye 30 bloques hoy', 20],
      ['destruye60', 'killDay', 60, 'Destruye 60 bloques hoy', 30],
      ['destruye120', 'killDay', 120, 'Destruye 120 bloques hoy', 50],
      ['juega3', 'runsDay', 3, 'Juega 3 partidas hoy', 20],
      ['juega5', 'runsDay', 5, 'Juega 5 partidas hoy', 30],
      ['reto', 'daily', 1, 'Juega el reto del día', 40],
    ]);
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

  it('seguir a un jugador: solo cuenta followedToday', () => {
    const m = byId('sigue');
    const played = { runs: 20, killed: 999, bestStreak: 99, maxTicks: 999999, playedDaily: true };
    expect(missionProgress(m, { ...EMPTY, ...played })).toEqual({ value: 0, done: false });
    expect(missionProgress(m, { ...EMPTY, followedToday: true })).toEqual({ value: 1, done: true });
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
