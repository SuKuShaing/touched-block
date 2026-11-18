// Lista los nombres de usuario actuales que no pasan el filtro de nombres (groserías, insultos,
// odio y suplantación; src/users/username-filter.ts). Los nombres existentes NO se cambian solos:
// por defecto solo se listan.
//
// Uso:
//   Producción (Dokploy: terminal del contenedor de la API, o en el VPS junto al compose):
//     docker compose exec api node scripts/check-usernames.mjs                     # solo lista
//     docker compose exec api node scripts/check-usernames.mjs --rename --dry-run  # qué nombre recibiría cada uno
//     docker compose exec api node scripts/check-usernames.mjs --rename            # les pone jugadorNNNN
//   Local (después de `pnpm --filter @tb/engine build` y `pnpm --filter @tb/api build`):
//     node apps/api/scripts/check-usernames.mjs [--rename] [--dry-run]
//
// Usa DATABASE_URL (en local la lee de apps/api/.env si no viene del entorno) y el código compilado
// en dist/. Guía: docs/despliegue.md, sección "Moderación".
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

const { runModerationCli } = require(path.join(root, 'dist/moderation/cli.js'));
process.exitCode = await runModerationCli(['check-names', ...process.argv.slice(2)]);
