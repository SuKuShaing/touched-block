import { Injectable } from '@nestjs/common';
import { type TierRef, dailyStreak, tierRefForTicks } from '@tb/engine';
import { utcDateKey } from '../common/dates';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type RunModeName = 'normal' | 'duel' | 'daily';
export const RUN_MODES: readonly RunModeName[] = ['normal', 'duel', 'daily'];

/** Estadísticas del jugador tal como viajan en la API (`Me.stats`, `RunResult.stats`). */
export interface PlayerStats {
  /** Duración (ticks, 60 por segundo) de la mejor partida normal sin modificadores. */
  bestTicks: number;
  /** Mejor racha en una partida normal sin modificadores. */
  bestStreak: number;
  /** Bloques destruidos en todas las partidas válidas (todos los modos). */
  totalKilled: number;
  /** Partidas válidas (todos los modos). */
  totalRuns: number;
  /** Bloques extra ganados con misiones. */
  bonusXp: number;
  /** Mejor "mejor que el N %" en un reto diario, o null si nunca se registró uno. */
  bestDailyPct: number | null;
  /** Mejor racha de días seguidos jugando el reto diario. */
  dailyStreakBest: number;
}

export const EMPTY_STATS: PlayerStats = {
  bestTicks: 0,
  bestStreak: 0,
  totalKilled: 0,
  totalRuns: 0,
  bonusXp: 0,
  bestDailyPct: null,
  dailyStreakBest: 0,
};

/** Lo que aporta una partida válida a las estadísticas. */
export interface RunForStats {
  ticks: number;
  killed: number;
  bestStreak: number;
  mode: RunModeName;
  /** Modificadores de la partida (Run.config), o null. */
  mods?: unknown;
}

type StatsRow = Omit<PlayerStats, 'dailyStreakBest'>;
type Db = PrismaService | Prisma.TransactionClient;

/** ¿La partida cuenta para la insignia y la mejor racha? Solo las normales sin modificadores (D6, 5.1). */
export const countsForBest = (mode: RunModeName, mods: unknown) => mode === 'normal' && (mods === null || mods === undefined);

/** Insignia pública: sale de la mejor duración; null si todavía no terminó ninguna partida válida. */
export function tierOf(s: { bestTicks: number; totalRuns: number } | null | undefined): TierRef | null {
  return s && s.totalRuns > 0 ? tierRefForTicks(s.bestTicks) : null;
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Suma una partida válida a las estadísticas con UNA sentencia atómica (sirve con peticiones
   * simultáneas). Todas las partidas suman a `totalKilled` y `totalRuns`; solo las normales sin
   * modificadores pueden subir `bestTicks` y `bestStreak`.
   */
  async record(userId: string, run: RunForStats, db: Db = this.prisma): Promise<PlayerStats> {
    const best = countsForBest(run.mode, run.mods);
    const ticks = best ? Math.max(0, Math.floor(run.ticks)) : 0;
    const streak = best ? Math.max(0, Math.floor(run.bestStreak)) : 0;
    const killed = Math.max(0, Math.floor(run.killed));
    const rows = await db.$queryRaw<StatsRow[]>`
      INSERT INTO "UserStats" AS s ("userId", "bestTicks", "bestStreak", "totalKilled", "totalRuns", "bonusXp", "updatedAt")
      VALUES (${userId}::uuid, ${ticks}::int, ${streak}::int, ${killed}::int, 1, 0, now())
      ON CONFLICT ("userId") DO UPDATE SET
        "bestTicks"   = GREATEST(s."bestTicks", EXCLUDED."bestTicks"),
        "bestStreak"  = GREATEST(s."bestStreak", EXCLUDED."bestStreak"),
        "totalKilled" = s."totalKilled" + EXCLUDED."totalKilled",
        "totalRuns"   = s."totalRuns" + 1,
        "updatedAt"   = now()
      RETURNING "bestTicks", "bestStreak", "totalKilled", "totalRuns", "bonusXp", "bestDailyPct"`;
    return { ...pick(rows[0]), dailyStreakBest: await this.dailyStreakBest(userId, db) };
  }

  /** Suma bloques extra (premio de misión). Atómico. */
  async addBonusXp(userId: string, xp: number, db: Db = this.prisma): Promise<number> {
    const rows = await db.$queryRaw<{ bonusXp: number }[]>`
      INSERT INTO "UserStats" AS s ("userId", "bonusXp", "updatedAt")
      VALUES (${userId}::uuid, ${xp}::int, now())
      ON CONFLICT ("userId") DO UPDATE SET "bonusXp" = s."bonusXp" + EXCLUDED."bonusXp", "updatedAt" = now()
      RETURNING "bonusXp"`;
    return rows[0].bonusXp;
  }

  /** Guarda el mejor porcentaje de un reto diario (se queda con el mayor). Atómico. */
  async recordDailyPct(userId: string, pct: number, db: Db = this.prisma): Promise<void> {
    await db.$executeRaw`
      INSERT INTO "UserStats" AS s ("userId", "bestDailyPct", "updatedAt")
      VALUES (${userId}::uuid, ${pct}::int, now())
      ON CONFLICT ("userId") DO UPDATE SET
        "bestDailyPct" = GREATEST(s."bestDailyPct", EXCLUDED."bestDailyPct"),
        "updatedAt" = now()
      WHERE s."bestDailyPct" IS NULL OR s."bestDailyPct" < EXCLUDED."bestDailyPct"`;
  }

  /** Estadísticas del usuario (ceros si todavía no tiene). */
  async get(userId: string): Promise<PlayerStats> {
    const [row, dailyStreakBest] = await Promise.all([
      this.prisma.userStats.findUnique({ where: { userId } }),
      this.dailyStreakBest(userId),
    ]);
    return row ? { ...pick(row), dailyStreakBest } : { ...EMPTY_STATS, dailyStreakBest };
  }

  /** Estadísticas e insignia del usuario. */
  async withTier(userId: string): Promise<{ stats: PlayerStats; tier: TierRef | null }> {
    const stats = await this.get(userId);
    return { stats, tier: tierOf(stats) };
  }

  /** Insignia de varios usuarios a la vez (rankings, retos). */
  async tiersFor(userIds: readonly string[]): Promise<Map<string, TierRef | null>> {
    const ids = [...new Set(userIds)];
    const out = new Map<string, TierRef | null>(ids.map((id) => [id, null]));
    if (ids.length === 0) return out;
    const rows = await this.prisma.userStats.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, bestTicks: true, totalRuns: true },
    });
    for (const r of rows) out.set(r.userId, tierOf(r));
    return out;
  }

  /** Mejor racha de días del reto diario (no depende del día de hoy). */
  private async dailyStreakBest(userId: string, db: Db = this.prisma): Promise<number> {
    const rows = await db.dailyEntry.findMany({ where: { userId }, select: { date: true } });
    if (rows.length === 0) return 0;
    return dailyStreak(
      rows.map((r) => r.date),
      utcDateKey(new Date()),
    ).best;
  }
}

function pick(r: StatsRow): StatsRow {
  return {
    bestTicks: r.bestTicks,
    bestStreak: r.bestStreak,
    totalKilled: r.totalKilled,
    totalRuns: r.totalRuns,
    bonusXp: r.bonusXp,
    bestDailyPct: r.bestDailyPct ?? null,
  };
}
