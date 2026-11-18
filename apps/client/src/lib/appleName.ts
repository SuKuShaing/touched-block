/**
 * Nombre de Sign in with Apple. Apple lo entrega solo en el PRIMER inicio de sesión (iOS:
 * credential.fullName; web: el objeto `user` de la respuesta) y nunca más. Si ese primer
 * POST /auth/apple falla (p. ej. sin conexión), el nombre se perdería: por eso se guarda en memoria,
 * asociado a la cuenta de Apple (`sub` del identityToken), y el reintento lo vuelve a mandar. Se
 * olvida cuando la API responde bien. La API solo lo usa al crear la cuenta o si quedó sin nombre:
 * nunca reemplaza uno ya guardado.
 */

const MAX = 100;
const pending = new Map<string, string>();

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX) || null;

/** Nombre completo a partir del objeto `user` de Sign in with Apple JS (solo viene la 1.ª vez). */
export function appleWebName(user: { name?: { firstName?: string; lastName?: string } } | null | undefined): string | null {
  return clean([user?.name?.firstName, user?.name?.lastName].filter(Boolean).join(' '));
}

/** `sub` del identityToken (sin verificar: solo para asociar el nombre en memoria). */
export function appleSubject(identityToken: string): string | null {
  try {
    const part = identityToken.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = JSON.parse(globalThis.atob(b64)) as { sub?: unknown };
    return typeof json.sub === 'string' && json.sub ? json.sub : null;
  } catch {
    return null;
  }
}

/**
 * Nombre que hay que mandar en este intento: el que trae Apple ahora (y se recuerda) o, si no trae,
 * el recordado de un intento anterior fallido de la misma cuenta.
 */
export function appleNameForLogin(identityToken: string, fullName: string | null | undefined): string | null {
  const sub = appleSubject(identityToken);
  const name = clean(fullName);
  if (name) {
    if (sub) pending.set(sub, name);
    return name;
  }
  return sub ? (pending.get(sub) ?? null) : null;
}

/** La API ya respondió bien: el nombre quedó guardado (o ya había uno). */
export function forgetAppleName(identityToken: string): void {
  const sub = appleSubject(identityToken);
  if (sub) pending.delete(sub);
}
