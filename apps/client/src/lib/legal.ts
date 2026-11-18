import { Linking, Platform } from 'react-native';
import { config } from '@/config';

/**
 * Páginas legales: viven en la landing (`config.landingUrl`, https://touchedblock.app/), en HTML
 * estático. Se abren con navegación completa, fuera de la app. Las direcciones viejas de la web
 * (`/politica-de-privacidad/`, `/condiciones-del-servicio/`) quedan en public/ como redirecciones.
 */
export type LegalPage = 'privacidad' | 'terminos';

export function legalUrl(page: LegalPage): string {
  // Con barra final: así el servidor no responde primero con una redirección.
  return `${config.landingUrl}${page}/`;
}

/** Enlace externo (p. ej. los créditos del Perfil): en la web, en otra pestaña. */
export function openExternal(url: string) {
  try {
    if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
    else void Linking.openURL(url).catch(() => {});
  } catch {}
}

export function openLegal(page: LegalPage) {
  const url = legalUrl(page);
  try {
    if (Platform.OS === 'web') window.location.assign(url);
    else void Linking.openURL(url).catch(() => {});
  } catch {}
}
