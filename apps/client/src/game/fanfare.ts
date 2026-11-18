import { getActiveCosmetics } from '@/cosmetics/active';
import { fx } from '@/platform/fx';
import type { Wave } from '@/platform/fx.types';

/**
 * Fanfarria de victoria de las celebraciones (premio, insignia, logro). Igual que el resto de
 * los sonidos (`sounds.ts`), se genera con `fx.beep`: WebAudio en la web y
 * react-native-audio-api (la misma API) en Android, sin archivos de audio. `fx` respeta los
 * ajustes de sonido y vibración y nunca lanza; aquí además todo va en try/catch.
 *
 * Cuatro notas que suben (sol, do, mi, sol) y un acorde final de do mayor, con el timbre del
 * paquete de sonidos elegido (8 bits, Suave o Marimba). `short` es un "ding" de dos notas para
 * la segunda celebración en adelante de una misma tanda.
 */
type Voice = (f: number, d: number, v: number) => void;

const tone = (type: Wave): Voice => (f, d, v) => fx.beep(f, d, type, v);
/** Golpe de mazo: fundamental + un armónico muy corto (como el paquete Marimba). */
const mallet: Voice = (f, d, v) => {
  fx.beep(f, d, 'sine', v);
  fx.beep(f * 4, 0.05, 'sine', v * 0.35);
};

const VOICES: Record<string, { lead: Voice; vol: number }> = {
  '8bits': { lead: tone('triangle'), vol: 0.08 },
  suave: { lead: tone('sine'), vol: 0.07 },
  marimba: { lead: mallet, vol: 0.08 },
};

/** Notas (Hz) y cuándo suenan (ms). */
export const FANFARE = {
  run: [
    { at: 0, f: 392, d: 0.11 },
    { at: 105, f: 523, d: 0.11 },
    { at: 210, f: 659, d: 0.11 },
    { at: 315, f: 784, d: 0.13 },
  ],
  /** Acorde final (do mayor), un poco después de la última nota. */
  chord: { at: 450, notes: [523, 659, 784, 1047], d: 0.55 },
  short: [
    { at: 0, f: 784, d: 0.1 },
    { at: 95, f: 1047, d: 0.22 },
  ],
} as const;

/** Vibración de la celebración (ms): en Android es la notificación "éxito" de expo-haptics. */
export const FANFARE_BUZZ_MS = 40;

const later = (ms: number, fn: () => void) => {
  if (ms <= 0) return fn();
  setTimeout(() => {
    try {
      fn();
    } catch {}
  }, ms);
};

export function playFanfare(short = false) {
  try {
    const v = VOICES[getActiveCosmetics().soundPack] ?? VOICES['8bits'];
    if (short) {
      for (const n of FANFARE.short) later(n.at, () => v.lead(n.f, n.d, v.vol));
    } else {
      for (const n of FANFARE.run) later(n.at, () => v.lead(n.f, n.d, v.vol));
      // el acorde, más suave por nota para que la suma no sature
      const { at, notes, d } = FANFARE.chord;
      later(at, () => notes.forEach((f) => v.lead(f, d, v.vol * 0.55)));
    }
  } catch {}
  try {
    fx.buzz(FANFARE_BUZZ_MS);
  } catch {}
}
