// Moderación (guía 1.2 de Apple): revisar reportes, cambiar nombres y eliminar cuentas.
// Lo mismo que los endpoints /admin/*, sin ADMIN_TOKEN (quien entra al contenedor ya tiene la base).
//
// Uso:
//   Producción (Dokploy: terminal del contenedor de la API, o en el VPS junto al compose):
//     docker compose exec api node scripts/moderation.mjs reports
//     docker compose exec api node scripts/moderation.mjs rename <usuario> [nombre-nuevo] [--dry-run]
//     docker compose exec api node scripts/moderation.mjs delete <usuario> --yes
//     docker compose exec api node scripts/moderation.mjs resolve <idReporte|@usuario> [--dismiss] [--note="..."]
//     docker compose exec api node scripts/moderation.mjs telegram-test [--chat-id]   (igual que scripts/telegram-test.mjs)
//   Local (después de `pnpm --filter @tb/engine build` y `pnpm --filter @tb/api build`):
//     node apps/api/scripts/moderation.mjs reports
//
// Sin argumentos muestra la ayuda. Usa DATABASE_URL (en local la lee de apps/api/.env si no viene
// del entorno) y el código compilado en dist/. Guía: docs/despliegue.md, sección "Moderación".
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

const telegramOnly = process.argv[2] === 'telegram-test';

if (!process.env.DATABASE_URL || (telegramOnly && !process.env.TELEGRAM_BOT_TOKEN)) {
  try {
    process.loadEnvFile(path.join(root, '.env'));
  } catch {
    // sin .env
  }
}
if (!process.env.DATABASE_URL && !telegramOnly) {
  console.error('Falta la variable de entorno DATABASE_URL.');
  process.exit(1);
}

const { runModerationCli } = require(path.join(root, 'dist/moderation/cli.js'));
process.exitCode = await runModerationCli(process.argv.slice(2));
