import { describe, expect, it } from 'vitest';
import { charLength, truncateChars } from './text';

const wellFormed = (s: string) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

describe('truncateChars', () => {
  it('no parte emojis (cuenta caracteres reales, como @MaxLength y VarChar)', () => {
    const s = 'a' + '😀'.repeat(100);
    const t = truncateChars(s, 100);
    expect(wellFormed(t)).toBe(true);
    expect(charLength(t)).toBe(100);
    expect(t).toBe('a' + '😀'.repeat(99));
  });

  it('deja igual lo que ya cabe', () => {
    expect(truncateChars('hola', 4)).toBe('hola');
    expect(truncateChars('😀😀', 2)).toBe('😀😀');
    expect(truncateChars('', 5)).toBe('');
  });

  it('recorta texto simple', () => {
    expect(truncateChars('abcdef', 3)).toBe('abc');
  });
});
