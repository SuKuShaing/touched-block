// Config propia de la prueba de paletas sobre fondos. Mismos alias que herramientas/prueba-paletas/vitest.config.mts
// (`@/` = src/ del cliente, `@tb/engine` = código fuente del motor); resuelve al juego REAL sin copiarlo.
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
    include: ['*.spec.ts'],
    environment: 'node',
    cache: false,
  },
};
