import type { Install, InstallState, PromptOutcome } from './install.types';

// Web instalable (sin service worker): Chrome/Edge disparan `beforeinstallprompt`, que se guarda
// para abrir el diálogo cuando el jugador toque "Instalar" (y así no aparece la barra del
// navegador en la primera visita). iOS no tiene ese evento: se muestran las instrucciones.

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Lo que guardó el script de public/index.html antes de que cargara la app. */
type EarlyWindow = Window & { __tbInstallPrompt?: BeforeInstallPromptEvent | null; __tbInstalled?: boolean };
const early = (): EarlyWindow | null => (typeof window === 'undefined' ? null : (window as EarlyWindow));

let deferred: BeforeInstallPromptEvent | null = early()?.__tbInstallPrompt ?? null;
let justInstalled = early()?.__tbInstalled === true;
const listeners = new Set<() => void>();

function isStandalone(): boolean {
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    return (navigator as Navigator & { standalone?: boolean }).standalone === true;
  } catch {
    return false;
  }
}

function isIos(): boolean {
  try {
    const ua = navigator.userAgent || '';
    // iPadOS se presenta como Mac, pero con pantalla táctil
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch {
    return false;
  }
}

function detect(): InstallState {
  return { installed: justInstalled || isStandalone(), kind: deferred ? 'prompt' : isIos() ? 'ios' : 'none' };
}

let state: InstallState = typeof window === 'undefined' ? { installed: false, kind: 'none' } : detect();

function update() {
  const next = detect();
  if (next.installed === state.installed && next.kind === state.kind) return;
  state = next;
  for (const l of listeners) {
    try {
      l();
    } catch {}
  }
}

if (typeof window !== 'undefined') {
  try {
    // (el script de index.html también escucha estos eventos; aquí se actualiza el estado)
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e as BeforeInstallPromptEvent;
      update();
    });
    window.addEventListener('appinstalled', () => {
      deferred = null;
      justInstalled = true;
      update();
    });
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', update);
  } catch {
    // navegador sin estas APIs: no se ofrece instalar
  }
}

export const install: Install = {
  get: () => state,
  subscribe(fn) {
    listeners.add(fn);
    return () => void listeners.delete(fn);
  },
  async prompt(): Promise<PromptOutcome> {
    const e = deferred;
    if (!e) return 'unavailable';
    // el evento sirve una sola vez; si lo rechaza, el navegador puede volver a dispararlo más adelante
    deferred = null;
    const w = early();
    if (w) w.__tbInstallPrompt = null;
    try {
      await e.prompt();
      const choice = await e.userChoice;
      if (choice.outcome === 'accepted') justInstalled = true;
      return choice.outcome;
    } catch {
      return 'unavailable';
    } finally {
      update();
    }
  },
};
