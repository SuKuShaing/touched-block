import { addDays, missionProgress, missionsFor } from '@tb/engine';
import { describe, expect, it, vi } from 'vitest';
import { utcDateKey } from '../common/dates';
import type { PrismaService } from '../prisma/prisma.service';
import type { StatsService } from '../stats/stats.service';
import { MissionsService } from './missions.service';

const today = utcDateKey(new Date());

/** Prisma falso con un día de partidas fijo y premios en memoria. */
function setup(
  day: { runs: number; killed: number; bestStreak: number; maxTicks: number; daily: number; follows?: number },
  invitedById: string | null = null,
) {
  const rewards = new Set<string>();
  let bonusXp = 0;
  const tx = {
    missionReward: {
      createMany: vi.fn(async ({ data }: { data: { missionId: string }[] }) => {
        const key = data[0].missionId;
        if (rewards.has(key)) return { count: 0 };
        rewards.add(key);
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    run: {
      aggregate: vi.fn(async (args: { _count?: unknown }) =>
        args._count
          ? { _count: { _all: day.runs }, _sum: { killed: day.killed } }
          : { _max: { bestStreak: day.bestStreak, ticks: day.maxTicks } },
      ),
      count: vi.fn(async () => day.daily),
    },
    user: { findUnique: vi.fn(async () => ({ invitedById })) },
    follow: { count: vi.fn(async (_args: { where: Record<string, unknown> }) => day.follows ?? 0) },
    missionReward: { findMany: vi.fn(async () => [...rewards].map((missionId) => ({ missionId }))) },
    userStats: { findUnique: vi.fn(async () => ({ bonusXp })) },
    $transaction: vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const stats = {
    addBonusXp: vi.fn(async (_u: string, xp: number) => {
      bonusXp += xp;
      return bonusXp;
    }),
  };
  const svc = new MissionsService(prisma as unknown as PrismaService, stats as unknown as StatsService);
  return { svc, prisma, stats };
}

describe('MissionsService', () => {
  it('arma el día con las partidas válidas y calcula el avance con el motor', async () => {
    const day = { runs: 2, killed: 17, bestStreak: 6, maxTicks: 50 * 60, daily: 0 };
    const { svc, prisma } = setup(day);
    const agg = await svc.dayAgg('u1', today, -180);
    expect(agg).toEqual({ runs: 2, killed: 17, bestStreak: 6, maxTicks: 3000, playedDaily: false, followedToday: false });
    // la mejor racha y la duración solo miran partidas sin modificadores
    const plainCall = prisma.run.aggregate.mock.calls.find((c) => !(c[0] as { _count?: unknown })._count)!;
    expect(JSON.stringify(plainCall[0])).toMatch(/"config"/);

    const res = await svc.get('u1', today, -180);
    expect(res.missions).toHaveLength(3);
    for (const [i, m] of missionsFor(today).entries()) {
      const p = missionProgress(m, agg);
      expect(res.missions[i]).toEqual({ id: m.id, kind: m.kind, title: m.title, target: m.target, value: p.value, done: p.done, reward: m.reward, rewarded: p.done });
    }
  });

  it('sigue a alguien ese día local, sin contar los seguimientos de una invitación', async () => {
    const day = { runs: 0, killed: 0, bestStreak: 0, maxTicks: 0, daily: 0, follows: 2 };
    const notMine = { OR: [{ invitedById: null }, { invitedById: { not: 'u1' } }] };
    const range = { gte: new Date('2026-12-08T03:00:00Z'), lt: new Date('2026-12-09T03:00:00Z') };

    const free = setup(day);
    expect((await free.svc.dayAgg('u1', '2026-12-08', -180)).followedToday).toBe(true);
    expect(free.prisma.follow.count.mock.calls[0][0].where).toStrictEqual({ followerId: 'u1', createdAt: range, followee: notMine });

    const invited = setup(day, 'host');
    await invited.svc.dayAgg('u1', '2026-12-08', -180);
    expect(invited.prisma.follow.count.mock.calls[0][0].where).toStrictEqual({
      followerId: 'u1',
      createdAt: range,
      followeeId: { not: 'host' },
      followee: notMine,
    });
  });

  it('premia cada misión cumplida una sola vez', async () => {
    const { svc, stats } = setup({ runs: 20, killed: 500, bestStreak: 300, maxTicks: 9000 * 60, daily: 1, follows: 1 });
    const first = await svc.get('u1', today, 0);
    const total = missionsFor(today).reduce((s, m) => s + m.reward, 0);
    expect(first.missions.every((m) => m.done && m.rewarded)).toBe(true);
    expect(first.bonusXp).toBe(total);
    expect(stats.addBonusXp).toHaveBeenCalledTimes(3);

    const again = await svc.get('u1', today, 0);
    expect(again.bonusXp).toBe(total);
    expect(stats.addBonusXp).toHaveBeenCalledTimes(3);
  });

  it('rechaza fechas fuera de la ventana de ±1 día', async () => {
    const { svc } = setup({ runs: 0, killed: 0, bestStreak: 0, maxTicks: 0, daily: 0 });
    await expect(svc.get('u1', addDays(today, 3), 0)).rejects.toMatchObject({ response: { code: 'invalid_date' } });
  });
});
