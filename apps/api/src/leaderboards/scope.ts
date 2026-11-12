import { normalizeCountry } from '../common/countries';
import { badRequest, unauthorized } from '../common/errors';
import type { PrismaService } from '../prisma/prisma.service';

export type Scope = 'world' | 'country' | 'friends';
export const SCOPES: readonly Scope[] = ['world', 'country', 'friends'];

/** Universo de un ranking: todos, un país, o una lista de usuarios (amigos + yo). */
export interface ResolvedScope {
  country?: string;
  userIds?: string[];
}

/**
 * Resuelve el alcance de un ranking (lo comparten el ranking general y el del reto diario).
 * - `country`: el indicado, o el del usuario; `400 country_required` si no hay ninguno.
 * - `friends`: a quienes sigo y yo; requiere sesión.
 */
export async function resolveScope(
  prisma: PrismaService,
  scope: Scope,
  countryParam: string | undefined,
  userId: string | undefined,
): Promise<ResolvedScope> {
  if (scope === 'country') {
    let country: string | undefined;
    if (countryParam !== undefined) {
      country = normalizeCountry(countryParam) ?? undefined;
      if (!country) throw badRequest('País inválido.', 'invalid_country');
    } else if (userId) {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { country: true } });
      country = me?.country ?? undefined;
    }
    if (!country) throw badRequest('Indica un país.', 'country_required');
    return { country };
  }
  if (scope === 'friends') {
    if (!userId) throw unauthorized('Inicia sesión para ver el ranking de amigos.');
    const follows = await prisma.follow.findMany({ where: { followerId: userId }, select: { followeeId: true } });
    return { userIds: [userId, ...follows.map((f) => f.followeeId)] };
  }
  return {};
}

/** Filtro de Prisma del alcance (sirve para BestScore y DailyEntry, que tienen userId y country). */
export const scopeFilter = (s: ResolvedScope) =>
  s.country ? { country: s.country } : s.userIds ? { userId: { in: s.userIds } } : {};
