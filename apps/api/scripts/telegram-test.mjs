// Prueba de los avisos de reportes por Telegram (docs/despliegue.md, sección 7, "Avisos por Telegram").
// No usa la base de datos. Nunca imprime el token.
//
// Uso:
//   Producción (Dokploy: terminal del contenedor de la API, o en el VPS junto al compose):
//     docker compose exec api node scripts/telegram-test.mjs             # manda un mensaje de prueba
//     docker compose exec api node scripts/telegram-test.mjs --chat-id   # muestra el chat id de quienes le escribieron al bot
//   Local (después de `pnpm --filter @tb/engine build` y `pnpm --filter @tb/api build`):
//     node apps/api/scripts/telegram-test.mjs [--chat-id]
//
// Usa TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID del entorno (en local, de apps/api/.env si no vienen) y
// el código compilado en dist/. Lo mismo: `node scripts/moderation.mjs telegram-test [--chat-id]`.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

if (!process.env.TELEGRAM_BOT_TOKEN) {
  try {
    process.loadEnvFile(path.join(root, '.env'));
  } catch {
    // sin .env
  }
}

const { runTelegramCli } = require(path.join(root, 'dist/moderation/telegram-cli.js'));
process.exitCode = await runTelegramCli(process.argv.slice(2));
