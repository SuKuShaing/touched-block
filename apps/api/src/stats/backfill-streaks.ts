import { RULES_VERSION, type TapInput, replay } from '@tb/engine';
import type { PrismaClient } from '../generated/prisma/client';
import { modsOf } from '../runs/run-verification';

export interface BackfillReport {
  /** Partidas repetidas. */
  replayed: number;
  /** Partidas que quedaron con su mejor racha y motivo del final. */
  updated: number;
  /** Partidas cuya repetición no coincide con lo guardado (no se tocan). */
  mismatched: number;
  /** Partidas que no se pudieron repetir (toques inválidos; no se tocan). */
  failed: number;
  /** Jugadores cuya mejor racha subió en UserStats. */
  usersUpdated: number;
}

/**
 * Relleno de la mejor racha (fase 2): repite las partidas válidas guardadas de las reglas
 * actuales que todavía no tienen `bestStreak` y guarda `bestStreak` y `endReason`; después sube
 * `UserStats.bestStreak` con GREATEST. Idempotente: se puede correr varias veces. Las partidas de
 * versiones de reglas anteriores no se pueden repetir con este motor y quedan como están.
 */
export async function backfillStreaks(
  prisma: PrismaClient,
  opts: { batchSize?: number; dryRun?: boolean; log?: (msg: string) => void } = {},
): Promise<BackfillReport> {
  const batchSize = opts.batchSize ?? 200;
  const log = opts.log ?? (() => {});
  const report: BackfillReport = { replayed: 0, updated: 0, mismatched: 0, failed: 0, usersUpdated: 0 };
  let cursor: string | undefined;

  for (;;) {
    const runs = await prisma.run.findMany({
      where: { status: 'valid', rulesVersion: RULES_VERSION, bestStreak: null, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true, seed: true, maxLives: true, fieldW: true, fieldH: true, config: true, inputs: true, killed: true, missed: true },
    });
    if (runs.length === 0) break;
    for (const run of runs) {
      cursor = run.id;
      try {
        const mods = modsOf(run.config);
        const r = replay(
          { seed: run.seed, maxLives: run.maxLives, fieldW: run.fieldW, fieldH: run.fieldH, ...(mods ? { mods } : {}) },
          (run.inputs ?? []) as TapInput[],
        );
        report.replayed++;
        if (!r.over || r.killed !== run.killed || r.missed !== run.missed) {
          report.mismatched++;
          log(`La partida ${run.id} no coincide con la repetición; se deja como está.`);
          continue;
        }
        if (!opts.dryRun) {
          await prisma.run.update({ where: { id: run.id }, data: { bestStreak: r.bestStreak, endReason: r.endReason } });
        }
        report.updated++;
      } catch (e) {
        report.failed++;
        log(`No se pudo repetir la partida ${run.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    log(`Procesadas ${report.replayed + report.failed} partidas…`);
  }

  if (!opts.dryRun) {
    // Solo las partidas normales sin modificadores cuentan para la mejor racha (D6, 5.1).
    report.usersUpdated = await prisma.$executeRaw`
      UPDATE "UserStats" AS s
      SET "bestStreak" = m.best, "updatedAt" = now()
      FROM (
        SELECT "userId", max("bestStreak") AS best
        FROM "Run"
        WHERE "status" = 'valid' AND "mode" = 'normal' AND "config" IS NULL
          AND "userId" IS NOT NULL AND "bestStreak" IS NOT NULL
        GROUP BY "userId"
      ) AS m
      WHERE s."userId" = m."userId" AND m.best > s."bestStreak"`;
  }
  return report;
}
