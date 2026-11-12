import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameResult } from '@/game/types';

// localStorage en memoria (storage.web.ts lo lee de window en cada llamada)
const mem = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
  },
});

const result = (killed: number, missed: number, durationTicks: number, bestStreak: number): GameResult => ({
  seed: 1,
  maxLives: 5,
  fieldW: 390,
  fieldH: 600,
  mods: null,
  inputs: [],
  killed,
  missed,
  bestStreak,
  endReason: 'tiempo',
  durationTicks,
  rulesVersion: 5,
});

// stats.ts guarda en memoria lo que leyó: módulos nuevos en cada test
const load = async () => {
  vi.resetModules();
  return import('./history');
};

beforeEach(() => mem.clear());

describe('recordRun', () => {
  it('misma clave; las entradas antiguas (sin t ni s) siguen siendo válidas', async () => {
    mem.set('tb_best5', '40');
    mem.set('tb_hist5', JSON.stringify([{ k: 40, m: 2, d: 1000 }]));
    const h = await load();
    expect(h.loadHist()).toEqual([{ k: 40, m: 2, d: 1000 }]);
    const r = h.recordRun(result(12, 3, 1800, 6), 2000);
    expect(r.isRecord).toBe(false);
    expect(r.best).toBe(40);
    expect(JSON.parse(mem.get('tb_hist5')!)).toEqual([
      { k: 12, m: 3, d: 2000, t: 1800, s: 6 },
      { k: 40, m: 2, d: 1000 },
    ]);
  });

  it('jugador existente sin tb_stats1: se inicializa sin contar dos veces esta partida', async () => {
    mem.set('tb_best5', '40');
    mem.set('tb_hist5', JSON.stringify([{ k: 40, m: 2, d: 1000 }, { k: 10, m: 5, d: 900 }]));
    const h = await load();
    const r = h.recordRun(result(12, 3, 1800, 6), 2000);
    expect(r.stats.before).toMatchObject({ bestTicks: 0, totalKilled: 50, runs: 2 });
    expect(r.stats.after).toMatchObject({ bestTicks: 1800, bestStreak: 6, totalKilled: 62, runs: 3 });
  });

  it('récord y estadísticas del dispositivo (antes y después)', async () => {
    const h = await load();
    const a = h.recordRun(result(20, 1, 3000, 9), 1);
    expect(a.isRecord).toBe(true);
    expect(mem.get('tb_best5')).toBe('20');
    expect(a.stats.before.bestTicks).toBe(0);
    expect(a.stats.after).toMatchObject({ bestTicks: 3000, bestStreak: 9, totalKilled: 20, runs: 1 });
    const b = h.recordRun(result(5, 4, 600, 2), 2);
    expect(b.stats.before.bestTicks).toBe(3000);
    expect(b.stats.after).toMatchObject({ bestTicks: 3000, bestStreak: 9, totalKilled: 25, runs: 2 });
  });
});
