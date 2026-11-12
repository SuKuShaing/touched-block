import { Vibration } from 'react-native';
import { getSettings } from '@/lib/settings';
import type { Fx } from './fx.types';

// Versión mínima para nativo: sin sonido todavía (fase app: expo-audio + expo-haptics).
// La vibración respeta el ajuste del dispositivo.
export const fx: Fx = {
  beep() {},
  buzz(ms: number) {
    try {
      if (!getSettings().haptics) return;
      Vibration.vibrate(ms);
    } catch {}
  },
};
