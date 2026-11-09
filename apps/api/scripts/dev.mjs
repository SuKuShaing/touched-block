// Desarrollo: compila con tsc --watch y reinicia la API (node --watch) cuando cambia dist/.
// Uso: pnpm --filter @tb/api start:dev   (requiere apps/api/.env y el Postgres de docker-compose.yml)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const run = (args, opts = {}) => spawn(process.execPath, args, { cwd: root, stdio: 'inherit', ...opts });

spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), 'generate'], { cwd: root, stdio: 'inherit' });
const tsc = run([require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput']);
while (!existsSync(path.join(root, 'dist/main.js'))) await sleep(300);
await sleep(1500);
const api = run(['--watch', '--env-file-if-exists=.env', 'dist/main.js']);

const stop = () => {
  tsc.kill();
  api.kill();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
