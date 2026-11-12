import { Share as RNShare } from 'react-native';
import type { Share } from './share.types';

// Versión mínima para nativo: hoja de compartir del sistema solo con texto. En la fase app se
// agrega la imagen (react-native-view-shot + expo-sharing) y el portapapeles (expo-clipboard).
async function shareText(text: string, url: string) {
  try {
    // el enlace en su propia línea si el texto tiene varias (el del reto diario)
    const r = await RNShare.share({ message: text.includes('\n') ? `${text}\n${url}` : `${text} ${url}`, url });
    return r.action === RNShare.dismissedAction ? ('cancelled' as const) : ('shared' as const);
  } catch {
    return 'failed' as const;
  }
}

export const share: Share = {
  prepareCard: () => {},
  shareResult: (_card, text, url) => shareText(text, url),
  shareText,
  copyText: async () => false,
};
