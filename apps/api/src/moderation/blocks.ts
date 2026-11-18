import type { PrismaService } from '../prisma/prisma.service';

/** Prisma o el cliente de una transacción (solo lo que se usa aquí). */
type Db = Pick<PrismaService, 'block'>;

/**
 * Ids de los jugadores con un bloqueo con `userId`, en cualquier sentido (los que bloqueó y los
 * que lo bloquearon). Se excluyen de su búsqueda y de sus rankings de amigos.
 */
export async function blockedEitherWay(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

/** Bloqueos entre `viewerId` y `otherId`: si yo lo bloqueé y si él me bloqueó. */
export async function blockBetween(db: Db, viewerId: string, otherId: string) {
  const rows = await db.block.findMany({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: otherId },
        { blockerId: otherId, blockedId: viewerId },
      ],
    },
    select: { blockerId: true },
  });
  return { iBlocked: rows.some((r) => r.blockerId === viewerId), blockedMe: rows.some((r) => r.blockerId === otherId) };
}
