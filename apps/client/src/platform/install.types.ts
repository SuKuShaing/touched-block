/**
 * Cómo se puede instalar la web en este dispositivo:
 * - `prompt`: el navegador ofrece su diálogo de instalación (Chrome/Edge, Android): `beforeinstallprompt`.
 * - `ios`: iPhone/iPad, sin diálogo: se explica "Compartir → Agregar a inicio".
 * - `none`: no se puede, o el navegador todavía no lo ofrece.
 */
export type InstallKind = 'prompt' | 'ios' | 'none';

export interface InstallState {
  /** Ya está instalada: se abrió como app (display-mode: standalone) o se acaba de instalar. */
  installed: boolean;
  kind: InstallKind;
}

export type PromptOutcome = 'accepted' | 'dismissed' | 'unavailable';

export interface Install {
  get(): InstallState;
  subscribe(fn: () => void): () => void;
  /** Abre el diálogo del navegador (solo con `kind: 'prompt'`). Nunca lanza. */
  prompt(): Promise<PromptOutcome>;
}
