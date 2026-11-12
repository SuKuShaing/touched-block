import { beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, string>());
vi.mock('@/platform/storage', () => ({
  storage: {
    get: (k: string) => mem.get(k) ?? null,
    set: (k: string, v: string) => void mem.set(k, v),
    remove: (k: string) => void mem.delete(k),
  },
}));

import {
  CHALLENGE_FROM_VISIT,
  PENDING_TTL_MS,
  challengeHead,
  challengeLink,
  challengeOfferVisible,
  challengeShareText,
  clearPendingChallenge,
  compareText,
  inviteTitle,
  isFatalChallengeReason,
  loadPendingChallenge,
  parseChallengeCode,
  readChallengeParam,
  resultShareText,
  rivalOf,
  savePendingChallenge,
  startFailureText,
} from './challenge';

beforeEach(() => mem.clear());

describe('código del reto', () => {
  it('normaliza minúsculas, espacios y guiones', () => {
    expect(parseChallengeCode('k7m2qxab')).toBe('K7M2QXAB');
    expect(parseChallengeCode('  K7M2 QXAB ')).toBe('K7M2QXAB');
    expect(parseChallengeCode('K7M2-QXAB')).toBe('K7M2QXAB');
    expect(parseChallengeCode(['k7m2qxab', 'otro'])).toBe('K7M2QXAB');
  });

  it('rechaza lo que no tiene la forma de un código (largo, letras ambiguas)', () => {
    expect(parseChallengeCode('K7M2QXA')).toBeNull();
    expect(parseChallengeCode('K7M2QXABC')).toBeNull();
    expect(parseChallengeCode('K7M2QXAO')).toBeNull(); // O
    expect(parseChallengeCode('K7M2QXA1')).toBeNull(); // 1
    expect(parseChallengeCode('K7M2QXAI')).toBeNull(); // I
    expect(parseChallengeCode('')).toBeNull();
    expect(parseChallengeCode(undefined)).toBeNull();
    expect(parseChallengeCode(42)).toBeNull();
  });
});

describe('parámetro reto', () => {
  it('de una query', () => {
    expect(readChallengeParam('?reto=k7m2qxab')).toBe('K7M2QXAB');
    expect(readChallengeParam('?utm=x&reto=K7M2QXAB&y=2')).toBe('K7M2QXAB');
    expect(readChallengeParam('reto=K7M2%20QXAB')).toBe('K7M2QXAB');
    expect(readChallengeParam('?retos=K7M2QXAB')).toBeNull();
    expect(readChallengeParam('?reto=')).toBeNull();
    expect(readChallengeParam('?reto=%E0%A4%A')).toBeNull(); // mal codificado
    expect(readChallengeParam('')).toBeNull();
  });

  it('de los parámetros de la ruta (expo-router)', () => {
    expect(readChallengeParam({ reto: 'k7m2qxab' })).toBe('K7M2QXAB');
    expect(readChallengeParam({ reto: ['K7M2QXAB'] })).toBe('K7M2QXAB');
    expect(readChallengeParam({ nivel: 'basico' })).toBeNull();
    expect(readChallengeParam(null)).toBeNull();
  });

  it('el enlace usa el parámetro, no una ruta', () => {
    expect(challengeLink('K7M2QXAB', 'https://sukushaing.github.io/touched-block/')).toBe(
      'https://sukushaing.github.io/touched-block/?reto=K7M2QXAB',
    );
    expect(readChallengeParam(challengeLink('K7M2QXAB').split('?')[1])).toBe('K7M2QXAB');
  });
});

describe('textos', () => {
  it('texto del enlace', () => {
    expect(challengeShareText(47)).toBe('Hice 47 bloques en este reto de Touched Block. Juega la misma partida y supérame');
    expect(challengeShareText(1)).toBe('Hice 1 bloque en este reto de Touched Block. Juega la misma partida y supérame');
  });

  it('comparación: ganar, perder, empate y desempate por escapados', () => {
    const seba = { username: 'seba', killed: 47, missed: 3 };
    expect(compareText({ killed: 52, missed: 2 }, seba)).toBe('Tú 52 · @seba 47. ¡Ganaste por 5!');
    expect(compareText({ killed: 40, missed: 0 }, seba)).toBe('Tú 40 · @seba 47. Perdiste por 7');
    expect(compareText({ killed: 47, missed: 1 }, seba)).toBe('Tú 47 · @seba 47. ¡Ganaste: se te escaparon menos bloques!');
    expect(compareText({ killed: 47, missed: 5 }, seba)).toBe('Tú 47 · @seba 47. Perdiste: se te escaparon más bloques');
    expect(compareText({ killed: 47, missed: 3 }, seba)).toBe('Tú 47 · @seba 47. ¡Empate!');
    expect(compareText({ killed: 3, missed: 0 }, { username: null, killed: 2, missed: 0 })).toBe('Tú 3 · un invitado 2. ¡Ganaste por 1!');
  });

  it('invitación al abrir el enlace', () => {
    expect(inviteTitle({ username: 'seba', killed: 47, missed: 3 })).toBe('Reto de @seba: 47 bloques');
    expect(inviteTitle({ username: null, killed: 20, missed: 6 })).toBe('Reto de un invitado: 20 bloques');
    expect(inviteTitle({ username: 'yo', killed: 1, missed: 0, isMe: true })).toBe('Tu reto: 1 bloque');
    expect(inviteTitle(null)).toBe('Te retaron a una partida');
  });

  it('texto para compartir el resultado', () => {
    expect(resultShareText({ killed: 52 }, { username: 'seba', killed: 47, missed: 3 })).toBe(
      'Hice 52 bloques en un reto de Touched Block (@seba: 47). Juega la misma partida y supérame',
    );
    expect(resultShareText({ killed: 52 }, null)).toBe(challengeShareText(52));
  });
});

