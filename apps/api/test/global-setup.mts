import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

/** Aplica las migraciones a la base de tests antes de correr los e2e. */
export default function setup() {
  const url = process.env.E2E_DATABASE_URL ?? 'postgresql://tb:tb@localhost:5434/touched_block_test';
  const require = createRequire(import.meta.url);
  const cli = require.resolve('prisma/build/index.js');
  execFileSync(process.execPath, [cli, 'migrate', 'deploy'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  });
}
