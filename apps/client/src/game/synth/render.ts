import type { SoundName } from '@/game/sounds';
import type { SynthAudio } from '@/platform/synthAudio.types';
import { derivedNotes, type DerivedSound } from './events';
import { LEAD, durationOf, type Note } from './notes';
import { SYNTH_PACKS, type SynthPackId } from './packs';
import { clearStrings, createMotor, limiterCurve, scheduleNotes, type Motor } from './voices';

/**
 * Método híbrido (decisión del 26 nov 2026): cada sonido del paquete elegido se renderiza UNA vez
 * a un `AudioBuffer` (con las voces de `voices.ts` en un `OfflineAudioContext` mono) y después se
 * reutiliza desde memoria. Si un búfer aún no está listo, o el render falla, ese sonido se
 * sintetiza en vivo con la misma voz. En memoria hay un solo paquete (≈ 0,5 a 1,5 MB).
 *
 * En vivo todo pasa por un bus permanente (ganancia → limitador → salida), con 12 voces como tope.
 * El limitador no se incluye en el render para no aplicarlo dos veces.
 */
export const MAX_VOICES = 12;
/** Pausa entre un render y el siguiente, para no trabar la interfaz. */
const PAUSE_MS = 16;
/** Un render que no responde se da por perdido (se sigue en vivo). */
const TIMEOUT_MS = 8000;
/** Muestras por bloque de la Web Audio API. */
const QUANTUM = 128;
/** Tras estos renders fallidos seguidos no se reintenta hasta reiniciar: todo en vivo. */
export const MAX_FAILURES = 2;

export type EventKey = `hit${number}` | 'kill' | `combo${1 | 2 | 3}` | DerivedSound;

/** Los 24 búferes de un paquete, en el orden en que se renderizan (primero lo más usado). */
export const EVENT_KEYS: readonly EventKey[] = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0].map((n): EventKey => `hit${n}`),
  'kill',
  'combo1',
  'combo2',
  'combo3',
  'expire',
  'miss',
  'trap',
  'heal',
  'milestone',
  'end',
  'start',
];

/** Notas de un sonido (`arg`: toques dados en `hit`, segundos de premio en `combo`). */
export function notesFor(id: SynthPackId, name: SoundName, arg = 0): Note[] {
  const pack = SYNTH_PACKS[id];
  if (name === 'hit') return pack.hit(arg);
  if (name === 'kill') return pack.kill();
  if (name === 'combo') return pack.combo(arg);
  return derivedNotes(id, name);
}

/** Búfer que corresponde a un sonido; null si no tiene (se sintetiza en vivo). */
export function keyFor(name: SoundName, arg = 0): EventKey | null {
  if (name === 'hit') return `hit${Math.min(Math.max(0, arg | 0), 12)}`;
  if (name === 'kill') return 'kill';
  if (name === 'combo') {
    const b = arg | 0;
    return b >= 3 ? 'combo3' : b === 2 ? 'combo2' : b === 1 ? 'combo1' : null;
  }
  return name;
}

function notesForKey(id: SynthPackId, key: EventKey): Note[] {
  if (key.startsWith('hit')) return notesFor(id, 'hit', Number(key.slice(3)));
  if (key.startsWith('combo')) return notesFor(id, 'combo', Number(key.slice(5)));
  return notesFor(id, key as 'kill' | DerivedSound);
}

/** `startRendering` como promesa (el Safari antiguo solo avisa por `oncomplete`), con límite. */
function startRendering(ctx: OfflineAudioContext, onSettled: () => void): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('render sin respuesta')), TIMEOUT_MS);
    const ok = (b: AudioBuffer) => {
      clearTimeout(timer);
      onSettled();
      resolve(b);
    };
    const fail = (e: unknown) => {
      clearTimeout(timer);
      onSettled();
      reject(e);
    };
    try {
      ctx.oncomplete = (e) => ok(e.renderedBuffer);
      const p = ctx.startRendering() as Promise<AudioBuffer> | undefined;
      if (p && typeof p.then === 'function') p.then(ok, fail);
    } catch (e) {
      fail(e);
    }
  });
}

/** Renderiza un sonido de un paquete. Lanza si la plataforma no puede. */
export async function renderEvent(audio: SynthAudio, id: SynthPackId, key: EventKey, sampleRate: number): Promise<AudioBuffer> {
  const pack = SYNTH_PACKS[id];
  const notes = notesForKey(id, key);
  // en bloques enteros de 128 muestras: así ningún motor procesa un bloque a medias
  const length = Math.ceil(((LEAD + durationOf(notes)) * sampleRate) / QUANTUM) * QUANTUM;
  const ctx = audio.offline(length, sampleRate);
  if (!ctx) throw new Error('sin OfflineAudioContext');
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    audio.release(ctx);
  };
  try {
    scheduleNotes(createMotor(ctx, ctx.destination), pack.voice, pack.level, notes, 0);
  } catch (e) {
    release();
    throw e;
  }
  // se suelta solo cuando el render terminó: uno colgado se deja vivo (soltarlo no es seguro)
  return startRendering(ctx, release);
}

