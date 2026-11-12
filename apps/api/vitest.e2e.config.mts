import { defineConfig } from 'vitest/config';

// Tests e2e contra Postgres real (docker-compose.yml, base touched_block_test).
// En CI se usa E2E_DATABASE_URL. La base se migra al empezar y cada archivo la vacía (test/global-setup.mts).
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://tb:tb@localhost:5434/touched_block_test';

export default defineConfig({
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } } as never,
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    globalSetup: ['test/global-setup.mts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL,
      JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
      GOOGLE_CLIENT_IDS: 'test-client-id',
      CORS_ORIGINS: 'http://localhost:8081',
      THROTTLE_DISABLED: '1',
      CLEANUP_INTERVAL_MS: '0',
      DAILY_SECRET: 'e2e-daily-secret-e2e-daily-secret-e2e',
    },
  },
});
