import { Injectable } from '@nestjs/common';
import { RULES_VERSION, type TierRef } from '@tb/engine';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { BestScoresService } from './best-scores.service';
import { type Period, periodKey } from './periods';
import { RANKING_ORDER } from './ranking';
import { type Scope, resolveScope, scopeFilter } from './scope';

export { SCOPES, type Scope } from './scope';

@Injectable()
export class LeaderboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly best: BestScoresService,
    private readonly stats: StatsService,
  ) {}

  async get(opts: { scope: Scope; period: Period; country?: string; limit: number; userId?: string }) {
    const { scope, period, limit, userId } = opts;
    const key = periodKey(period, new Date());
    const resolved = await resolveScope(this.prisma, scope, opts.country, userId);
    const filter: Prisma.BestScoreWhereInput = scopeFilter(resolved);
    const country = resolved.country;

    const where: Prisma.BestScoreWhereInput = { rulesVersion: RULES_VERSION, periodType: period, periodKey: key, ...filter };
    const [rows, total] = await Promise.all([
      this.prisma.bestScore.findMany({
        where,
        orderBy: RANKING_ORDER,
        take: limit,
        include: { user: { select: { username: true } } },
      }),
      this.prisma.bestScore.count({ where }),
    ]);

    let me: { rank: number; killed: number; missed: number; achievedAt: string; tier: TierRef | null } | null | undefined;
    const tiers = await this.stats.tiersFor([...rows.map((r) => r.userId), ...(userId ? [userId] : [])]);
    if (userId) {
      const mine = await this.best.best(userId, period, key);
      // en el ranking de país solo aparece si su récord cuenta para ese país
      const inScope = mine && (scope !== 'country' || mine.country === country);
      me = inScope
        ? {
            rank: await this.best.rankOf(mine, period, key, filter),
            killed: mine.killed,
            missed: mine.missed,
            achievedAt: mine.achievedAt.toISOString(),
            tier: tiers.get(userId) ?? null,
          }
        : null;
    }

    return {
      scope,
      period,
      periodKey: key,
      ...(country ? { country } : {}),
      total,
      entries: rows.map((r, i) => ({
        rank: i + 1,
        userId: r.userId,
        username: r.user.username,
        country: r.country,
        killed: r.killed,
        missed: r.missed,
        achievedAt: r.achievedAt.toISOString(),
        tier: tiers.get(r.userId) ?? null,
        ...(userId ? { isMe: r.userId === userId } : {}),
      })),
      ...(me !== undefined ? { me } : {}),
    };
  }
}