interface LiveVoice {
  g: GainNode;
  end: number;
  source?: AudioBufferSourceNode;
}

interface Bus {
  motor: Motor;
  voices: LiveVoice[];
}

interface Job {
  id: SynthPackId;
  sampleRate: number;
  buffers: Map<EventKey, AudioBuffer>;
  status: 'rendering' | 'done' | 'failed';
}

export interface SynthPlayer {
  /** Deja listo un paquete (suelta el anterior). Vuelve de inmediato; renderiza de a poco. */
  prepare(id: SynthPackId): void;
  /** Suelta los búferes (se eligió un paquete que no se renderiza). */
  drop(): void;
  /** Toca un sonido: el búfer si está listo; si no, en vivo. Nunca lanza. */
  play(id: SynthPackId, name: SoundName, arg?: number): void;
  /** Estado del paquete en memoria (para pruebas y mediciones). */
  state(): { id: SynthPackId; status: Job['status']; ready: number } | null;
  /** Termina cuando no quedan renders pendientes. */
  idle(): Promise<void>;
}

export function createSynthPlayer(audio: SynthAudio): SynthPlayer {
  const buses = new WeakMap<BaseAudioContext, Bus>();
  let job: Job | null = null;
  let queue: Promise<void> = Promise.resolve();
  let failures = 0;

  function busFor(ctx: BaseAudioContext): Bus {
    let bus = buses.get(ctx);
    if (bus) return bus;
    const input = ctx.createGain();
    try {
      const limiter = ctx.createWaveShaper();
      limiter.curve = limiterCurve();
      input.connect(limiter);
      limiter.connect(ctx.destination);
    } catch {
      // sin limitador antes que sin sonido (los volúmenes son bajos)
      input.disconnect();
      input.connect(ctx.destination);
    }
    bus = { motor: createMotor(ctx, input), voices: [] };
    buses.set(ctx, bus);
    return bus;
  }

  /** Suma una voz; si se pasa el tope, la más vieja se apaga con una caída de ~12 ms. */
  function register(bus: Bus, voice: LiveVoice) {
    const now = bus.motor.ctx.currentTime;
    bus.voices = bus.voices.filter((x) => x.end > now);
    bus.voices.push(voice);
    while (bus.voices.length > MAX_VOICES) {
      const old = bus.voices.shift()!;
      try {
        old.g.gain.cancelScheduledValues(now);
        old.g.gain.setTargetAtTime(0, now, 0.004);
        old.source?.stop(now + 0.05);
      } catch {}
    }
  }

  function playBuffer(bus: Bus, buffer: AudioBuffer) {
    const ctx = bus.motor.ctx;
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const g = ctx.createGain();
    source.connect(g);
    g.connect(bus.motor.out);
    source.start(t);
    register(bus, { g, end: t + buffer.duration, source });
  }

  async function run(current: Job) {
    for (const key of EVENT_KEYS) {
      await new Promise<void>((r) => setTimeout(r, PAUSE_MS));
      if (job !== current) return; // ya se eligió otro paquete
      try {
        const buffer = await renderEvent(audio, current.id, key, current.sampleRate);
        if (job !== current) return; // llegó tarde: se descarta
        current.buffers.set(key, buffer);
      } catch {
        if (job !== current) return;
        current.status = 'failed';
        failures++;
        clearStrings();
        return;
      }
    }
    current.status = 'done';
    failures = 0;
    clearStrings();
  }

  function drop() {
    job = null;
    clearStrings();
  }

  return {
    prepare(id) {
      try {
        if (job && job.id === id && job.status !== 'failed') return;
        if (job && job.id !== id) drop();
        if (failures >= MAX_FAILURES) return;
        const live = audio.live();
        if (!live) return;
        const next: Job = { id, sampleRate: live.sampleRate, buffers: new Map(), status: 'rendering' };
        job = next;
        // en fila: nunca dos renders a la vez
        queue = queue.then(() => run(next)).catch(() => {});
      } catch {}
    },
    drop,
    play(id, name, arg = 0) {
      try {
        const ctx = audio.live();
        if (!ctx) return;
        const bus = busFor(ctx);
        const key = keyFor(name, arg);
        const buffer = key && job?.id === id ? job.buffers.get(key) : undefined;
        if (buffer) {
          try {
            playBuffer(bus, buffer);
            return;
          } catch {}
        }
        const pack = SYNTH_PACKS[id];
        scheduleNotes(bus.motor, pack.voice, pack.level, notesFor(id, name, arg), ctx.currentTime, (v) => register(bus, v));
      } catch {}
    },
    state: () => (job ? { id: job.id, status: job.status, ready: job.buffers.size } : null),
    idle: () => queue,
  };
}
