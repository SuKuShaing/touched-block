import { describe, expect, it } from 'vitest';
import { normalizeUsername, searchKey, usernameBase, usernameCandidates, usernameProblem } from './username';

describe('nombre de usuario', () => {
  it('normaliza: minúsculas, sin espacios ni @ inicial', () => {
    expect(normalizeUsername('  @SeBa.Tapia ')).toBe('seba.tapia');
  });

  it('clave de búsqueda: sin tildes, minúsculas, solo letras y números', () => {
    expect(searchKey('  @Sebastián S. ')).toBe('sebastians');
    expect(searchKey('Peña_Núñez')).toBe('penanunez');
    expect(searchKey('._ ')).toBe('');
    expect(searchKey(undefined)).toBe('');
  });

  it.each([
    ['seba', null],
    ['seba_t.99', null],
    ['ab', 'Debe tener'],
    ['a'.repeat(21), 'Debe tener'],
    ['seba-t', 'Solo puede tener'],
    ['señor', 'Solo puede tener'],
    ['.seba', 'No puede empezar'],
    ['seba.', 'No puede empezar'],
    ['se..ba', 'No puede empezar'],
    ['admin', 'no está permitido'],
  ])('%s', (u, problem) => {
    const p = usernameProblem(u);
    if (problem === null) expect(p).toBeNull();
    else expect(p).toContain(problem);
  });

  it('genera la base desde el nombre de Google', () => {
    expect(usernameBase('Sebastián Sanhueza Tapia')).toBe('sebastian.sanhueza.t');
    expect(usernameBase('José Núñez')).toBe('jose.nunez');
    expect(usernameBase('李', 'li.wei@gmail.com')).toBe('li.wei');
    expect(usernameBase('', '')).toBe('jugador');
    expect(usernameBase('X-Æ-12')).toBe('x.12');
  });

  it('los candidatos son válidos y empiezan por la base', () => {
    const c = usernameCandidates('sebastian.sanhueza.t');
    expect(c[0]).toBe('sebastian.sanhueza.t');
    expect(c.length).toBeGreaterThan(20);
    for (const u of c) {
      expect(usernameProblem(u)).toBeNull();
      expect(u.length).toBeLessThanOrEqual(20);
    }
    expect(c.slice(1).every((u) => /\d+$/.test(u))).toBe(true);
  });
});
