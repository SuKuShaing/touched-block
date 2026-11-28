import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOG_STATS } from '@/cosmetics/catalog';
import { collectionScore, hasCollectionNews, seenAfterViewing } from './collectionScore';

describe('collectionScore', () => {
  it('un jugador nuevo no tiene nada', () => expect(collectionScore(EMPTY_CATALOG_STATS)).toBe(0));
  it('crece al ganar cosas', () => {
    const some = { ...EMPTY_CATALOG_STATS, runs: 50, bestTicks: 60 * 120, totalKilled: 5000, bestStreak: 40 };
    expect(collectionScore(some)).toBeGreaterThan(0);
    // participar en un reto diario (aunque sea con 0 %) también suma: logro y premio
    expect(collectionScore({ ...some, bestDailyPct: 0 })).toBe(collectionScore(some) + 2);
  });
});

describe('hasCollectionNews', () => {
  it('sin sembrar no hay punto', () => expect(hasCollectionNews(10, -1)).toBe(false));
  it('igual o menos no hay punto', () => {
    expect(hasCollectionNews(10, 10)).toBe(false);
    expect(hasCollectionNews(8, 10)).toBe(false);
  });
  it('más que lo visto enciende el punto', () => expect(hasCollectionNews(11, 10)).toBe(true));
});

describe('seenAfterViewing', () => {
  it('guarda el máximo (cerrar sesión no baja lo visto)', () => {
    expect(seenAfterViewing(5, 10)).toBe(10);
    expect(seenAfterViewing(12, 10)).toBe(12);
    expect(seenAfterViewing(3, -1)).toBe(3);
  });
});
