import { getSettings, updateSettings } from '@/lib/settings';
import { appleDevice } from '@/platform/runPlatform';
import { toast } from './Toast';

/**
 * Aviso del modo silencio (iPhone y iPad). El juego respeta el modo silencio, como la mayoría de los
 * juegos de iOS (categoría "ambient"), y ni la web ni la app pueden saber si el dispositivo está en
 * silencio: por eso es un aviso general, solo en iOS (un Mac no tiene modo silencio).
 */
export const SILENT_TIP = '¿No escuchas el sonido? Revisa que tu iPhone o iPad no esté en modo silencio.';

/** true en iPhone/iPad (web o app). */
export const showsSilentTip = () => appleDevice() === 'ios';

/** Muestra el aviso (al encender el sonido). */
export function silentTip() {
  if (showsSilentTip()) toast(SILENT_TIP);
}

/** Muestra el aviso una sola vez por dispositivo (al empezar la primera partida con sonido). */
export function silentTipOnce() {
  try {
    if (!showsSilentTip()) return;
    const s = getSettings();
    if (!s.sound || s.silentTipSeen) return;
    updateSettings({ silentTipSeen: true });
    toast(SILENT_TIP);
  } catch {}
}
