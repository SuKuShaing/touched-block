/**
 * Contexto de audio falso para los tests de la síntesis: anota cada nodo, ajuste y conexión en
 * orden. No lo usa el juego.
 */
export interface FakeParam {
  value: number;
}

export interface FakeContext {
  /** Operaciones en orden, p. ej. `Gain1.gain.setValueAtTime(0.0001,0.005)`. */
  log: string[];
  /** Nodos creados, por tipo. */
  count(kind: string): number;
  nodes(): number;
  currentTime: number;
  sampleRate: number;
  destination: object;
  oncomplete: ((e: { renderedBuffer: AudioBuffer }) => void) | null;
}

const num = (x: unknown) => (typeof x === 'number' ? String(Math.round(x * 1e6) / 1e6) : String(x));

export function fakeContext(options: { sampleRate?: number; render?: () => Promise<unknown> } = {}) {
  const sampleRate = options.sampleRate ?? 48000;
  const log: string[] = [];
  const counts = new Map<string, number>();
  const label = new WeakMap<object, string>();
  const nameOf = (o: unknown) => (typeof o === 'object' && o !== null ? (label.get(o) ?? '?') : num(o));

  function param(owner: string, name: string, initial: number) {
    let value = initial;
    const op =
      (method: string) =>
      (...args: unknown[]) => {
        log.push(`${owner}.${name}.${method}(${args.map(num).join(',')})`);
      };
    const p = {
      get value() {
        return value;
      },
      set value(v: number) {
        value = v;
        log.push(`${owner}.${name}=${num(v)}`);
      },
      setValueAtTime: op('setValueAtTime'),
      linearRampToValueAtTime: op('linearRamp'),
      exponentialRampToValueAtTime: op('exponentialRamp'),
      setTargetAtTime: op('setTarget'),
      cancelScheduledValues: op('cancel'),
    };
    label.set(p, `${owner}.${name}`);
    return p;
  }

  function node(kind: string, params: Record<string, number>, props: readonly string[] = [], methods: readonly string[] = []) {
    const i = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, i);
    const id = `${kind}${i}`;
    const n: Record<string, unknown> = {
      id,
      connect: (to: object) => {
        log.push(`${id}>${nameOf(to)}`);
        return to;
      },
      disconnect: () => log.push(`${id}.disconnect()`),
    };
    for (const [name, initial] of Object.entries(params)) n[name] = param(id, name, initial);
    for (const name of props) {
      let value: unknown;
      Object.defineProperty(n, name, {
        get: () => value,
        set: (v: unknown) => {
          value = v;
          if (name === 'oversample') return;
          log.push(`${id}.${name}=${v instanceof Float32Array ? `curva${v.length}` : nameOf(v)}`);
        },
      });
    }
    for (const m of methods) n[m] = (...args: unknown[]) => log.push(`${id}.${m}(${args.map(nameOf).join(',')})`);
    label.set(n, id);
    log.push(`+${id}`);
    return n;
  }

  const destination = {};
  label.set(destination, 'OUT');
  const ctx = {
    log,
    sampleRate,
    currentTime: 0,
    destination,
    oncomplete: null,
    count: (kind: string) => counts.get(kind) ?? 0,
    nodes: () => [...counts.entries()].filter(([k]) => k !== 'Buffer' && k !== 'Wave').reduce((a, [, c]) => a + c, 0),
    /** Para que las notas cuya salida es el bus de la maqueta se comparen con las del juego. */
    alias: (o: object, name: string) => label.set(o, name),
    createGain: () => node('Gain', { gain: 1 }),
    createOscillator: () => node('Osc', { frequency: 440, detune: 0 }, ['type'], ['start', 'stop', 'setPeriodicWave']),
    createBiquadFilter: () => node('Filter', { frequency: 350, Q: 1 }, ['type']),
    createWaveShaper: () => node('Shaper', {}, ['curve', 'oversample']),
    createBufferSource: () => node('Source', { playbackRate: 1 }, ['buffer'], ['start', 'stop']),
    createPeriodicWave: (real: Float32Array, imag: Float32Array) => {
      const w = node('Wave', {});
      log.push(`${w.id}=${[...real].map(num).join(',')}/${[...imag].map(num).join(',')}`);
      return w;
    },
    createBuffer: (_channels: number, length: number, rate: number) => {
      const data = new Float32Array(length);
      const b = node('Buffer', {});
      Object.assign(b, { length, sampleRate: rate, duration: length / rate, getChannelData: () => data });
      return b;
    },
    startRendering: () =>
      options.render ? options.render() : Promise.resolve({ length: 1, sampleRate, duration: 0.2 }),
  };
  return ctx;
}
