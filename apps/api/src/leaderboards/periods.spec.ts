import { describe, expect, it } from 'vitest';
import { isoWeekKey, periodKey, periodKeysFor, periodStart } from './periods';
import { type Score, compareScores, isBetter } from './ranking';

const d = (s: string) => new Date(s);

describe('semanas ISO (UTC)', () => {
  it.each([
    ['2026-01-01T12:00:00Z', '2026-W01'], // jueves
    ['2025-12-29T00:00:00Z', '2026-W01'], // lunes de la semana 1 de 2026
    ['2025-12-28T23:59:59Z', '2025-W52'], // domingo anterior
    ['2027-01-01T00:00:00Z', '2026-W53'], // 2026 tiene 53 semanas
    ['2024-12-30T08:00:00Z', '2025-W01'],
    ['2021-01-03T00:00:00Z', '2020-W53'],
    ['2026-11-09T00:00:00Z', '2026-W46'],
    ['2026-11-08T23:59:59Z', '2026-W45'],
  ])('%s → %s', (iso, key) => {
    expect(isoWeekKey(d(iso))).toBe(key);
  });

  it('usa UTC y no la hora local', () => {
    // 30-nov 23:30 en Chile (UTC−3) ya es diciembre en UTC
    const t = d('2026-11-30T23:30:00-03:00');
    expect(periodKey('month', t)).toBe('2026-12');
    expect(periodKey('year', d('2026-12-31T22:00:00-03:00'))).toBe('2027');
  });
});

describe('claves y comienzos de período', () => {
  const t = d('2026-11-12T15:04:05Z'); // jueves
  it('genera las 4 claves', () => {
    expect(periodKeysFor(t)).toEqual([
      { periodType: 'week', periodKey: '2026-W46' },
      { periodType: 'month', periodKey: '2026-11' },
      { periodType: 'year', periodKey: '2026' },
      { periodType: 'all', periodKey: 'all' },
    ]);
  });

  it('el comienzo de la semana es el lunes 00:00 UTC', () => {
    expect(periodStart('week', t)?.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(periodStart('week', d('2026-11-15T23:59:00Z'))?.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(periodStart('week', d('2026-11-09T00:00:00Z'))?.toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(periodStart('month', t)?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(periodStart('year', t)?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(periodStart('all', t)).toBeNull();
  });

  it('la clave de la semana coincide con la de su lunes', () => {
    for (let i = 0; i < 400; i++) {
      const day = new Date(Date.UTC(2026, 0, 1) + i * 86_400_000);
      expect(isoWeekKey(periodStart('week', day)!)).toBe(isoWeekKey(day));
    }
  });
});

describe('orden del ranking', () => {
  const s = (killed: number, missed: number, at: string): Score => ({ killed, missed, achievedAt: d(at) });

  it('más destruidos, luego menos escapados, luego el que lo logró antes', () => {
    const a = s(10, 3, '2026-11-10T00:00:00Z');
    const b = s(10, 1, '2026-11-11T00:00:00Z');
    const c = s(12, 9, '2026-11-12T00:00:00Z');
    const e = s(10, 1, '2026-11-09T00:00:00Z');
    expect([a, b, c, e].sort(compareScores)).toEqual([c, e, b, a]);
    expect(isBetter(c, a)).toBe(true);
    expect(isBetter(b, e)).toBe(false);
    expect(compareScores(a, a)).toBe(0);
  });
});
