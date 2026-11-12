import { describe, expect, it } from 'vitest';
import { ADD_START, MILESTONES, MUL_START, NUM_STEP, TICKS_PER_SECOND } from '@tb/engine';
import {
  challengeTrackStart,
  friendAhead,
  friendAheadText,
  friendTargets,
  milestonePos,
  milestoneProgress,
  nextMilestonePhrase,
  passedCount,
  recordGapText,
  stagePhrase,
  toMilestone,
  trackPos,
} from './stagePath';

const N = MILESTONES.length;
const sec = (s: number) => Math.round(s * TICKS_PER_SECOND);

describe('trackPos: cada hito ocupa el mismo ancho', () => {
  it('bordes', () => {
    expect(trackPos(0)).toBe(0);
    expect(trackPos(-5)).toBe(0);
    expect(trackPos(MILESTONES[N - 1].at)).toBe(1);
    expect(trackPos(10_000)).toBe(1);
  });
  it('en cada hito cae justo en su marca', () => {
    MILESTONES.forEach((m, i) => expect(trackPos(m.at)).toBeCloseTo(milestonePos(i), 10));
  });
  it('lineal dentro de cada tramo', () => {
    expect(trackPos(NUM_STEP / 2)).toBeCloseTo(0.5 / N, 10);
    const i = MILESTONES.findIndex((m) => m.at === MUL_START);
    expect(trackPos((ADD_START + MUL_START) / 2)).toBeCloseTo((i + 0.5) / N, 10);
  });
});

describe('milestoneProgress', () => {
  it('parte vacío hacia el primer hito', () => {
    expect(milestoneProgress(0)).toEqual({ ratio: 0, next: MILESTONES[0] });
    expect(milestoneProgress(NUM_STEP / 2).ratio).toBeCloseTo(0.5, 10);
  });
  it('al cruzar un hito apunta al siguiente', () => {
    const p = milestoneProgress(ADD_START);
    expect(p.next?.at).toBe(MUL_START);
    expect(p.ratio).toBe(0);
  });
  it('después del último: lleno y sin próximo', () => {
    expect(milestoneProgress(MILESTONES[N - 1].at + 5)).toEqual({ ratio: 1, next: null });
  });
});

describe('stagePhrase', () => {
  it('primera partida que cruza un hito', () => {
    expect(stagePhrase(sec(30), 0)).toBe('¡Llegaste al 4!');
  });
  it('sin hito nuevo: cuánto faltó para el siguiente', () => {
    expect(stagePhrase(sec(30), sec(30))).toBe('Te faltaron 10 s para el 5');
    expect(stagePhrase(sec(112), sec(200))).toBe('Te faltaron 8 s para el 9');
    expect(stagePhrase(sec(3), 0)).toBe('Te faltaron 17 s para el 4');
  });
  it('redondea hacia arriba y nunca dice 0 s', () => {
    expect(stagePhrase(sec(ADD_START - 0.5), sec(300))).toBe('Te faltaron 1 s para las sumas y restas');
  });
  it('hito nuevo para él: el más lejano que alcanzó', () => {
    expect(stagePhrase(sec(ADD_START + 10), sec(130))).toBe('¡Llegaste a las sumas y restas!');
    expect(stagePhrase(sec(MUL_START + 1), sec(10))).toBe('¡Llegaste a las multiplicaciones y divisiones!');
  });
  it('si ya cruzó todo', () => {
    const end = sec(MILESTONES[N - 1].at + 30);
    expect(stagePhrase(end, end)).toBe('Llegaste a los bloques de 1 s');
  });
  it('contracción "al"', () => {
    expect(toMilestone('el 5')).toBe('al 5');
    expect(toMilestone('las sumas y restas')).toBe('a las sumas y restas');
  });
});

