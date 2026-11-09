import { Injectable } from '@nestjs/common';
import { RULES_VERSION } from '@tb/engine';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { type Period, periodKey, periodKeysFor } from './periods';
import { type Score, betterThan } from './ranking';

/** Filtro de Prisma para "puntajes estrictamente peores que `s`". */
function worseThan(s: Score) {
  return {
    OR: [
      { killed: { lt: s.killed } },
      { killed: s.killed, missed: { gt: s.missed } },
      { killed: s.killed, missed: s.missed, achievedAt: { gt: s.achievedAt } },
    ],
  };
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export interface Ranks {
  world: number | null;
  country: number | null;
}

@Injectable()
export class BestScoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una partida válida en los 4 períodos (semana, mes, año, histórico) solo donde mejora
   * el puntaje guardado. Devuelve los períodos donde quedó como nuevo récord.
   */
  async record(userId: string, runId: string, score: Score, country: string | null): Promise<Period[]> {
    const improved: Period[] = [];
    for (const { periodType, periodKey: key } of periodKeysFor(score.achievedAt)) {
      const id = { userId, rulesVersion: RULES_VERSION, periodType, periodKey: key };
      const data = { killed: score.killed, missed: score.missed, achievedAt: score.achievedAt, runId, country };
      for (let attempt = 0; attempt < 2; attempt++) {
        // actualización condicional y atómica: solo si lo guardado es peor
        const upd = await this.prisma.bestScore.updateMany({ where: { ...id, ...worseThan(score) }, data });
        if (upd.count > 0) {
          improved.push(periodType);
          break;
        }
        try {
          await this.prisma.bestScore.create({ data: { ...id, ...data } });
          improved.push(periodType);
          break;
        } catch (e) {
          if (!isUniqueViolation(e)) throw e;
          // ya existía uno igual o mejor (o lo creó otra petición): reintenta la actualización una vez
        }
      }
    }
    return improved;
  }

  /** Mejor puntaje del usuario en un período (el actual si no se da la clave). */
  best(userId: string, period: Period, key = periodKey(period, new Date())) {
    return this.prisma.bestScore.findUnique({
      where: {
        userId_rulesVersion_periodType_periodKey: { userId, rulesVersion: RULES_VERSION, periodType: period, periodKey: key },
      },
    });
  }

  /**
   * Posición de un puntaje: cuántos tienen uno estrictamente mejor + 1.
   * `filter` acota el universo (país o lista de amigos).
   */
  async rankOf(score: Score, period: Period, key: string, filter: Prisma.BestScoreWhereInput = {}): Promise<number> {
    const better = await this.prisma.bestScore.count({
      where: { rulesVersion: RULES_VERSION, periodType: period, periodKey: key, ...filter, ...betterThan(score) },
    });
    return better + 1;
  }

  /** Posición mundial y en su país del mejor puntaje del usuario en el período actual. */
  async ranksOf(userId: string, period: Period = 'all'): Promise<Ranks | null> {
    const key = periodKey(period, new Date());
    const best = await this.best(userId, period, key);
    if (!best) return null;
    const [world, country] = await Promise.all([
      this.rankOf(best, period, key),
      best.country ? this.rankOf(best, period, key, { country: best.country }) : Promise.resolve(null),
    ]);
    return { world, country };
  }
}
