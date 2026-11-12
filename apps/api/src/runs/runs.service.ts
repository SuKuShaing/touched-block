import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BASE_LIVES,
  DAILY_ATTEMPTS_ACCOUNT,
  DAILY_ATTEMPTS_GUEST,
  type GameMods,
  RULES_VERSION,
  TICKS_PER_SECOND,
  dailyNumber,
  randomSeed,
} from '@tb/engine';
import { ChallengesService } from '../challenges/challenges.service';
import { matchesHash, randomToken, sha256 } from '../common/crypto';
import { isWithinDateWindow } from '../common/dates';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../common/errors';
import { DailyService, attemptsExhausted, dailyDateInvalid, guestClaimNotAllowed } from '../daily/daily.service';
import { Prisma, type Run } from '../generated/prisma/client';
import { BestScoresService } from '../leaderboards/best-scores.service';
import { type Period, periodKey, periodStart } from '../leaderboards/periods';
import { PrismaService } from '../prisma/prisma.service';
import { type RunModeName, StatsService } from '../stats/stats.service';
import { UsersService } from '../users/users.service';
import { challengeField, CommonFieldService } from './common-field.service';
import type { ClaimRunDto, CreateRunDto, FinishRunDto } from './dto';
import { REJECT_MESSAGES, modsOf, verifyRun } from './run-verification';

/** Plazo para reclamar una partida de invitado después de terminarla. */
export const CLAIM_WINDOW_MS = 60 * 60 * 1000;
/** Las partidas de invitado sin reclamar (y las nunca terminadas) se borran después de esto. */
export const GUEST_RUN_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * Las partidas del reto diario de una cuenta que nunca se terminaron son intentos gastados: se
 * conservan hasta que su fecha ya no se puede jugar ni reclamar (dailyClosesAt, a lo más ~53 h
 * después de empezarla) y se borran después de esto, sin devolver ningún intento.
 */
export const DAILY_STARTED_RUN_TTL_MS = 72 * 60 * 60 * 1000;
/** Vidas de un reto a un amigo: iguales para todos, sin los corazones por invitar. */
export const CHALLENGE_LIVES = BASE_LIVES;

const runNotFound = () => notFound('Partida no encontrada.', 'run_not_found');
const ticksToMs = (ticks: number) => Math.round((ticks * 1000) / TICKS_PER_SECOND);
/** Semilla de 31 bits: cabe en un INTEGER de Postgres y el motor la usa igual (seed | 0). */
const newSeed = () => randomSeed() & 0x7fffffff;

type Db = PrismaService | Prisma.TransactionClient;

interface NewRun {
  id?: string;
  seed: number;
  maxLives: number;
  fieldW: number;
  fieldH: number;
  mode: RunModeName;
  challengeCode?: string;
  dailyDate?: string;
  mods?: GameMods | null;
}

/** Resultado de una partida válida, calculado por el servidor. */
interface ValidResult {
  killed: number;
  missed: number;
  ticks: number;
  bestStreak: number;
}

const modeFieldError = (field: 'challenge' | 'date') =>
  badRequest('Datos inválidos.', 'validation_error', { fields: [{ field, problems: ['mode'] }] });