describe('retos: frase sin comparar con su mejor y dónde parte el camino', () => {
  it('nunca felicita "¡Llegaste…!": dice cuánto faltó para el siguiente hito', () => {
    expect(nextMilestonePhrase(30)).toBe('Te faltaron 10 s para el 5');
    expect(nextMilestonePhrase(0)).toBe('Te faltaron 20 s para el 4');
    expect(nextMilestonePhrase(-3)).toBe('Te faltaron 20 s para el 4');
    expect(nextMilestonePhrase(ADD_START - 0.5)).toBe('Te faltaron 1 s para las sumas y restas');
    expect(nextMilestonePhrase(MILESTONES[N - 1].at + 1)).toBe('Llegaste a los bloques de 1 s');
  });
  it('con startAt la frase usa la dificultad alcanzada (inicio + segundos jugados)', () => {
    // directo a las sumas (startAt = ADD_START) y 10 s jugados
    expect(nextMilestonePhrase(ADD_START + 10)).toBe(`Te faltaron ${MUL_START - ADD_START - 10} s para las multiplicaciones y divisiones`);
  });
  it('stagePhrase sin hito nuevo coincide con la frase de reto', () => {
    expect(stagePhrase(sec(112), sec(200))).toBe(nextMilestonePhrase(112));
  });
  it('challengeTrackStart', () => {
    expect(challengeTrackStart(null)).toBe(0);
    expect(challengeTrackStart(undefined)).toBe(0);
    expect(challengeTrackStart({ lives: 3 })).toBe(0);
    expect(challengeTrackStart({ noRed: true })).toBe(0);
    expect(challengeTrackStart({ startAt: ADD_START })).toBe(ADD_START);
    expect(challengeTrackStart({ startAt: 0 })).toBe(0);
    // una sola familia: los hitos no se cumplen, el camino se omite
    expect(challengeTrackStart({ only: 'mul' })).toBeNull();
    expect(challengeTrackStart({ only: 'mul', startAt: MUL_START })).toBeNull();
  });
});

describe('recordGapText', () => {
  it('sin récord previo o con récord: nada', () => {
    expect(recordGapText(5, 0)).toBeNull();
    expect(recordGapText(10, 9)).toBeNull();
  });
  it('cuántos faltaban para superarlo', () => {
    expect(recordGapText(9, 9)).toBe('Te faltó 1 bloque para tu récord');
    expect(recordGapText(5, 9)).toBe('Te faltaron 5 bloques para tu récord');
  });
});

describe('amigos', () => {
  const lb = [
    { userId: 'a', username: 'ana', killed: 60 },
    { userId: 'me', username: 'yo', killed: 50, isMe: true },
    { userId: 'j', username: 'jose', killed: 47 },
    { userId: 'p', username: 'pia', killed: 30 },
  ];
  it('el más cercano por encima, sin contarme a mí', () => {
    expect(friendAhead(lb, 'me', 40)).toEqual({ username: 'jose', diff: 7 });
    expect(friendAhead(lb, null, 47)).toEqual({ username: 'ana', diff: 13 });
    expect(friendAhead(lb, 'me', 60)).toBeNull();
    expect(friendAhead([{ userId: 'me', username: 'yo', killed: 90 }], 'me', 10)).toBeNull();
  });
  it('texto', () => {
    expect(friendAheadText({ username: 'jose', diff: 3 })).toBe('Estás a 3 bloques de @jose esta semana');
    expect(friendAheadText({ username: 'jose', diff: 1 })).toBe('Estás a 1 bloque de @jose esta semana');
  });
  it('objetivos: los que aún no superé esta semana, de menor a mayor', () => {
    expect(friendTargets(lb, 'me', 45).map((f) => f.username)).toEqual(['jose', 'ana']);
    expect(friendTargets(lb, 'me', 0).map((f) => f.username)).toEqual(['pia', 'jose', 'ana']);
  });
  it('passedCount', () => {
    const t = friendTargets(lb, 'me', 0);
    expect(passedCount(t, 30)).toBe(0);
    expect(passedCount(t, 31)).toBe(1);
    expect(passedCount(t, 61)).toBe(3);
  });
});
