import { Injectable } from '@nestjs/common';
import { type DateKey, type DayAgg, type MissionKind, missionProgress, missionsFor } from '@tb/engine';
import { isWithinDateWindow, localDayStart } from '../common/dates';
import { badRequest } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';

export interface MissionView {
  id: string;
  kind: MissionKind;
  title: string;
  target: number;
  value: number;
  done: boolean;
  reward: number;
  rewarded: boolean;
}

export const invalidDate = () => badRequest('La fecha no es válida.', 'invalid_date');

@Injectable()
export class MissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
  ) {}

  /**
   * Resumen de las partidas válidas del usuario que terminaron en ese día local (`tz` = minutos
   * al este de UTC). La mejor racha y la duración solo miran partidas sin modificadores.
   */
  async dayAgg(userId: string, date: DateKey, tz: number): Promise<DayAgg> {
    const start = localDayStart(date, tz);
    const end = new Date(start.getTime() + 86_400_000);
    const inDay = { userId, status: 'valid' as const, finishedAt: { gte: start, lt: end } };
    const [all, plain, daily] = await Promise.all([
      this.prisma.run.aggregate({ where: inDay, _count: { _all: true }, _sum: { killed: true } }),
      this.prisma.run.aggregate({ where: { ...inDay, config: { equals: Prisma.DbNull } }, _max: { bestStreak: true, ticks: true } }),
      this.prisma.run.count({ where: { userId, status: 'valid', mode: 'daily', dailyDate: date } }),
    ]);
    return {
      runs: all._count._all,
      killed: all._sum.killed ?? 0,
      bestStreak: plain._max.bestStreak ?? 0,
      maxTicks: plain._max.ticks ?? 0,
      playedDaily: daily > 0,
    };
  }

  /**
   * Las tres misiones del día con su avance. Una misión cumplida se premia una sola vez
   * (MissionReward con clave usuario + fecha + misión), sumando `bonusXp` en la misma transacción.
   */
  async get(userId: string, date: DateKey, tz: number) {
    if (!isWithinDateWindow(date)) throw invalidDate();
    const agg = await this.dayAgg(userId, date, tz);
    const missions = missionsFor(date).map((m) => ({ m, p: missionProgress(m, agg) }));
    const rewarded = new Set(
      (await this.prisma.missionReward.findMany({ where: { userId, date }, select: { missionId: true } })).map((r) => r.missionId),
    );
    for (const { m, p } of missions) {
      if (!p.done || rewarded.has(m.id)) continue;
      await this.prisma.$transaction(async (tx) => {
        // ON CONFLICT DO NOTHING: con dos peticiones a la vez, solo una entrega el premio
        const res = await tx.missionReward.createMany({
          data: [{ userId, date, missionId: m.id, reward: m.reward }],
          skipDuplicates: true,
        });
        if (res.count === 1) await this.stats.addBonusXp(userId, m.reward, tx);
      });
      rewarded.add(m.id);
    }
    const stats = await this.prisma.userStats.findUnique({ where: { userId }, select: { bonusXp: true } });
    return {
      date,
      missions: missions.map(
        ({ m, p }): MissionView => ({
          id: m.id,
          kind: m.kind,
          title: m.title,
          target: m.target,
          value: p.value,
          done: p.done,
          reward: m.reward,
          rewarded: rewarded.has(m.id),
        }),
      ),
      bonusXp: stats?.bonusXp ?? 0,
    };
  }
}
