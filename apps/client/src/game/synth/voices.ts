import { LEAD, type Note } from './notes';

/**
 * Las voces (una nota) de los paquetes sintetizados, portadas de `config_logros/sonidos.js`.
 * Sirven igual para renderizar (`OfflineAudioContext`) y para sonar en vivo, en la web y en la
 * app, así que usan SOLO nodos que `react-native-audio-api` implementa: oscilador (con
 * `PeriodicWave`), ganancia, filtro biquad, `WaveShaper`, fuente de búfer y `createBuffer`.
 *
 * El `WaveShaper` va sin `oversample`: en `react-native-audio-api` 1.0.0 el remuestreo escribe en
 * búferes de tamaño fijo sin comprobar cuántas muestras salen. No activarlo.
 */

/** −80 dB: las rampas exponenciales no pueden llegar a 0. */
export const SILENCE = 0.0001;

/** Dónde se dibujan las notas: un contexto, su salida y lo que se reutiliza entre notas. */
export interface Motor {
  ctx: BaseAudioContext;
  out: AudioNode;
  noise: AudioBuffer | null;
  waves: Map<string, PeriodicWave>;
  noiseTurn: number;
}

export function createMotor(ctx: BaseAudioContext, out: AudioNode): Motor {
  return { ctx, out, noise: null, waves: new Map(), noiseTurn: 0 };
}

/** La ganancia de la nota (para apagarla si hace falta) y el instante en que termina. */
export interface Voice {
  g: GainNode;
  end: number;
}

export type VoiceFn = (m: Motor, t: number, n: Note) => Voice;

type Curve = Float32Array<ArrayBuffer>;

/** Curva del limitador del bus: lineal hasta 0,6 y compresión suave después (tope ≈ 0,88). */
export function limiterCurve(): Curve {
  const n = 1025;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= 0.6 ? a : 0.6 + 0.33 * Math.tanh((a - 0.6) / 0.33);
    c[i] = x < 0 ? -y : y;
  }
  return c;
}

let satCache: Curve | null = null;
/** Curva de distorsión de la guitarra: saturación suave tipo válvula. */
function saturationCurve(): Curve {
  if (!satCache) {
    const n = 2049;
    const k = 2.2;
    const c = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * k) / norm;
    satCache = c;
  }
  return satCache;
}

/** 0,4 s de ruido blanco (generador congruencial: siempre el mismo ruido). */
function noiseBuffer(m: Motor): AudioBuffer {
  if (!m.noise) {
    const c = m.ctx;
    const n = Math.floor(c.sampleRate * 0.4);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    let s = 12345;
    for (let i = 0; i < n; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      d[i] = (s / 4294967296) * 2 - 1;
    }
    m.noise = b;
  }
  return m.noise;
}

function noiseSource(m: Motor, t: number, dur: number): AudioBufferSourceNode {
  const s = m.ctx.createBufferSource();
  s.buffer = noiseBuffer(m);
  m.noiseTurn = (m.noiseTurn + 1) % 7;
  s.start(t, m.noiseTurn * 0.043);
  s.stop(t + dur);
  return s;
}

/** Onda periódica por armónicos (amplitudes del 1.º, 2.º, 3.º…, todos senos). */
function wave(m: Motor, name: string, harmonics: readonly number[]): PeriodicWave {
  let w = m.waves.get(name);
  if (!w) {
    const real = new Float32Array(harmonics.length + 1);
    const imag = new Float32Array(harmonics.length + 1);
    harmonics.forEach((a, i) => (imag[i + 1] = a));
    w = m.ctx.createPeriodicWave(real, imag);
    m.waves.set(name, w);
  }
  return w;
}

/**
 * Envolvente: sube linealmente a `peak` en `attack` s y baja en rampas exponenciales por los
 * `steps` [segundo, valor]; el último paso es el fin (cae a 0 en 10 ms más para no dejar
 * escalón). Devuelve el instante en que la ganancia queda en 0.
 */
