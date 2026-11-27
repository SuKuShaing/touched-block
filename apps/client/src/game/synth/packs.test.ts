import { describe, expect, it } from 'vitest';
import { DERIVED_SOUNDS, derivedNotes } from './events';
import { fakeContext } from './fakeAudio';
import { durationOf, type Note } from './notes';
import { SYNTH_PACKS, type SynthPackId } from './packs';
import { clearStrings, createMotor, scheduleNotes } from './voices';

// fs y vm de Node sin depender de @types/node (el cliente no los tiene); vitest corre en apps/client
const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(path: string, enc: 'utf8'): string };
const vm = (await import(/* @vite-ignore */ 'node:' + 'vm')) as { runInNewContext(code: string, sandbox: object): unknown };

/** La maqueta de la que se portaron las voces y las notas. */
interface Original {
  ids: string[];
  paquetes: Record<string, { nivel: number; hit(n: number): object[]; kill(): object[]; combo(b: number): object[] }>;
  tocar(ctx: unknown, id: string, que: string, arg: number, t0: number): number;
  motorDe(ctx: unknown): { bus: object };
}
function loadOriginal(): Original {
  const window: { TBSonidos?: Original } = {};
  // las mismas funciones matemáticas y arreglos que aquí, para comparar bit a bit
  vm.runInNewContext(fs.readFileSync('../../config_logros/sonidos.js', 'utf8'), { window, Math, Float32Array, Object, WeakMap, Map });
  return window.TBSonidos!;
}
const original = loadOriginal();
const IDS = Object.keys(SYNTH_PACKS) as SynthPackId[];
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/** Jugadas que define la maqueta. */
const PLAYS: [('hit' | 'kill' | 'combo'), number][] = [
  ...Array.from({ length: 15 }, (_, n): ['hit', number] => ['hit', n]),
  ['kill', 0],
  ...[0, 1, 2, 3, 6].map((b): ['combo', number] => ['combo', b]),
];

describe('fieles a config_logros/sonidos.js', () => {
  it('son los mismos 6 paquetes, con el mismo volumen', () => {
    expect([...IDS].sort()).toEqual([...original.ids].sort());
    for (const id of IDS) expect(SYNTH_PACKS[id].level, id).toBe(original.paquetes[id].nivel);
  });

  it.each(IDS)('%s: mismas notas en hit, kill y combo', (id) => {
    for (const [name, arg] of PLAYS) {
      expect(plain(SYNTH_PACKS[id][name](arg)), `${name} ${arg}`).toEqual(plain(original.paquetes[id][name](arg)));
    }
  });

  it.each(IDS)('%s: las voces arman el mismo grafo de audio', (id) => {
    for (const [name, arg] of [['hit', 3], ['kill', 0], ['combo', 3]] as const) {
      clearStrings();
      const theirs = fakeContext();
      const { bus } = original.motorDe(theirs); // su bus y su limitador no son parte de la nota
      theirs.alias(bus, 'OUT');
      const skip = theirs.log.length;
      original.tocar(theirs, id, name, arg, 0);

      const mine = fakeContext();
      const pack = SYNTH_PACKS[id];
      scheduleNotes(createMotor(mine as unknown as BaseAudioContext, mine.destination as AudioNode), pack.voice, pack.level, pack[name](arg), 0);

      // los números de nodo de la maqueta incluyen la ganancia y el limitador del bus
      const renumber = (l: string) =>
        l.replace(/\b(Gain|Shaper)(\d+)/g, (_, kind: string, n: string) => `${kind}${Number(n) - 1}`);
      expect(mine.log, `${id} ${name}`).toEqual(theirs.log.slice(skip).map(renumber));
    }
  });

  it('la guitarra no usa remuestreo en el WaveShaper (inseguro en la app)', () => {
    clearStrings();
    const ctx = fakeContext();
    const shapers: { oversample?: string }[] = [];
    const create = ctx.createWaveShaper;
    ctx.createWaveShaper = () => {
      const s = create();
      shapers.push(s);
      return s;
    };
    const pack = SYNTH_PACKS.guitarra;
    scheduleNotes(createMotor(ctx as unknown as BaseAudioContext, ctx.destination as AudioNode), pack.voice, pack.level, pack.kill(), 0);
    expect(shapers).toHaveLength(3);
    for (const s of shapers) expect(s.oversample).toBeUndefined();
  });
});

