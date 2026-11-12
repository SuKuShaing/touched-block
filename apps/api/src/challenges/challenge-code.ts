import { randomInt } from 'node:crypto';

/** Letras y números sin los que se confunden al leerlos o dictarlos (I, L, O, 0 y 1). */
export const CHALLENGE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CHALLENGE_CODE_LENGTH = 8;
/** Días que dura un reto desde que se crea. */
export const CHALLENGE_TTL_DAYS = 30;

const CODE_RE = new RegExp(`^[${CHALLENGE_CODE_ALPHABET}]{${CHALLENGE_CODE_LENGTH}}$`);

/** Código aleatorio de 8 caracteres (31^8 ≈ 8,5 × 10^11 combinaciones). */
export function newChallengeCode(): string {
  let s = '';
  for (let i = 0; i < CHALLENGE_CODE_LENGTH; i++) s += CHALLENGE_CODE_ALPHABET[randomInt(CHALLENGE_CODE_ALPHABET.length)];
  return s;
}

/** Normaliza lo que manda el cliente (espacios, minúsculas). Devuelve null si no tiene la forma de un código. */
export function normalizeChallengeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}
