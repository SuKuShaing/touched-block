import { Injectable } from '@nestjs/common';
import { RULES_VERSION } from '@tb/engine';
import { normalizeCountry } from '../common/countries';
import { badRequest, unauthorized } from '../common/errors';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BestScoresService } from './best-scores.service';
import { type Period, periodKey } from './periods';
import { RANKING_ORDER } from './ranking';

export type Scope = 'world' | 'country' | 'friends';
export const SCOPES: readonly Scope[] = ['world', 'country', 'friends'];

@Injectable()
export class LeaderboardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly best: BestScoresService,
  ) {}

  async get(opts: { scope: Scope; period: Period; country?: string; limit: number; userId?: string }) {
    const { scope, period, limit, userId } = opts;
    const key = periodKey(period, new Date());
    let filter: Prisma.BestScoreWhereInput = {};
    let country: string | undefined;

    if (scope === 'country') {
      if (opts.country !== undefined) {
        country = normalizeCountry(opts.country) ?? undefined;
        if (!country) throw badRequest('País inválido.', 'invalid_country');
      } else if (userId) {
        const me = await this.prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
        country = me?.country ?? undefined;
      }
      if (!country) throw badRequest('Indica un país.', 'country_required');
      filter = { country };
    } else if (scope === 'friends') {
      if (!userId) throw unauthorized('Inicia sesión para ver el ranking de amigos.');
      const follows = await this.prisma.follow.findMany({ where: { followerId: userId }, select: { followeeId: true } });
      filter = { userId: { in: [userId, ...follows.map((f) => f.followeeId)] } };
    }

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

    let me: { rank: number; killed: number; missed: number; achievedAt: string } | null | undefined;
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
        ...(userId ? { isMe: r.userId === userId } : {}),
      })),
      ...(me !== undefined ? { me } : {}),
    };
  }
}
