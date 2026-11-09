/** Un puntaje: más destruidos es mejor; a igualdad, menos escapados; luego, quien lo logró antes. */
export interface Score {
  killed: number;
  missed: number;
  achievedAt: Date;
}

/** < 0 si `a` es mejor que `b`, > 0 si es peor, 0 si empatan en todo. Sirve para Array.sort. */
export function compareScores(a: Score, b: Score): number {
  if (a.killed !== b.killed) return b.killed - a.killed;
  if (a.missed !== b.missed) return a.missed - b.missed;
  return a.achievedAt.getTime() - b.achievedAt.getTime();
}

export const isBetter = (a: Score, b: Score) => compareScores(a, b) < 0;

/** Filtro de Prisma para "puntajes estrictamente mejores que `s`" (para calcular la posición). */
export function betterThan(s: Score) {
  return {
    OR: [
      { killed: { gt: s.killed } },
      { killed: s.killed, missed: { lt: s.missed } },
      { killed: s.killed, missed: s.missed, achievedAt: { lt: s.achievedAt } },
    ],
  };
}

/** Orden de Prisma equivalente a compareScores. */
export const RANKING_ORDER = [
  { killed: 'desc' as const },
  { missed: 'asc' as const },
  { achievedAt: 'asc' as const },
];
