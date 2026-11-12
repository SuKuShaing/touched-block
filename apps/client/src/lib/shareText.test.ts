import { describe, expect, it } from 'vitest';
import { ADD_START, LIFE_STAGE_START, MUL_START, NUM_STEP, TICKS_PER_SECOND } from '@tb/engine';
import { resultText, stageReached, stageText } from './shareText';

const secs = (s: number) => s * TICKS_PER_SECOND;

describe('stageText', () => {
  it('sin hitos no dice nada', () => {
    expect(stageText(0)).toBeNull();
    expect(stageText(undefined)).toBeNull();
    expect(stageText(secs(NUM_STEP) - 1)).toBeNull();
  });

  it('usa "al" con los números', () => {
    expect(stageText(secs(NUM_STEP))).toBe('Llegué al 4');
    expect(stageText(secs(4 * NUM_STEP) + 30)).toBe('Llegué al 7');
  });

  it('nombra cada etapa', () => {
    expect(stageText(secs(ADD_START))).toBe('Llegué a las sumas y restas');
    expect(stageText(secs(MUL_START + 10))).toBe('Llegué a las multiplicaciones y divisiones');
    expect(stageText(secs(LIFE_STAGE_START))).toBe('Llegué a los bloques de 4 s');
    expect(stageText(secs(10_000))).toBe('Llegué a los bloques de 1 s');
  });

  it('stageReached devuelve el hito', () => {
    expect(stageReached(secs(ADD_START + 5))?.kind).toBe('add');
  });
});

describe('resultText', () => {
  it('no cambió', () => {
    expect(resultText(1)).toBe('¡Destruí 1 bloque en Touched Block! ¿Me superas?');
    expect(resultText(47, 3)).toBe('¡Destruí 47 bloques en Touched Block y voy #3 en el mundo! ¿Me superas?');
  });
});
