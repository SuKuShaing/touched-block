import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DAILY_EPOCH, type DayAgg, TICKS_PER_SECOND, addDays, dailyModsFor, missionProgress, missionsFor, weekdayOf } from '@tb/engine';
import type { MissionView } from '@/api/daily';
import type { HistEntry } from './history';

const mem = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
  },
});

// stats.ts y daily.ts guardan en memoria lo que leyeron: módulos nuevos en cada test
const load = async () => {
  vi.resetModules();
  const missions = await import('./missions');
  const stats = await import('./stats');
  const daily = await import('./daily');
  return { ...missions, stats, daily };
};

beforeEach(() => mem.clear());

/** Una fecha con ese día de la semana (0 = lunes). */
const onWeekday = (wd: number) => addDays(DAILY_EPOCH, (wd - weekdayOf(DAILY_EPOCH) + 7) % 7);
const MONDAY = onWeekday(0); // partida normal
const TUESDAY = onWeekday(1); // directo a las sumas (con modificador)

const at = (date: string, h: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d, h).getTime();
};
const h = (date: string, hour: number, k: number, t?: number, s?: number): HistEntry => ({ k, m: 0, d: at(date, hour), t, s });
const dr = (k: number, t: number, s: number) => ({ k, m: 0, t, s, d: 0 });

describe('dayAggFrom', () => {
  it('suma las partidas del día local y deja fuera las de otros días', async () => {
    const { dayAggFrom } = await load();
    expect(dailyModsFor(MONDAY).mods).toBeNull();
    const hist = [
      h(MONDAY, 0, 10, 600, 4),
      h(MONDAY, 23, 20, 1800, 9),
      h(addDays(MONDAY, -1), 23, 99, 99_999, 99),
      h(addDays(MONDAY, 1), 0, 99, 99_999, 99),
      { k: 7, m: 1, d: at(MONDAY, 12) }, // entrada antigua sin t ni s
    ];
    expect(dayAggFrom(MONDAY, hist, [])).toEqual({ runs: 3, killed: 37, bestStreak: 9, maxTicks: 1800, playedDaily: false });
  });

  it('el reto sin modificador cuenta para todo', async () => {
    const { dayAggFrom } = await load();
    expect(dayAggFrom(MONDAY, [h(MONDAY, 10, 5, 300, 2)], [dr(40, 9000, 30)])).toEqual({
      runs: 2,
      killed: 45,
      bestStreak: 30,
      maxTicks: 9000,
      playedDaily: true,
    });
  });

  it('el reto con modificador no cuenta para la racha ni la duración (como el servidor)', async () => {
    const { dayAggFrom } = await load();
    expect(dailyModsFor(TUESDAY).mods).not.toBeNull();
    expect(dayAggFrom(TUESDAY, [h(TUESDAY, 10, 5, 300, 2)], [dr(40, 9000, 30)])).toEqual({
      runs: 2,
      killed: 45,
      bestStreak: 2,
      maxTicks: 300,
      playedDaily: true,
    });
  });
});

describe('missionViews', () => {
  it('las tres del motor con su avance', async () => {
    const { missionViews } = await load();
    const agg: DayAgg = { runs: 5, killed: 200, bestStreak: 30, maxTicks: 400 * TICKS_PER_SECOND, playedDaily: true };
    const views = missionViews(MONDAY, agg, new Set());
    const ms = missionsFor(MONDAY);
    expect(views.map((v) => v.id)).toEqual(ms.map((m) => m.id));
    for (const [i, v] of views.entries()) {
      expect(v).toEqual({ ...ms[i], ...missionProgress(ms[i], agg), rewarded: false });
      expect(v.done).toBe(true);
    }
  });

  it('marca las premiadas', async () => {
    const { missionViews } = await load();
    const ms = missionsFor(MONDAY);
    const views = missionViews(MONDAY, { runs: 0, killed: 0, bestStreak: 0, maxTicks: 0, playedDaily: false }, new Set([ms[1].id]));
    expect(views.map((v) => v.rewarded)).toEqual([false, true, false]);
    expect(views.every((v) => !v.done)).toBe(true);
  });
});

