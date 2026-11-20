import { Injectable } from '@nestjs/common';
import { livesFor } from '@tb/engine';
import { badRequest, conflict, forbidden, notFound } from '../common/errors';
import { blockBetween } from '../moderation/blocks';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeUsername } from '../users/username';

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * "¿Quién te invitó?": se fija una sola vez, nunca a uno mismo. Ambos quedan siguiéndose
   * y el que invitó gana un corazón (5 + invitados, máximo 8).
   */
  async setInviter(userId: string, rawUsername: string) {
    const username = normalizeUsername(rawUsername);
    const inviter = await this.prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
    if (!inviter) throw notFound('Ese usuario no existe.', 'user_not_found');
    if (inviter.id === userId) throw badRequest('No puedes ponerte a ti mismo como quien te invitó.', 'inviter_self');

    await this.prisma.$transaction(async (tx) => {
      // condicional y atómico: solo si todavía no tiene a nadie
      const res = await tx.user.updateMany({
        where: { id: userId, invitedById: null },
        data: { invitedById: inviter.id, invitedAt: new Date() },
      });
      if (res.count !== 1) throw conflict('Ya indicaste quién te invitó.', 'inviter_already_set');
      // con un bloqueo entre los dos, el corazón se da igual pero no se siguen
      const blocked = await blockBetween(tx, userId, inviter.id);
      if (blocked.iBlocked || blocked.blockedMe) return;
      await tx.follow.createMany({
        data: [
          { followerId: userId, followeeId: inviter.id },
          { followerId: inviter.id, followeeId: userId },
        ],
        skipDuplicates: true,
      });
    });

    // mismo cierre de carrera que en follow(), sin error: el corazón ya se dio
    await this.undoIfBlockedMeanwhile(userId, inviter.id).catch(() => {});
    const invitedCount = await this.prisma.user.count({ where: { invitedById: inviter.id } });
    return { inviter, inviterInvitedCount: invitedCount, inviterMaxLives: livesFor(invitedCount) };
  }

  async follow(userId: string, targetId: string) {
    if (targetId === userId) throw badRequest('No puedes seguirte a ti mismo.', 'follow_self');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw notFound('Ese usuario no existe.', 'user_not_found');
    const blocked = await blockBetween(this.prisma, userId, targetId);
    if (blocked.iBlocked) throw conflict('Bloqueaste a este jugador. Desbloquéalo en tu perfil para seguirlo.', 'user_blocked');
    if (blocked.blockedMe) throw forbidden('No puedes seguir a este jugador.', 'follow_blocked');
    await this.prisma.follow.createMany({ data: [{ followerId: userId, followeeId: targetId }], skipDuplicates: true });
    await this.undoIfBlockedMeanwhile(userId, targetId);
  }

  /**
   * Un bloqueo que se confirmó mientras se creaba el seguimiento puede no haberlo visto: se vuelve a
   * mirar después de crearlo y, si ya hay bloqueo, se deshace (block() también borra los seguimientos
   * después de confirmar el suyo, así que entre los dos no queda ninguno vivo).
   */
  private async undoIfBlockedMeanwhile(a: string, b: string) {
    const now = await blockBetween(this.prisma, a, b);
    if (!now.iBlocked && !now.blockedMe) return;
    await this.prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: a, followeeId: b },
          { followerId: b, followeeId: a },
        ],
      },
    });
    throw now.iBlocked
      ? conflict('Bloqueaste a este jugador. Desbloquéalo en tu perfil para seguirlo.', 'user_blocked')
      : forbidden('No puedes seguir a este jugador.', 'follow_blocked');
  }

  async unfollow(userId: string, targetId: string) {
    await this.prisma.follow.deleteMany({ where: { followerId: userId, followeeId: targetId } });
  }

  async following(userId: string) {
    const rows = await this.prisma.follow.findMany({
      where: { followerId: userId },
      include: { followee: { select: { id: true, username: true, country: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { users: rows.map((r) => ({ ...r.followee, followedAt: r.createdAt.toISOString() })) };
  }

  async followers(userId: string) {
    const rows = await this.prisma.follow.findMany({
      where: { followeeId: userId },
      include: { follower: { select: { id: true, username: true, country: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { users: rows.map((r) => ({ ...r.follower, followedAt: r.createdAt.toISOString() })) };
  }
}