function envelope(g: GainNode, t: number, attack: number, peak: number, steps: readonly (readonly [number, number])[]): number {
  const p = g.gain;
  p.setValueAtTime(SILENCE, t);
  p.linearRampToValueAtTime(peak, t + attack);
  for (const [dt, v] of steps) p.exponentialRampToValueAtTime(Math.max(v, SILENCE), t + dt);
  const end = t + steps[steps.length - 1][0];
  p.linearRampToValueAtTime(0, end + 0.01);
  return end + 0.01;
}

function gain(m: Motor, out?: AudioNode): GainNode {
  const g = m.ctx.createGain();
  g.connect(out ?? m.out);
  return g;
}

function filter(m: Motor, type: BiquadFilterType, f: number, q: number): BiquadFilterNode {
  const b = m.ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

function oscillator(m: Motor, type: OscillatorType, f: number, t: number, end: number): OscillatorNode {
  const o = m.ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  o.start(t);
  o.stop(end);
  return o;
}

/**
 * Piano: 2 cuerdas desafinadas ±3 centésimas con armónicos que decaen, filtro que se cierra (los
 * agudos se apagan antes) y golpe de martillo (ruido corto).
 */
const PIANO_HARMONICS = [1, 0.55, 0.32, 0.2, 0.11, 0.07, 0.045, 0.03, 0.02, 0.012];
export const pianoVoice: VoiceFn = (m, t, o) => {
  const { f, d, v } = o;
  const g = gain(m);
  const end = envelope(g, t, 0.002, v, [[0.07, v * 0.45], [d, SILENCE]]);
  const lp = filter(m, 'lowpass', Math.min(f * 9, 8000), 0.7);
  lp.frequency.setValueAtTime(Math.min(f * 9, 8000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.8, 500), t + d);
  lp.connect(g);
  const w = wave(m, 'piano', PIANO_HARMONICS);
  for (const cents of [-3, 3]) {
    const os = m.ctx.createOscillator();
    os.setPeriodicWave(w);
    os.frequency.value = f;
    os.detune.value = cents;
    os.connect(lp);
    os.start(t);
    os.stop(end + 0.01);
  }
  // martillo: ruido pasa-banda de 15 ms
  const gm = gain(m);
  envelope(gm, t, 0.001, v * 0.35, [[0.016, SILENCE]]);
  const bp = filter(m, 'bandpass', Math.min(f * 3, 3500), 0.9);
  bp.connect(gm);
  noiseSource(m, t, 0.03).connect(bp);
  return { g, end };
};

/**
 * Karplus-Strong: cuerda pulsada como línea de retardo con filtro de pérdidas. Se genera una vez
 * por nota en un `AudioBuffer` (sirve en cualquier contexto) y se afina con `playbackRate`. Es la
 * única parte que se calcula en el hilo de la interfaz: por eso se hace al renderizar el paquete.
 */
interface PluckedString {
  buf: AudioBuffer;
  rate: number;
}
const strings = new Map<string, PluckedString>();

/** Suelta las cuerdas generadas (≈ 1 MB): son un paso intermedio del render. */
export function clearStrings(): void {
  strings.clear();
}

function pluckedString(m: Motor, f: number, mute: boolean): PluckedString {
  const sr = m.ctx.sampleRate;
  const key = `${sr}:${f}${mute ? 'm' : 'a'}`;
  const cached = strings.get(key);
  if (cached) return cached;
  const N = Math.max(3, Math.round(sr / f + 0.5));
  const realF = sr / (N - 0.5); // promediar una muestra con la siguiente resta media muestra de retardo
  const dur = mute ? 0.3 : 0.75;
  const len = Math.floor(sr * dur);
  const buf = m.ctx.createBuffer(1, len, sr);
  const out = buf.getChannelData(0);
  const line = new Float32Array(N);
  let s = 777 + N;
  let prev = 0;
  let mean = 0;
  for (let i = 0; i < N; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const rnd = (s / 4294967296) * 2 - 1;
    prev += 0.55 * (rnd - prev); // excitación algo suavizada: pulso de púa, no ruido blanco
    line[i] = prev;
    mean += prev;
  }
  mean /= N;
  let peak = 0;
  for (let i = 0; i < N; i++) {
    line[i] -= mean;
    peak = Math.max(peak, Math.abs(line[i]));
  }
  for (let i = 0; i < N; i++) line[i] /= peak || 1;
  const loss = mute ? 0.972 : 0.9975;
  let idx = 0;
  for (let n = 0; n < len; n++) {
    const a = line[idx];
    const b = line[idx + 1 === N ? 0 : idx + 1];
    out[n] = a;
    line[idx] = loss * 0.5 * (a + b);
    idx = idx + 1 === N ? 0 : idx + 1;
  }
  const result = { buf, rate: f / realF };
  strings.set(key, result);
  return result;
}

/** Guitarra eléctrica: cuerda → ganancia y saturación → pasa-altos y pasa-bajos de "altavoz". */
export const guitarVoice: VoiceFn = (m, t, o) => {
  const mute = !!o.mute;
  const { d, v } = o;
  const ks = pluckedString(m, o.f, mute);
  const src = m.ctx.createBufferSource();
  src.buffer = ks.buf;
  src.playbackRate.value = ks.rate;
  const pre = m.ctx.createGain();
  pre.gain.value = o.drive || 4;
  const shaper = m.ctx.createWaveShaper();
  shaper.curve = saturationCurve();
  const hp = filter(m, 'highpass', 110, 0.7);
  const lp = filter(m, 'lowpass', mute ? 1900 : 3400, 0.8);
  const g = gain(m);
  const end = envelope(g, t, 0.002, v, mute ? [[d * 0.35, v * 0.6], [d, SILENCE]] : [[0.1, v * 0.7], [d, SILENCE]]);
  src.connect(pre);
  pre.connect(shaper);
  shaper.connect(hp);
  hp.connect(lp);
  lp.connect(g);
  src.start(t);
  src.stop(end + 0.01);
  return { g, end };
};

/**
 * Palitos (claves): seno agudo de caída muy rápida + un 2.º modo no armónico + chasquido de
 * ruido. `flam`: el 2.º palito llega 9 ms después, un poco más agudo.
 */
export const sticksVoice: VoiceFn = (m, t, o) => {
  const { d } = o;
  const g = gain(m);
  const end = envelope(g, t, 0.0006, o.v, [[d, SILENCE]]);
  oscillator(m, 'sine', o.f, t, end + 0.01).connect(g);
  const g2 = gain(m);
  envelope(g2, t, 0.0005, o.v * 0.4, [[d * 0.4, SILENCE]]);
  oscillator(m, 'sine', o.f * 2.76, t, t + d).connect(g2);
  const gc = gain(m);
  envelope(gc, t, 0.0004, o.v * 0.5, [[0.012, SILENCE]]);
  const bp = filter(m, 'bandpass', Math.min(o.f * 1.4, 6000), 2.2);
  bp.connect(gc);
  noiseSource(m, t, 0.02).connect(bp);
  if (o.flam) sticksVoice(m, t + 0.009, { dt: 0, f: o.f * 1.07, v: o.v * 0.7, d: d * 0.8 });
  return { g, end };
};

/** Viento (flauta): seno con poco armónico, soplo, vibrato que entra despacio y "scoop" inicial. */
const FLUTE_HARMONICS = [1, 0.2, 0.07, 0.025];
export const windVoice: VoiceFn = (m, t, o) => {
  const { f, d, v } = o;
  const g = gain(m);
  const end = envelope(g, t, o.ataque || 0.014, v, [[d * 0.6, v * 0.8], [d, SILENCE]]);
  const os = m.ctx.createOscillator();
  os.setPeriodicWave(wave(m, 'flauta', FLUTE_HARMONICS));
  os.frequency.setValueAtTime(o.f0 || f * 0.97, t);
  os.frequency.exponentialRampToValueAtTime(f, t + 0.035);
  os.connect(g);
  os.start(t);
  os.stop(end + 0.01);
  // vibrato
  const lfo = oscillator(m, 'sine', 5.6, t, end + 0.01);
  const lg = m.ctx.createGain();
  lg.gain.setValueAtTime(0, t);
  lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.15);
  lfo.connect(lg);
  lg.connect(os.frequency);
  // soplo
  const gs = gain(m, g);
  envelope(gs, t, 0.008, v * 0.5, [[0.05, v * 0.16], [d * 0.7, v * 0.12], [d, SILENCE]]);
  const bp = filter(m, 'bandpass', Math.min(f * 2, 5000), 0.9);
  bp.connect(gs);
  noiseSource(m, t, d + 0.02).connect(bp);
  return { g, end };
};

