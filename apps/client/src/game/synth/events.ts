import type { Note } from './notes';
import { SYNTH_PACKS, type SynthPackId } from './packs';

/**
 * Los 7 sonidos que la maqueta no definió, derivados de la escala de cada paquete (decisión B12 de
 * `config_logros/PLAN_IMPLEMENTACION.md`). Para redefinirlos basta cambiar este archivo.
 *
 * `trap`, `miss` y `expire` nunca suben (ni entre notas ni dentro de una nota): no deben sonar a
 * premio. La trampa es la más fuerte.
 */
export type DerivedSound = 'start' | 'trap' | 'heal' | 'expire' | 'miss' | 'end' | 'milestone';

export const DERIVED_SOUNDS: readonly DerivedSound[] = ['start', 'trap', 'heal', 'expire', 'miss', 'end', 'milestone'];

/** Volumen relativo de cada uno. */
const VOLUME: Record<DerivedSound, number> = {
  start: 1,
  trap: 1.4,
  heal: 0.9,
  expire: 0.45,
  miss: 0.9,
  end: 0.95,
  milestone: 0.9,
};

/** Melodía de cada uno; `e(i)` es la nota i de la escala del paquete. */
function melody(name: DerivedSound, e: (i: number) => number): Note[] {
  const v = VOLUME[name];
  const seq = (steps: number[], gap: number, d: number, lastD = d): Note[] =>
    steps.map((s, i) => ({ dt: i * gap, f: e(s), d: i === steps.length - 1 ? lastD : d, v }));
  switch (name) {
    case 'start':
      return [{ dt: 0, f: e(5), d: 0.12, v }];
    case 'heal':
      return seq([7, 9, 11], 0.07, 0.16);
    case 'milestone':
      return seq([5, 7, 8, 10], 0.09, 0.16, 0.24);
    case 'end':
      return seq([7, 5, 3, 0], 0.15, 0.28, 0.6);
    case 'trap':
      // dos notas casi a un semitono: disonante
      return [
        { dt: 0, f: e(0) / 2, d: 0.45, v },
        { dt: 0.09, f: (e(0) / 2) * 0.944, d: 0.45, v },
      ];
    case 'miss':
      return [{ dt: 0, f: e(0) * 0.63, d: 0.25, v }];
    case 'expire':
      return [{ dt: 0, f: e(1) * 0.75, d: 0.15, v }];
  }
}

const isError = (name: DerivedSound) => name === 'trap' || name === 'miss' || name === 'expire';

/** Ajustes del timbre de cada paquete a una nota derivada. */
const TIMBRE: Record<SynthPackId, (name: DerivedSound, n: Note) => Partial<Note>> = {
  // errores: filtro menos abierto, más opacos
  electronico: (name) => (isError(name) ? { brillo: 5 } : {}),
  // la voz sube por defecto: en los errores se desliza hacia abajo y al final va derecha
  futurista: (name, n) => (isError(name) ? { f0: n.f * 1.3, glis: 0.08 } : name === 'end' ? { f0: n.f } : {}),
  piano: () => ({}),
  // cuerdas al aire para lo largo; palma para lo corto (la cuerda con palma dura 0,3 s)
  guitarra: (name) => (name === 'trap' ? { drive: 6 } : name === 'end' ? {} : { mute: true }),
  // dos palitos a la vez en lo fuerte
  palitos: (name) => (name === 'trap' || name === 'start' ? { flam: true } : {}),
  // en los errores el "scoop" inicial va hacia abajo
  viento: (name, n) => (isError(name) ? { f0: n.f * 1.03, ataque: 0.02 } : { ataque: 0.014 }),
};

export function derivedNotes(id: SynthPackId, name: DerivedSound): Note[] {
  const { scale } = SYNTH_PACKS[id];
  return melody(name, (i) => scale[i]).map((n) => ({ ...n, ...TIMBRE[id](name, n) }));
}
