/**
 * Pausa tras terminar una partida en la que los botones que empiezan otra ("Jugar de nuevo",
 * "Probar ahora", "Retar a un amigo", "Revancha") no responden. Quien está tocando bloques rápido
 * cuando la partida termina podría pulsarlos sin querer y saltarse la pantalla final. El botón
 * sigue visible y sin cambios: solo se ignora la pulsación.
 */
export const END_TAP_GUARD_MS = 450;

/** ¿Ya se puede empezar otra partida desde la pantalla final? `endedAt` null = no terminó ninguna. */
export function endTapReady(endedAt: number | null, now: number, guardMs = END_TAP_GUARD_MS): boolean {
  if (endedAt === null || !Number.isFinite(endedAt)) return true;
  // reloj que retrocede (cambio de hora del sistema): no se bloquea para siempre
  if (now < endedAt) return true;
  return now - endedAt >= guardMs;
}
