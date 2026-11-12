// Relleno de la mejor racha (plan de jugabilidad, fase 2): repite las partidas válidas guardadas
// de las reglas actuales para llenar Run.bestStreak / Run.endReason y sube UserStats.bestStreak.
// Idempotente: se puede correr varias veces (solo toca partidas sin bestStreak y usa GREATEST).
//
// Uso:
//   Producción (Dokploy, terminal del contenedor de la API, o en el VPS):
//     docker compose exec api node scripts/backfill-streaks.mjs [--dry-run]
//   Local (después de `pnpm --filter @tb/engine build` y `pnpm --filter @tb/api build`):
//     node apps/api/scripts/backfill-streaks.mjs [--dry-run]
//
// Usa DATABASE_URL (en local la lee de apps/api/.env si no viene del entorno) y el código ya
// compilado en dist/ (el mismo que corre la API).
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(path.join(root, '.env'));
  } catch {
    // sin .env
  }
}
if (!process.env.DATABASE_URL) {
  console.error('Falta la variable de entorno DATABASE_URL.');
  process.exit(1);
}

const dryRun = process.argv.includes('--dry-run');
const { PrismaClient } = require(path.join(root, 'dist/generated/prisma/client.js'));
const { PrismaPg } = require('@prisma/adapter-pg');
const { backfillStreaks } = require(path.join(root, 'dist/stats/backfill-streaks.js'));

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  console.log(dryRun ? 'Relleno de rachas (prueba, sin guardar)…' : 'Relleno de rachas…');
  const report = await backfillStreaks(prisma, { dryRun, log: (m) => console.log(m) });
  console.log(
    `Listo: ${report.replayed} repetidas, ${report.updated} ${dryRun ? 'se actualizarían' : 'actualizadas'}, ` +
      `${report.mismatched} no coinciden, ${report.failed} con error, ${report.usersUpdated} jugadores con mejor racha nueva.`,
  );
} catch (e) {
  console.error('Falló el relleno:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
