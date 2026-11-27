import { RULES_VERSION } from '@tb/engine';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

/** Marca del reinicio en `DataReset`: con ella puesta, no se vuelve a borrar nada. */
export const RESET_ID = 'v6-2026';
/** Valor exacto que exige `--confirm=` para borrar. */
export const RESET_CONFIRM = 'BORRAR-PROGRESO';
/** El reinicio solo se corre con el código de estas reglas (o posteriores) ya publicado. */
export const RESET_MIN_RULES_VERSION = 6;

const WEEK_MS = 7 * 86_400_000;

export interface ResetCounts {
  /** Cuentas (se conservan todas). */
  users: number;
  /** Cuentas con alguna partida guardada. */
  usersWithRuns: number;
  /** Cuentas con alguna partida empezada en los últimos 7 días. */
  usersWithRuns7d: number;
  /** Cuentas con alguna estadística distinta de cero (nivel, insignia, logros). */
  usersWithStats: number;
  runsWithUser: number;
  /** Partidas de invitado sin reclamar. */
  runsGuest: number;
  /** Filas de récord (rankings). */
  bestScores: number;
  dailyEntries: number;
  challenges: number;
  challengeEntries: number;
  missionRewards: number;
  /** Cuentas que respondieron "¿Quién te invitó?". */
  invitations: number;
}

export interface ResetReport {
  /** true solo si esta llamada borró. */
  applied: boolean;
  /** Cuándo se había aplicado antes, o null. */
  alreadyApplied: Date | null;
  /** Lo que había al empezar (antes de borrar). */
  counts: ResetCounts;
}

/**
 * Argumentos de scripts/reset-progress.mjs: sin ellos es una simulación; borra solo con
 * `--apply --confirm=BORRAR-PROGRESO`. Cualquier otra cosa es un error (no se hace nada).
 */
export function parseResetArgs(argv: readonly string[]): { apply: boolean } {
  if (argv.length === 0) return { apply: false };
  if (argv.length === 2 && argv.includes('--apply') && argv.includes(`--confirm=${RESET_CONFIRM}`)) return { apply: true };
  throw new Error(
    `Argumentos no válidos: ${argv.join(' ')}. Sin argumentos es una simulación de solo lectura; ` +
      `para borrar se necesitan exactamente: --apply --confirm=${RESET_CONFIRM}`,
  );
}

async function count(tx: Prisma.TransactionClient, now: Date): Promise<ResetCounts> {
  // en serie: una transacción usa una sola conexión
  return {
    users: await tx.user.count(),
    usersWithRuns: await tx.user.count({ where: { runs: { some: {} } } }),
    usersWithRuns7d: await tx.user.count({ where: { runs: { some: { startedAt: { gte: new Date(now.getTime() - WEEK_MS) } } } } }),
    usersWithStats: await tx.userStats.count({
      where: {
        OR: [
          { bestTicks: { gt: 0 } },
          { bestStreak: { gt: 0 } },
          { totalKilled: { gt: 0 } },
          { totalRuns: { gt: 0 } },
          { bonusXp: { gt: 0 } },
          { bestDailyPct: { not: null } },
        ],
      },
    }),
    runsWithUser: await tx.run.count({ where: { userId: { not: null } } }),
    runsGuest: await tx.run.count({ where: { userId: null } }),
    bestScores: await tx.bestScore.count(),
    dailyEntries: await tx.dailyEntry.count(),
    challenges: await tx.challenge.count(),
    challengeEntries: await tx.challengeEntry.count(),
    missionRewards: await tx.missionReward.count(),
    invitations: await tx.user.count({ where: { invitedById: { not: null } } }),
  };
}

function describe(c: ResetCounts): string[] {
  return [
    `Cuentas (se conservan): ${c.users}`,
    `Cuentas con partidas: ${c.usersWithRuns} (en los últimos 7 días: ${c.usersWithRuns7d})`,
    `Cuentas con estadísticas: ${c.usersWithStats}`,
    `Partidas: ${c.runsWithUser + c.runsGuest} (con cuenta: ${c.runsWithUser}, sin cuenta: ${c.runsGuest})`,
    `Récords (filas de ranking): ${c.bestScores}`,
    `Resultados del reto diario: ${c.dailyEntries}`,
    `Desafíos: ${c.challenges} (resultados: ${c.challengeEntries})`,
    `Premios de misión: ${c.missionRewards}`,
    `Invitaciones: ${c.invitations}`,
  ];
}

