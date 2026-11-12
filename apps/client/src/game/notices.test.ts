import { describe, expect, it } from 'vitest';
import { LIFE_STAGE_FIRST, MILESTONES, MISS_MULT_ADD_STAGE, MISS_MULT_MUL_STAGE } from '@tb/engine';
import {
  MILESTONE_SOUND,
  comboNotice,
  duelStartText,
  friendNotice,
  milestoneNotice,
  milestoneText,
  modeNotice,
  noticeWins,
  pickNotice,
  recordNotice,
  streakBreakNotice,
} from './notices';

const byKind = (k: string, v?: number) => MILESTONES.find((m) => m.kind === k && (v === undefined || m.value === v))!;

describe('un solo aviso a la vez', () => {
  const rec = recordNotice();
  const fr = friendNotice('jose');
  const mil = milestoneNotice(MILESTONES[0]);
  const combo = comboNotice(3, 1);
  const brk = streakBreakNotice(12, 7);

  it('si coinciden gana el más importante: récord > amigo > hito > combo > racha cortada', () => {
    expect(pickNotice([brk, combo, mil, fr, rec])).toBe(rec);
    expect(pickNotice([combo, fr, mil])).toBe(fr);
    expect(pickNotice([brk, combo, mil])).toBe(mil);
    expect(pickNotice([brk, combo])).toBe(combo);
    expect(pickNotice([])).toBeNull();
  });
  it('a igual importancia, el último', () => {
    const c2 = comboNotice(5, 2);
    expect(pickNotice([combo, c2])).toBe(c2);
  });
  it('uno menos importante no interrumpe al que se muestra', () => {
    expect(noticeWins(null, brk)).toBe(true);
    expect(noticeWins(mil, combo)).toBe(false);
    expect(noticeWins(mil, rec)).toBe(true);
    expect(noticeWins(combo, comboNotice(5, 2))).toBe(true);
  });
});

describe('textos de los hitos (números de las constantes)', () => {
  it('números', () => {
    expect(milestoneText(byKind('num', 5))).toBe('¡Aparece el 5!');
  });
  it('cambios de etapa con su castigo', () => {
    expect(milestoneText(byKind('add'))).toBe(`¡Sumas y restas! Escapar ahora resta ×${MISS_MULT_ADD_STAGE}`);
    expect(milestoneText(byKind('mul'))).toContain(`×${MISS_MULT_MUL_STAGE}`);
    const fin = milestoneText(byKind('life', LIFE_STAGE_FIRST));
    expect(fin).toContain('Etapa final');
    expect(fin).toContain(`${LIFE_STAGE_FIRST} s`);
    expect(fin).toContain(`×${MISS_MULT_MUL_STAGE}`);
  });
  it('resto de la etapa final', () => {
    expect(milestoneText(byKind('life', LIFE_STAGE_FIRST - 1))).toBe(`¡Bloques de ${LIFE_STAGE_FIRST - 1} s!`);
  });
  it('combos y racha cortada como antes', () => {
    expect(comboNotice(3, 1).text).toBe('+1s · ¡Combo ×3!');
    expect(streakBreakNotice(12, 7).text).toBe('Racha de 12 · +7 s');
  });
});

describe('aviso del modo (al empezar un reto)', () => {
  it('es el menos importante: cualquier otro lo reemplaza', () => {
    const m = modeNotice('Reto nuevo: al terminar, compártelo');
    expect(pickNotice([m, streakBreakNotice(3, 1)])?.kind).toBe('streak');
    expect(noticeWins(m, comboNotice(3, 1))).toBe(true);
    expect(noticeWins(comboNotice(3, 1), m)).toBe(false);
  });
  it('textos', () => {
    expect(duelStartText(null, false)).toBe('Reto nuevo: al terminar, compártelo');
    expect(duelStartText({ username: 'seba', killed: 47 }, true)).toBe('A superar: @seba con 47');
    expect(duelStartText({ username: null, killed: 20 }, true)).toBe('A superar: un invitado con 20');
    expect(duelStartText(null, true)).toBe('Reto: la misma partida para todos');
  });
});

it('sonido del hito: 523, 659 y 784 Hz, triangle, 0.12 s, volumen 0.07, cada 90 ms, vibración 30 ms', () => {
  expect(MILESTONE_SOUND).toEqual({ notes: [523, 659, 784], wave: 'triangle', dur: 0.12, vol: 0.07, gapMs: 90, buzzMs: 30 });
});
