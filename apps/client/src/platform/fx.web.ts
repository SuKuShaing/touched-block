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
//
// Además, en iOS el contexto puede quedar mudo al volver de segundo plano (pantalla bloqueada,
// otra app, llamada, Siri, música): o queda "interrupted"/"suspended", o dice "running" pero su
// reloj no avanza. Por eso, al volver (visibilitychange, pageshow, focus, statechange), el
// siguiente gesto lo reanuda y comprueba que el reloj avance; si no, el gesto siguiente lo cierra
// y crea uno nuevo (un AudioContext solo puede nacer dentro de un gesto).
type Ctx = AudioContext & { state: AudioContextState | 'interrupted' };
let ac: Ctx | null = null;
/** Volvimos de segundo plano o el contexto cambió de estado: revisar en el próximo gesto. */
let check = false;
/** El contexto no revivió con resume(): el próximo gesto lo recrea. */
let broken = false;

function create(): Ctx {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = (w.AudioContext || w.webkitAudioContext) as typeof AudioContext;
  let c: Ctx;
  try {
    c = new Ctor({ latencyHint: 'interactive' }) as Ctx;
  } catch {
    c = new Ctor() as Ctx; // Safari antiguo: sin opciones
  }
  try {
    c.addEventListener('statechange', () => {
      if (c === ac && c.state !== 'running') check = true;
    });
  } catch {}
  return c;
}

function context(): Ctx {
  if (!ac || (ac.state as string) === 'closed') ac = create();
  return ac;
}

/** Búfer de 1 muestra en silencio: el desbloqueo de iOS, que exige empezar algo dentro del gesto. */
function silentTick(c: Ctx) {
  const src = c.createBufferSource();
  src.buffer = c.createBuffer(1, 1, c.sampleRate);
  src.connect(c.destination);
  src.start(0);
}

/**
 * Gesto que activa la página: crea, reanuda o (si quedó inservible) recrea el contexto, y después
 * comprueba que de verdad esté corriendo.
 */
function onGesture() {
  try {
    if (!getSettings().sound) return;
    if (broken && ac) {
      broken = false;
      const old = ac;
      ac = null;
      old.close().catch(() => {});
    }
    const c = context();
    if (c.state === 'running' && !check) return;
    check = false;
    if (c.state !== 'running') c.resume().catch(() => {});
    silentTick(c);
    const t0 = c.currentTime;
    setTimeout(() => {
      try {
        // sigue sin correr, o "corre" con el reloj detenido: recrearlo en el próximo gesto
        if (c === ac && (c.state !== 'running' || c.currentTime === t0)) broken = true;
      } catch {}
    }, 300);
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
    const back = () => {
      check = true;
    };
    document.addEventListener('visibilitychange', back);
    window.addEventListener('pageshow', back); // vuelta desde el historial (bfcache)
    window.addEventListener('focus', back);
    // iOS (Safari 16.4+): categoría "ambient" (respeta el modo silencio y no corta la música), como
    // en la app. Decisión del usuario (19 nov 2026): se respeta el silencio.
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'ambient';
  }
} catch {}

/**
 * El contexto en el que se puede sonar ahora (también para `synthAudio.web.ts`); null con el sonido
 * apagado o mientras no haya nacido en un gesto.
 */
export function liveContext(): AudioContext | null {
  if (!getSettings().sound) return null;
  // El contexto solo se crea dentro de un gesto (onGesture): uno nacido aquí (pointerdown,
  // requestAnimationFrame, un efecto) queda "suspended" para siempre en iOS. Hasta el primer
  // gesto no suena nada; después de él, siempre hay contexto.
  const c = ac;
  if (!c || broken) return null;
  if (c.state !== 'running') {
    check = true;
    c.resume().catch(() => {});
  }
  return c;
}

export const fx: Fx = {
  beep(f: number, d: number, type: Wave = 'square', v = 0.05) {
    try {
      const c = liveContext();
      if (!c) return;
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
