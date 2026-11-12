import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { COMMON_FIELD, CommonFieldService, challengeField, commonFieldFrom } from './common-field.service';

describe('commonFieldFrom', () => {
  it('usa el percentil 5 en px enteros (hacia abajo, para que quepa)', () => {
    expect(commonFieldFrom({ runs: 500, w: 375.9, h: 612.4 })).toEqual({ fieldW: 375, fieldH: 612 });
  });

  it('acota a los límites de seguridad', () => {
    expect(commonFieldFrom({ runs: 500, w: 200, h: 300 })).toEqual({ fieldW: COMMON_FIELD.minW, fieldH: COMMON_FIELD.minH });
    expect(commonFieldFrom({ runs: 500, w: 1200, h: 2000 })).toEqual({ fieldW: COMMON_FIELD.maxW, fieldH: COMMON_FIELD.maxH });
    expect(commonFieldFrom({ runs: 500, w: 320, h: 440 })).toEqual({ fieldW: 320, fieldH: 440 });
    expect(commonFieldFrom({ runs: 500, w: 430, h: 800 })).toEqual({ fieldW: 430, fieldH: 800 });
  });

  it('con pocos datos usa 360 × 540', () => {
    expect(commonFieldFrom({ runs: COMMON_FIELD.minRuns - 1, w: 400, h: 700 })).toEqual({ fieldW: 360, fieldH: 540 });
    expect(commonFieldFrom({ runs: 0, w: null, h: null })).toEqual({ fieldW: 360, fieldH: 540 });
    expect(commonFieldFrom({ runs: COMMON_FIELD.minRuns, w: 400, h: 700 })).toEqual({ fieldW: 400, fieldH: 700 });
  });
});

describe('challengeField', () => {
  it('el menor en cada dimensión entre el campo del creador y el común', () => {
    const common = { fieldW: 360, fieldH: 540 };
    expect(challengeField({ fieldW: 412, fieldH: 915 }, common)).toEqual(common);
    expect(challengeField({ fieldW: 320, fieldH: 900 }, common)).toEqual({ fieldW: 320, fieldH: 540 });
    expect(challengeField({ fieldW: 500, fieldH: 480 }, common)).toEqual({ fieldW: 360, fieldH: 480 });
  });
});

describe('CommonFieldService', () => {
  function service(sample: { runs: number; w: number | null; h: number | null }) {
    const $queryRaw = vi.fn(async () => [sample]);
    return { $queryRaw, svc: new CommonFieldService({ $queryRaw } as unknown as PrismaService) };
  }

  it('calcula con el percentil de la base y lo guarda en memoria 1 h', async () => {
    const { $queryRaw, svc } = service({ runs: 1000, w: 380.2, h: 650.7 });
    const t0 = Date.now();
    expect(await svc.get(t0)).toEqual({ fieldW: 380, fieldH: 650 });
    expect(await svc.get(t0 + COMMON_FIELD.cacheMs - 1000)).toEqual({ fieldW: 380, fieldH: 650 });
    expect($queryRaw).toHaveBeenCalledTimes(1);
    await svc.get(Date.now() + COMMON_FIELD.cacheMs + 1);
    expect($queryRaw).toHaveBeenCalledTimes(2);
  });

  it('peticiones simultáneas comparten un solo cálculo', async () => {
    const { $queryRaw, svc } = service({ runs: 10, w: 400, h: 700 });
    const all = await Promise.all([svc.get(), svc.get(), svc.get()]);
    expect(all).toEqual([
      { fieldW: 360, fieldH: 540 },
      { fieldW: 360, fieldH: 540 },
      { fieldW: 360, fieldH: 540 },
    ]);
    expect($queryRaw).toHaveBeenCalledTimes(1);
  });

  it('la consulta mira solo partidas válidas de modo normal de los últimos 30 días', async () => {
    const { $queryRaw, svc } = service({ runs: 0, w: null, h: null });
    await svc.sample();
    const [strings, ...values] = $queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    const sql = strings.join('?');
    expect(sql).toMatch(/percentile_cont/);
    expect(sql).toMatch(/"status" = 'valid' AND "mode" = 'normal'/);
    expect(values).toEqual([0.05, 0.05, 30]);
  });
});
