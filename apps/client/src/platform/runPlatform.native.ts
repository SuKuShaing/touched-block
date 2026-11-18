import { Platform } from 'react-native';
import type { RunPlatform } from './runPlatform.types';

/** La app: Android o iOS (las tablets también, igual que en la web). */
export function runPlatform(): RunPlatform | null {
  try {
    if (Platform.OS === 'android') return 'app_android';
    if (Platform.OS === 'ios') return 'app_ios';
  } catch {
    // sin módulo de plataforma: no se manda
  }
  return null;
}
