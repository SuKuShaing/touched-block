import { getSettings } from '@/lib/settings';
import type { Fx, Wave } from './fx.types';

// WebAudio + navigator.vibrate, igual que legacy/game.js. Todo en try/catch porque puede
// no estar disponible (Safari antiguo, navegadores sin audio, iOS sin vibración).
// Respetan los ajustes del dispositivo (Perfil → En este dispositivo): sonido y vibración.
//
// Desbloqueo del audio: los navegadores solo dejan arrancar un AudioContext dentro de un gesto
// que "activa" la página (touchend, click, keydown, mousedown; en Chrome, un pointerdown de un
// dedo NO cuenta, y en iOS Safari tampoco touchstart/pointerdown). Los pitidos del juego salen
// del pointerdown del campo (fieldTaps.web.ts) o del requestAnimationFrame, y el inicio de
// partida tras el tutorial sale de un efecto, no de un toque: si el contexto nacía ahí quedaba
// "suspended" (o "interrupted" en iOS al volver de segundo plano) y ningún resume() posterior
// servía, así que el juego quedaba mudo. Por eso cada gesto que activa la página crea o reanuda
// el contexto (y en iOS reproduce un búfer en silencio, el desbloqueo clásico de WebKit).
type Ctx = AudioContext & { state: AudioContextState | 'interrupted' };
let ac: Ctx | null = null;

function context(): Ctx {
  if (!ac) {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = (w.AudioContext || w.webkitAudioContext) as typeof AudioContext;
    try {
      ac = new Ctor({ latencyHint: 'interactive' }) as Ctx;
    } catch {
      ac = new Ctor() as Ctx; // Safari antiguo: sin opciones
    }
  }
  return ac;
}

/**
 * Gesto que activa la página: crea o reanuda el contexto y, mientras no esté sonando, reproduce
 * un búfer de 1 muestra en silencio (el desbloqueo de iOS, que exige empezar algo dentro del gesto).
 */
function onGesture() {
  try {
    if (!getSettings().sound) return;
    const c = context();
    if (c.state === 'running') return;
    c.resume().catch(() => {});
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch {}
}

try {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    // Solo los eventos que activan la página (pointerdown/touchstart de un dedo no sirven). En
    // captura y pasivos: no interfieren con los toques del campo ni con su preventDefault.
    const opts = { capture: true, passive: true } as const;
    for (const t of ['touchend', 'pointerup', 'mousedown', 'click', 'keydown']) {
      window.addEventListener(t, onGesture, opts);
    }
    // iOS: categoría "ambient" (respeta el modo silencio y no corta la música), como en la app.
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  }
} catch {}

export const fx: Fx = {
  beep(f: number, d: number, type: Wave = 'square', v = 0.05) {
    try {
      if (!getSettings().sound) return;
      const c = context();
      if (c.state !== 'running') c.resume().catch(() => {});
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f;
      // El volumen inicial se agenda en el instante actual: con solo `g.gain.value = v`, algunos
      // motores (WebKit) calculan la rampa desde el tiempo 0 del contexto y el pitido sale mudo
      // cuando la página lleva rato abierta. Es la misma curva que en fx.native.ts.
      const t = c.currentTime;
      g.gain.setValueAtTime(v, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + d);
    } catch {}
  },
  buzz(ms: number) {
    try {
      if (!getSettings().haptics) return;
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  },
};
