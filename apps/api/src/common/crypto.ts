import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Token opaco aleatorio (256 bits, base64url). */
export const randomToken = () => randomBytes(32).toString('base64url');

/** Compara un token con su hash sha256 sin filtrar tiempos. */
export function matchesHash(token: string, hash: string | null | undefined): boolean {
  if (!hash || typeof token !== 'string') return false;
  const a = Buffer.from(sha256(token), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}
