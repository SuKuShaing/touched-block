import type { PrismaClient } from '../generated/prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { parseResetArgs, resetProgress } from './reset-progress';

describe('parseResetArgs', () => {
  it('sin argumentos es una simulación', () => {
    expect(parseResetArgs([])).toEqual({ apply: false });
  });

  it('borra solo con --apply y la confirmación literal', () => {
    expect(parseResetArgs(['--apply', '--confirm=BORRAR-PROGRESO'])).toEqual({ apply: true });
    expect(parseResetArgs(['--confirm=BORRAR-PROGRESO', '--apply'])).toEqual({ apply: true });
  });

  it.each([
    [['--apply']],
    [['--confirm=BORRAR-PROGRESO']],
    [['--apply', '--confirm']],
    [['--apply', '--confirm=borrar-progreso']],
    [['--apply', '--confirm=BORRAR-PROGRESO ']],
    [['--apply', '--apply']],
    [['--apply', '--confirm=BORRAR-PROGRESO', '--dry-run']],
    [['--dry-run']],
  ])('%j es un error', (argv) => {
    expect(() => parseResetArgs(argv)).toThrow(/--apply --confirm=BORRAR-PROGRESO/);
  });
});

describe('resetProgress con reglas anteriores a la v6', () => {
  it('se niega sin tocar la base', async () => {
    vi.resetModules();
    vi.doMock('@tb/engine', () => ({ RULES_VERSION: 5 }));
    try {
      const old = await import('./reset-progress.js');
      const $transaction = vi.fn();
      for (const apply of [false, true]) {
        await expect(old.resetProgress({ $transaction } as unknown as PrismaClient, { apply, log: () => {} })).rejects.toThrow(/v6/);
      }
      expect($transaction).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('@tb/engine');
      vi.resetModules();
    }
  });

  it('con las reglas actuales abre la transacción', async () => {
    const $transaction = vi.fn(async () => {
      throw new Error('sin base');
    });
    await expect(resetProgress({ $transaction } as unknown as PrismaClient, { apply: false, log: () => {} })).rejects.toThrow('sin base');
  });
});
