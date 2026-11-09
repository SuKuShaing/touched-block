import { HttpStatus, Injectable } from '@nestjs/common';
import { BASE_LIVES, RULES_VERSION, TICKS_PER_SECOND, randomSeed } from '@tb/engine';
import { matchesHash, randomToken, sha256 } from '../common/crypto';
import { ApiError, conflict, forbidden, notFound } from '../common/errors';
import type { Prisma } from '../generated/prisma/client';
import { BestScoresService } from '../leaderboards/best-scores.service';
import { type Period, periodKey, periodStart } from '../leaderboards/periods';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { ClaimRunDto, CreateRunDto, FinishRunDto } from './dto';
import { REJECT_MESSAGES, verifyRun } from './run-verification';

/** Plazo para reclamar una partida de invitado después de terminarla. */
export const CLAIM_WINDOW_MS = 60 * 60 * 1000;
/** Las partidas de invitado sin reclamar (y las nunca terminadas) se borran después de esto. */
export const GUEST_RUN_TTL_MS = 24 * 60 * 60 * 1000;

const runNotFound = () => notFound('Partida no encontrada.', 'run_not_found');
const ticksToMs = (ticks: number) => Math.round((ticks * 1000) / TICKS_PER_SECOND);

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly best: BestScoresService,
  ) {}

  async create(userId: string | undefined, dto: CreateRunDto) {
    // semilla de 31 bits: cabe en un INTEGER de Postgres y el motor la usa igual (seed | 0)
    const seed = randomSeed() & 0x7fffffff;
    const maxLives = userId ? await this.users.maxLivesOf(userId) : BASE_LIVES;
    const claimToken = userId ? undefined : randomToken();
    const run = await this.prisma.run.create({
      data: {
        userId: userId ?? null,
        claimTokenHash: claimToken ? sha256(claimToken) : null,
        seed,
        rulesVersion: RULES_VERSION,
        maxLives,
        fieldW: dto.fieldW,
        fieldH: dto.fieldH,
      },
    });
    return {
      runId: run.id,
      seed,
      maxLives,
      rulesVersion: RULES_VERSION,
      fieldW: run.fieldW,
      fieldH: run.fieldH,
      startedAt: run.startedAt.toISOString(),
      ...(claimToken ? { claimToken } : {}),
    };
  }

  async finish(runId: string, userId: string | undefined, dto: FinishRunDto) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) throw runNotFound();
    if (run.userId) {
      if (run.userId !== userId) throw forbidden('Esta partida no es tuya.', 'not_your_run');
    } else if (!dto.claimToken || !matchesHash(dto.claimToken, run.claimTokenHash)) {
      throw forbidden('Falta el claimToken de la partida de invitado o no es válido.', 'invalid_claim_token');
    }
    if (run.status !== 'started') throw conflict('Esta partida ya se terminó.', 'run_already_finished');

    const now = new Date();
    const v = verifyRun(run, { inputs: dto.inputs, killed: dto.killed, missed: dto.missed }, now);
    const ticks = v.ticks ?? null;
    const res = await this.prisma.run.updateMany({
      where: { id: run.id, status: 'started' },
      data: {
        status: v.valid ? 'valid' : 'rejected',
        rejectReason: v.valid ? null : v.reason,
        killed: v.killed ?? null,
        missed: v.missed ?? null,
        ticks,
        durationMs: ticks === null ? null : ticksToMs(ticks),
        inputs: dto.inputs as unknown as Prisma.InputJsonValue,
        finishedAt: now,
      },
    });
    if (res.count !== 1) throw conflict('Esta partida ya se terminó.', 'run_already_finished');

    const base = {
      runId: run.id,
      valid: v.valid,
      killed: v.killed ?? null,
      missed: v.missed ?? null,
      durationMs: ticks === null ? null : ticksToMs(ticks),
    };
    if (!v.valid) return { ...base, reason: v.reason, message: REJECT_MESSAGES[v.reason] };
    if (!run.userId) {
      return { ...base, claimable: true, claimExpiresAt: new Date(now.getTime() + CLAIM_WINDOW_MS).toISOString() };
    }
    return { ...base, ...(await this.recordBest(run.userId, run.id, v.killed, v.missed, now)) };
  }

  async claim(runId: string, userId: string, dto: ClaimRunDto) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) throw runNotFound();
    if (run.userId) throw conflict('Esta partida ya tiene dueño.', 'run_already_claimed');
    if (!matchesHash(dto.claimToken, run.claimTokenHash)) {
      throw forbidden('El claimToken no es válido.', 'invalid_claim_token');
    }
    if (run.status === 'started') throw conflict('Primero hay que terminar la partida.', 'run_not_finished');
    if (run.status !== 'valid' || run.killed === null || run.missed === null || !run.finishedAt) {
      throw conflict('Esta partida no es válida, así que no se puede guardar.', 'run_not_valid');
    }
    if (Date.now() - run.finishedAt.getTime() > CLAIM_WINDOW_MS) {
      throw new ApiError(HttpStatus.GONE, 'claim_expired', 'Pasó demasiado tiempo para guardar esta partida.');
    }
    const res = await this.prisma.run.updateMany({
      where: { id: run.id, userId: null, status: 'valid' },
      data: { userId, claimedAt: new Date(), claimTokenHash: null },
    });
    if (res.count !== 1) throw conflict('Esta partida ya tiene dueño.', 'run_already_claimed');
    return {
      runId: run.id,
      valid: true,
      killed: run.killed,
      missed: run.missed,
      durationMs: run.durationMs,
      ...(await this.recordBest(userId, run.id, run.killed, run.missed, run.finishedAt)),
    };
  }

  private async recordBest(userId: string, runId: string, killed: number, missed: number, achievedAt: Date) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
    const improved = await this.best.record(userId, runId, { killed, missed, achievedAt }, user?.country ?? null);
    return {
      isNewBest: improved.includes('all'),
      newBestPeriods: improved,
      ranks: await this.best.ranksOf(userId, 'all'),
    };
  }

  /** Historial de partidas válidas del usuario en el período actual. */
  async history(userId: string, period: Period, limit: number) {
    const now = new Date();
    const key = periodKey(period, now);
    const from = periodStart(period, now);
    const [runs, best] = await Promise.all([
      this.prisma.run.findMany({
        where: {
          userId,
          status: 'valid',
          rulesVersion: RULES_VERSION,
          ...(from ? { finishedAt: { gte: from } } : {}),
        },
        orderBy: { finishedAt: 'desc' },
        take: limit,
        select: { id: true, killed: true, missed: true, durationMs: true, finishedAt: true, maxLives: true },
      }),
      this.best.best(userId, period, key),
    ]);
    return {
      period,
      periodKey: key,
      best: best
        ? { runId: best.runId, killed: best.killed, missed: best.missed, achievedAt: best.achievedAt.toISOString() }
        : null,
      runs: runs.map((r) => ({
        id: r.id,
        killed: r.killed ?? 0,
        missed: r.missed ?? 0,
        durationMs: r.durationMs ?? 0,
        maxLives: r.maxLives,
        finishedAt: r.finishedAt?.toISOString() ?? null,
        isBest: best?.runId === r.id,
      })),
    };
  }

  /** Borra partidas de invitado sin reclamar y partidas nunca terminadas de más de 24 h. */
  async cleanup(now = new Date()) {
    const cutoff = new Date(now.getTime() - GUEST_RUN_TTL_MS);
    const runs = await this.prisma.run.deleteMany({
      where: { startedAt: { lt: cutoff }, OR: [{ userId: null }, { status: 'started' }] },
    });
    const tokens = await this.prisma.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: cutoff } }] },
    });
    return { runs: runs.count, refreshTokens: tokens.count };
  }
}
