import { Injectable } from '@nestjs/common';
import { RULES_VERSION, livesFor } from '@tb/engine';
import { normalizeCountry } from '../common/countries';
import { badRequest, conflict, notFound } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { MeDto, PublicUserDto, UpdateMeDto } from './dto';
import { normalizeUsername, usernameBase, usernameCandidates, usernameProblem } from './username';

/** Días mínimos entre dos cambios de país. */
export const COUNTRY_CHANGE_DAYS = 30;

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export interface NewUserInput {
  provider: string;
  subject: string;
  email?: string | null;
  name?: string | null;
  country?: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vidas (corazones) del usuario: 5 + invitados, con tope 8. */
  async maxLivesOf(userId: string): Promise<number> {
    return livesFor(await this.prisma.user.count({ where: { invitedById: userId } }));
  }

  /** Crea un usuario nuevo con su identidad, generando un nombre de usuario libre. */
  async createWithIdentity(input: NewUserInput) {
    const base = usernameBase(input.name, input.email);
    for (let round = 0; round < 5; round++) {
      const candidates = usernameCandidates(base);
      const taken = new Set(
        (
          await this.prisma.user.findMany({ where: { username: { in: candidates } }, select: { username: true } })
        ).map((u) => u.username),
      );
      const username = candidates.find((c) => !taken.has(c));
      if (!username) continue;
      try {
        return await this.prisma.user.create({
          data: {
            username,
            displayName: input.name?.slice(0, 100) ?? null,
            email: input.email?.slice(0, 320) ?? null,
            country: normalizeCountry(input.country),
            identities: {
              create: { provider: input.provider, subject: input.subject, email: input.email?.slice(0, 320) ?? null },
            },
          },
        });
      } catch (e) {
        // Si la identidad ya existe (doble inicio de sesión simultáneo), se propaga para que auth la reutilice.
        // Si no, el nombre se tomó entre la consulta y la creación: otra vuelta.
        if (!isUniqueViolation(e)) throw e;
        const identity = await this.prisma.authIdentity.findUnique({
          where: { provider_subject: { provider: input.provider, subject: input.subject } },
        });
        if (identity) throw e;
      }
    }
    throw conflict('No se pudo generar un nombre de usuario. Inténtalo de nuevo.', 'username_generation_failed');
  }

  async getMe(userId: string): Promise<MeDto> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        invitedBy: { select: { id: true, username: true } },
        _count: { select: { invitees: true, following: true, followers: true } },
      },
    });
    if (!u) throw notFound('Usuario no encontrado.', 'user_not_found');
    return {
      id: u.id,
      username: u.username,
      country: u.country,
      countryChangedAt: u.countryChangedAt?.toISOString() ?? null,
      nextCountryChangeAt: nextCountryChange(u.countryChangedAt)?.toISOString() ?? null,
      invitedBy: u.invitedBy,
      invitedCount: u._count.invitees,
      maxLives: livesFor(u._count.invitees),
      followingCount: u._count.following,
      followersCount: u._count.followers,
      createdAt: u.createdAt.toISOString(),
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('Usuario no encontrado.', 'user_not_found');
    const data: Prisma.UserUpdateInput = {};

    if (dto.username !== undefined) {
      const u = normalizeUsername(dto.username);
      const problem = usernameProblem(u);
      if (problem) throw badRequest(problem, 'invalid_username');
      if (u !== user.username) data.username = u;
    }

    let newCountry: string | null = null;
    if (dto.country !== undefined) {
      const c = normalizeCountry(dto.country);
      if (!c) throw badRequest('País inválido.', 'invalid_country');
      if (c !== user.country) {
        const next = nextCountryChange(user.countryChangedAt);
        if (next && next > new Date()) {
          throw conflict(
            `Solo puedes cambiar de país una vez cada ${COUNTRY_CHANGE_DAYS} días.`,
            'country_change_too_soon',
            { nextCountryChangeAt: next.toISOString() },
          );
        }
        newCountry = c;
        data.country = c;
        data.countryChangedAt = new Date();
      }
    }

    if (Object.keys(data).length > 0) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: userId }, data });
          if (newCountry) await tx.bestScore.updateMany({ where: { userId }, data: { country: newCountry } });
        });
      } catch (e) {
        if (isUniqueViolation(e)) throw conflict('Ese nombre de usuario ya está tomado.', 'username_taken');
        throw e;
      }
    }
    return this.getMe(userId);
  }

  async deleteMe(userId: string): Promise<void> {
    // borra en cascada identidades, sesiones, partidas, récords y seguimientos
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async checkUsername(raw: string, userId?: string) {
    const username = normalizeUsername(raw);
    const problem = usernameProblem(username);
    if (problem) return { username, valid: false, available: false, message: problem };
    const owner = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    const available = !owner || owner.id === userId;
    return {
      username,
      valid: true,
      available,
      ...(available ? {} : { message: 'Ese nombre de usuario ya está tomado.' }),
    };
  }

  async publicProfile(rawUsername: string, viewerId?: string) {
    const username = normalizeUsername(rawUsername);
    const u = await this.prisma.user.findUnique({
      where: { username },
      include: { _count: { select: { invitees: true, following: true, followers: true } } },
    });
    if (!u) throw notFound('Ese usuario no existe.', 'user_not_found');
    const best = await this.prisma.bestScore.findUnique({
      where: {
        userId_rulesVersion_periodType_periodKey: {
          userId: u.id,
          rulesVersion: RULES_VERSION,
          periodType: 'all',
          periodKey: 'all',
        },
      },
    });
    const isFollowing =
      viewerId && viewerId !== u.id
        ? !!(await this.prisma.follow.findUnique({
            where: { followerId_followeeId: { followerId: viewerId, followeeId: u.id } },
          }))
        : undefined;
    return {
      id: u.id,
      username: u.username,
      country: u.country,
      best: best ? { killed: best.killed, missed: best.missed, achievedAt: best.achievedAt.toISOString() } : null,
      invitedCount: u._count.invitees,
      followersCount: u._count.followers,
      followingCount: u._count.following,
      createdAt: u.createdAt.toISOString(),
      ...(viewerId ? { isMe: viewerId === u.id, isFollowing: isFollowing ?? false } : {}),
    };
  }

  async search(rawQ: string, viewerId?: string): Promise<(PublicUserDto & { isFollowing?: boolean })[]> {
    const q = normalizeUsername(rawQ).replace(/[^a-z0-9_.]/g, '');
    if (!q) return [];
    const users = await this.prisma.user.findMany({
      where: { username: { startsWith: q } },
      orderBy: { username: 'asc' },
      take: 20,
      select: { id: true, username: true, country: true },
    });
    if (!viewerId) return users;
    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId, followeeId: { in: users.map((u) => u.id) } },
      select: { followeeId: true },
    });
    const set = new Set(follows.map((f) => f.followeeId));
    return users.map((u) => ({ ...u, isFollowing: set.has(u.id) }));
  }
}

/** Cuándo puede volver a cambiar de país (null si nunca lo cambió a mano: el primer cambio es libre). */
export function nextCountryChange(changedAt: Date | null): Date | null {
  if (!changedAt) return null;
  const next = new Date(changedAt.getTime() + COUNTRY_CHANGE_DAYS * 86_400_000);
  return next > new Date() ? next : null;
}