/**
 * Electrónico: dos sierras desafinadas ±8 centésimas + un seno una octava abajo, por un pasa-bajos
 * resonante que se cierra rápido ("pluck" de sintetizador).
 */
export const electroVoice: VoiceFn = (m, t, o) => {
  const { f, d, v } = o;
  const g = gain(m);
  const end = envelope(g, t, 0.002, v, [[0.045, v * 0.7], [d, SILENCE]]);
  const lp = filter(m, 'lowpass', 1000, 6);
  lp.frequency.setValueAtTime(Math.min(f * (o.brillo || 9), 7000), t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 300), t + Math.min(d, 0.14));
  lp.connect(g);
  for (const cents of [-8, 8]) {
    const os = oscillator(m, 'sawtooth', f, t, end + 0.01);
    os.detune.value = cents;
    const gs = m.ctx.createGain();
    gs.gain.value = 0.5;
    os.connect(gs);
    gs.connect(lp);
  }
  const sub = oscillator(m, 'sine', f / 2, t, end + 0.01);
  const gsub = m.ctx.createGain();
  gsub.gain.value = 0.1;
  sub.connect(gsub);
  gsub.connect(lp);
  return { g, end };
};

/**
 * Futurista: FM de razón 1,41 (timbre metálico) con índice que se apaga, deslizamiento de afinación
 * (`f0` → `f`) y un seno una octava arriba. `soplo` suma un barrido de ruido. Los ecos son notas
 * más bajas que añade el paquete.
 */
