import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { beep, buzz, audio, active } = vi.hoisted(() => ({
  beep: vi.fn(),
  buzz: vi.fn(),
  audio: { live: vi.fn(), offline: vi.fn(), release: vi.fn() },
  active: { soundPack: '8bits' },
}));
vi.mock('@/platform/fx', () => ({ fx: { beep, buzz } }));
vi.mock('@/platform/synthAudio', () => ({ synthAudio: audio }));
vi.mock('@/cosmetics/active', () => ({ getActiveCosmetics: () => active }));

import { SOUND_PACKS, sounds } from '@/game/sounds';
import { CATALOG } from '@/cosmetics/catalog';
import { fakeContext } from './fakeAudio';
import { SYNTH_PACKS, isSynthPack, type SynthPackId } from './packs';
import { EVENT_KEYS, MAX_FAILURES, MAX_VOICES, createSynthPlayer, keyFor } from './render';

const IDS = Object.keys(SYNTH_PACKS) as SynthPackId[];

type Fake = ReturnType<typeof fakeContext>;

/** Plataforma falsa: un contexto en vivo y uno nuevo por cada render. */
function platform(render?: () => Promise<unknown>) {
  const live = fakeContext();
  const offline: { ctx: Fake; length: number; sampleRate: number }[] = [];
  const released: unknown[] = [];
  return {
    live,
    offline,
    released,
    audio: {
      live: vi.fn(() => live as unknown as BaseAudioContext),
      offline: vi.fn((length: number, sampleRate: number) => {
        const ctx = fakeContext({ sampleRate, render });
        offline.push({ ctx, length, sampleRate });
        return ctx as unknown as OfflineAudioContext;
      }),
      release: vi.fn((c: unknown) => released.push(c)),
    },
  };
}

const settle = async (idle: () => Promise<void>) => {
  await vi.advanceTimersByTimeAsync(2000);
  await idle();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  active.soundPack = '8bits';
});
afterEach(() => vi.useRealTimers());

