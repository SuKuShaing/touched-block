import { Injectable } from '@nestjs/common';
import {
  DAILY_ATTEMPTS_ACCOUNT,
  DAILY_ATTEMPTS_GUEST,
  DAILY_LIVES,
  type DailyStreak,
  type DateKey,
  type GameMods,
  type TierRef,
  addDays,
  dailyModsFor,
  dailyNumber,
  dailyStreak,
} from '@tb/engine';
import { dateWindowEnd } from '../common/dates';
import { badRequest, conflict } from '../common/errors';
import { AppConfig } from '../config/app-config';
import { Prisma } from '../generated/prisma/client';
import { RANKING_ORDER, type Score, betterThan, worseThan } from '../leaderboards/ranking';
import { type Scope, resolveScope, scopeFilter } from '../leaderboards/scope';
import { PrismaService } from '../prisma/prisma.service';
import { CommonFieldService, type Field } from '../runs/common-field.service';
import { StatsService } from '../stats/stats.service';
import { dailySeed } from './daily-seed';

/**
 * Con menos jugadores que esto en un día, el porcentaje de ese día no cuenta para el logro
 * "Mejor resultado en un reto diario": se guarda 0 (solo "participó"). Provisorio.
 */
export const DAILY_PCT_MIN_PLAYERS = 10;

/**
 * Plazo, después de que una fecha sale de la ventana (ya no se pueden empezar partidas de ese
 * día), durante el que su ranking todavía puede cambiar: 2 h para terminar una partida empezada
 * (MAX_RUN_AGE_MS) + 1 h para reclamar una de invitado (CLAIM_WINDOW_MS).
 */
export const DAILY_RESULTS_GRACE_MS = 3 * 60 * 60 * 1000;

/** Días hacia atrás (desde la fecha pedida) en que se busca un día cerrado para guardar su porcentaje. */
export const DAILY_PCT_LOOKBACK_DAYS = 7;

/**
 * Momento en que el ranking del reto de `date` queda fijo: nadie puede empezar, terminar ni
 * reclamar partidas de esa fecha. Se pueden empezar mientras alguna zona horaria real esté en
 * `date` (hasta `(date+1) 00:00 UTC + 12 h`, ver dateWindowEnd), más DAILY_RESULTS_GRACE_MS.
 */
export function dailyClosesAt(date: DateKey): Date {
  return new Date(dateWindowEnd(date).getTime() + DAILY_RESULTS_GRACE_MS);
}

/** Días (terminando en la fecha pedida, incluida) de la "tira de la semana" de GET /daily. */
export const DAILY_WEEK_DAYS = 7;

export const dailyDateInvalid = () => badRequest('La fecha del reto diario no es válida.', 'daily_date_invalid');
export const attemptsExhausted = () =>
  conflict(`Ya usaste tus ${DAILY_ATTEMPTS_ACCOUNT} intentos del reto de este día.`, 'daily_attempts_exhausted');
/** Reclamar una partida diaria de invitado cuando la cuenta ya empezó el reto de esa fecha. */
export const guestClaimNotAllowed = () =>
  conflict(
    'Solo puedes guardar tu partida de invitado del reto diario si todavía no jugaste el reto de ese día con tu cuenta.',
    'daily_attempts_exhausted',
  );

/** "Mejor que el N %": jugadores con peor puntaje / (total − 1) × 100, hacia abajo. 0 si es el único. */
export function betterThanPct(worse: number, total: number): number {
  return total > 1 ? Math.floor((worse * 100) / (total - 1)) : 0;
}

/**
 * Fechas jugadas (con resultado) dentro de los DAILY_WEEK_DAYS días que terminan en `date`
 * (incluida), de la más antigua a la más reciente, sin repetir.
 */
