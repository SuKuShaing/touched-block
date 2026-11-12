import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { beep, buzz } = vi.hoisted(() => ({ beep: vi.fn(), buzz: vi.fn() }));
vi.mock('@/platform/fx', () => ({ fx: { beep, buzz } }));

import { BUZZ, SOUND_PACKS, type SoundName, sounds } from './sounds';

const NAMES: SoundName[] = ['start', 'hit', 'kill', 'trap', 'heal', 'expire', 'miss', 'combo', 'end', 'milestone'];

beforeEach(() => {
  vi.useFakeTimers();
  beep.mockClear();
  buzz.mockClear();
});
afterEach(() => vi.useRealTimers());

const run = (name: SoundName, arg?: number, pack?: string) => {
  sounds.play(name, arg, pack);
  vi.runAllTimers();
  return { beeps: beep.mock.calls, buzzes: buzz.mock.calls };
};

// Los valores que tenía GameScreen antes de la fase 2: el paquete 8 bits no puede cambiarlos.
describe('8 bits suena como siempre', () => {
  it('hit sube con los toques, con tope en 12', () => {
    expect(run('hit', 3)).toEqual({ beeps: [[510, 0.07]], buzzes: [[10]] });
    beep.mockClear();
    buzz.mockClear();
    expect(run('hit', 25).beeps).toEqual([[1140, 0.07]]);
  });

  it('kill, trap, expire, miss, end y start', () => {
    expect(run('kill')).toEqual({ beeps: [[880, 0.15, 'triangle', 0.09]], buzzes: [[30]] });
    beep.mockClear();
    buzz.mockClear();
    expect(run('trap')).toEqual({ beeps: [[90, 0.4, 'sawtooth', 0.12]], buzzes: [[250]] });
    beep.mockClear();
    buzz.mockClear();
    expect(run('expire')).toEqual({ beeps: [[150, 0.15, 'sawtooth', 0.05]], buzzes: [] });
    beep.mockClear();
    buzz.mockClear();
    expect(run('miss')).toEqual({ beeps: [[120, 0.25, 'sawtooth', 0.08]], buzzes: [[80]] });
    beep.mockClear();
    buzz.mockClear();
    expect(run('end')).toEqual({ beeps: [[200, 0.5, 'sawtooth', 0.08]], buzzes: [[150]] });
    beep.mockClear();
    buzz.mockClear();
    expect(run('start')).toEqual({ beeps: [[520, 0.1, 'triangle', 0.08]], buzzes: [] });
  });

  it('heal: tres notas cada 70 ms', () => {
    sounds.play('heal');
    expect(buzz.mock.calls).toEqual([[40]]);
    vi.advanceTimersByTime(0);
    expect(beep.mock.calls).toEqual([[660, 0.1, 'triangle', 0.07]]);
    vi.advanceTimersByTime(140);
    expect(beep.mock.calls).toEqual([
      [660, 0.1, 'triangle', 0.07],
      [880, 0.1, 'triangle', 0.07],
      [1320, 0.1, 'triangle', 0.07],
    ]);
  });

  it('combo: más notas cuanto mayor el premio', () => {
    sounds.play('combo', 1);
    expect(beep.mock.calls).toEqual([[660, 0.09, 'triangle', 0.06]]); // la primera al tiro
    vi.runAllTimers();
    expect(beep.mock.calls.map((c) => c[0])).toEqual([660, 830, 990]);
    expect(buzz.mock.calls).toEqual([[25]]);
    beep.mockClear();
    run('combo', 5);
    expect(beep.mock.calls.map((c) => c[0])).toEqual([660, 830, 990, 1320, 1660]);
  });

  it('milestone: 523, 659 y 784 Hz cada 90 ms', () => {
    sounds.play('milestone');
    vi.advanceTimersByTime(90);
    expect(beep.mock.calls).toEqual([
      [523, 0.12, 'triangle', 0.07],
      [659, 0.12, 'triangle', 0.07],
    ]);
    vi.advanceTimersByTime(90);
    expect(beep.mock.calls.map((c) => c[0])).toEqual([523, 659, 784]);
    expect(buzz.mock.calls).toEqual([[30]]);
  });
});

describe('paquetes', () => {
  it('sin elegir nada (o con un paquete desconocido) suena 8 bits', () => {
    expect(run('kill').beeps).toEqual([[880, 0.15, 'triangle', 0.09]]);
    beep.mockClear();
    expect(run('kill', 0, 'no-existe').beeps).toEqual([[880, 0.15, 'triangle', 0.09]]);
  });

  it.each(Object.keys(SOUND_PACKS))('%s tiene todos los sonidos y vibra igual', (pack) => {
    for (const name of NAMES) {
      beep.mockClear();
      buzz.mockClear();
      run(name, 2, pack);
      expect(beep).toHaveBeenCalled();
      expect(buzz.mock.calls).toEqual(BUZZ[name] ? [[BUZZ[name]]] : []);
    }
  });

  it('los paquetes nuevos suenan distinto de 8 bits', () => {
    const sig = (pack: string) => {
      beep.mockClear();
      for (const name of NAMES) run(name, 2, pack);
      return JSON.stringify(beep.mock.calls);
    };
    const base = sig('8bits');
    expect(sig('suave')).not.toBe(base);
    expect(sig('marimba')).not.toBe(base);
    expect(sig('suave')).not.toBe(sig('marimba'));
  });

  it('preview no lanza y suena', () => {
    sounds.preview('marimba');
    vi.runAllTimers();
    expect(beep).toHaveBeenCalled();
    expect(buzz).not.toHaveBeenCalled();
  });
});
