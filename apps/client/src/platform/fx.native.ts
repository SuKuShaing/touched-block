import { Vibration } from 'react-native';
import type { Fx } from './fx.types';

// Versión mínima para nativo: sin sonido todavía (fase app: expo-audio + expo-haptics).
export const fx: Fx = {
  beep() {},
  buzz(ms: number) {
    try {
      Vibration.vibrate(ms);
    } catch {}
  },
};
