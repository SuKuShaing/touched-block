import { randomInt } from 'node:crypto';

/** Reglas del nombre de usuario: 3–20 caracteres de [a-z0-9_.], sin punto al inicio/fin ni dos puntos seguidos. */
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const USERNAME_RE = /^[a-z0-9_.]{3,20}$/;

const RESERVED = new Set([
  'admin',
  'administrador',
  'api',
  'root',
  'me',
  'yo',
  'soporte',
  'support',
  'sistema',
  'system',
  'moderador',
  'invitado',
  'guest',
  'null',
  'undefined',
  'touchedblock',
  'touched_block',
  'touched.block',
]);

/** Quita espacios y una @ inicial, y pasa a minúsculas. */
export function normalizeUsername(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/^@/, '').toLowerCase();
}

/**
 * Clave de búsqueda: sin tildes, en minúsculas y solo con letras y números (sin espacios,
 * puntos ni guiones bajos). Así "Sebastián S" encuentra a "sebastian.sanhueza".
 */
export function searchKey(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Devuelve el problema (en español) de un nombre ya normalizado, o null si es válido. */
export function usernameProblem(u: string): string | null {
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) {
    return `Debe tener entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres.`;
  }
  if (!USERNAME_RE.test(u)) return 'Solo puede tener letras minúsculas sin tilde, números, punto (.) y guion bajo (_).';
  if (u.startsWith('.') || u.endsWith('.') || u.includes('..')) {
    return 'No puede empezar ni terminar con punto, ni tener dos puntos seguidos.';
  }
  if (RESERVED.has(u)) return 'Ese nombre de usuario no está permitido.';
  return null;
}

function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[\s\-]+/g, '.')
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._]+|[._]+$/g, '');
}

const trimEnd = (s: string, max: number) => s.slice(0, max).replace(/[.]+$/, '');

/**
 * Base para generar un nombre de usuario a partir del nombre del proveedor
 * (p. ej. "Sebastián Sanhueza" → "sebastian.sanhueza"); si no sirve, usa el correo y si no, "jugador".
 */
export function usernameBase(name?: string | null, email?: string | null): string {
  for (const src of [name, email?.split('@')[0]]) {
    if (!src) continue;
    const s = trimEnd(slugify(src), USERNAME_MAX);
    if (s.length >= USERNAME_MIN && !usernameProblem(s)) return s;
  }
  return 'jugador';
}

/** Candidatos en orden: la base y luego la base con dígitos al final (cada vez más dígitos). */
export function usernameCandidates(base: string): string[] {
  const out = new Set<string>();
  if (!usernameProblem(base)) out.add(base);
  const plan: [digits: number, tries: number][] = [
    [2, 6],
    [3, 6],
    [4, 8],
    [6, 10],
  ];
  for (const [digits, tries] of plan) {
    const stem = trimEnd(base, USERNAME_MAX - digits) || 'jugador';
    for (let i = 0; i < tries; i++) {
      const n = String(randomInt(10 ** (digits - 1), 10 ** digits));
      const c = stem + n;
      if (!usernameProblem(c)) out.add(c);
    }
  }
  return [...out];
}
