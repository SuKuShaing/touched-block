/**
 * Visibilidad de la app: en la web, la pestaña (`visibilitychange`); en nativo, AppState
 * ('background'/'inactive' = oculta, 'active' = visible).
 */
export interface Lifecycle {
  /** Llama a `cb(visible)` cada vez que la app se oculta o vuelve a verse. Nunca lanza. Devuelve la función para dejar de escuchar. */
  onVisibility(cb: (visible: boolean) => void): () => void;
}
