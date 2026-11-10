/**
 * Búsqueda de usuarios: la misma normalización que usa la API en GET /users/search
 * (`searchKey` en apps/api/src/users/username.ts). Mantener ambas iguales.
 */

/** Máximo de resultados que devuelve la API. */
export const SEARCH_LIMIT = 20;

/** Sin tildes, en minúsculas y solo letras y números: "Sebastián S." → "sebastians". */
export function searchKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Dónde calza `key` dentro de `username`, ignorando puntos y guiones bajos (igual que la API).
 * Devuelve [inicio, fin) en el texto original, o null si no calza.
 */
export function matchRange(username: string, key: string): [number, number] | null {
  if (!key) return null;
  let plain = '';
  const pos: number[] = [];
  for (let i = 0; i < username.length; i++) {
    const ch = username[i];
    if (ch === '.' || ch === '_') continue;
    plain += ch;
    pos.push(i);
  }
  const at = plain.indexOf(key);
  if (at < 0) return null;
  return [pos[at], pos[at + key.length - 1] + 1];
}
