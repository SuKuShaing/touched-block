import { Platform } from 'react-native';
import type { AppleDevice } from '@/lib/webPlatform';
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

/** La app en iOS (iPhone o iPad) es `ios`; Android, null. */
export function appleDevice(): AppleDevice {
  try {
    return Platform.OS === 'ios' ? 'ios' : null;
  } catch {
    return null;
  }
}