@Injectable()
export class RunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly best: BestScoresService,
    private readonly stats: StatsService,
    private readonly field: CommonFieldService,
    private readonly challenges: ChallengesService,
    private readonly daily: DailyService,
  ) {}

  async create(userId: string | undefined, dto: CreateRunDto) {
    const mode = dto.mode ?? 'normal';
    if (dto.challenge !== undefined && mode !== 'duel') throw modeFieldError('challenge');
    if (dto.date !== undefined && mode !== 'daily') throw modeFieldError('date');
    if (mode === 'duel') return dto.challenge === undefined ? this.createDuel(userId, dto) : this.joinDuel(userId, dto.challenge);
    if (mode === 'daily') return this.createDaily(userId, dto.date);

    const maxLives = userId ? await this.users.maxLivesOf(userId) : BASE_LIVES;
    return this.startRun(this.prisma, userId, { seed: newSeed(), maxLives, fieldW: dto.fieldW, fieldH: dto.fieldH, mode: 'normal' });
  }

  /** Inserta la partida y arma la respuesta común de POST /runs. */
  private async startRun(db: Db, userId: string | undefined, d: NewRun) {
    const claimToken = userId ? undefined : randomToken();
    const run = await db.run.create({
      data: {
        ...(d.id ? { id: d.id } : {}),
        userId: userId ?? null,
        claimTokenHash: claimToken ? sha256(claimToken) : null,
        seed: d.seed,
        rulesVersion: RULES_VERSION,
        maxLives: d.maxLives,
        fieldW: d.fieldW,
        fieldH: d.fieldH,
        mode: d.mode,
        challengeCode: d.challengeCode ?? null,
        dailyDate: d.dailyDate ?? null,
        config: d.mods ? (d.mods as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
    return {
      runId: run.id,
      seed: run.seed,
      maxLives: run.maxLives,
      rulesVersion: RULES_VERSION,
      fieldW: run.fieldW,
      fieldH: run.fieldH,
      startedAt: run.startedAt.toISOString(),
      ...(claimToken ? { claimToken } : {}),
      mode: d.mode,
      mods: d.mods ?? null,
    };
  }

  /** Reto nuevo: semilla nueva y campo = el menor entre el del creador y el común (D4). */
  private async createDuel(userId: string | undefined, dto: CreateRunDto) {
    const field = challengeField({ fieldW: dto.fieldW, fieldH: dto.fieldH }, await this.field.get());
    const seed = newSeed();
    const runId = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const ch = await this.challenges.create(tx, { seed, ...field, createdById: userId ?? null, creatorRunId: runId });
      const base = await this.startRun(tx, userId, {
        id: runId,
        seed,
        maxLives: CHALLENGE_LIVES,
        ...field,
        mode: 'duel',
        challengeCode: ch.code,
      });
      return { ...base, challengeCode: ch.code, challenge: { code: ch.code, expiresAt: ch.expiresAt.toISOString(), creator: null } };
    });
  }

  /** Unirse a un reto: misma semilla y mismo campo que el reto, cualquiera sea la pantalla. */
  private async joinDuel(userId: string | undefined, rawCode: string) {
    const ch = await this.challenges.findPlayable(rawCode);
    const [creator, base] = await Promise.all([
      this.challenges.creatorOf(ch.code),
      this.startRun(this.prisma, userId, {
        seed: ch.seed,
        maxLives: CHALLENGE_LIVES,
        fieldW: ch.fieldW,
        fieldH: ch.fieldH,
        mode: 'duel',
        challengeCode: ch.code,
      }),
    ]);
    return { ...base, challengeCode: ch.code, challenge: { code: ch.code, expiresAt: ch.expiresAt.toISOString(), creator } };
  }

  /** Reto diario: el intento se gasta al empezar (3 con cuenta; los invitados los cuenta el cliente). */
  private async createDaily(userId: string | undefined, rawDate: string | undefined) {
    if (rawDate === undefined || !isWithinDateWindow(rawDate)) throw dailyDateInvalid();
    const date = rawDate;
    const field = await this.daily.fieldFor(date, true);
    const { mods, title, maxLives } = this.daily.rulesFor(date);
    const data: NewRun = { seed: this.daily.seedFor(date), maxLives, ...field, mode: 'daily', dailyDate: date, mods };
    const info = { date, number: dailyNumber(date), title };
    if (!userId) {
      const base = await this.startRun(this.prisma, undefined, data);
      return { ...base, daily: { ...info, attemptsMax: DAILY_ATTEMPTS_GUEST, attemptsUsed: 1 } };
    }
    return this.prisma.$transaction(async (tx) => {
      await this.daily.lockAttempts(tx, userId, date);
      const used = await this.daily.attemptsUsed(userId, date, tx);
      if (used >= DAILY_ATTEMPTS_ACCOUNT) throw attemptsExhausted();
      const base = await this.startRun(tx, userId, data);
      return { ...base, daily: { ...info, attemptsMax: DAILY_ATTEMPTS_ACCOUNT, attemptsUsed: used + 1 } };
    });
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
        bestStreak: v.bestStreak ?? null,
        endReason: v.endReason ?? null,
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
    const r: ValidResult = { killed: v.killed, missed: v.missed, ticks: v.ticks, bestStreak: v.bestStreak };

    if (run.mode === 'duel' && run.challengeCode) await this.challenges.recordEntry({ ...run, challengeCode: run.challengeCode }, r, now);
    if (!run.userId) {
      return {
        ...base,
        claimable: true,
        claimExpiresAt: new Date(now.getTime() + CLAIM_WINDOW_MS).toISOString(),
        ...(run.mode === 'duel' && run.challengeCode
          ? { challenge: await this.challenges.view(run.challengeCode, { userId, runId: run.id }) }
          : {}),
        ...(run.mode === 'daily' && run.dailyDate
          ? { daily: await this.daily.guestResult(run.dailyDate, { killed: r.killed, missed: r.missed, achievedAt: now }) }
          : {}),
      };
    }
    return { ...base, ...(await this.recordForUser(run, run.userId, r, now, false)) };
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
    const dailyDate = run.mode === 'daily' ? run.dailyDate : null;
    if (dailyDate) {
      // El intento de invitado (D8: 1) pasa a ser el PRIMERO de la cuenta: solo se puede reclamar
      // si la cuenta todavía no empezó el reto de esa fecha. Así se reclama como máximo una
      // partida diaria por cuenta y fecha, y nadie juega N partidas de invitado para quedarse
      // con las mejores. Con el mismo bloqueo que POST /runs (concurrencia).
      await this.prisma.$transaction(async (tx) => {
        await this.daily.lockAttempts(tx, userId, dailyDate);
        if ((await this.daily.attemptsUsed(userId, dailyDate, tx)) > 0) throw guestClaimNotAllowed();
        await this.assign(tx, run.id, userId);
      });
    } else {
      await this.assign(this.prisma, run.id, userId);
    }
    const r: ValidResult = { killed: run.killed, missed: run.missed, ticks: run.ticks ?? 0, bestStreak: run.bestStreak ?? 0 };
    return {
      runId: run.id,
      valid: true,
      killed: run.killed,
      missed: run.missed,
      durationMs: run.durationMs,
      ...(await this.recordForUser(run, userId, r, run.finishedAt, true)),
    };
  }

  /** Asigna una partida de invitado válida a la cuenta (condicional y atómico). */
  private async assign(db: Db, runId: string, userId: string) {
    const res = await db.run.updateMany({
      where: { id: runId, userId: null, status: 'valid' },
      data: { userId, claimedAt: new Date(), claimTokenHash: null },
    });
    if (res.count !== 1) throw conflict('Esta partida ya tiene dueño.', 'run_already_claimed');
  }

  /**
   * Registra una partida válida de un usuario (al terminarla o al reclamarla): récords (solo modo
   * normal), resultado del reto o del día, y estadísticas.
   */
  private async recordForUser(run: Run, userId: string, r: ValidResult, achievedAt: Date, claimed: boolean) {
    const score = { killed: r.killed, missed: r.missed, achievedAt };
    if (run.mode === 'duel' && run.challengeCode) {
      if (claimed) await this.challenges.claimEntry(run.id, userId);
      const stats = await this.stats.record(userId, { ...r, mode: run.mode, mods: modsOf(run.config) });
      return { stats, challenge: await this.challenges.view(run.challengeCode, { userId, runId: run.id }) };
    }
    if (run.mode === 'daily' && run.dailyDate) {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
      const improved = await this.daily.recordEntry(
        userId,
        run.dailyDate,
        score,
        { runId: run.id, ticks: r.ticks, bestStreak: r.bestStreak },
        user?.country ?? null,
      );
      const stats = await this.stats.record(userId, { ...r, mode: run.mode, mods: modsOf(run.config) });
      return { stats, daily: await this.daily.resultFor(userId, run.dailyDate, improved) };
    }
    const best = await this.recordBest(userId, run.id, r.killed, r.missed, achievedAt);
    const stats = await this.stats.record(userId, { ...r, mode: 'normal', mods: modsOf(run.config) });
    return { ...best, stats };
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

  /** Historial de partidas válidas de modo normal del usuario en el período actual (sin retos, D6). */
  async history(userId: string, period: Period, limit: number) {
    const now = new Date();
    const key = periodKey(period, now);
    const from = periodStart(period, now);
    const [runs, best] = await Promise.all([
      this.prisma.run.findMany({
        where: {
          userId,
          status: 'valid',
          mode: 'normal',
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

  /**
   * Borra partidas de invitado sin reclamar y partidas nunca terminadas de más de 24 h.
   * Excepción: las partidas diarias de una cuenta que nunca se terminaron son intentos gastados
   * del día; se borran recién a las 72 h (DAILY_STARTED_RUN_TTL_MS), cuando su fecha ya no se
   * puede jugar, para que no se recupere ningún intento.
   */
  async cleanup(now = new Date()) {
    const cutoff = new Date(now.getTime() - GUEST_RUN_TTL_MS);
    const dailyCutoff = new Date(now.getTime() - DAILY_STARTED_RUN_TTL_MS);
    const runs = await this.prisma.run.deleteMany({
      where: {
        OR: [
          { startedAt: { lt: cutoff }, userId: null },
          { startedAt: { lt: cutoff }, status: 'started', mode: { not: 'daily' } },
          { startedAt: { lt: dailyCutoff }, status: 'started', mode: 'daily' },
        ],
      },
    });
    const tokens = await this.prisma.refreshToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: cutoff } }] },
    });
    return { runs: runs.count, refreshTokens: tokens.count };
  }
}
