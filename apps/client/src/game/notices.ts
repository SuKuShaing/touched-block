import { LIFE_STAGE_FIRST, type Milestone, missMultFor } from '@tb/engine';

/**
 * Avisos de la partida. Van todos en la franja fija bajo la barra de tiempo (nunca sobre el
 * campo), de a uno: si coinciden, gana el más importante y el resto se descarta.
 */
export type NoticeKind = 'record' | 'friend' | 'milestone' | 'combo' | 'streak' | 'mode';
export type NoticeTone = 'gold' | 'good' | 'accent';

export interface Notice {
  kind: NoticeKind;
  text: string;
  tone: NoticeTone;
  /** Cuánto se muestra (ms). */
  ms: number;
}

/** Récord > amigo superado > hito > combo > racha cortada > modo de la partida (al empezar un reto). */
export const NOTICE_PRIORITY: Record<NoticeKind, number> = { record: 5, friend: 4, milestone: 3, combo: 2, streak: 1, mode: 0 };

/** ¿`next` reemplaza al aviso que se está mostrando? (uno igual o más importante lo reemplaza). */
export const noticeWins = (active: Notice | null, next: Notice) => !active || NOTICE_PRIORITY[next.kind] >= NOTICE_PRIORITY[active.kind];

/** El más importante de los que llegaron juntos (a igual importancia, el último). */
export function pickNotice(cands: readonly Notice[]): Notice | null {
  let best: Notice | null = null;
  for (const c of cands) if (!best || NOTICE_PRIORITY[c.kind] >= NOTICE_PRIORITY[best.kind]) best = c;
  return best;
}

/**
 * Texto del aviso de un hito. En los cambios de etapa (sumas, multiplicaciones, etapa final)
 * incluye el castigo por bloque escapado, tomado de las constantes del motor.
 */
export function milestoneText(m: Milestone): string {
  const mult = missMultFor(m);
  switch (m.kind) {
    case 'num':
      return `¡Aparece el ${m.value}!`;
    case 'add':
      return `¡Sumas y restas! Escapar ahora resta ×${mult}`;
    case 'mul':
      return `¡Multiplicaciones y divisiones! Escapar resta ×${mult}`;
    case 'life':
      return m.value === LIFE_STAGE_FIRST
        ? `¡Etapa final! Bloques de ${m.value} s · escapar resta ×${mult}`
        : `¡Bloques de ${m.value} s!`;
  }
}

export const milestoneNotice = (m: Milestone): Notice => ({ kind: 'milestone', text: milestoneText(m), tone: 'accent', ms: 2600 });
export const recordNotice = (): Notice => ({ kind: 'record', text: '¡Nuevo récord!', tone: 'gold', ms: 2200 });
export const friendNotice = (username: string): Notice => ({ kind: 'friend', text: `Superaste a @${username}`, tone: 'good', ms: 2200 });
export const comboNotice = (streak: number, bonus: number): Notice => ({
  kind: 'combo',
  text: `+${bonus}s · ¡Combo ×${streak}!`,
  tone: 'good',
  ms: 1300,
});
export const streakBreakNotice = (streak: number, earned: number): Notice => ({
  kind: 'streak',
  text: `Racha de ${streak} · +${earned} s`,
  tone: 'gold',
  ms: 1700,
});

/**
 * Aviso al empezar una partida que no es la normal ("Reto de @seba: 47 bloques", "Reto #6 ·
 * Directo a las sumas"). Es el menos importante: cualquier otro lo reemplaza.
 */
export const modeNotice = (text: string): Notice => ({ kind: 'mode', text, tone: 'accent', ms: 2600 });

/** Aviso al empezar un reto a un amigo: contra quién se juega, o que es un reto nuevo. */
export function duelStartText(creator: { username: string | null; killed: number } | null, joining: boolean): string {
  if (!joining) return 'Reto nuevo: al terminar, compártelo';
  if (!creator) return 'Reto: la misma partida para todos';
  return `A superar: ${creator.username ? '@' + creator.username : 'un invitado'} con ${creator.killed}`;
}

/**
 * Sonido del aviso de hito: tres notas cortas. El paquete de sonidos (fase 2) copia estos valores.
 */
export const MILESTONE_SOUND = {
  notes: [523, 659, 784],
  wave: 'triangle',
  dur: 0.12,
  vol: 0.07,
  gapMs: 90,
  buzzMs: 30,
} as const;
