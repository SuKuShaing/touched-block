export type Wave = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface Fx {
  /** Pitido corto (frecuencia Hz, duración s, forma de onda, volumen). */
  beep(freq: number, dur: number, type?: Wave, vol?: number): void;
  /** Vibración (ms). */
  buzz(ms: number): void;
}
