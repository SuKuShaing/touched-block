import { Platform } from 'react-native';
import { storage } from '@/platform/storage';

/**
 * Hay dos tutoriales:
 * - básico: la dinámica del juego. Se abre solo en la 1.ª visita al dispositivo.
 * - avanzado: operaciones, restas ≤ 0 y "solo positivos". Se abre solo en la 3.ª visita.
 * En la 2.ª visita no se abre nada: se va directo a jugar. Desde el Perfil se repite el básico o,
 * si ya vio los dos, el completo (básico y después avanzado).
 */
export type OnbLevel = 'basico' | 'avanzado';
/** Lo que muestra /como-jugar: un nivel, o el completo (básico y luego avanzado) para repasar. */
export type OnbView = OnbLevel | 'completo';

/** Marcas de "ya lo vio". tb_onb1 era la del tutorial único de antes; ahora es la del básico. */
const SEEN_KEY: Record<OnbLevel, string> = { basico: 'tb_onb1', avanzado: 'tb_onb_adv1' };
/** Cuántas visitas lleva este dispositivo y cuándo fue la última actividad (ms). */
const VISITS_KEY = 'tb_visits1';
const LAST_KEY = 'tb_last1';

/** Visita en la que se abre solo el tutorial avanzado. */
export const ADVANCED_ON_VISIT = 3;
/** Tiempo sin usar la web para que volver cuente como una visita nueva (recargar no cuenta). */
export const NEW_VISIT_GAP_MS = 30 * 60 * 1000;

export const onboardingSeen = (level: OnbLevel) => storage.get(SEEN_KEY[level]) === '1';
export const markOnboardingSeen = (level: OnbLevel) => storage.set(SEEN_KEY[level], '1');

export const parseView = (v: unknown): OnbView => (v === 'avanzado' || v === 'completo' ? v : 'basico');

/** Marca como vistos los niveles que incluye lo que se mostró. */
export function markViewSeen(view: OnbView) {
  if (view !== 'avanzado') markOnboardingSeen('basico');
  if (view !== 'basico') markOnboardingSeen('avanzado');
}

/** Qué repasa el botón "Ver tutorial de nuevo" del Perfil: el completo si ya vio los dos; si no, el básico. */
export const replayView = (): OnbView => (onboardingSeen('basico') && onboardingSeen('avanzado') ? 'completo' : 'basico');

function readInt(key: string): number {
  const n = Number(storage.get(key));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export const visitCount = () => readInt(VISITS_KEY);

const markActive = (now = Date.now()) => storage.set(LAST_KEY, String(now));

/**
 * Cuenta una visita nueva si es la primera o si pasó NEW_VISIT_GAP_MS desde la última
 * actividad. Devuelve true si contó una.
 */
function touchVisit(now = Date.now()): boolean {
  const n = visitCount();
  const last = readInt(LAST_KEY);
  const isNew = n === 0 || now - last > NEW_VISIT_GAP_MS;
  if (isNew) storage.set(VISITS_KEY, String(n + 1));
  markActive(now);
  return isNew;
}

let counted = false;
/** Cuenta la visita de esta carga de la página (una sola vez, aunque se llame varias). */
export function registerVisit() {
  if (counted) return;
  counted = true;
  touchVisit();
}

/** Qué tutorial corresponde abrir solo ahora, o null. */
export function dueOnboarding(): OnbLevel | null {
  registerVisit();
  if (!onboardingSeen('basico')) return 'basico';
  if (!onboardingSeen('avanzado') && visitCount() >= ADVANCED_ON_VISIT) return 'avanzado';
  return null;
}

const listeners = new Set<() => void>();
/** Avisa cuando se cuenta una visita nueva sin recargar (volver a una pestaña que quedó abierta). */
export function onNewVisit(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * En la web, una pestaña puede quedar abierta días: al volver a ella después de
 * NEW_VISIT_GAP_MS cuenta como visita nueva. Devuelve la función para dejar de escuchar.
 */
export function startVisitTracking(): () => void {
  registerVisit();
  if (Platform.OS !== 'web' || typeof document === 'undefined') return () => {};
  const onVisibility = () => {
    try {
      if (document.visibilityState === 'hidden') markActive();
      else if (touchVisit()) for (const cb of listeners) cb();
    } catch {
      // sin almacenamiento: no se cuentan visitas
    }
  };
  const onHide = () => markActive();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onHide);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onHide);
  };
}

// "¡Jugar!" en la última slide vuelve al inicio y empieza una partida al tiro.
let pendingStart = false;
export const requestStart = () => {
  pendingStart = true;
};
export const consumeStartRequest = () => {
  const p = pendingStart;
  pendingStart = false;
  return p;
};