describe('renderizar y reutilizar', () => {
  it('son 24 búferes: 13 toques, destruir, 3 combos y los 7 derivados', () => {
    expect(new Set(EVENT_KEYS).size).toBe(24);
    expect(keyFor('hit', 40)).toBe('hit12');
    expect(keyFor('hit', -1)).toBe('hit0');
    expect([1, 2, 3, 9].map((b) => keyFor('combo', b))).toEqual(['combo1', 'combo2', 'combo3', 'combo3']);
    expect(keyFor('combo', 0)).toBeNull();
    for (const name of ['kill', 'start', 'trap', 'heal', 'expire', 'miss', 'end', 'milestone'] as const) {
      expect(EVENT_KEYS).toContain(keyFor(name));
    }
  });

  it.each(IDS)('%s: un contexto mono por sonido, sin limitador, y todos liberados', async (id) => {
    const p = platform();
    const player = createSynthPlayer(p.audio);
    player.prepare(id);
    expect(p.audio.offline).not.toHaveBeenCalled(); // vuelve de inmediato
    await settle(player.idle);
    expect(player.state()).toEqual({ id, status: 'done', ready: 24 });
    expect(p.offline).toHaveLength(24);
    expect(p.released).toHaveLength(24);
    for (const { ctx, length, sampleRate } of p.offline) {
      expect(sampleRate).toBe(48000);
      expect(length).toBeGreaterThan(48000 * 0.05);
      expect(length).toBeLessThan(48000 * 1.3);
      expect(length % 128).toBe(0);
      // el limitador queda en vivo: el único WaveShaper permitido es el de la guitarra
      if (id !== 'guitarra') expect(ctx.count('Shaper')).toBe(0);
      // muy por debajo de la cola de la librería nativa (1024 nodos) que la bloquearía
      expect(ctx.nodes()).toBeLessThan(300);
    }
  });

  it('con el búfer listo suena desde memoria: fuente → ganancia → bus → limitador', async () => {
    const p = platform();
    const player = createSynthPlayer(p.audio);
    player.prepare('piano');
    await settle(player.idle);
    player.play('piano', 'hit', 3);
    expect(p.live.count('Osc')).toBe(0);
    expect(p.live.count('Shaper')).toBe(1);
    expect(p.live.log).toEqual(expect.arrayContaining(['Gain1>Shaper1', 'Shaper1>OUT', 'Source1>Gain2', 'Gain2>Gain1', 'Source1.start(0)']));
    player.play('piano', 'kill');
    expect(p.live.count('Source')).toBe(2);
    expect(p.live.count('Shaper')).toBe(1); // el bus es permanente
  });

  it('sin búfer todavía (o sin búfer posible) suena en vivo con la misma voz', async () => {
    const p = platform();
    const player = createSynthPlayer(p.audio);
    player.prepare('piano');
    player.play('piano', 'hit', 3);
    expect(p.live.count('Osc')).toBe(2);
    await settle(player.idle);
    player.play('piano', 'combo', 0); // combo sin premio: no se renderiza
    expect(p.live.count('Osc')).toBe(2 + 2 * 2);
  });

  it('si el render falla, todo en vivo; y tras varios fallos no se reintenta', async () => {
    const p = platform(() => Promise.reject(new Error('no')));
    const player = createSynthPlayer(p.audio);
    for (let i = 0; i < MAX_FAILURES; i++) {
      player.prepare('viento');
      await settle(player.idle);
    }
    expect(p.offline).toHaveLength(MAX_FAILURES);
    expect(p.released).toHaveLength(MAX_FAILURES);
    player.prepare('viento');
    player.prepare('piano');
    await settle(player.idle);
    expect(p.offline).toHaveLength(MAX_FAILURES);
    player.play('piano', 'kill');
    expect(p.live.count('Osc')).toBeGreaterThan(0);
  });

  it('sin OfflineAudioContext, o si un nodo no existe, no lanza y suena en vivo', async () => {
    const p = platform();
    p.audio.offline.mockImplementation(() => null as unknown as OfflineAudioContext);
    const player = createSynthPlayer(p.audio);
    player.prepare('electronico');
    await settle(player.idle);
    expect(player.state()).toMatchObject({ status: 'failed', ready: 0 });
    player.play('electronico', 'hit', 1);
    expect(p.live.count('Osc')).toBe(3);

    const broken = fakeContext();
    broken.createBiquadFilter = () => {
      throw new Error('sin filtros');
    };
    p.audio.offline.mockImplementation(() => broken as unknown as OfflineAudioContext);
    player.prepare('electronico');
    await settle(player.idle);
    expect(p.released).toEqual([broken]);
    p.audio.live.mockImplementation(() => broken as unknown as BaseAudioContext);
    expect(() => player.play('electronico', 'kill')).not.toThrow();
  });

  it('un render colgado se abandona sin soltar su contexto', async () => {
    const p = platform(() => new Promise(() => {}));
    const player = createSynthPlayer(p.audio);
    player.prepare('piano');
    await vi.advanceTimersByTimeAsync(9000);
    await player.idle();
    expect(player.state()).toMatchObject({ status: 'failed' });
    expect(p.released).toHaveLength(0);
  });

  it('preparar el mismo paquete no repite; cambiarlo descarta lo anterior, aunque llegue tarde', async () => {
    const pending: (() => void)[] = [];
    const p = platform(() => new Promise((resolve) => pending.push(() => resolve({ duration: 0.1, sampleRate: 48000, length: 1 }))));
    const player = createSynthPlayer(p.audio);
    player.prepare('piano');
    player.prepare('piano');
    await vi.advanceTimersByTimeAsync(20);
    expect(pending).toHaveLength(1);
    player.prepare('viento');
    await vi.advanceTimersByTimeAsync(100);
    expect(pending).toHaveLength(1); // nunca dos renders a la vez
    pending[0](); // termina el de piano, ya reemplazado
    await vi.advanceTimersByTimeAsync(20);
    expect(player.state()).toEqual({ id: 'viento', status: 'rendering', ready: 0 });
    expect(pending).toHaveLength(2);
    player.play('piano', 'hit', 1); // de piano no queda nada
    expect(p.live.count('Source')).toBe(1); // solo el ruido del martillo, en vivo
    expect(p.live.count('Osc')).toBe(2);
    player.drop();
    expect(player.state()).toBeNull();
    pending[1]();
    await settle(player.idle);
    expect(player.state()).toBeNull();
    expect(pending).toHaveLength(2);
  });

  it(`nunca hay más de ${MAX_VOICES} voces: la más vieja se apaga`, async () => {
    const p = platform();
    const player = createSynthPlayer(p.audio);
    player.prepare('palitos');
    await settle(player.idle);
    for (let i = 0; i < MAX_VOICES; i++) player.play('palitos', 'hit', i);
    const fades = () => p.live.log.filter((l) => l.includes('.gain.setTarget('));
    expect(fades()).toHaveLength(0);
    player.play('palitos', 'hit', 1);
    // Gain1 es el bus: la primera voz es Gain2
    expect(fades()).toEqual(['Gain2.gain.setTarget(0,0,0.004)']);
    expect(p.live.log).toContain('Source1.stop(0.05)');
    player.play('palitos', 'hit', 2);
    expect(fades()).toHaveLength(2);
  });

  it('el tope también cuenta las notas en vivo, y las terminadas no ocupan lugar', () => {
    const p = platform();
    const player = createSynthPlayer(p.audio);
    for (let i = 0; i < MAX_VOICES + 3; i++) player.play('piano', 'hit', 1);
    const fades = () => p.live.log.filter((l) => l.includes('.gain.setTarget('));
    expect(fades()).toHaveLength(3);
    p.live.currentTime = 10;
    for (let i = 0; i < MAX_VOICES; i++) player.play('piano', 'hit', 1);
    expect(fades()).toHaveLength(3);
  });

  it('sin contexto en vivo (sonido apagado o antes del primer gesto) no hace nada', async () => {
    const p = platform();
    p.audio.live.mockImplementation(() => null as unknown as BaseAudioContext);
    const player = createSynthPlayer(p.audio);
    player.prepare('piano');
    player.play('piano', 'kill');
    await settle(player.idle);
    expect(p.offline).toHaveLength(0);
    expect(player.state()).toBeNull();
  });
});