export function weekOf(played: readonly DateKey[], date: DateKey): DateKey[] {
  const days = new Set<DateKey>();
  for (let d = DAILY_WEEK_DAYS - 1; d >= 0; d--) days.add(addDays(date, -d));
  return [...new Set(played)].filter((p) => days.has(p)).sort();
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

type Db = PrismaService | Prisma.TransactionClient;

/** Resultado del reto diario en la pantalla final (con cuenta). */
export interface DailyResult {
  date: DateKey;
  number: number;
  attemptsLeft: number;
  isBestToday: boolean;
  rank: number;
  total: number;
  betterThanPct: number;
  friends: { beaten: number; total: number };
  streak: DailyStreak;
}

/** Resultado del reto diario de un invitado: dónde habría quedado. */
export interface GuestDailyResult {
  date: DateKey;
  number: number;
  rank: number;
  total: number;
  betterThanPct: number;
}

@Injectable()
export class DailyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly field: CommonFieldService,
    private readonly stats: StatsService,
  ) {}

  seedFor(date: DateKey): number {
    return dailySeed(this.config.dailySecret, date);
  }

  /** Modificadores, título y vidas del reto de esa fecha (calendario del motor). */
  rulesFor(date: DateKey): { mods: GameMods | null; title: string; maxLives: number } {
    const { mods, title } = dailyModsFor(date);
    return { mods, title, maxLives: mods?.lives ?? DAILY_LIVES };
  }

  /**
   * Campo del día: el guardado; si todavía no hay, el campo común vigente. Con `fix`, la primera
   * partida de la fecha lo deja guardado para todos.
   */
  async fieldFor(date: DateKey, fix: boolean): Promise<Field> {
    const day = await this.prisma.dailyChallenge.findUnique({ where: { date } });
    if (day) return { fieldW: day.fieldW, fieldH: day.fieldH };
    const common = await this.field.get();
    if (!fix) return common;
    await this.prisma.dailyChallenge.createMany({ data: [{ date, ...common }], skipDuplicates: true });
    const fixed = await this.prisma.dailyChallenge.findUniqueOrThrow({ where: { date } });
    return { fieldW: fixed.fieldW, fieldH: fixed.fieldH };
  }

  /** Intentos gastados: partidas diarias del usuario en esa fecha, en cualquier estado. */
  attemptsUsed(userId: string, date: DateKey, db: Db = this.prisma): Promise<number> {
    return db.run.count({ where: { userId, mode: 'daily', dailyDate: date } });
  }

  /** Serializa (hasta el fin de la transacción) los intentos de un usuario en una fecha. */
  async lockAttempts(tx: Prisma.TransactionClient, userId: string, date: DateKey): Promise<void> {
    await tx.$queryRaw`SELECT 1 AS ok FROM pg_advisory_xact_lock(hashtext(${`daily:${userId}:${date}`}))`;
  }

  /**
   * Guarda el resultado del día si mejora el mejor (actualización condicional y atómica, como
   * BestScoresService.record). Devuelve si quedó como el mejor del día.
   */
  async recordEntry(
    userId: string,
    date: DateKey,
    score: Score,
    extra: { runId: string; ticks: number; bestStreak: number },
    country: string | null,
  ): Promise<boolean> {
    const attempts = await this.attemptsUsed(userId, date);
    const id = { userId, date };
    const data = { ...score, ...extra, attempts, country };
    for (let attempt = 0; attempt < 2; attempt++) {
      const upd = await this.prisma.dailyEntry.updateMany({ where: { ...id, ...worseThan(score) }, data });
      if (upd.count > 0) return true;
      try {
        await this.prisma.dailyEntry.create({ data: { ...id, ...data } });
        return true;
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
        // ya había uno igual o mejor (o lo creó otra petición): reintenta la actualización una vez
      }
    }
    await this.prisma.dailyEntry.updateMany({ where: { ...id, attempts: { lt: attempts } }, data: { attempts } });
    return false;
  }

  /** Posición, jugadores con peor puntaje y total en esa fecha (dentro de `filter`). */
  private async position(date: DateKey, score: Score, filter: Prisma.DailyEntryWhereInput = {}) {
    const [better, worse, total] = await Promise.all([
      this.prisma.dailyEntry.count({ where: { date, ...filter, ...betterThan(score) } }),
      this.prisma.dailyEntry.count({ where: { date, ...filter, ...worseThan(score) } }),
      this.prisma.dailyEntry.count({ where: { date, ...filter } }),
    ]);
    return { rank: better + 1, worse, total };
  }

  /** Resultado del día de un jugador con cuenta (después de registrar su partida). */
  async resultFor(userId: string, date: DateKey, isBestToday: boolean): Promise<DailyResult> {
    const [entry, used, follows, dates] = await Promise.all([
      this.prisma.dailyEntry.findUnique({ where: { userId_date: { userId, date } } }),
      this.attemptsUsed(userId, date),
      this.prisma.follow.findMany({ where: { followerId: userId }, select: { followeeId: true } }),
      this.prisma.dailyEntry.findMany({ where: { userId }, select: { date: true } }),
    ]);
    const friendIds = follows.map((f) => f.followeeId);
    let rank = 0;
    let total = await this.prisma.dailyEntry.count({ where: { date } });
    let pct = 0;
    let friends = { beaten: 0, total: 0 };
    if (entry) {
      const pos = await this.position(date, entry);
      rank = pos.rank;
      total = pos.total;
      pct = betterThanPct(pos.worse, pos.total);
      if (friendIds.length > 0) {
        const inFriends = { userId: { in: friendIds } };
        const [ft, fb] = await Promise.all([
          this.prisma.dailyEntry.count({ where: { date, ...inFriends } }),
          this.prisma.dailyEntry.count({ where: { date, ...inFriends, ...worseThan(entry) } }),
        ]);
        friends = { beaten: fb, total: ft };
      }
    }
    return {
      date,
      number: dailyNumber(date),
      attemptsLeft: Math.max(0, DAILY_ATTEMPTS_ACCOUNT - used),
      isBestToday,
      rank,
      total,
      betterThanPct: pct,
      friends,
      streak: dailyStreak(
        dates.map((d) => d.date),
        date,
      ),
    };
  }

  /** Dónde habría quedado un invitado con este puntaje (contándolo a él en el total). */
  async guestResult(date: DateKey, score: Score): Promise<GuestDailyResult> {
    const pos = await this.position(date, score);
    const total = pos.total + 1;
    return { date, number: dailyNumber(date), rank: pos.rank, total, betterThanPct: betterThanPct(pos.worse, total) };
  }

  /** GET /daily: el reto de esa fecha, mis intentos y mi mejor, la racha y el resumen de ayer. */
  async overview(date: DateKey, userId?: string, now = new Date()) {
    const { mods, title } = this.rulesFor(date);
    const [field, total] = await Promise.all([this.fieldFor(date, false), this.prisma.dailyEntry.count({ where: { date } })]);
    let attemptsUsed = 0;
    let best: { killed: number; missed: number; bestStreak: number; achievedAt: string; rank: number } | null = null;
    let streak: DailyStreak = { current: 0, best: 0 };
    let week: DateKey[] = [];
    if (userId) {
      const [used, entry, dates] = await Promise.all([
        this.attemptsUsed(userId, date),
        this.prisma.dailyEntry.findUnique({ where: { userId_date: { userId, date } } }),
        this.prisma.dailyEntry.findMany({ where: { userId }, select: { date: true } }),
      ]);
      attemptsUsed = used;
      if (entry) {
        const pos = await this.position(date, entry);
        best = {
          killed: entry.killed,
          missed: entry.missed,
          bestStreak: entry.bestStreak,
          achievedAt: entry.achievedAt.toISOString(),
          rank: pos.rank,
        };
      }
      streak = dailyStreak(
        dates.map((d) => d.date),
        date,
      );
      week = weekOf(
        dates.map((d) => d.date),
        date,
      );
      await this.saveClosedPcts(userId, date, now);
    }
    return {
      date,
      number: dailyNumber(date),
      title,
      mods,
      fieldW: field.fieldW,
      fieldH: field.fieldH,
      attemptsMax: userId ? DAILY_ATTEMPTS_ACCOUNT : DAILY_ATTEMPTS_GUEST,
      attemptsUsed,
      best,
      total,
      streak,
      week,
      yesterday: await this.yesterday(addDays(date, -1), userId),
    };
  }

  /**
   * Resumen del día anterior: mi posición, el total y el ganador (null si nadie jugó). Es un
   * resumen provisorio: ese día todavía puede estar jugándose en otras zonas horarias, así que
   * no se guarda nada (ver saveClosedPcts).
   */
  private async yesterday(date: DateKey, userId?: string) {
    const [total, top] = await Promise.all([
      this.prisma.dailyEntry.count({ where: { date } }),
      this.prisma.dailyEntry.findFirst({ where: { date }, orderBy: RANKING_ORDER, include: { user: { select: { username: true } } } }),
    ]);
    if (!top || total === 0) return null;
    let rank: number | null = null;
    let pct: number | null = null;
    if (userId) {
      const mine = await this.prisma.dailyEntry.findUnique({ where: { userId_date: { userId, date } } });
      if (mine) {
        const pos = await this.position(date, mine);
        rank = pos.rank;
        pct = betterThanPct(pos.worse, pos.total);
      }
    }
    return { date, rank, total, betterThanPct: pct, winner: { username: top.user.username, killed: top.killed } };
  }

  /**
   * Guarda en UserStats.bestDailyPct (se queda con el mayor) el porcentaje de los días que el
   * jugador jugó en la última semana y que ya **cerraron** (dailyClosesAt): antes de eso el
   * ranking del día todavía cambia, y guardarlo daría un porcentaje inflado para siempre. Con
   * menos de DAILY_PCT_MIN_PLAYERS jugadores ese día se guarda 0 (solo participó).
   */
  private async saveClosedPcts(userId: string, date: DateKey, now: Date): Promise<void> {
    const closed: DateKey[] = [];
    for (let d = 1; d <= DAILY_PCT_LOOKBACK_DAYS; d++) {
      const key = addDays(date, -d);
      if (dailyClosesAt(key).getTime() <= now.getTime()) closed.push(key);
    }
    if (closed.length === 0) return;
    const mine = await this.prisma.dailyEntry.findMany({ where: { userId, date: { in: closed } } });
    if (mine.length === 0) return;
    const pcts = await Promise.all(
      mine.map(async (e) => {
        const pos = await this.position(e.date, e);
        return pos.total >= DAILY_PCT_MIN_PLAYERS ? betterThanPct(pos.worse, pos.total) : 0;
      }),
    );
    await this.stats.recordDailyPct(userId, Math.max(...pcts));
  }

  /** GET /daily/leaderboard: como GET /leaderboards, pero con los mejores de una fecha. */
  async leaderboard(opts: { date: DateKey; scope: Scope; country?: string; limit: number; userId?: string }) {
    const { date, scope, limit, userId } = opts;
    const resolved = await resolveScope(this.prisma, scope, opts.country, userId);
    const filter: Prisma.DailyEntryWhereInput = scopeFilter(resolved);
    const where: Prisma.DailyEntryWhereInput = { date, ...filter };
    const [rows, total] = await Promise.all([
      this.prisma.dailyEntry.findMany({ where, orderBy: RANKING_ORDER, take: limit, include: { user: { select: { username: true } } } }),
      this.prisma.dailyEntry.count({ where }),
    ]);
    const tiers = await this.stats.tiersFor([...rows.map((r) => r.userId), ...(userId ? [userId] : [])]);

    let me: { rank: number; killed: number; missed: number; achievedAt: string; tier: TierRef | null } | null | undefined;
    if (userId) {
      const mine = await this.prisma.dailyEntry.findUnique({ where: { userId_date: { userId, date } } });
      const inScope = mine && (scope !== 'country' || mine.country === resolved.country);
      me = inScope
        ? {
            rank: (await this.position(date, mine, filter)).rank,
            killed: mine.killed,
            missed: mine.missed,
            achievedAt: mine.achievedAt.toISOString(),
            tier: tiers.get(userId) ?? null,
          }
        : null;
    }

    return {
      scope,
      date,
      number: dailyNumber(date),
      ...(resolved.country ? { country: resolved.country } : {}),
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
