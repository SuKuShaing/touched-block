import { Injectable } from '@nestjs/common';
import { livesFor } from '@tb/engine';
import { badRequest, conflict, notFound } from '../common/errors';
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
      await tx.follow.createMany({
        data: [
          { followerId: userId, followeeId: inviter.id },
          { followerId: inviter.id, followeeId: userId },
        ],
        skipDuplicates: true,
      });
    });

    const invitedCount = await this.prisma.user.count({ where: { invitedById: inviter.id } });
    return { inviter, inviterInvitedCount: invitedCount, inviterMaxLives: livesFor(invitedCount) };
  }

  async follow(userId: string, targetId: string) {
    if (targetId === userId) throw badRequest('No puedes seguirte a ti mismo.', 'follow_self');
    const target = await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!target) throw notFound('Ese usuario no existe.', 'user_not_found');
    await this.prisma.follow.createMany({ data: [{ followerId: userId, followeeId: targetId }], skipDuplicates: true });
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
