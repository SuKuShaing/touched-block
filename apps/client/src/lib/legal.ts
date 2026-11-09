import { Linking, Platform } from 'react-native';
import { config } from '@/config';

/**
 * Páginas legales: HTML estático en `public/<página>/index.html` (no son rutas de Expo Router,
 * para que se lean sin JavaScript). Se abren con navegación completa, fuera de la app.
 */
export type LegalPage = 'politica-de-privacidad' | 'condiciones-del-servicio';

export function legalUrl(page: LegalPage): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // EXPO_BASE_URL lo incrusta Expo con experiments.baseUrl ("/touched-block"), también en
    // desarrollo; pero el servidor de desarrollo sirve public/ en la raíz, así que ahí se omite.
    const base = __DEV__ ? '' : (process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '');
    // Con barra final: Pages (y el servidor de desarrollo) redirigen `/x` a `/x/` con un 301.
    return `${window.location.origin}${base}/${page}/`;
  }
  return `${config.siteUrl}${page}/`;
}

export function openLegal(page: LegalPage) {
  const url = legalUrl(page);
  try {
    if (Platform.OS === 'web') window.location.assign(url);
    else void Linking.openURL(url).catch(() => {});
  } catch {}
}
