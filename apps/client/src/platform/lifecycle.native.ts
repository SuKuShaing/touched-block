import { AppState } from 'react-native';
import type { Lifecycle } from './lifecycle.types';

// AppState: 'background' (Android e iOS) e 'inactive' (solo iOS: multitarea, centro de control)
// equivalen a la pestaña oculta; 'active' a la pestaña visible.
export const lifecycle: Lifecycle = {
  onVisibility(cb) {
    try {
      const sub = AppState.addEventListener('change', (s) => {
        try {
          cb(s === 'active');
        } catch {}
      });
      return () => {
        try {
          sub.remove();
        } catch {}
      };
    } catch {
      return () => {};
    }
  },
};
