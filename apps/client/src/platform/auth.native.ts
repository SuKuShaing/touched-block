import type { Auth } from './auth.types';

// Fase app: @react-native-google-signin/google-signin + expo-apple-authentication
// (POST /auth/google con el idToken nativo y POST /auth/apple). Por ahora no hay login en nativo.
export const auth: Auth = {
  googleAvailable: false,
  appleAvailable: false,
  renderGoogleButton: (_host, _opts, _onCredential, onError) => {
    onError('El inicio de sesión todavía no está disponible en la app.');
    return () => {};
  },
};
