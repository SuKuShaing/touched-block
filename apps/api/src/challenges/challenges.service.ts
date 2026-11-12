import { HttpStatus, Injectable } from '@nestjs/common';
import { RULES_VERSION, type TierRef } from '@tb/engine';
import { ApiError, notFound } from '../common/errors';
import { type Challenge, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StatsService } from '../stats/stats.service';
import { CHALLENGE_TTL_DAYS, newChallengeCode, normalizeChallengeCode } from './challenge-code';

/** Máximo de resultados que devuelve un reto. */
export const CHALLENGE_MAX_ENTRIES = 100;

export interface ChallengeCreator {
  username: string | null;
  tier: TierRef | null;
  killed: number;
  missed: number;
}

export interface ChallengeEntryView {
  username: string | null;
  tier: TierRef | null;
  killed: number;
  missed: number;
  isMe: boolean;
  isCreator: boolean;
  createdAt: string;
}

export interface ChallengeView {
  code: string;
  playable: boolean;
  expiresAt: string;
  fieldW: number;
  fieldH: number;
  entries: ChallengeEntryView[];
}

export const challengeNotFound = () => notFound('Ese reto no existe.', 'challenge_not_found');

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** ¿Se puede jugar? Vence a los 30 días y deja de servir si cambian las reglas. */
export const isPlayable = (ch: Pick<Challenge, 'expiresAt' | 'rulesVersion'>, now = new Date()) =>
  ch.expiresAt > now && ch.rulesVersion === RULES_VERSION;

@Injectable()
export class ChallengesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stats: StatsService,
  ) {}

  /** Crea un reto con un código libre (dentro de la transacción de quien llama). */
  async create(
    tx: Prisma.TransactionClient,
    data: { seed: number; fieldW: number; fieldH: number; createdById: string | null; creatorRunId: string },
    now = new Date(),
  ): Promise<Challenge> {
    const expiresAt = new Date(now.getTime() + CHALLENGE_TTL_DAYS * 86_400_000);
    for (let attempt = 0; attempt < 10; attempt++) {
      const row = { code: newChallengeCode(), ...data, rulesVersion: RULES_VERSION, createdAt: now, expiresAt };
      // ON CONFLICT DO NOTHING: un choque de códigos no aborta la transacción
      const res = await tx.challenge.createMany({ data: [row], skipDuplicates: true });
      if (res.count === 1) return row;
    }
    throw new Error('No se pudo generar un código de reto libre');
  }

  /** Reto al que se quiere unir: 404 si no existe, 410 si venció o es de otras reglas. */
  async findPlayable(rawCode: unknown, now = new Date()): Promise<Challenge> {
    const code = normalizeChallengeCode(rawCode);
    const ch = code ? await this.prisma.challenge.findUnique({ where: { code } }) : null;
    if (!ch) throw challengeNotFound();
    if (ch.rulesVersion !== RULES_VERSION) {
      throw new ApiError(HttpStatus.GONE, 'challenge_expired', 'Este reto es de una versión anterior del juego y ya no se puede jugar.');
    }
    if (!isPlayable(ch, now)) throw new ApiError(HttpStatus.GONE, 'challenge_expired', 'Este reto ya venció.');
    return ch;
  }

  /** Resultado de quien creó el reto (null si todavía no lo termina o su partida no fue válida). */
  async creatorOf(code: string): Promise<ChallengeCreator | null> {
    const e = await this.prisma.challengeEntry.findFirst({
      where: { challengeCode: code, isCreator: true },
      include: { user: { select: { username: true } } },
    });
    if (!e) return null;
    const tier = e.userId ? ((await this.stats.tiersFor([e.userId])).get(e.userId) ?? null) : null;
    return { username: e.user?.username ?? null, tier, killed: e.killed, missed: e.missed };
  }

  /**
   * Guarda el resultado de una partida válida del reto. Con cuenta solo cuenta el primer intento
   * (índice único reto + usuario: los siguientes no se guardan); los invitados siempre se guardan.
   */
  async recordEntry(
    run: { id: string; challengeCode: string; userId: string | null },
    r: { killed: number; missed: number; ticks: number },
    at = new Date(),
  ): Promise<void> {
    const ch = await this.prisma.challenge.findUnique({ where: { code: run.challengeCode }, select: { creatorRunId: true } });
    if (!ch) return;
    await this.prisma.challengeEntry.createMany({
      data: [
        {
          challengeCode: run.challengeCode,
          userId: run.userId,
          runId: run.id,
          isCreator: ch.creatorRunId === run.id,
          killed: r.killed,
          missed: r.missed,
          ticks: r.ticks,
          createdAt: at,
        },
      ],
      skipDuplicates: true,
    });
  }

  /**
   * Al reclamar una partida de invitado, su resultado pasa a la cuenta. Si la cuenta ya tenía un
   * resultado en ese reto, se queda el del primer intento (el otro se descarta). Si el invitado
   * había creado el reto, queda como su creador.
   */
  async claimEntry(runId: string, userId: string): Promise<void> {
    const entry = await this.prisma.challengeEntry.findUnique({ where: { runId } });
    if (entry && !entry.userId) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const mine = await tx.challengeEntry.findUnique({
            where: { challengeCode_userId: { challengeCode: entry.challengeCode, userId } },
          });
          if (mine && mine.createdAt <= entry.createdAt) {
            await tx.challengeEntry.delete({ where: { id: entry.id } });
            return;
          }
          if (mine) await tx.challengeEntry.delete({ where: { id: mine.id } });
          await tx.challengeEntry.update({ where: { id: entry.id }, data: { userId } });
        });
      } catch (e) {
        // otra petición reclamó al mismo tiempo: queda lo que haya guardado ella
        if (!isUniqueViolation(e)) throw e;
      }
    }
    await this.prisma.challenge.updateMany({
      where: { creatorRunId: runId, createdById: null },
      data: { createdById: userId },
    });
  }

  /** Reto con sus resultados ordenados por puntaje. `viewer` marca `isMe`. */
  async view(rawCode: unknown, viewer: { userId?: string; runId?: string } = {}, now = new Date()): Promise<ChallengeView> {
    const code = normalizeChallengeCode(rawCode);
    const ch = code ? await this.prisma.challenge.findUnique({ where: { code } }) : null;
    if (!ch) throw challengeNotFound();
    const entries = await this.prisma.challengeEntry.findMany({
      where: { challengeCode: ch.code },
      orderBy: [{ killed: 'desc' }, { missed: 'asc' }, { createdAt: 'asc' }],
      take: CHALLENGE_MAX_ENTRIES,
      include: { user: { select: { username: true } } },
    });
    const tiers = await this.stats.tiersFor(entries.flatMap((e) => (e.userId ? [e.userId] : [])));
    return {
      code: ch.code,
      playable: isPlayable(ch, now),
      expiresAt: ch.expiresAt.toISOString(),
      fieldW: ch.fieldW,
      fieldH: ch.fieldH,
      entries: entries.map((e) => ({
        username: e.user?.username ?? null,
        tier: e.userId ? (tiers.get(e.userId) ?? null) : null,
        killed: e.killed,
        missed: e.missed,
        isMe: (!!viewer.userId && e.userId === viewer.userId) || (!!viewer.runId && e.runId === viewer.runId),
        isCreator: e.isCreator,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }
}
