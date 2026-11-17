import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { config } from '@/config';

/**
 * Versión de la app de src/lib/legal.ts (Metro elige este archivo en Android/iOS; la web usa
 * legal.ts). Las páginas legales son las publicadas en la web (`config.siteUrl`), abiertas en el
 * navegador integrado (Custom Tabs / SFSafariViewController) para no sacar al jugador de la app.
 */
export type LegalPage = 'politica-de-privacidad' | 'condiciones-del-servicio';

export function legalUrl(page: LegalPage): string {
  return `${config.siteUrl}${page}/`;
}

export function openLegal(page: LegalPage) {
  const url = legalUrl(page);
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
