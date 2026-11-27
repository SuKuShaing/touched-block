// Reinicio de registros (reset A, reglas v6). BORRA partidas, récords, rankings, retos diarios,
// desafíos, premios de misión e invitaciones, y pone las estadísticas en cero. Conserva cuentas,
// sesiones, seguidos, bloqueos y reportes. NO SE PUEDE DESHACER. Se aplica una sola vez (tabla
// DataReset) y solo a mano: ningún arranque, workflow ni compose lo invoca.
//
// Uso (la migración de DataReset la aplica la API al arrancar):
//   Producción (Dokploy, terminal del contenedor "api" tras `cd /app`, o en el VPS):
//     docker compose exec api node scripts/reset-progress.mjs                                     # simulación
//     docker compose exec api node scripts/reset-progress.mjs --apply --confirm=BORRAR-PROGRESO   # borra
//   Local (después de `pnpm --filter @tb/engine build` y `pnpm --filter @tb/api build`):
//     node apps/api/scripts/reset-progress.mjs [--apply --confirm=BORRAR-PROGRESO]
//
// Sin argumentos solo lee y cuenta. Usa DATABASE_URL (en local la lee de apps/api/.env si no viene
// del entorno) y el código ya compilado en dist/ (el mismo que corre la API).
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

const { parseResetArgs, resetProgress } = require(path.join(root, 'dist/maintenance/reset-progress.js'));

let args;
try {
  args = parseResetArgs(process.argv.slice(2));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

const { PrismaClient } = require(path.join(root, 'dist/generated/prisma/client.js'));
const { PrismaPg } = require('@prisma/adapter-pg');

/** Servidor y base a los que se conecta, sin usuario ni contraseña. */
function target() {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return `${url.host}${url.pathname}`;
  } catch {
    return '(no se pudo leer DATABASE_URL)';
  }
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
try {
  console.log(`Base: ${target()}`);
  console.log(args.apply ? 'Reinicio de registros (BORRA, sin vuelta atrás)…' : 'Reinicio de registros: simulación (solo lectura)…');
  await resetProgress(prisma, { apply: args.apply, log: (m) => console.log(m) });
} catch (e) {
  console.error('Falló el reinicio; no se cambió nada:', e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