describe('rival', () => {
  const me = { username: 'yo', killed: 30, missed: 1, isMe: true };
  it('quien se une se compara con quien creó el reto, aunque haya otros mejores', () => {
    const creator = { username: 'seba', killed: 20, missed: 0, isCreator: true };
    const top = { username: 'ana', killed: 90, missed: 0 };
    expect(rivalOf([top, me, creator])).toBe(creator);
  });
  it('quien creó el reto se compara con el mejor de los demás', () => {
    const mine = { ...me, isCreator: true };
    const a = { username: 'a', killed: 10, missed: 0 };
    const b = { username: 'b', killed: 12, missed: 4 };
    expect(rivalOf([mine, a, b])).toBe(b);
    expect(rivalOf([mine])).toBeNull();
  });
  it('sin creador (no terminó su partida): el mejor de los demás', () => {
    const a = { username: 'a', killed: 10, missed: 2 };
    const b = { username: 'b', killed: 10, missed: 1 };
    expect(rivalOf([me, a, b])).toBe(b);
  });
});

describe('errores al empezar', () => {
  it('mensajes', () => {
    expect(startFailureText('duel', 'offline')).toBe('El reto necesita conexión.');
    expect(startFailureText('duel', 'off')).toBe('El reto necesita conexión.');
    expect(startFailureText('daily', 'offline')).toBe('El reto diario necesita conexión.');
    expect(startFailureText('duel', 'challenge_expired')).toBe('Este reto venció.');
    expect(startFailureText('duel', 'challenge_not_found')).toBe('Este reto no existe. Revisa el enlace.');
    expect(startFailureText('daily', 'daily_attempts_exhausted')).toBe('Ya usaste tus intentos del reto de hoy.');
    expect(startFailureText('duel', 'error', 'Demasiadas peticiones.')).toBe('Demasiadas peticiones.');
    expect(startFailureText('duel', 'error')).toBe('No se pudo empezar el reto. Inténtalo de nuevo.');
  });
  it('un reto que no existe o venció no se reintenta', () => {
    expect(isFatalChallengeReason('challenge_expired')).toBe(true);
    expect(isFatalChallengeReason('challenge_not_found')).toBe(true);
    expect(isFatalChallengeReason('offline')).toBe(false);
  });
});

describe('código pendiente (tutorial de la 1.ª visita)', () => {
  it('se guarda, se lee y se borra', () => {
    savePendingChallenge('K7M2QXAB', 1000);
    expect(loadPendingChallenge(2000)).toBe('K7M2QXAB');
    clearPendingChallenge();
    expect(loadPendingChallenge(2000)).toBeNull();
  });
  it('vence solo', () => {
    savePendingChallenge('K7M2QXAB', 1000);
    expect(loadPendingChallenge(1000 + PENDING_TTL_MS + 1)).toBeNull();
    expect(mem.size).toBe(0);
  });
  it('lo dañado se descarta', () => {
    mem.set('tb_reto1', '{nope');
    expect(loadPendingChallenge()).toBeNull();
    mem.set('tb_reto1', JSON.stringify({ code: 'nada', at: Date.now() }));
    expect(loadPendingChallenge()).toBeNull();
  });
});

describe('challengeHead: encabezado del resultado del reto', () => {
  const base = { settled: true, hasView: false, hasRival: false, fetchFailed: false };
  it('con rival, la comparación', () => {
    expect(challengeHead({ ...base, hasRival: true, hasView: true })).toBe('compare');
  });
  it('mientras se envía la partida, cargando', () => {
    expect(challengeHead({ ...base, settled: false })).toBe('loading');
    expect(challengeHead({ ...base, settled: false, fetchFailed: true })).toBe('loading');
  });
  it('ya enviada, sin vista y GET /challenges falló: error con Reintentar (no cargando para siempre)', () => {
    expect(challengeHead({ ...base, fetchFailed: true })).toBe('failed');
  });
  it('ya enviada, pidiendo el reto: cargando', () => {
    expect(challengeHead(base)).toBe('loading');
  });
  it('se cargó y no hay nadie más: es el primero', () => {
    expect(challengeHead({ ...base, hasView: true })).toBe('first');
    expect(challengeHead({ ...base, hasView: true, fetchFailed: true })).toBe('first');
  });
});

describe('challengeOfferVisible: Retar a un amigo desde la 2.ª visita', () => {
  it('1.ª visita: no, salvo que haya llegado por un enlace de reto', () => {
    expect(challengeOfferVisible({ accounts: true, visits: 1, arrivedByLink: false })).toBe(false);
    expect(challengeOfferVisible({ accounts: true, visits: 0, arrivedByLink: false })).toBe(false);
    expect(challengeOfferVisible({ accounts: true, visits: 1, arrivedByLink: true })).toBe(true);
  });
  it('desde la 2.ª visita, sí', () => {
    expect(challengeOfferVisible({ accounts: true, visits: CHALLENGE_FROM_VISIT, arrivedByLink: false })).toBe(true);
    expect(challengeOfferVisible({ accounts: true, visits: 7, arrivedByLink: false })).toBe(true);
  });
  it('sin API, nunca', () => {
    expect(challengeOfferVisible({ accounts: false, visits: 9, arrivedByLink: true })).toBe(false);
  });
});
