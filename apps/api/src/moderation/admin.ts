import { badRequest, conflict, notFound } from '../common/errors';
import { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { normalizeUsername, randomPlayerName, usernameProblem } from '../users/username';

/**
 * Operaciones de moderación del dueño. Las usan los endpoints /admin/* (AdminController) y los
 * scripts de línea de comandos (scripts/moderation.mjs, scripts/check-usernames.mjs), así que
 * reciben Prisma y no dependen de Nest.
 */

/** Horas que Apple espera como máximo para actuar sobre un reporte (guía 1.2). */
export const REPORT_RESPONSE_HOURS = 24;

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export interface AdminReport {
  id: string;
  status: 'pending' | 'resolved' | 'dismissed';
  reason: 'offensive_name' | 'impersonation' | 'other';
  details: string | null;
  /** Nombre que tenía el reportado al reportarlo. */
  reportedUsername: string;
  /** El reportado ahora (null si eliminó su cuenta o se la eliminaron). */
  reported: { id: string; username: string } | null;
  /** null si quien reportó eliminó su cuenta. */
  reporter: { id: string; username: string } | null;
  createdAt: string;
  /** Horas desde el reporte. */
  ageHours: number;
  resolvedAt: string | null;
  resolution: string | null;
}

export async function listReports(
  prisma: PrismaService,
  opts: { status?: 'pending' | 'resolved' | 'dismissed' | 'all'; limit?: number } = {},
): Promise<{ reports: AdminReport[]; pending: number; overdue: number }> {
  const status = opts.status ?? 'pending';
  const now = Date.now();
  const [rows, pending, overdue] = await Promise.all([
    prisma.report.findMany({
      where: status === 'all' ? {} : { status },
      // pendientes: primero los más antiguos (los más urgentes); el resto, los más nuevos
      orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' },
      take: opts.limit ?? 100,
      include: {
        reporter: { select: { id: true, username: true } },
        reported: { select: { id: true, username: true } },
      },
    }),
    prisma.report.count({ where: { status: 'pending' } }),
    prisma.report.count({
      where: { status: 'pending', createdAt: { lt: new Date(now - REPORT_RESPONSE_HOURS * 3_600_000) } },
    }),
  ]);
  return {
    pending,
    overdue,
    reports: rows.map((r) => ({
      id: r.id,
      status: r.status,
      reason: r.reason,
      details: r.details,
      reportedUsername: r.reportedUsername,
      reported: r.reported,
      reporter: r.reporter,
      createdAt: r.createdAt.toISOString(),
      ageHours: Math.floor((now - r.createdAt.getTime()) / 3_600_000),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      resolution: r.resolution,
    })),
  };
}

/** Marca un reporte (por id) como resuelto o descartado. */
export async function resolveReport(
  prisma: PrismaService,
  id: string,
  opts: { status?: 'resolved' | 'dismissed'; resolution?: string | null } = {},
) {
  const r = await prisma.report.findUnique({ where: { id }, select: { id: true } });
  if (!r) throw notFound('Ese reporte no existe.', 'report_not_found');
  return prisma.report.update({
    where: { id },
    data: { status: opts.status ?? 'resolved', resolution: opts.resolution?.slice(0, 200) ?? null, resolvedAt: new Date() },
  });
}

/** Cierra todos los reportes pendientes contra un usuario (al cambiarle el nombre o eliminarlo). */
export async function resolvePendingFor(
  prisma: PrismaService,
  userId: string,
  resolution: string,
  status: 'resolved' | 'dismissed' = 'resolved',
): Promise<number> {
  const res = await prisma.report.updateMany({
    where: { reportedId: userId, status: 'pending' },
    data: { status, resolution: resolution.slice(0, 200), resolvedAt: new Date() },
  });
  return res.count;
}

export async function findUserByUsername(prisma: PrismaService, raw: string) {
  const username = normalizeUsername(raw);
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
  if (!user) throw notFound(`No existe el usuario @${username}.`, 'user_not_found');
  return user;
}

/**
 * Cambia a la fuerza el nombre de un usuario: al indicado (debe cumplir las reglas y el filtro)
 * o a uno automático tipo "jugador1234". Cierra sus reportes pendientes.
 */
export async function forceRename(
  prisma: PrismaService,
  rawUsername: string,
  rawNew?: string | null,
  opts: { dryRun?: boolean } = {},
): Promise<{ from: string; to: string; resolvedReports: number; dryRun: boolean }> {
  const user = await findUserByUsername(prisma, rawUsername);
  let wanted: string | null = null;
  if (rawNew) {
    wanted = normalizeUsername(rawNew);
    const problem = usernameProblem(wanted);
    if (problem) throw badRequest(problem, 'invalid_username');
    if (wanted === user.username) throw badRequest('Ese ya es su nombre.', 'same_username');
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const to = wanted ?? randomPlayerName(attempt < 10 ? 4 : 6);
    const taken = await prisma.user.findUnique({ where: { username: to }, select: { id: true } });
    if (taken) {
      if (wanted) throw conflict('Ese nombre de usuario ya está tomado.', 'username_taken');
      continue;
    }
    if (opts.dryRun) return { from: user.username, to, resolvedReports: 0, dryRun: true };
    try {
      await prisma.user.update({ where: { id: user.id }, data: { username: to } });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      if (wanted) throw conflict('Ese nombre de usuario ya está tomado.', 'username_taken');
      continue;
    }
    const resolvedReports = await resolvePendingFor(prisma, user.id, `Nombre cambiado de @${user.username} a @${to}.`);
    return { from: user.username, to, resolvedReports, dryRun: false };
  }
  throw conflict('No se pudo generar un nombre libre. Inténtalo de nuevo.', 'username_generation_failed');
}

/** Usuarios cuyo nombre actual no pasa las reglas (incluido el filtro de groserías y suplantación). */
export async function namesFailingFilter(prisma: PrismaService) {
  const out: { id: string; username: string; problem: string }[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.user.findMany({
      select: { id: true, username: true },
      orderBy: { id: 'asc' },
      take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    for (const u of page) {
      const problem = usernameProblem(u.username);
      if (problem) out.push({ ...u, problem });
    }
    if (page.length < 1000) break;
    cursor = page[page.length - 1].id;
  }
  return out.sort((a, b) => a.username.localeCompare(b.username));
}
