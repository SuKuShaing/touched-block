// Config propia de la prueba de paletas candidatas. Mismos alias que apps/client/vitest.config.mts
// (`@/` = src/ del cliente, `@tb/engine` = código fuente del motor); se resuelven al juego REAL sin copiarlo.
// Exporta un objeto plano (sin `defineConfig`) para no necesitar `vitest` resoluble desde esta carpeta.
import { fileURLToPath } from 'node:url';

const src = fileURLToPath(new URL('../../../apps/client/src/', import.meta.url));
const engine = fileURLToPath(new URL('../../../packages/engine/src/index.ts', import.meta.url));
const vitestDir = fileURLToPath(new URL('../../../apps/client/node_modules/vitest/', import.meta.url));

export default {
  resolve: {
    alias: [
      { find: /^@tb\/engine$/, replacement: engine },
      { find: /^@\/platform\/(\w+)$/, replacement: `${src}platform/$1.web.ts` },
      { find: /^@\//, replacement: src },
      { find: /^vitest$/, replacement: `${vitestDir}dist/index.js` },
    ],
  },
  test: {
    include: ['*.test.ts', '*.spec.ts'],
    environment: 'node',
    // La caché de vite/vitest no debe escribirse dentro del juego.
    cache: false,
  },
};
