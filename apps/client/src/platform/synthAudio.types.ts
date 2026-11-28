/** Los contextos de audio que necesitan los sonidos sintetizados (`game/synth/`). Nada lanza. */
export interface SynthAudio {
  /**
   * El contexto en el que suena el juego (el mismo de `fx.beep`); null si el sonido está apagado
   * en los ajustes o, en la web, si todavía no nació en un gesto.
   */
  live(): BaseAudioContext | null;
  /** Contexto mono para renderizar `length` muestras; null si la plataforma no puede. */
  offline(length: number, sampleRate: number): OfflineAudioContext | null;
  /** Suelta un contexto de `offline` que ya terminó. */
  release(ctx: OfflineAudioContext): void;
}
