// Tests por propiedades del desbloqueo del reto del día, las misiones y "Retar a un amigo".
// Sin librería de PBT: generador propio con PRNG mulberry32 y semilla fija (reproducible, sin shrinking).
import { describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, string>());
vi.mock('@/platform/storage', () => ({
  storage: {
    get: (k: string) => mem.get(k) ?? null,
    set: (k: string, v: string) => void mem.set(k, v),
    remove: (k: string) => void mem.delete(k),
  },
}));

import { challengeOfferVisible } from './challenge';
import { DAILY_FROM_RUNS, DAILY_FROM_VISIT, dailyVisible, playedRuns, runsToUnlock, unlockHintText } from './daily';

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0xacb5);
const EDGE = [0, 1, 2, 3, 4, 5, 10, 1_000_000, Number.MAX_SAFE_INTEGER];
const nat = () => (rnd() < 0.5 ? EDGE[Math.floor(rnd() * EDGE.length)] : Math.floor(rnd() * 20));
const bool = () => rnd() < 0.5;
const state = () => ({ accounts: bool(), visits: nat(), runs: nat(), remembered: rnd() < 0.2 });
const N = 600;

describe('desbloqueo (propiedades)', () => {
  it('2.ª visita, 3.ª partida o ya recordado; más visitas o partidas nunca vuelven a bloquear; sin API nunca', () => {
    for (let i = 0; i < N; i++) {
      const s = state();
      const s2 = { ...s, visits: s.visits + nat(), runs: s.runs + nat() };
      if (dailyVisible(s)) expect(dailyVisible(s2), JSON.stringify([s, s2])).toBe(true);
      expect(dailyVisible(s), JSON.stringify(s)).toBe(s.accounts && (s.remembered || s.visits >= 2 || s.runs >= 3));
    }
    expect(DAILY_FROM_VISIT).toBe(2);
    expect(DAILY_FROM_RUNS).toBe(3);
  });

  it('runsToUnlock: solo con API, bloqueado y al menos 1 partida; runs + faltan = DAILY_FROM_RUNS', () => {
    for (let i = 0; i < N; i++) {
      const s = state();
      const left = runsToUnlock(s);
      expect(left !== null, JSON.stringify(s)).toBe(s.accounts && !dailyVisible(s) && s.runs >= 1);
      if (left !== null) {
        expect(left).toBeGreaterThanOrEqual(1);
        expect(left).toBeLessThanOrEqual(DAILY_FROM_RUNS - 1);
        expect(s.runs + left).toBe(DAILY_FROM_RUNS);
      }
    }
  });

  it('"Retar a un amigo" se desbloquea junto con el reto, o antes por un enlace de reto', () => {
    for (let i = 0; i < N; i++) {
      const s = { ...state(), arrivedByLink: bool() };
      expect(challengeOfferVisible(s), JSON.stringify(s)).toBe(s.accounts && (dailyVisible(s) || s.arrivedByLink));
    }
  });

  it('playedRuns: la mayor entre las del dispositivo y las de la cuenta', () => {
    const user = (): { stats?: { totalRuns: number } } | null | undefined => {
      const r = rnd();
      if (r < 0.1) return undefined;
      if (r < 0.2) return null;
      if (r < 0.3) return {};
      if (r < 0.4) return { stats: undefined };
      return { stats: { totalRuns: nat() } };
    };
    for (let i = 0; i < N; i++) {
      const l = nat();
      const u = user();
      expect(playedRuns(l, u)).toBe(Math.max(l, u?.stats?.totalRuns ?? 0));
    }
    // null por JSON se ignora (NaN no puede llegar por JSON)
    expect(playedRuns(2, { stats: { totalRuns: null as unknown as number } })).toBe(2);
  });

  it('unlockHintText: singular y plural', () => {
    expect(unlockHintText(1)).toBe('Te falta 1 partida para desbloquear el reto del día y las misiones.');
    for (let n = 2; n < 200; n++) {
      expect(unlockHintText(n)).toBe(`Te faltan ${n} partidas para desbloquear el reto del día y las misiones.`);
    }
  });
});