/**
 * Reinicio de registros (reset A, reglas v6): borra partidas, récords, retos, desafíos y premios de
 * misión, pone las estadísticas en cero y quita las invitaciones. Conserva cuentas, sesiones,
 * seguidos, bloqueos, reportes y el campo de cada reto diario. No se puede deshacer.
 *
 * Con `apply: false` solo cuenta, en una transacción de solo lectura. Con `apply: true` todo va en
 * una sola transacción y una sola vez: la marca `DataReset` impide repetirlo. Nada lo invoca solo:
 * se corre a mano con scripts/reset-progress.mjs.
 */
export async function resetProgress(
  prisma: PrismaClient,
  opts: { apply: boolean; log(m: string): void },
): Promise<ResetReport> {
  const version: number = RULES_VERSION;
  if (version < RESET_MIN_RULES_VERSION) {
    throw new Error(`El reinicio requiere las reglas v${RESET_MIN_RULES_VERSION} o posteriores; este código usa la v${version}.`);
  }

  const report = await prisma.$transaction(
    async (tx): Promise<ResetReport> => {
      if (opts.apply) {
        // $executeRaw: la función devuelve void y $queryRaw no sabe leerlo
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('tb-reset-v6'))`;
      } else {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      }
      const done = await tx.dataReset.findUnique({ where: { id: RESET_ID } });
      if (!opts.apply || done) {
        return { applied: false, alreadyApplied: done?.appliedAt ?? null, counts: await count(tx, new Date()) };
      }

      // La API sigue atendiendo: se frenan sus escrituras (las lecturas no) hasta confirmar, para
      // que una partida que termine a la mitad no deje filas que sobrevivan al reinicio.
      await tx.$executeRaw`SET LOCAL lock_timeout = '15s'`;
      await tx.$executeRaw`LOCK TABLE "BestScore", "DailyEntry", "ChallengeEntry", "Challenge", "MissionReward", "Run", "UserStats", "User" IN EXCLUSIVE MODE`;
      const counts = await count(tx, new Date());

      await tx.$executeRaw`DELETE FROM "BestScore"`;
      await tx.$executeRaw`DELETE FROM "DailyEntry"`;
      await tx.$executeRaw`DELETE FROM "ChallengeEntry"`;
      await tx.$executeRaw`DELETE FROM "Challenge"`;
      await tx.$executeRaw`DELETE FROM "MissionReward"`;
      await tx.$executeRaw`DELETE FROM "Run"`;
      await tx.$executeRaw`
        UPDATE "UserStats" SET "bestTicks" = 0, "bestStreak" = 0, "totalKilled" = 0, "totalRuns" = 0,
          "bonusXp" = 0, "bestDailyPct" = NULL, "updatedAt" = now()`;
      await tx.$executeRaw`
        UPDATE "User" SET "invitedById" = NULL, "invitedAt" = NULL
        WHERE "invitedById" IS NOT NULL OR "invitedAt" IS NOT NULL`;
      await tx.dataReset.create({ data: { id: RESET_ID, details: { ...counts } } });
      return { applied: true, alreadyApplied: null, counts };
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  // fuera de la transacción: se informa solo lo que ya quedó confirmado
  for (const line of describe(report.counts)) opts.log(line);
  if (report.alreadyApplied) {
    opts.log(`El reinicio ${RESET_ID} ya se aplicó el ${report.alreadyApplied.toISOString()}: no se borra nada.`);
  } else if (report.applied) {
    opts.log(`Reinicio ${RESET_ID} aplicado: se borró el progreso contado arriba; las cuentas se conservan.`);
  } else {
    opts.log('Simulación: no se cambió nada.');
  }
  return report;
}
