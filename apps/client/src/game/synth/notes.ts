/**
 * Notas y escalas de los paquetes de sonido sintetizados (CAMBIO-024). Todo puro: aquí no se
 * toca ningún `AudioContext`. Portado de `config_logros/sonidos.js`.
 */

/** Una nota: cuándo suena (s desde el golpe), qué tan aguda, cuánto dura y con qué fuerza. */
export interface Note {
  dt: number;
  /** Frecuencia (Hz). */
  f: number;
  /** Duración (s). */
  d: number;
  /** Volumen relativo; al programarla se multiplica por el `level` del paquete. */
  v: number;
  /** Guitarra: palma sobre las cuerdas (se apaga rápido y suena opaca). */
  mute?: boolean;
  /** Guitarra: ganancia antes de la saturación. */
  drive?: number;
  /** Palitos: dos golpes que casi chocan a la vez. */
  flam?: boolean;
  /** Viento: segundos hasta el volumen máximo. */
  ataque?: number;
  /** Electrónico: cuánto abre el filtro (múltiplo de la frecuencia). */
  brillo?: number;
  /** Viento y Futurista: frecuencia desde la que se desliza hasta `f`. */
  f0?: number;
  /** Futurista: duración (s) del deslizamiento. */
  glis?: number;
  /** Futurista: suma un barrido de ruido. */
  soplo?: boolean;
  /** Futurista: índice de la modulación FM. */
  indice?: number;
}

/** Margen (s) entre el instante en que se pide un sonido y su primera nota. */
export const LEAD = 0.005;

/** Escalas de 13 notas (toques 0 a 12). */
export const SCALES = {
  /** La de la Marimba: do mayor pentatónica. */
  piano: [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319],
  /** Una octava abajo. */
  guitarra: [131, 147, 165, 196, 220, 262, 294, 330, 392, 440, 523, 587, 659],
  /** Sol mayor pentatónica, registro de flauta. */
  viento: [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319, 1568, 1760, 1976],
  /** La menor pentatónica. */
  electronico: [220, 262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175],
  /** Tonos enteros. */
  futurista: [330, 370, 415, 466, 523, 587, 659, 740, 831, 932, 1047, 1175, 1319],
  /** Los palitos no tienen escala musical: suben de a 110 Hz. */
  palitos: [1500, 1610, 1720, 1830, 1940, 2050, 2160, 2270, 2380, 2490, 2600, 2710, 2820],
} as const;

/** `n` toques dados → nota de la escala (tope en la última). */
export function noteAt(scale: readonly number[], n: number): number {
  return scale[Math.min(Math.max(0, n | 0), scale.length - 1)];
}

/** Cuántas notas tiene un combo según los segundos de premio (2 a 5), como los paquetes en vivo. */
export function comboCount(bonus: number): number {
  return Math.min(5, Math.max(0, bonus | 0) + 2);
}

/** Duración (s) de una jugada: del golpe al final de la última nota. */
export function durationOf(notes: readonly Note[]): number {
  return Math.max(...notes.map((n) => n.dt + n.d + 0.02));
}
