import { beforeEach, describe, expect, it, vi } from 'vitest';

// localStorage en memoria (storage.web.ts lo lee de window en cada llamada)
const mem = new Map<string, string>();
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
  },
});

// stats.ts guarda en memoria lo que leyó: módulo nuevo en cada test
const load = async () => {
  vi.resetModules();
  return import('./stats');
};

const run = (killed: number, durationTicks: number, bestStreak = 0) => ({ killed, durationTicks, bestStreak });

beforeEach(() => mem.clear());

describe('tb_stats2', () => {
  it('si está dañado se reconstruye desde el historial, no desde cero', async () => {
    mem.set('tb_hist6', JSON.stringify([{ k: 30, m: 1, d: 1, t: 9000, s: 12 }]));
    for (const bad of ['{roto', 'null', '42', '[]']) {
      mem.set('tb_stats2', bad);
      const { loadStats } = await load();
      expect(loadStats()).toMatchObject({ bestTicks: 9000, bestStreak: 12, totalKilled: 30, runs: 1 });
    }
  });

  it('otra pestaña guardó más: no se pisa con la copia vieja en memoria', async () => {
    const { loadStats, recordStats } = await load();
    expect(loadStats().bestTicks).toBe(0); // esta pestaña leyó antes
    // la otra pestaña llegó a Oro y guardó
    mem.set('tb_stats2', JSON.stringify({ bestTicks: 21600, bestStreak: 40, totalKilled: 500, runs: 20, bonusXp: 30 }));
    const { after } = recordStats(run(5, 600, 3));
    expect(after).toEqual({ bestTicks: 21600, bestStreak: 40, totalKilled: 505, runs: 21, bonusXp: 30 });
    expect(JSON.parse(mem.get('tb_stats2')!)).toEqual(after);
  });

  it('con el almacenamiento bloqueado se acumula en memoria durante la sesión', async () => {
    const { recordStats } = await load();
    mem.clear();
    const realSet = mem.set.bind(mem);
    mem.set = () => mem; // setItem no guarda nada
    try {
      recordStats(run(10, 1200));
      const { after } = recordStats(run(7, 600));
      expect(after.totalKilled).toBe(17);
      expect(after.runs).toBe(2);
      expect(after.bestTicks).toBe(1200);
    } finally {
      mem.set = realSet;
    }
  });

  it('las partidas de reto no suben la mejor duración ni la racha (D6)', async () => {
    const { recordStats } = await load();
    const { after } = recordStats(run(50, 30000, 40), { normal: false });
    expect(after).toMatchObject({ bestTicks: 0, bestStreak: 0, totalKilled: 50, runs: 1 });
  });
});

describe('reinicio de datos', () => {
  it('lo guardado con las claves de antes no se lee ni se borra', async () => {
    const old = {
      tb_best5: '120',
      tb_hist5: JSON.stringify([{ k: 120, m: 0, d: 1, t: 30000, s: 50 }]),
      tb_stats1: JSON.stringify({ bestTicks: 30000, bestStreak: 50, totalKilled: 1500, runs: 64, bonusXp: 120 }),
    };
    for (const [k, v] of Object.entries(old)) mem.set(k, v);
    const { EMPTY_STATS, loadStats, recordStats } = await load();
    expect(loadStats()).toEqual(EMPTY_STATS);
    expect(recordStats(run(5, 600, 3)).after).toEqual({ bestTicks: 600, bestStreak: 3, totalKilled: 5, runs: 1, bonusXp: 0 });
    for (const [k, v] of Object.entries(old)) expect(mem.get(k)).toBe(v);
  });

  it('la copia vieja del usuario no se usa: la sesión sigue y el perfil se vuelve a pedir', async () => {
    mem.set('tb_rt1', 'token-de-refresco');
    mem.set('tb_me1', JSON.stringify({ id: 'u1', username: 'jugador' }));
    vi.resetModules();
    const { session } = await import('@/api/session');
    expect(session.get()).toEqual({ status: 'authed', user: null });
  });
});

describe('withRun', () => {
  it('estadísticas del dispositivo (runs) y de la cuenta (totalRuns), sin tocar los demás campos', async () => {
    const { withRun } = await load();
    const dev = { bestTicks: 600, bestStreak: 5, totalKilled: 40, runs: 3, bonusXp: 30 };
    expect(withRun(dev, run(10, 1200, 8), true)).toEqual({ bestTicks: 1200, bestStreak: 8, totalKilled: 50, runs: 4, bonusXp: 30 });
    const acc = { bestTicks: 9000, bestStreak: 40, totalKilled: 900, totalRuns: 70, bonusXp: 60, bestDailyPct: 55, dailyStreakBest: 4 };
    expect(withRun(acc, run(10, 1200, 8), true, 'totalRuns')).toEqual({ ...acc, totalKilled: 910, totalRuns: 71 });
    // de reto: solo bloques y partidas
    expect(withRun(acc, run(10, 99999, 99), false, 'totalRuns')).toEqual({ ...acc, totalKilled: 910, totalRuns: 71 });
  });
});
