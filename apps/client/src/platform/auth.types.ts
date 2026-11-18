export interface GoogleButtonOptions {
  /** Ancho del botón en px (Google acepta entre 200 y 400). */
  width: number;
  text?: 'signin_with' | 'continue_with' | 'signup_with';
}

/**
 * Resultado de Sign in with Apple. identityToken null sin error = el usuario lo canceló.
 * authorizationCode: código de un solo uso (5 min) que la API canjea por el refresh token de Apple
 * para poder revocarlo al eliminar la cuenta. fullName: Apple solo lo entrega la primera vez (iOS:
 * credential.fullName; web: el objeto `user` de la respuesta).
 */
export interface AppleSignInResult {
  identityToken: string | null;
  authorizationCode?: string | null;
  fullName?: string | null;
  /** Solo web: el redirectURI de la autorización (la API lo necesita para canjear el código). */
  redirectUri?: string | null;
  error?: string;
}

/** Login con proveedores externos (web: Google Identity Services; nativo: fase app). */
export interface Auth {
  /** Si el botón oficial de Google se puede mostrar en esta plataforma. */
  googleAvailable: boolean;
  /**
   * Sign in with Apple. iOS: cuando el sistema lo confirma (AppleAuthentication.isAvailableAsync).
   * Web: si hay API y Services ID (EXPO_PUBLIC_APPLE_SERVICES_ID). Android: siempre false.
   */
  appleAvailable(): Promise<boolean>;
  /**
   * iOS: abre la hoja de Sign in with Apple. Web: abre la ventana emergente de Sign in with Apple JS
   * (hay que llamarla directo desde el toque, sin esperas antes, o el navegador bloquea la ventana).
   * Pide nombre y correo.
   */
  signInApple?(): Promise<AppleSignInResult>;
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
  /**
   * Solo nativo: abre el selector de cuentas de Google del sistema. idToken null sin error =
   * el usuario lo canceló. En web no existe (se usa renderGoogleButton).
   */
  signInGoogle?(): Promise<{ idToken: string | null; error?: string }>;
  /** Solo nativo: olvida la cuenta de Google elegida (para poder elegir otra al volver a entrar). */
  signOut?(): Promise<void>;
}
