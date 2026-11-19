import { Injectable } from '@nestjs/common';
import { badRequest, conflict, notFound } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeUsername } from '../users/username';
import { REPORT_RESPONSE_HOURS } from './admin';
import type { ReportDto } from './dto';
import { TelegramNotifier } from './telegram';

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

/** Reportar y bloquear jugadores (guía 1.2 de Apple). */
@Injectable()
export class ModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramNotifier,
  ) {}

  private async target(rawUsername: string) {
    const username = normalizeUsername(rawUsername);
    const u = await this.prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
    if (!u) throw notFound('Ese usuario no existe.', 'user_not_found');
    return u;
  }

  /**
   * Un reporte por reportante, reportado y día (UTC). Queda pendiente para el dueño, que recibe un
   * aviso por Telegram si está configurado (sin esperarlo: si Telegram falla, el reporte vale igual).
   */
  async report(reporterId: string, rawUsername: string, dto: ReportDto) {
    const target = await this.target(rawUsername);
    if (target.id === reporterId) throw badRequest('No puedes reportarte a ti mismo.', 'report_self');
    const details = dto.details?.trim().slice(0, 200) || null;
    try {
      const r = await this.prisma.report.create({
        data: {
          reporterId,
          reportedId: target.id,
          reportedUsername: target.username,
          reason: dto.reason,
          details,
          day: new Date().toISOString().slice(0, 10),
        },
        select: { id: true },
      });
      void this.telegram.reportCreated({ reportedId: target.id, reportedUsername: target.username, reason: dto.reason, details });
      return { id: r.id, status: 'pending' as const, reviewWithinHours: REPORT_RESPONSE_HOURS };
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw conflict(
          `Ya reportaste a @${target.username} hoy. Lo revisaremos dentro de ${REPORT_RESPONSE_HOURS} horas.`,
          'already_reported',
        );
      }
      throw e;
    }
  }

  /**
   * Bloquea a un jugador: se borran los seguimientos entre los dos (en ambos sentidos) y, mientras
   * dure, ninguno puede seguir al otro. Idempotente.
   */
  async block(userId: string, rawUsername: string) {
    const target = await this.target(rawUsername);
    if (target.id === userId) throw badRequest('No puedes bloquearte a ti mismo.', 'block_self');
    await this.prisma.$transaction([
      this.prisma.block.createMany({ data: [{ blockerId: userId, blockedId: target.id }], skipDuplicates: true }),
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: userId, followeeId: target.id },
            { followerId: target.id, followeeId: userId },
          ],
        },
      }),
    ]);
  }

  /** Desbloquea (idempotente). No vuelve a crear los seguimientos que se borraron. */
  async unblock(userId: string, rawUsername: string) {
    const target = await this.target(rawUsername);
    await this.prisma.block.deleteMany({ where: { blockerId: userId, blockedId: target.id } });
  }

  async blocks(userId: string) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: { id: true, username: true, country: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { users: rows.map((r) => ({ ...r.blocked, blockedAt: r.createdAt.toISOString() })) };
  }
}
