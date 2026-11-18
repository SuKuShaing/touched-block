import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { config } from '@/config';

/**
 * Versión de la app de src/lib/legal.ts (Metro elige este archivo en Android/iOS; la web usa
 * legal.ts). Las páginas legales son las de la landing (`config.landingUrl`), abiertas en el
 * navegador integrado (Custom Tabs / SFSafariViewController) para no sacar al jugador de la app.
 */
export type LegalPage = 'privacidad' | 'terminos';

export function legalUrl(page: LegalPage): string {
  return `${config.landingUrl}${page}/`;
}

export function openLegal(page: LegalPage) {
  openExternal(legalUrl(page));
}

/** Enlace externo (p. ej. los créditos del Perfil), en el navegador integrado. */
export function openExternal(url: string) {
  try {
    WebBrowser.openBrowserAsync(url).catch(() => {
      // sin navegador integrado: el navegador del sistema
      Linking.openURL(url).catch(() => {});
    });
  } catch {
    try {
      Linking.openURL(url).catch(() => {});
    } catch {}
  }
}
