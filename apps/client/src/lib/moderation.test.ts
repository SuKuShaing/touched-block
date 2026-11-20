import { describe, expect, it } from 'vitest';
import { moderationUnavailable, truncateChars } from './moderation';

describe('moderationUnavailable', () => {
  it('la API sin moderación responde 404 de ruta desconocida', () => {
    expect(moderationUnavailable({ status: 404, code: 'not_found' })).toBe(true);
    expect(moderationUnavailable({ status: 404, code: 'http_404' })).toBe(true);
  });

  it('un usuario que no existe u otros errores no cuentan', () => {
    expect(moderationUnavailable({ status: 404, code: 'user_not_found' })).toBe(false);
    expect(moderationUnavailable({ status: 404, code: 'report_not_found' })).toBe(false);
    expect(moderationUnavailable({ status: 409, code: 'already_reported' })).toBe(false);
    expect(moderationUnavailable({ status: 0, code: 'network' })).toBe(false);
    expect(moderationUnavailable(null)).toBe(false);
    expect(moderationUnavailable(new Error('x'))).toBe(false);
  });
});

describe('truncateChars', () => {
  it('recorta por caracteres reales sin partir emojis', () => {
    expect(truncateChars('a' + '😀'.repeat(200), 200)).toBe('a' + '😀'.repeat(199));
    expect(truncateChars('hola', 200)).toBe('hola');
  });
});
