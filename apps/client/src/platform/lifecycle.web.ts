import type { Lifecycle } from './lifecycle.types';

// Pestaña oculta/visible (`visibilitychange`). Sin `document` (tests, SSR) no hace nada.
export const lifecycle: Lifecycle = {
  onVisibility(cb) {
    if (typeof document === 'undefined') return () => {};
    const h = () => {
      try {
        cb(document.visibilityState !== 'hidden');
      } catch {}
    };
    try {
      document.addEventListener('visibilitychange', h);
    } catch {
      return () => {};
    }
    return () => {
      try {
        document.removeEventListener('visibilitychange', h);
      } catch {}
    };
  },
};
