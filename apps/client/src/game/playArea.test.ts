import { describe, expect, it } from 'vitest';
import { FIELD_MAX, FIELD_MIN, areaFor, fitArea, rectToArea, serverField, stretchArea, tapToField } from './playArea';

describe('partida normal: el campo es la pantalla completa (D5)', () => {
  it('escala 1 y sin desplazamiento cuando el campo es la pantalla', () => {
    const a = stretchArea(390, 640, 390, 640);
    expect(a).toEqual({ sx: 1, sy: 1, ox: 0, oy: 0, w: 390, h: 640, letterbox: false });
    expect(tapToField(a, 100.4, 200.6)).toEqual({ x: 100.4, y: 200.6 });
  });

  it('si la pantalla cambia en plena partida, estira en cada eje como antes (sx, sy)', () => {
    const a = stretchArea(780, 320, 390, 640);
    expect(a.sx).toBe(2);
    expect(a.sy).toBe(0.5);
    expect(tapToField(a, 390, 160)).toEqual({ x: 195, y: 320 });
  });

  it('nunca ignora un toque (el motor recorta al campo)', () => {
    const a = stretchArea(390, 640, 390, 640);
    expect(tapToField(a, -5, 700)).toEqual({ x: -5, y: 700 });
  });
});

describe('retos: rectángulo centrado con escala única', () => {
  it('pantalla más alta que el campo: franjas arriba y abajo', () => {
    // 412×915 de pantalla (menos el marcador ≈ 412×780) con un campo de 360×540
    const a = fitArea(412, 780, 360, 540);
    const k = 412 / 360;
    expect(a.sx).toBeCloseTo(k, 10);
    expect(a.sy).toBeCloseTo(k, 10);
    expect(a.ox).toBe(0);
    expect(a.w).toBeCloseTo(412, 10);
    expect(a.h).toBeCloseTo(540 * k, 10);
    expect(a.oy).toBeCloseTo((780 - 540 * k) / 2, 10);
    expect(a.letterbox).toBe(true);
  });

  it('pantalla más ancha: franjas a los lados', () => {
    const a = fitArea(600, 540, 360, 540);
    expect(a.sx).toBe(1);
    expect(a.ox).toBe(120);
    expect(a.oy).toBe(0);
    expect(a.w).toBe(360);
    expect(a.h).toBe(540);
  });

  it('pantalla más chica que el campo: se reduce', () => {
    const a = fitArea(320, 500, 360, 540);
    expect(a.sx).toBeCloseTo(320 / 360, 10);
    expect(a.sx).toBeLessThan(1);
    expect(a.w).toBeCloseTo(320, 10);
  });

  it('el mismo punto lógico cae en el mismo lugar relativo en cualquier pantalla', () => {
    for (const [cw, ch] of [
      [360, 520],
      [390, 700],
      [412, 780],
    ]) {
      const a = fitArea(cw, ch, 360, 540);
      const p = tapToField(a, a.ox + 180 * a.sx, a.oy + 270 * a.sy)!;
      expect(p.x).toBeCloseTo(180, 9);
      expect(p.y).toBeCloseTo(270, 9);
    }
  });

  it('un toque fuera del rectángulo se ignora (no cuesta vida)', () => {
    const a = fitArea(412, 780, 360, 540);
    expect(tapToField(a, 200, a.oy - 1)).toBeNull();
    expect(tapToField(a, 200, a.oy + a.h + 1)).toBeNull();
    expect(tapToField(a, 200, 2)).toBeNull();
    const side = fitArea(600, 540, 360, 540);
    expect(tapToField(side, 119, 100)).toBeNull();
    expect(tapToField(side, 481, 100)).toBeNull();
    expect(tapToField(a, Number.NaN, 100)).toBeNull();
  });

  it('los bordes del rectángulo cuentan como dentro', () => {
    const a = fitArea(600, 540, 360, 540);
    expect(tapToField(a, 120, 0)).toEqual({ x: 0, y: 0 });
    expect(tapToField(a, 480, 540)).toEqual({ x: 360, y: 540 });
  });

  it('bloques: posición y tamaño con la misma escala', () => {
    const a = fitArea(720, 1080, 360, 540);
    expect(rectToArea(a, { x: 10, y: 20, w: 70, h: 70 })).toEqual({ x: 20, y: 40, w: 140, h: 140 });
  });

  it('sin medidas todavía no se rompe', () => {
    expect(fitArea(0, 0, 360, 540).sx).toBe(1);
    expect(stretchArea(0, 0, 360, 540).sx).toBe(1);
  });
});

describe('areaFor', () => {
  it('elige según el modo', () => {
    expect(areaFor(false, 412, 780, 412, 780).letterbox).toBe(false);
    expect(areaFor(true, 412, 780, 360, 540).letterbox).toBe(true);
  });
});

describe('serverField: el campo de la respuesta de POST /runs', () => {
  const sent = { fieldW: 390, fieldH: 640 };
  it('válido: se usa el del servidor (normal y retos)', () => {
    expect(serverField(false, sent, { fieldW: 390, fieldH: 640 })).toEqual({ fieldW: 390, fieldH: 640 });
    expect(serverField(true, sent, { fieldW: 360, fieldH: 540 })).toEqual({ fieldW: 360, fieldH: 540 });
    expect(serverField(true, sent, { fieldW: FIELD_MIN, fieldH: FIELD_MAX })).toEqual({ fieldW: FIELD_MIN, fieldH: FIELD_MAX });
  });
  it('partida normal sin campo (API anterior a la fase 3): el enviado', () => {
    expect(serverField(false, sent, {})).toEqual(sent);
    expect(serverField(false, sent, { fieldW: 0, fieldH: undefined })).toEqual(sent);
  });
  it('reto sin campo válido: null (no se usa el tamaño de la pantalla)', () => {
    expect(serverField(true, sent, {})).toBeNull();
    expect(serverField(true, sent, { fieldW: 360 })).toBeNull();
    expect(serverField(true, sent, { fieldW: 0, fieldH: 540 })).toBeNull();
    expect(serverField(true, sent, { fieldW: Number.NaN, fieldH: 540 })).toBeNull();
    expect(serverField(true, sent, { fieldW: '360', fieldH: 540 })).toBeNull();
    expect(serverField(true, sent, { fieldW: FIELD_MIN - 1, fieldH: 540 })).toBeNull();
    expect(serverField(true, sent, { fieldW: 360, fieldH: FIELD_MAX + 1 })).toBeNull();
    expect(serverField(true, sent, { fieldW: Infinity, fieldH: 540 })).toBeNull();
  });
});
