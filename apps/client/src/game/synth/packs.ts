import type { SoundId } from '@/cosmetics/ids';
import { SCALES, comboCount, noteAt, type Note } from './notes';
import { electroVoice, futureVoice, guitarVoice, pianoVoice, sticksVoice, windVoice, type VoiceFn } from './voices';

/**
 * Los 6 paquetes sintetizados: toque (`n` = toques dados, la altura sube con tope en 12), destruir
 * y combo (`bonus` = segundos de premio). Las notas y los volúmenes son los de
 * `config_logros/sonidos.js` (un test lo comprueba). Los otros 7 sonidos están en `events.ts`.
 */
export type SynthPackId = Exclude<SoundId, '8bits' | 'suave' | 'marimba'>;

export interface SynthPack {
  voice: VoiceFn;
  /** Volumen del paquete: la única constante a tocar para subirlo o bajarlo. */
  level: number;
  /** 13 notas; de aquí salen también los sonidos de `events.ts`. */
  scale: readonly number[];
  hit(n: number): Note[];
  kill(): Note[];
  combo(bonus: number): Note[];
}

export const SYNTH_PACKS: Record<SynthPackId, SynthPack> = {
  electronico: {
    voice: electroVoice,
    level: 0.045,
    scale: SCALES.electronico,
    hit: (n) => [{ dt: 0, f: noteAt(SCALES.electronico, n), d: 0.16, v: 1 }],
    kill: () => [
      { dt: 0, f: 440, d: 0.2, v: 1 },
      { dt: 0.05, f: 659, d: 0.2, v: 0.9 },
      { dt: 0.1, f: 880, d: 0.34, v: 0.9, brillo: 14 },
    ],
    combo: (b) =>
      [440, 523, 659, 784, 1047].slice(0, comboCount(b)).map((f, i) => ({ dt: i * 0.065, f, d: 0.1, v: 0.8 })),
  },
  futurista: {
    voice: futureVoice,
    level: 0.047,
    scale: SCALES.futurista,
    hit: (n) => {
      const f = noteAt(SCALES.futurista, n);
      return [
        { dt: 0, f, d: 0.13, v: 1 },
        { dt: 0.075, f, f0: f, d: 0.11, v: 0.26 },
      ];
    },
    kill: () => [
      { dt: 0, f: 1480, f0: 330, glis: 0.22, d: 0.34, v: 1, soplo: true, indice: 1.8 },
      { dt: 0.1, f: 1480, f0: 1480, d: 0.2, v: 0.3 },
      { dt: 0.2, f: 1480, f0: 1480, d: 0.2, v: 0.16 },
    ],
    combo: (b) =>
      [659, 740, 831, 932, 1047].slice(0, comboCount(b)).flatMap((f, i) => [
        { dt: i * 0.07, f, d: 0.1, v: 0.9 },
        { dt: i * 0.07 + 0.06, f, f0: f, d: 0.08, v: 0.2 },
      ]),
  },
  piano: {
    voice: pianoVoice,
    level: 0.028,
    scale: SCALES.piano,
    hit: (n) => [{ dt: 0, f: noteAt(SCALES.piano, n), d: 0.24, v: 1 }],
    kill: () => [
      { dt: 0, f: 523, d: 0.5, v: 0.85 },
      { dt: 0.035, f: 659, d: 0.5, v: 0.8 },
      { dt: 0.07, f: 784, d: 0.5, v: 0.8 },
      { dt: 0.105, f: 1047, d: 0.5, v: 0.75 },
    ],
    combo: (b) =>
      [659, 784, 880, 1047, 1319].slice(0, comboCount(b)).map((f, i) => ({ dt: i * 0.065, f, d: 0.16, v: 0.85 })),
  },
  guitarra: {
    voice: guitarVoice,
    level: 0.037,
    scale: SCALES.guitarra,
    // toque: nota con la palma; destruir: acorde de potencia rasgueado, abierto
    hit: (n) => [{ dt: 0, f: noteAt(SCALES.guitarra, n), mute: true, d: 0.18, v: 1 }],
    kill: () => [
      { dt: 0, f: 196, d: 0.55, v: 0.8 },
      { dt: 0.014, f: 294, d: 0.55, v: 0.8 },
      { dt: 0.028, f: 392, d: 0.55, v: 0.8 },
    ],
    combo: (b) =>
      [330, 392, 440, 523, 659].slice(0, comboCount(b)).map((f, i) => ({ dt: i * 0.07, f, mute: true, d: 0.14, v: 0.9 })),
  },
  palitos: {
    voice: sticksVoice,
    level: 0.058,
    scale: SCALES.palitos,
    hit: (n) => [{ dt: 0, f: noteAt(SCALES.palitos, n), d: 0.09, v: 1, flam: true }],
    kill: () => [
      { dt: 0, f: 2300, d: 0.1, v: 1, flam: true },
      { dt: 0.06, f: 2900, d: 0.14, v: 1, flam: true },
      { dt: 0.12, f: 3300, d: 0.2, v: 0.8 },
    ],
    combo: (b) =>
      [2200, 2420, 2640, 2860, 3080].slice(0, comboCount(b)).map((f, i) => ({ dt: i * 0.055, f, d: 0.07, v: 0.9 })),
  },
  viento: {
    voice: windVoice,
    level: 0.0275,
    scale: SCALES.viento,
    hit: (n) => [{ dt: 0, f: noteAt(SCALES.viento, n), d: 0.18, v: 1 }],
    kill: () => [
      { dt: 0, f: 784, d: 0.26, v: 0.9, ataque: 0.02 },
      { dt: 0.09, f: 1175, d: 0.42, v: 1, ataque: 0.03 },
    ],
    combo: (b) =>
      [784, 880, 988, 1175, 1319].slice(0, comboCount(b)).map((f, i) => ({ dt: i * 0.07, f, d: 0.12, v: 0.9, ataque: 0.012 })),
  },
};

export function isSynthPack(id: string | null | undefined): id is SynthPackId {
  return !!id && Object.prototype.hasOwnProperty.call(SYNTH_PACKS, id);
}