describe('premios del invitado', () => {
  it('suma los bloques una sola vez por misión y fecha', async () => {
    const { missionViews, rewardMissions, loadRewarded, stats } = await load();
    const agg: DayAgg = { runs: 9, killed: 999, bestStreak: 99, maxTicks: 999_999, playedDaily: true };
    const views = missionViews(MONDAY, agg, loadRewarded(MONDAY));
    const total = views.reduce((a, v) => a + v.reward, 0);
    const before = stats.loadStats().bonusXp;
    const fresh = rewardMissions(MONDAY, views);
    expect(fresh.map((v) => v.id)).toEqual(views.map((v) => v.id));
    expect(fresh.every((v) => v.rewarded)).toBe(true);
    expect(stats.loadStats().bonusXp).toBe(before + total);
    // otra vez: nada nuevo
    expect(rewardMissions(MONDAY, views)).toEqual([]);
    expect(stats.loadStats().bonusXp).toBe(before + total);
    expect([...loadRewarded(MONDAY)].sort()).toEqual(views.map((v) => v.id).sort());
    // otra fecha, otras misiones
    expect(loadRewarded(addDays(MONDAY, 1)).size).toBe(0);
  });

  it('solo premia las cumplidas', async () => {
    const { missionViews, rewardMissions, stats } = await load();
    const views = missionViews(MONDAY, { runs: 0, killed: 0, bestStreak: 0, maxTicks: 0, playedDaily: false });
    expect(rewardMissions(MONDAY, views)).toEqual([]);
    expect(stats.loadStats().bonusXp).toBe(0);
  });

  it('olvida las fechas viejas', async () => {
    const { missionViews, rewardMissions, MISSIONS_KEY } = await load();
    const full: DayAgg = { runs: 9, killed: 999, bestStreak: 99, maxTicks: 999_999, playedDaily: true };
    const old = addDays(MONDAY, -30);
    rewardMissions(old, missionViews(old, full));
    rewardMissions(MONDAY, missionViews(MONDAY, full));
    expect(Object.keys(JSON.parse(mem.get(MISSIONS_KEY)!))).toEqual([MONDAY]);
  });

  it('guestMissions junta el historial y el reto de tb_daily1', async () => {
    const { guestMissions, daily } = await load();
    daily.markDailyStarted(MONDAY);
    daily.recordDailyFinish(MONDAY, { killed: 30, missed: 1, durationTicks: 3000, bestStreak: 12 });
    const views = guestMissions(MONDAY, [h(MONDAY, 9, 30, 600, 3)], daily.loadDailyLocal());
    const agg: DayAgg = { runs: 2, killed: 60, bestStreak: 12, maxTicks: 3000, playedDaily: true };
    const expected = missionsFor(MONDAY).map((m) => ({ ...m, ...missionProgress(m, agg), rewarded: false }));
    expect(views).toEqual(expected);
  });
});

describe('pantalla final', () => {
  const v = (id: string, done: boolean): MissionView => ({ id, kind: 'streak', title: id, target: 1, value: done ? 1 : 0, done, reward: 10, rewarded: done });

  it('solo las que se cumplieron en esta partida', async () => {
    const { newlyCompleted } = await load();
    const before = [v('a', true), v('b', false), v('c', false)];
    const after = [v('a', true), v('b', true), v('c', false)];
    expect(newlyCompleted(before, after).map((m) => m.id)).toEqual(['b']);
    expect(newlyCompleted(null, after)).toEqual([]);
    expect(newlyCompleted(before, null)).toEqual([]);
    // una misión que no estaba antes (otro día) no cuenta
    expect(newlyCompleted([v('x', false)], [v('y', true)])).toEqual([]);
  });

  it('textos del avance', async () => {
    const { progressLabel, doneCount } = await load();
    expect(progressLabel({ ...v('a', false), kind: 'streak', value: 9, target: 15 })).toBe('9/15');
    expect(progressLabel({ ...v('a', false), kind: 'reach', value: 112, target: 140 })).toBe('112/140 s');
    expect(progressLabel(v('a', true))).toBe('Lista');
    expect(doneCount([v('a', true), v('b', false), v('c', true)])).toBe(2);
  });
});
