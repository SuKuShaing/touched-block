import { TICKS_PER_SECOND, TIERS } from '@tb/engine';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { EMPTY_STATS, StatsService, countsForBest, tierOf } from './stats.service';

/** Prisma falso: guarda las llamadas a $queryRaw (texto y valores) y devuelve `row`. */
function fakePrisma(row: Record<string, unknown>, dailyDates: string[] = []) {
  const calls: { sql: string; values: unknown[] }[] = [];
  const prisma = {
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: strings.join('?'), values });
      return [row];
    }),
    dailyEntry: { findMany: vi.fn(async () => dailyDates.map((date) => ({ date }))) },
    userStats: { findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []) },
  };
  return { prisma, calls, service: new StatsService(prisma as unknown as PrismaService) };
}

const ROW = { bestTicks: 600, bestStreak: 12, totalKilled: 40, totalRuns: 3, bonusXp: 20, bestDailyPct: null };

describe('countsForBest / tierOf', () => {
  it('solo las partidas normales sin modificadores cuentan para la insignia y la racha', () => {
    expect(countsForBest('normal', null)).toBe(true);
    expect(countsForBest('normal', undefined)).toBe(true);
    expect(countsForBest('normal', { startAt: 140 })).toBe(false);
    expect(countsForBest('duel', null)).toBe(false);
    expect(countsForBest('daily', null)).toBe(false);
  });

  it('la insignia sale de la mejor duración; null sin partidas', () => {
    expect(tierOf(null)).toBeNull();
    expect(tierOf({ bestTicks: 0, totalRuns: 0 })).toBeNull();
    expect(tierOf({ bestTicks: 0, totalRuns: 1 })).toEqual({ tier: 'madera', step: 1 });
    const bronce = TIERS.find((t) => t.tier === 'bronce')!;
    expect(tierOf({ bestTicks: bronce.at * TICKS_PER_SECOND, totalRuns: 4 })).toEqual({ tier: 'bronce', step: 1 });
    expect(tierOf({ bestTicks: bronce.at * TICKS_PER_SECOND - 1, totalRuns: 4 })).toEqual({ tier: 'madera', step: 3 });
  });
});

describe('StatsService.record', () => {
  it('una sola sentencia atómica (INSERT … ON CONFLICT con GREATEST y sumas)', async () => {
    const { service, calls } = fakePrisma(ROW);
    const stats = await service.record('u1', { ticks: 600, killed: 7, bestStreak: 12, mode: 'normal', mods: null });
    expect(calls).toHaveLength(1);
    const { sql, values } = calls[0];
    expect(sql).toMatch(/INSERT INTO "UserStats"/);
    expect(sql).toMatch(/ON CONFLICT \("userId"\) DO UPDATE/);
    expect(sql).toMatch(/"bestTicks"\s*= GREATEST/);
    expect(sql).toMatch(/"bestStreak"\s*= GREATEST/);
    expect(sql).toMatch(/"totalKilled" = s\."totalKilled" \+ EXCLUDED\."totalKilled"/);
    expect(sql).toMatch(/"totalRuns"\s*= s\."totalRuns" \+ 1/);
    expect(values).toEqual(['u1', 600, 12, 7]);
    expect(stats).toEqual({ ...ROW, dailyStreakBest: 0 });
  });

  it('retos y partidas con modificador no suben la mejor duración ni la racha, pero suman bloques y partidas', async () => {
    for (const run of [
      { mode: 'duel' as const, mods: null },
      { mode: 'daily' as const, mods: null },
      { mode: 'daily' as const, mods: { lives: 3 } },
      { mode: 'normal' as const, mods: { noRed: true } },
    ]) {
      const { service, calls } = fakePrisma(ROW);
      await service.record('u1', { ticks: 9000, killed: 50, bestStreak: 40, ...run });
      expect(calls[0].values).toEqual(['u1', 0, 0, 50]);
    }
  });

  it('agrega la mejor racha de días del reto diario', async () => {
    const { service } = fakePrisma(ROW, ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-08']);
    const stats = await service.record('u1', { ticks: 60, killed: 1, bestStreak: 1, mode: 'normal' });
    expect(stats.dailyStreakBest).toBe(3);
  });
});

describe('StatsService.get', () => {
  it('ceros si el usuario todavía no tiene estadísticas', async () => {
    const { service } = fakePrisma(ROW);
    expect(await service.get('u1')).toEqual(EMPTY_STATS);
    expect(await service.withTier('u1')).toEqual({ stats: EMPTY_STATS, tier: null });
  });
});
