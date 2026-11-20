import { describe, expect, it } from 'vitest';
import { appleNameForLogin, appleSubject, appleWebName, forgetAppleName } from './appleName';

const b64url = (o: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const token = (sub: string) => `${b64url({ alg: 'RS256' })}.${b64url({ sub, iss: 'https://appleid.apple.com', email: 'á@x.com' })}.firma`;

describe('nombre de Sign in with Apple', () => {
  it('lee el sub del identityToken (base64url) y tolera basura', () => {
    expect(appleSubject(token('001234.abc.0987'))).toBe('001234.abc.0987');
    expect(appleSubject('no-es-jwt')).toBeNull();
    expect(appleSubject('a.@@@.b')).toBeNull();
  });

  it('arma el nombre del objeto user de la web', () => {
    expect(appleWebName({ name: { firstName: ' Ana ', lastName: 'Pérez' } })).toBe('Ana Pérez');
    expect(appleWebName({ name: { firstName: 'Ana' } })).toBe('Ana');
    expect(appleWebName(undefined)).toBeNull();
    expect(appleWebName({ name: {} })).toBeNull();
  });

  it('si el primer login falla, el reintento (sin nombre de Apple) manda el nombre recordado', () => {
    const t = token('sub-reintento');
    expect(appleNameForLogin(t, 'Ana Pérez')).toBe('Ana Pérez');
    // la API falló: el 2.º intento ya no trae nombre de Apple
    expect(appleNameForLogin(t, null)).toBe('Ana Pérez');
    // otra cuenta de Apple no hereda el nombre
    expect(appleNameForLogin(token('otra-cuenta'), null)).toBeNull();
  });

  it('tras un login exitoso se olvida', () => {
    const t = token('sub-ok');
    appleNameForLogin(t, 'Ana');
    forgetAppleName(t);
    expect(appleNameForLogin(t, undefined)).toBeNull();
  });

  it('un nombre en blanco no cuenta y se recorta a 100 caracteres', () => {
    const t = token('sub-blanco');
    expect(appleNameForLogin(t, '   ')).toBeNull();
    expect(appleNameForLogin(t, 'x'.repeat(150))).toHaveLength(100);
  });
});

describe('appleWebName: recorte', () => {
  const wellFormed = (s: string) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);
  it('no termina en espacio al recortar a 100', () => {
    expect(appleWebName({ name: { firstName: 'x'.repeat(99), lastName: 'y' } })).toBe('x'.repeat(99));
  });
  it('no parte emojis al recortar', () => {
    const n = appleWebName({ name: { firstName: 'x'.repeat(99) + '😀😀' } })!;
    expect(wellFormed(n)).toBe(true);
    expect(n).toBe('x'.repeat(99) + '😀');
  });
});
