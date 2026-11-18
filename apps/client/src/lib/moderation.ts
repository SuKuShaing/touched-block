import type { ReportReason } from '@/api/types';

/**
 * Reportar y bloquear jugadores (guía 1.2 de Apple). El menú no se ve por defecto: aparece al
 * pasar el mouse (botón "⋯") o con un toque sostenido sobre el nombre.
 */

/** Toque sostenido para abrir el menú de un jugador (también en la web táctil). */
export const LONG_PRESS_MS = 500;

/** Plazo en que se revisa un reporte (debe coincidir con la API y los términos). */
export const REPORT_REVIEW_HOURS = 24;

/** Largo máximo del texto opcional de un reporte (como la API). */
export const REPORT_DETAILS_MAX = 200;

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'offensive_name', label: 'Nombre ofensivo' },
  { value: 'impersonation', label: 'Se hace pasar por otra persona o por Touched Block' },
  { value: 'other', label: 'Otro motivo' },
];

/**
 * La API todavía no tiene la ruta (404 de ruta desconocida, no "ese usuario no existe"): la web
 * se publica antes que la API. El menú normalmente ni se muestra (useApiFeatures), esto es por si acaso.
 */
export function moderationUnavailable(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { status, code } = e as { status?: unknown; code?: unknown };
  return status === 404 && code !== 'user_not_found';
}

export const MODERATION_SOON = 'Disponible pronto.';
