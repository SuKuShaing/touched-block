import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Platform, Share as RNShare, ToastAndroid } from 'react-native';
import { toast } from '@/components/Toast';
import { requestCardImage, type ShareCard } from '@/lib/shareCardStore';
import type { Share, ShareOutcome } from './share.types';

// Versión nativa de share.web.ts: las mismas tarjetas PNG (dibujada con View por
// components/ShareCardHost.native.tsx y capturada con react-native-view-shot), compartida con la
// hoja del sistema. Si no hay imagen, solo el texto; si tampoco se puede, se copia. Todo con
// try/catch: nunca lanza.
//
// Imagen + texto en Android: el intent de expo-sharing lleva solo el archivo (no admite mensaje)
// y el Share de React Native solo texto (su `url` es solo de iOS). Para que el jugador tenga la
// imagen Y el texto con el enlace, en Android se copia el texto al portapapeles, se avisa con un
// toast ("pégalo junto a la imagen") y luego se abre la hoja con la imagen. En iOS el Share de
// React Native sí acepta un archivo (`url`) y un mensaje juntos, así que va todo en una sola hoja.
// Los premios se comparten desde una ventana (`Modal`), que taparía el toast de la app: ahí el
// aviso es el del sistema (`ToastAndroid`).

/** Texto y enlace juntos: el enlace en su propia línea si el texto tiene varias (el del reto diario). */
const withUrl = (text: string, url: string) => (text.includes('\n') ? `${text}\n${url}` : `${text} ${url}`);

/** Tiempo para leer el toast antes de que la hoja de compartir lo tape. */
const TOAST_READ_MS = 900;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function copyText(text: string): Promise<boolean> {
  try {
    return await Clipboard.setStringAsync(text);
  } catch {
    return false;
  }
}

/** Hoja de compartir de RN; null si falló (para pasar al siguiente plan). */
async function rnShare(content: { message: string; url?: string }): Promise<ShareOutcome | null> {
  try {
    const r = await RNShare.share(content);
    // en Android siempre llega sharedAction (no se sabe si la cerró sin elegir)
    return r.action === RNShare.dismissedAction ? 'cancelled' : 'shared';
  } catch {
    return null;
  }
}

async function shareText(text: string, url: string): Promise<ShareOutcome> {
  // en iOS un texto de una línea va con el enlace aparte (como `{ text, url }` en la web); en
  // Android `url` no existe, y uno de varias líneas va entero para que cada app lo muestre igual
  const r = await rnShare(
    Platform.OS === 'ios' && !text.includes('\n') ? { message: text, url } : { message: withUrl(text, url) },
  );
  if (r) return r;
  return (await copyText(withUrl(text, url))) ? 'copied' : 'failed';
}

/** Título de la hoja y cómo avisar (en Android) que el texto quedó copiado. */
interface Sheet {
  title: string;
  notice: (message: string) => void;
}

const RESULT_SHEET: Sheet = { title: 'Compartir resultado', notice: toast };

const PRIZE_SHEET: Sheet = {
  title: 'Compartir premio',
  notice: (message) => {
    try {
      ToastAndroid.show(message, ToastAndroid.LONG);
    } catch {}
  },
};

/** Comparte el PNG; null si no se pudo (para caer a solo texto). */
async function shareImage(uri: string, text: string, url: string, sheet: Sheet): Promise<ShareOutcome | null> {
  let copied = false;
  try {
    if (Platform.OS === 'ios') return await rnShare({ message: withUrl(text, url), url: uri });
    if (!(await Sharing.isAvailableAsync())) return null;
    if (await copyText(withUrl(text, url))) {
      copied = true;
      sheet.notice('Texto copiado: pégalo junto a la imagen');
      await wait(TOAST_READ_MS);
    }
    // se resuelve al volver de la hoja; Android no dice si se compartió o se canceló
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: sheet.title });
    return 'shared';
  } catch {
    // si el texto ya quedó copiado (y se avisó), no abrir otra hoja de solo texto
    return copied ? 'copied' : null;
  }
}

/** Dibuja la imagen antes de que la pidan. */
function prepare(card: ShareCard) {
  try {
    void requestCardImage(card);
  } catch {}
}

/** Imagen con texto y enlace; si no se puede, solo el texto. */
async function shareCard(card: ShareCard, text: string, url: string, sheet: Sheet): Promise<ShareOutcome> {
  try {
    const uri = await requestCardImage(card);
    if (uri) {
      const r = await shareImage(uri, text, url, sheet);
      if (r) return r;
    }
  } catch {}
  return shareText(text, url);
}

export const share: Share = {
  prepareCard: prepare,
  shareResult: (card, text, url) => shareCard(card, text, url, RESULT_SHEET),
  preparePrize: prepare,
  sharePrize: (card, text, url) => shareCard(card, text, url, PRIZE_SHEET),
  shareText,
  copyText,
};