export const futureVoice: VoiceFn = (m, t, o) => {
  const { f, d, v } = o;
  const f0 = o.f0 || f * 0.6;
  const glide = o.glis || 0.03;
  const g = gain(m);
  const lp = filter(m, 'lowpass', 6500, 0.7);
  lp.connect(g);
  const end = envelope(g, t, 0.003, v, [[Math.min(d * 0.35, 0.06), v * 0.6], [d, SILENCE]]);
  const c = oscillator(m, 'sine', f0, t, end + 0.01);
  c.frequency.setValueAtTime(f0, t);
  c.frequency.exponentialRampToValueAtTime(f, t + glide);
  const mo = oscillator(m, 'sine', f0 * 1.41, t, end + 0.01);
  mo.frequency.setValueAtTime(f0 * 1.41, t);
  mo.frequency.exponentialRampToValueAtTime(f * 1.41, t + glide);
  const mg = m.ctx.createGain();
  mg.gain.setValueAtTime(f * (o.indice || 1.9), t);
  mg.gain.exponentialRampToValueAtTime(f * 0.3, t + d);
  mo.connect(mg);
  mg.connect(c.frequency);
  c.connect(lp);
  // brillo una octava arriba, un poco desafinado
  const br = oscillator(m, 'sine', f * 2, t, end + 0.01);
  br.detune.value = 7;
  br.frequency.setValueAtTime(f0 * 2, t);
  br.frequency.exponentialRampToValueAtTime(f * 2, t + glide);
  const gb = m.ctx.createGain();
  gb.gain.value = 0.22;
  br.connect(gb);
  gb.connect(lp);
  if (o.soplo) {
    const gw = gain(m);
    envelope(gw, t, 0.05, v * 0.28, [[d * 0.7, v * 0.2], [d, SILENCE]]);
    const bp = filter(m, 'bandpass', 500, 3);
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + d * 0.85);
    bp.connect(gw);
    noiseSource(m, t, d + 0.02).connect(bp);
  }
  return { g, end };
};

/**
 * Programa unas notas a partir de `t` (instante del golpe en el reloj del contexto) y devuelve
 * sus voces. `level` es el volumen del paquete.
 */
export function scheduleNotes(m: Motor, voice: VoiceFn, level: number, notes: readonly Note[], t: number, onVoice?: (v: Voice) => void): void {
  for (const n of notes) {
    const v = voice(m, t + LEAD + n.dt, { ...n, v: n.v * level });
    onVoice?.(v);
  }
}
