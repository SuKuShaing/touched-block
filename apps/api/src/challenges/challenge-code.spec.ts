import { describe, expect, it } from 'vitest';
import { CHALLENGE_CODE_ALPHABET, newChallengeCode, normalizeChallengeCode } from './challenge-code';

describe('códigos de reto', () => {
  it('8 caracteres sin ambiguos', () => {
    expect(CHALLENGE_CODE_ALPHABET).not.toMatch(/[IL0O1]/);
    const codes = new Set(Array.from({ length: 500 }, newChallengeCode));
    expect(codes.size).toBe(500);
    for (const c of codes) expect(c).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });

  it('normaliza espacios y minúsculas; rechaza lo que no tiene forma de código', () => {
    expect(normalizeChallengeCode(' k7m2qxab ')).toBe('K7M2QXAB');
    expect(normalizeChallengeCode('K7M2QX')).toBeNull();
    expect(normalizeChallengeCode('K7M2QXA1')).toBeNull(); // el 1 no existe
    expect(normalizeChallengeCode('K7M2QXAO')).toBeNull(); // la O tampoco
    expect(normalizeChallengeCode(42)).toBeNull();
  });
});
