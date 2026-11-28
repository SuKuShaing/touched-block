import { describe, expect, it } from 'vitest';
import type { Me, PlayerStats } from '@/api/types';
import { EMPTY_STATS } from '@/lib/stats';
import { catalogStatsFor } from './active';
import { CATALOG, meets } from './catalog';

const me = (stats: Partial<PlayerStats>) => ({ id: 'u1', username: 'ana', invitedCount: 0, stats }) as unknown as Me;
const pctPrizes = (pct: number | null) =>
  CATALOG.filter((i) => i.req.kind === 'achievement' && i.req.id === 'mejorReto' && meets(i.req, { ...catalogStatsFor(EMPTY_STATS, null), bestDailyPct: pct })).map(
    (i) => i.id,
  );

describe('porcentaje del reto para logros y premios', () => {
  it('invitado: un porcentaje guardado es provisional y solo cuenta como participación', () => {
    const s = catalogStatsFor(EMPTY_STATS, null, { bestPct: 100 });
    expect(s.bestDailyPct).toBe(0);
    expect(pctPrizes(s.bestDailyPct)).toEqual(['rayas']);
  });

  it('invitado que nunca participó: null', () => {
    expect(catalogStatsFor(EMPTY_STATS, null, { bestPct: null }).bestDailyPct).toBeNull();
    expect(catalogStatsFor(EMPTY_STATS, null).bestDailyPct).toBeNull();
    expect(catalogStatsFor(EMPTY_STATS, undefined, {}).bestDailyPct).toBeNull();
  });

  it('con cuenta manda la cuenta (solo días cerrados), no el dispositivo', () => {
    expect(catalogStatsFor(EMPTY_STATS, me({ bestDailyPct: 75 }), { bestPct: 0 }).bestDailyPct).toBe(75);
    expect(catalogStatsFor(EMPTY_STATS, me({ bestDailyPct: null }), { bestPct: 100 }).bestDailyPct).toBeNull();
  });
});
