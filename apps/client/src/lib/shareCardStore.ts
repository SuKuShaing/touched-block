import type { ResultCard } from '@/platform/share.types';

/**
 * Cola de la tarjeta de compartir en nativo (sin React Native: solo estado). `share.native.ts`
 * pide la imagen con `requestCardImage`; `components/ShareCardHost.native.tsx` (montado una vez en
 * `app/_layout.tsx`) dibuja la tarjeta fuera de la pantalla, la captura a PNG y responde con
 * `finishCardJob`. En la web no se usa (allí la tarjeta se dibuja en un `<canvas>`).
 */
export interface CardJob {
  key: string;
  card: ResultCard;
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
export function requestCardImage(card: ResultCard): Promise<string | null> {
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
      if (job?.key === key) {
        job = null;
        emit();
      }
      // un fallo no se guarda: el próximo intento vuelve a dibujarla
      if (!u && cache?.key === key) cache = null;
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
