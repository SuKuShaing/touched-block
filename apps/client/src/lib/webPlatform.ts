import type { RunPlatform } from '@/platform/runPlatform.types';

/** Lo que se lee de `navigator` (separado para poder probarlo sin navegador). */
export interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentData?: { mobile?: boolean; platform?: string } | null;
}

/** Dispositivo de Apple: iPhone/iPad (`ios`) o Mac (`mac`); null si no es de Apple o no se sabe. */
export type AppleDevice = 'ios' | 'mac' | null;

/**
 * Si el navegador corre en un dispositivo de Apple. iPadOS en modo escritorio se presenta como Mac
 * pero tiene pantalla táctil: cuenta como `ios` (tiene modo silencio; un Mac no).
 */
export function appleDeviceOf(nav: NavigatorLike | null | undefined): AppleDevice {
  if (!nav) return null;
  const ua = nav.userAgent ?? '';
  if (/iPhone|iPad|iPod/i.test(ua) || nav.platform === 'iPhone' || nav.platform === 'iPad') return 'ios';
  const mac = /Macintosh|Mac OS X/i.test(ua) || nav.platform === 'MacIntel' || nav.userAgentData?.platform === 'macOS';
  if (mac) return (nav.maxTouchPoints ?? 0) > 1 ? 'ios' : 'mac';
  return null;
}

/**
 * Navegador de celular/tablet o de PC. Las tablets cuentan como móvil.
 * - `userAgentData.mobile` (Chrome/Edge) cuando dice que sí; si dice que no, se mira igual el UA
 *   porque Chrome en tablets Android responde `mobile: false`.
 * - iPadOS en modo escritorio se presenta como Mac ("MacIntel") pero tiene pantalla táctil.
 */
export function webPlatformOf(nav: NavigatorLike | null | undefined): RunPlatform {
  if (!nav) return 'web_desktop';
  if (nav.userAgentData?.mobile === true) return 'web_mobile';
  if (/Android|iPhone|iPad|iPod|Mobi/i.test(nav.userAgent ?? '')) return 'web_mobile';
  if (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1) return 'web_mobile';
  return 'web_desktop';
}
