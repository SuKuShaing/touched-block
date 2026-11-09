export interface GoogleButtonOptions {
  /** Ancho del botón en px (Google acepta entre 200 y 400). */
  width: number;
  text?: 'signin_with' | 'continue_with' | 'signup_with';
}

/** Login con proveedores externos (web: Google Identity Services; nativo: fase app). */
export interface Auth {
  /** Si el botón oficial de Google se puede mostrar en esta plataforma. */
  googleAvailable: boolean;
  /** Sign in with Apple (solo en la app iOS, más adelante). */
  appleAvailable: boolean;
  /**
   * Dibuja el botón oficial de Google dentro de `host` (en web, el elemento DOM de un View).
   * `onCredential` recibe el idToken. Devuelve una función que lo quita.
   */
  renderGoogleButton(
    host: unknown,
    opts: GoogleButtonOptions,
    onCredential: (idToken: string) => void,
    onError: (message: string) => void,
  ): () => void;
}
