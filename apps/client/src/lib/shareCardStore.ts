import type { PrizeShareCard, ResultCard } from '@/platform/share.types';

/**
 * Cola de la tarjeta de compartir en nativo (sin React Native: solo estado). `share.native.ts`
 * pide la imagen con `requestCardImage`; `components/ShareCardHost.native.tsx` (montado una vez en
 * `app/_layout.tsx`) dibuja la tarjeta fuera de la pantalla, la captura a PNG y responde con
 * `finishCardJob`. En la web no se usa (allí la tarjeta se dibuja en un `<canvas>`).
 */
/** La del resultado de una partida o la de un premio (se distinguen por `kind`). */
export type ShareCard = ResultCard | PrizeShareCard;

export const isPrizeCard = (card: ShareCard): card is PrizeShareCard => 'kind' in card;

/**
 * Medidas de la tarjeta de un premio (px de la tarjeta de 1080; `y` = línea base del texto). Las
 * usan `share.web.ts` (canvas) y `ShareCardHost.native.tsx`, para que las dos queden iguales.
 */
export const PRIZE_CARD = {
  maxW: 860,
  brand: { y: 180, size: 64 },
  who: { y: 248, size: 42 },
  /** Lado de la insignia o del icono del logro, y altura de su centro. */
  art: { box: 360, cy: 545 },
  /** Textos con imagen (insignia y logro). */
  withArt: { kicker: { y: 322, size: 38 }, title: { y: 825, size: 80 }, sub: { y: 892, size: 40 } },
  /** Tarjeta de solo texto (premios del catálogo). */
  textOnly: { kicker: { y: 450, size: 46 }, title: { y: 590, size: 110 }, sub: { y: 700, size: 44 } },
  footer: { y: 975, size: 32 },
} as const;

export interface CardJob {
  key: string;
  card: ShareCard;
}

/** Si el host no responde (no montado, captura colgada), se sigue sin imagen. */
const TIMEOUT_MS = 4000;

let job: CardJob | null = null;
let cache: { key: string; uri: Promise<string | null> } | null = null;
let resolveJob: ((uri: string | null) => void) | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribeCardJob = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
export const getCardJob = () => job;

/** URI (file://) del PNG de la tarjeta, o null si no se pudo. Se guarda la última por sus datos. */
export function requestCardImage(card: ShareCard): Promise<string | null> {
  const key = JSON.stringify(card);
  if (cache?.key === key) return cache.uri;
  // una pedida anterior sin terminar se descarta (la tarjeta cambió)
  resolveJob?.(null);
  const uri = new Promise<string | null>((resolve) => {
    let done = false;
    const finish = (u: string | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (resolveJob === finish) resolveJob = null;
      // un fallo no se guarda: el próximo intento vuelve a dibujarla (se limpia antes de avisar,
      // por si un suscriptor la vuelve a pedir durante emit())
      if (!u && cache?.key === key) cache = null;
      if (job?.key === key) {
        job = null;
        emit();
      }
      resolve(u);
    };
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);
    resolveJob = finish;
  });
  cache = { key, uri };
  job = { key, card };
  emit();
  return uri;
}

/** El host avisa el resultado de la captura de `key`. */
export function finishCardJob(key: string, uri: string | null) {
  if (job?.key === key) resolveJob?.(uri);
}
