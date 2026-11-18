/**
 * Desde dónde se jugó una partida (columna Run.platform). Solo sirve para estadísticas: no cambia
 * reglas ni rankings. Tablets = móvil.
 * - `app_android` / `app_ios`: la app (React Native).
 * - `web_mobile`: navegador de un celular o tablet.
 * - `web_desktop`: navegador de PC.
 */
export const RUN_PLATFORMS = ['app_android', 'app_ios', 'web_mobile', 'web_desktop'] as const;
export type RunPlatform = (typeof RUN_PLATFORMS)[number];

export const isRunPlatform = (v: unknown): v is RunPlatform => typeof v === 'string' && (RUN_PLATFORMS as readonly string[]).includes(v);

/**
 * Plataforma deducida de la cabecera User-Agent, para los clientes que no mandan `platform` (el
 * APK ya repartido y las webs en caché). null si no hay UA o no parece ni la app ni un navegador
 * (curl, scripts, bots sin "Mozilla/").
 * - El fetch de React Native en Android sale por OkHttp ("okhttp/4.12.0"); el de Java, "Dalvik/…".
 * - En iOS sale por NSURLSession: "<App>/1 CFNetwork/1498 Darwin/24.0.0" (Safari no dice CFNetwork).
 * - Los navegadores empiezan con "Mozilla/". iPadOS en modo escritorio se presenta como Mac: por UA
 *   queda como PC (el cliente nuevo lo detecta y lo manda como `web_mobile`).
 */
export function platformFromUserAgent(ua: string | null | undefined): RunPlatform | null {
  if (typeof ua !== 'string') return null;
  const s = ua.trim().slice(0, 512);
  if (!s) return null;
  if (/^Mozilla\//i.test(s)) return /Android|iPhone|iPad|iPod|Mobi/i.test(s) ? 'web_mobile' : 'web_desktop';
  if (/\bokhttp\/|^Dalvik\//i.test(s)) return 'app_android';
  if (/\bCFNetwork\/|\bDarwin\//i.test(s)) return 'app_ios';
  return null;
}

/** La que mandó el cliente si es conocida; si no (falta o es un valor desconocido), la del User-Agent. */
export const resolvePlatform = (sent: unknown, ua: string | null | undefined): RunPlatform | null =>
  isRunPlatform(sent) ? sent : platformFromUserAgent(ua);
