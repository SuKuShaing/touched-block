import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Campo común de los retos (plan 3.1, decisión D4): un campo que cabe sin achicarse en el 95 %
 * de las pantallas que de verdad juegan. Todos los números son provisorios.
 */
export const COMMON_FIELD = {
  /** Percentil de los campos enviados (0.05 = percentil 5). */
  percentile: 0.05,
  /** Días hacia atrás que se miran. */
  days: 30,
  /** Con menos partidas que esto se usa el campo por defecto. */
  minRuns: 200,
  /** Campo por defecto con pocos datos. */
  fallback: { fieldW: 360, fieldH: 540 },
  /** Límites de seguridad. */
  minW: 320,
  maxW: 430,
  minH: 440,
  maxH: 800,
  /** Se recalcula como máximo una vez por este tiempo. */
  cacheMs: 60 * 60 * 1000,
} as const;

export interface Field {
  fieldW: number;
  fieldH: number;
}

/** Resumen de los campos enviados: cantidad de partidas y percentil de ancho y alto. */
export interface FieldSample {
  runs: number;
  w: number | null;
  h: number | null;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Campo común a partir de la muestra: percentil acotado a los límites, en px enteros (hacia abajo). */
export function commonFieldFrom(s: FieldSample): Field {
  if (s.runs < COMMON_FIELD.minRuns || s.w === null || s.h === null || !Number.isFinite(s.w) || !Number.isFinite(s.h)) {
    return { ...COMMON_FIELD.fallback };
  }
  return {
    fieldW: Math.floor(clamp(s.w, COMMON_FIELD.minW, COMMON_FIELD.maxW)),
    fieldH: Math.floor(clamp(s.h, COMMON_FIELD.minH, COMMON_FIELD.maxH)),
  };
}

/** Campo de un reto nuevo: el menor, en cada dimensión, entre el del creador y el común. */
export const challengeField = (sent: Field, common: Field): Field => ({
  fieldW: Math.min(sent.fieldW, common.fieldW),
  fieldH: Math.min(sent.fieldH, common.fieldH),
});

@Injectable()
export class CommonFieldService {
  private cached?: { field: Field; at: number };
  private pending?: Promise<Field>;

  constructor(private readonly prisma: PrismaService) {}

  /** Campo común vigente (en memoria hasta 1 h). */
  async get(now = Date.now()): Promise<Field> {
    if (this.cached && now - this.cached.at < COMMON_FIELD.cacheMs) return { ...this.cached.field };
    this.pending ??= this.compute()
      .then((field) => {
        this.cached = { field, at: Date.now() };
        return field;
      })
      .finally(() => {
        this.pending = undefined;
      });
    return { ...(await this.pending) };
  }

  /** Olvida el valor en memoria (tests). */
  invalidate() {
    this.cached = undefined;
  }

  /**
   * Percentil de los campos de las partidas válidas de modo normal de los últimos 30 días. Los
   * retos no cuentan: guardan el campo que decidió el servidor, no la pantalla del celular.
   */
  async sample(): Promise<FieldSample> {
    const rows = await this.prisma.$queryRaw<{ runs: number; w: number | null; h: number | null }[]>`
      SELECT count(*)::int AS runs,
             percentile_cont(${COMMON_FIELD.percentile}::float8) WITHIN GROUP (ORDER BY "fieldW") AS w,
             percentile_cont(${COMMON_FIELD.percentile}::float8) WITHIN GROUP (ORDER BY "fieldH") AS h
      FROM "Run"
      WHERE "status" = 'valid' AND "mode" = 'normal'
        AND "startedAt" >= now() - make_interval(days => ${COMMON_FIELD.days}::int)`;
    const r = rows[0];
    return { runs: r?.runs ?? 0, w: r?.w === null || r?.w === undefined ? null : Number(r.w), h: r?.h === null || r?.h === undefined ? null : Number(r.h) };
  }

  private async compute(): Promise<Field> {
    return commonFieldFrom(await this.sample());
  }
}
