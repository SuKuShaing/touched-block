export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface Fx {
  /** Pitido corto (frecuencia Hz, duración s, forma de onda, volumen). No suena si el sonido está apagado en los ajustes. */
  beep(freq: number, dur: number, type?: Wave, vol?: number): void;
  /** Vibración (ms). No vibra si la vibración está apagada en los ajustes. */
  buzz(ms: number): void;
}
