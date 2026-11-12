import type { Install, InstallState } from './install.types';

// En la app nativa no hay nada que instalar: ya es una app.
const INSTALLED: InstallState = { installed: true, kind: 'none' };

export const install: Install = {
  get: () => INSTALLED,
  subscribe: () => () => {},
  prompt: async () => 'unavailable',
};
