import { webPlatformOf } from '@/lib/webPlatform';
import type { RunPlatform } from './runPlatform.types';

let cached: RunPlatform | null = null;

/** Navegador de celular/tablet o de PC (ver lib/webPlatform.ts). null sin `navigator` (render estático). */
export function runPlatform(): RunPlatform | null {
  if (cached) return cached;
  try {
    if (typeof navigator === 'undefined') return null;
    cached = webPlatformOf(navigator as Navigator & { userAgentData?: { mobile?: boolean } });
    return cached;
  } catch {
    return null;
  }
}