describe('los 7 sonidos derivados (B12)', () => {
  const freqs = (notes: Note[]) => notes.map((n) => n.f);
  const times = (notes: Note[]) => notes.map((n) => Math.round(n.dt * 1000));

  it.each(IDS)('%s sigue la tabla', (id) => {
    const E = SYNTH_PACKS[id].scale;
    expect(E).toHaveLength(13);
    const get = (name: (typeof DERIVED_SOUNDS)[number]) => derivedNotes(id, name);

    expect(freqs(get('start'))).toEqual([E[5]]);
    expect(get('start')[0].d).toBe(0.12);
    expect(freqs(get('heal'))).toEqual([E[7], E[9], E[11]]);
    expect(times(get('heal'))).toEqual([0, 70, 140]);
    expect(freqs(get('milestone'))).toEqual([E[5], E[7], E[8], E[10]]);
    expect(times(get('milestone'))).toEqual([0, 90, 180, 270]);
    expect(freqs(get('end'))).toEqual([E[7], E[5], E[3], E[0]]);
    expect(times(get('end'))).toEqual([0, 150, 300, 450]);
    const end = get('end');
    expect(end[3].d).toBeGreaterThan(end[0].d); // cola larga
    expect(freqs(get('trap'))).toEqual([E[0] / 2, (E[0] / 2) * 0.944]);
    expect(times(get('trap'))).toEqual([0, 90]);
    expect(get('trap').map((n) => n.d)).toEqual([0.45, 0.45]);
    expect(freqs(get('miss'))).toEqual([E[0] * 0.63]);
    expect(get('miss')[0].d).toBe(0.25);
    expect(freqs(get('expire'))).toEqual([E[1] * 0.75]);
    expect(get('expire')[0].d).toBe(0.15);
  });

  it('la escala de cada paquete es la de la maqueta', () => {
    for (const id of IDS.filter((x) => x !== 'palitos')) {
      for (let n = 0; n <= 12; n++) {
        expect(SYNTH_PACKS[id].scale[n], `${id} ${n}`).toBe((original.paquetes[id].hit(n)[0] as Note).f);
      }
    }
    for (let n = 0; n <= 12; n++) expect(SYNTH_PACKS.palitos.scale[n]).toBe((original.paquetes.palitos.hit(n)[0] as Note).f);
  });

  it.each(IDS)('%s: la trampa es la más fuerte y los errores nunca suben', (id) => {
    const loudest = (name: (typeof DERIVED_SOUNDS)[number]) => Math.max(...derivedNotes(id, name).map((n) => n.v));
    for (const name of DERIVED_SOUNDS.filter((n) => n !== 'trap')) expect(loudest('trap'), name).toBeGreaterThan(loudest(name));
    expect(loudest('expire')).toBeLessThan(loudest('miss'));
    for (const name of ['trap', 'miss', 'expire'] as const) {
      const notes = derivedNotes(id, name);
      notes.forEach((n, i) => {
        if (i > 0) expect(n.f).toBeLessThan(notes[i - 1].f);
        // tampoco dentro de la nota (deslizamiento de la futurista y "scoop" del viento)
        if (n.f0 !== undefined) expect(n.f0).toBeGreaterThanOrEqual(n.f);
        else expect(['futurista', 'viento']).not.toContain(id);
      });
    }
  });

  it('la cuerda con palma (0,3 s) alcanza para cada nota que la usa', () => {
    for (const name of DERIVED_SOUNDS) {
      for (const n of derivedNotes('guitarra', name)) expect(n.d, name).toBeLessThanOrEqual(n.mute ? 0.29 : 0.74);
    }
  });

  it.each(IDS)('%s: todos se programan y duran poco', (id) => {
    const pack = SYNTH_PACKS[id];
    for (const name of DERIVED_SOUNDS) {
      clearStrings();
      const ctx = fakeContext();
      const notes = derivedNotes(id, name);
      scheduleNotes(createMotor(ctx as unknown as BaseAudioContext, ctx.destination as AudioNode), pack.voice, pack.level, notes, 0);
      expect(ctx.log.join(' ')).not.toMatch(/NaN|Infinity|undefined/);
      expect(durationOf(notes)).toBeLessThan(1.2);
    }
  });
});
