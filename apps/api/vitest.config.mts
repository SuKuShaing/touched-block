import { defineConfig } from 'vitest/config';

// Tests unitarios (sin base de datos). Oxc emite la metadata de decoradores que necesita Nest.
export default defineConfig({
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } } as never,
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
});
