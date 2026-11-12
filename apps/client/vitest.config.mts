import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Tests del cliente: solo módulos puros (sin React Native). Se resuelven los mismos alias que
// usa Metro: `@/` = src/ y `@tb/engine` = código fuente del motor. Los módulos por plataforma
// (`@/platform/x`) usan su versión web; sin `window` caen en sus try/catch (almacenamiento
// vacío, sin sonido), y cada test puede reemplazarlos con `vi.mock` o `vi.stubGlobal`.
const src = fileURLToPath(new URL('./src/', import.meta.url));
const engine = fileURLToPath(new URL('../../packages/engine/src/index.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@tb\/engine$/, replacement: engine },
      { find: /^@\/platform\/(\w+)$/, replacement: `${src}platform/$1.web.ts` },
      { find: /^@\//, replacement: src },
    ],
  },
  test: {
    include: ['src/lib/**/*.test.ts', 'src/cosmetics/**/*.test.ts', 'src/game/**/*.test.ts'],
    environment: 'node',
  },
});