describe('sounds', () => {
  function wire() {
    const p = platform();
    audio.live.mockImplementation(p.audio.live);
    audio.offline.mockImplementation(p.audio.offline);
    audio.release.mockImplementation(p.audio.release);
    return p;
  }

  it('cada sonido del catálogo existe (en vivo o sintetizado)', () => {
    const ids = CATALOG.filter((c) => c.type === 'sound').map((c) => c.id);
    expect(ids).toHaveLength(9);
    for (const id of ids) expect(isSynthPack(id) || id in SOUND_PACKS, id).toBe(true);
    expect(ids.filter((id) => isSynthPack(id)).sort()).toEqual([...IDS].sort());
  });

  it("play('start') prepara el paquete equipado y suena sin fx.beep; la vibración no cambia", async () => {
    const p = wire();
    active.soundPack = 'futurista';
    sounds.play('start');
    sounds.play('trap');
    await vi.advanceTimersByTimeAsync(2000);
    expect(p.offline).toHaveLength(24);
    expect(beep).not.toHaveBeenCalled();
    expect(buzz.mock.calls).toEqual([[250]]);
    const sources = p.live.count('Source');
    sounds.play('hit', 2);
    expect(p.live.count('Source')).toBe(sources + 1);
    sounds.prepare('8bits'); // suelta la memoria
    const osc = p.live.count('Osc');
    sounds.play('hit', 2, 'futurista');
    expect(p.live.count('Osc')).toBeGreaterThan(osc);
  });

  it('preview de un paquete sintetizado lo prepara y toca toque, toque, destruir y combo', async () => {
    const p = wire();
    sounds.preview('marimba');
    sounds.preview('palitos');
    await vi.advanceTimersByTimeAsync(2000);
    expect(p.offline).toHaveLength(24);
    expect(p.live.count('Osc') + p.live.count('Source')).toBeGreaterThan(0);
    expect(buzz).not.toHaveBeenCalled();
  });

  it('los 3 paquetes en vivo no renderizan nada', async () => {
    const p = wire();
    for (const id of Object.keys(SOUND_PACKS)) {
      sounds.play('start', 0, id);
      sounds.preview(id);
    }
    await vi.advanceTimersByTimeAsync(2000);
    expect(p.offline).toHaveLength(0);
    expect(p.live.nodes()).toBe(0);
    expect(beep).toHaveBeenCalled();
  });

  it('un fallo de audio no corta la vibración ni lanza', () => {
    audio.live.mockImplementation(() => {
      throw new Error('sin audio');
    });
    expect(() => sounds.play('kill', 0, 'piano')).not.toThrow();
    expect(() => sounds.preview('piano')).not.toThrow();
    expect(() => sounds.prepare('piano')).not.toThrow();
    expect(buzz.mock.calls).toEqual([[30]]);
  });
});
