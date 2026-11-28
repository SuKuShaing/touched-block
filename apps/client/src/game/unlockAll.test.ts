// APK de prueba (`EXPO_PUBLIC_UNLOCK_ALL=1`): todo se puede usar, pero se celebra lo que se gana.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADD_START, TICKS_PER_SECOND } from '@tb/engine';

const { mem } = vi.hoisted(() => ({ mem: new Map<string, string>() }));
vi.mock('@/platform/storage', () => ({
  storage: {
    get: (k: string) => mem.get(k) ?? null,
    set: (k: string, v: string) => void mem.set(k, v),
    remove: (k: string) => void mem.delete(k),
  },
}));
vi.mock('@/config', () => ({ config: { unlockAll: true }, features: { accounts: true } }));

import { CATALOG, type CatalogStats, EMPTY_CATALOG_STATS, isUnlocked } from '@/cosmetics/catalog';
import { getCelebrationQueue, observeCelebrations, offerRunCelebrations, resetCelebrationsForTests } from './celebrationQueue';
import { outsideCelebrations, ownedKeys, runCelebrations } from './celebrations';
import { endPrize } from './endPrize';

const ALL = { accounts: true, daily: true };
const st = (p: Partial<CatalogStats>): CatalogStats => ({ ...EMPTY_CATALOG_STATS, ...p });
const keys = () => getCelebrationQueue().items.map((c) => c.key);

beforeEach(() => {
  mem.clear();
  resetCelebrationsForTests();
});

describe('con todo desbloqueado', () => {
  it('se pueden usar los 55, pero no cuentan como ganados', () => {
    expect(CATALOG.filter((i) => isUnlocked(i, EMPTY_CATALOG_STATS))).toHaveLength(55);
    expect(ownedKeys(EMPTY_CATALOG_STATS)).toEqual([]);
  });

  it('la primera partida celebra la insignia y sus premios', () => {
    observeCelebrations({ viewer: 'guest', local: EMPTY_CATALOG_STATS, owned: () => ownedKeys(EMPTY_CATALOG_STATS) }, ALL, 0);
    const after = st({ runs: 1, bestTicks: 25 * TICKS_PER_SECOND, totalKilled: 8 });
    const prize = endPrize(EMPTY_CATALOG_STATS, after, ALL)!;
    expect(prize.items.map((i) => i.id)).toEqual(['suave', 'marimba']);
    offerRunCelebrations(runCelebrations({ prize, before: EMPTY_CATALOG_STATS, after, unlockedFeature: false, ctx: ALL }), 0, 1000);
    expect(keys()).toEqual(['tier:0', 'item:sound:suave', 'item:sound:marimba']);
  });

  it('lo que llega fuera de la partida también (bloques extra de una misión)', () => {
    const a = { viewer: 'u1', stats: st({ runs: 1, totalKilled: 280 }) };
    const b = { viewer: 'u1', stats: st({ runs: 1, totalKilled: 280, bonusXp: 30 }) };
    expect(outsideCelebrations(a, b, ALL).map((c) => c.key)).toEqual(['item:palette:pastel']);
  });

  it('subir a Bronce: se anuncia Viento', () => {
    const before = st({ runs: 11, bestTicks: (ADD_START - 1) * TICKS_PER_SECOND });
    const after = st({ runs: 12, bestTicks: ADD_START * TICKS_PER_SECOND });
    expect(endPrize(before, after, ALL)!.items.map((i) => i.id)).toEqual(['viento']);
  });
});
