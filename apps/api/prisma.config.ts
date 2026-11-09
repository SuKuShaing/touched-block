import { defineConfig } from 'prisma/config';

// En desarrollo carga apps/api/.env si DATABASE_URL no viene del entorno
// (en producción, CI y tests e2e viene del entorno).
if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env');
  } catch {
    // sin .env
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? '',
  },
});
