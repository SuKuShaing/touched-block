// Sonidos nuevos (CAMBIO-024): Electrónico, Futurista, Piano, Guitarra eléctrica, Palitos y Viento.
//
// Son SINTETIZADORES que imitan al instrumento, no grabaciones: el timbre se arma con osciladores, filtros y ruido, así que se
// parecen al instrumento pero no se confunden con uno real. Todo sale de la Web Audio API y SOLO usa nodos que
// `react-native-audio-api` 1.0.0 (el que usa la app en Android/iOS, apps/client/src/platform/fx.native.ts) también implementa:
// Oscillator (con PeriodicWave), Gain, BiquadFilter, WaveShaper, BufferSource y createBuffer. Por eso el mismo código serviría
// tal cual en el juego (web y nativo): no hace falta pre-renderizar WAV ni empaquetar archivos de audio.
//
// El archivo no depende de la página: recibe un `AudioContext` (o un `OfflineAudioContext`, que es como se midió; ver
// herramientas/prueba-sonidos/). Lo usa preview.js (vista previa y muestra de cada fila).
//
// Cada paquete (`PAQUETES[id]`) tiene la misma forma que los de hoy en apps/client/src/game/sounds.ts:
//   hit(n)    toque al bloque; `n` = toques dados, la altura sube con n (tope 12)
//   kill()    destruir
//   combo(b)  premio de combo; b = segundos de premio (más notas cuanto mayor, tope 5)
// pero en vez de sonar al instante devuelven una LISTA DE NOTAS `{ dt, f, d, v, … }` (segundos desde el golpe, Hz, duración, volumen
// relativo) y `tocar()` las programa en el reloj del contexto (más exacto que setTimeout). `voz` dibuja una nota.
(function (global) {
  'use strict';

  const SILENCIO = 0.0001; // -80 dB: las rampas exponenciales no pueden llegar a 0
  const MAX_VOCES = 12; // polifonía: si se pasa, la nota más vieja se apaga con una caída de ~12 ms
  const TAU = Math.PI * 2;

  // ------------------------------------------------------------------ motor (uno por contexto)
  const motores = new WeakMap();

  /** Curva del limitador del bus: lineal hasta 0,6 y compresión suave después (tope ≈ 0,88 con entrada 1). */
  function curvaLimite() {
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

  /** Curva de distorsión de la guitarra: saturación suave tipo válvula. */
  function curvaSat(k) {
    const n = 2049;
    const c = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) c[i] = Math.tanh(((i / (n - 1)) * 2 - 1) * k) / norm;
    return c;
  }

  function motorDe(ctx, destino) {
    let m = motores.get(ctx);
    if (m) return m;
    m = { ctx, voces: [], ruidoBuf: null, ondas: {}, ks: new Map(), nr: 0 };
    // bus: ganancia y limitador suave → salida (así no se acumula sin control ni se recorta al sonar varias notas)
    const bus = ctx.createGain();
    bus.gain.value = 1;
    const lim = ctx.createWaveShaper();
    lim.curve = curvaLimite();
    bus.connect(lim);
    lim.connect(destino || ctx.destination);
    m.bus = bus;
    motores.set(ctx, m);
    return m;
  }

  /** 0,4 s de ruido blanco (generador congruencial: siempre el mismo ruido, para poder repetir mediciones). */
  function ruido(m) {
    if (!m.ruidoBuf) {
      const c = m.ctx;
      const n = Math.floor(c.sampleRate * 0.4);
      const b = c.createBuffer(1, n, c.sampleRate);
      const d = b.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < n; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        d[i] = (s / 4294967296) * 2 - 1;
      }
      m.ruidoBuf = b;
    }
    return m.ruidoBuf;
  }

  function fuenteRuido(m, t, dur) {
    const s = m.ctx.createBufferSource();
    s.buffer = ruido(m);
    m.nr = (m.nr + 1) % 7;
    s.start(t, m.nr * 0.043);
    s.stop(t + dur);
    return s;
  }

  /** Onda periódica por armónicos (amplitudes de 1.º, 2.º, 3.º…, todos senos). */
  function onda(m, nombre, armonicos) {
    if (!m.ondas[nombre]) {
      const real = new Float32Array(armonicos.length + 1);
      const imag = new Float32Array(armonicos.length + 1);
      armonicos.forEach((a, i) => (imag[i + 1] = a));
      m.ondas[nombre] = m.ctx.createPeriodicWave(real, imag);
    }
    return m.ondas[nombre];
  }

  /**
   * Envolvente: sube linealmente a `pico` en `a` s y baja en rampas exponenciales por los `pasos` [[segundo, valor], …]; el último
   * paso es el fin (cae a 0 en 10 ms más para no dejar escalón). Devuelve el instante en que la ganancia queda en 0.
   */
  function envolvente(g, t, a, pico, pasos) {
    const p = g.gain;
    p.setValueAtTime(SILENCIO, t);
    p.linearRampToValueAtTime(pico, t + a);
    pasos.forEach(([dt, v]) => p.exponentialRampToValueAtTime(Math.max(v, SILENCIO), t + dt));
    const fin = t + pasos[pasos.length - 1][0];
    p.linearRampToValueAtTime(0, fin + 0.01);
    return fin + 0.01;
  }

  function ganancia(m, destino) {
    const g = m.ctx.createGain();
    g.connect(destino || m.bus);
    return g;
  }

  function filtro(m, tipo, f, q) {
    const b = m.ctx.createBiquadFilter();
    b.type = tipo;
    b.frequency.value = f;
    if (q != null) b.Q.value = q;
    return b;
  }

  function oscilador(m, tipo, f, t, fin) {
    const o = m.ctx.createOscillator();
    o.type = tipo;
    o.frequency.value = f;
    o.start(t);
    o.stop(fin);
    return o;
  }

  // ------------------------------------------------------------------ voces (una nota)
  // Cada voz recibe (motor, instante, nota) y devuelve { g, fin }: la ganancia de la nota (para apagarla si hace falta) y cuándo acaba.

  /** Piano: 2 cuerdas desafinadas ±3 centésimas con espectro de armónicos que decae, filtro que se cierra (los agudos se apagan
   *  antes, como en un piano) y un golpe de martillo (ruido corto). Caída rápida al principio y más lenta después. */
  const ARM_PIANO = [1, 0.55, 0.32, 0.2, 0.11, 0.07, 0.045, 0.03, 0.02, 0.012];
  function vozPiano(m, t, o) {
    const f = o.f;
    const d = o.d || 0.24;
    const v = o.v;
    const g = ganancia(m);
    const fin = envolvente(g, t, 0.002, v, [[0.07, v * 0.45], [d, SILENCIO]]);
    const lp = filtro(m, 'lowpass', Math.min(f * 9, 8000), 0.7);
    lp.frequency.setValueAtTime(Math.min(f * 9, 8000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.8, 500), t + d);
    lp.connect(g);
    const w = onda(m, 'piano', ARM_PIANO);
    [-3, 3].forEach((cent) => {
      const os = m.ctx.createOscillator();
      os.setPeriodicWave(w);
      os.frequency.value = f;
      os.detune.value = cent;
      os.connect(lp);
      os.start(t);
      os.stop(fin + 0.01);
    });
    // martillo: ruido pasa-banda de 15 ms
    const gm = ganancia(m);
    envolvente(gm, t, 0.001, v * 0.35, [[0.016, SILENCIO]]);
    const bp = filtro(m, 'bandpass', Math.min(f * 3, 3500), 0.9);
    bp.connect(gm);
    fuenteRuido(m, t, 0.03).connect(bp);
    return { g, fin };
  }

  /** Karplus-Strong: cuerda pulsada como línea de retardo con filtro de pérdidas. Se genera una vez por nota en un AudioBuffer
   *  (13 alturas × 2 formas ≈ 1 MB en memoria; unos ms) y se toca con `playbackRate` para afinar con precisión (un retardo entero
   *  desafina hasta 25 centésimas en las notas agudas). */
  function cuerdaKS(m, f, mute) {
    const clave = f + (mute ? 'm' : 'a');
    let r = m.ks.get(clave);
    if (r) return r;
    const sr = m.ctx.sampleRate;
    const N = Math.max(3, Math.round(sr / f + 0.5));
    const fReal = sr / (N - 0.5); // promediar una muestra con la siguiente (aún sin actualizar) resta media muestra de retardo
    const dur = mute ? 0.3 : 0.75;
    const len = Math.floor(sr * dur);
    const buf = m.ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const linea = new Float32Array(N);
    let s = 777 + N;
    let prev = 0;
    let media = 0;
    for (let i = 0; i < N; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      const rnd = (s / 4294967296) * 2 - 1;
      prev += 0.55 * (rnd - prev); // excitación algo suavizada: pulso de púa, no ruido blanco
      linea[i] = prev;
      media += prev;
    }
    media /= N;
    let pico = 0;
    for (let i = 0; i < N; i++) {
      linea[i] -= media;
      pico = Math.max(pico, Math.abs(linea[i]));
    }
    for (let i = 0; i < N; i++) linea[i] /= pico || 1;
    const perdida = mute ? 0.972 : 0.9975;
    let idx = 0;
    for (let n = 0; n < len; n++) {
      const a = linea[idx];
      const b = linea[idx + 1 === N ? 0 : idx + 1];
      out[n] = a;
      linea[idx] = perdida * 0.5 * (a + b);
      idx = idx + 1 === N ? 0 : idx + 1;
    }
    r = { buf, rate: f / fReal };
    m.ks.set(clave, r);
    return r;
  }

  /** Guitarra eléctrica: cuerda Karplus-Strong → ganancia y saturación (WaveShaper) → pasa-altos y pasa-bajos de "altavoz".
   *  `mute` = palma sobre las cuerdas (toque): se apaga rápido y suena más opaco. */
  function vozGuitarra(m, t, o) {
    const mute = !!o.mute;
    const d = o.d || (mute ? 0.18 : 0.5);
    const v = o.v;
    const ks = cuerdaKS(m, o.f, mute);
    const src = m.ctx.createBufferSource();
    src.buffer = ks.buf;
    src.playbackRate.value = ks.rate;
    const pre = m.ctx.createGain();
    pre.gain.value = o.drive || 4;
    const sh = m.ctx.createWaveShaper();
    sh.curve = curvaSat(2.2);
    try {
      sh.oversample = '2x';
    } catch (e) {}
    const hp = filtro(m, 'highpass', 110, 0.7);
    const lp = filtro(m, 'lowpass', mute ? 1900 : 3400, 0.8);
    const g = ganancia(m);
    const fin = envolvente(g, t, 0.002, v, mute ? [[d * 0.35, v * 0.6], [d, SILENCIO]] : [[0.1, v * 0.7], [d, SILENCIO]]);
    src.connect(pre);
    pre.connect(sh);
    sh.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    src.start(t);
    src.stop(fin + 0.01);
    return { g, fin };
  }

  /** Palitos (claves): golpe de madera = seno agudo de caída muy rápida + un 2.º modo no armónico + chasquido de ruido.
   *  `flam`: dos palitos que casi chocan a la vez (9 ms de diferencia, el 2.º un poco más agudo). */
  function vozPalitos(m, t, o) {
    const d = o.d || 0.09;
    const g = ganancia(m);
    const gf = envolvente(g, t, 0.0006, o.v, [[d, SILENCIO]]);
    oscilador(m, 'sine', o.f, t, gf + 0.01).connect(g);
    const g2 = ganancia(m);
    envolvente(g2, t, 0.0005, o.v * 0.4, [[d * 0.4, SILENCIO]]);
    oscilador(m, 'sine', o.f * 2.76, t, t + d).connect(g2);
    const gc = ganancia(m);
    envolvente(gc, t, 0.0004, o.v * 0.5, [[0.012, SILENCIO]]);
    const bp = filtro(m, 'bandpass', Math.min(o.f * 1.4, 6000), 2.2);
    bp.connect(gc);
    fuenteRuido(m, t, 0.02).connect(bp);
    if (o.flam) vozPalitos(m, t + 0.009, { f: o.f * 1.07, v: o.v * 0.7, d: d * 0.8 });
    return { g, fin: gf };
  }

  /** Viento (flauta): seno con poco armónico, soplo de ruido pasa-banda que se asienta tras el ataque, vibrato que entra
   *  despacio y un pequeño "scoop" de afinación al empezar. */
  const ARM_FLAUTA = [1, 0.2, 0.07, 0.025];
  function vozViento(m, t, o) {
    const f = o.f;
    const d = o.d || 0.18;
    const v = o.v;
    const g = ganancia(m);
    const fin = envolvente(g, t, o.ataque || 0.014, v, [[d * 0.6, v * 0.8], [d, SILENCIO]]);
    const os = m.ctx.createOscillator();
    os.setPeriodicWave(onda(m, 'flauta', ARM_FLAUTA));
    os.frequency.setValueAtTime(f * 0.97, t);
    os.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    os.connect(g);
    os.start(t);
    os.stop(fin + 0.01);
    // vibrato
    const lfo = oscilador(m, 'sine', 5.6, t, fin + 0.01);
    const lg = m.ctx.createGain();
    lg.gain.setValueAtTime(0, t);
    lg.gain.linearRampToValueAtTime(f * 0.007, t + 0.15);
    lfo.connect(lg);
    lg.connect(os.frequency);
    // soplo
    const gs = ganancia(m, g);
    envolvente(gs, t, 0.008, v * 0.5, [[0.05, v * 0.16], [d * 0.7, v * 0.12], [d, SILENCIO]]);
    const bp = filtro(m, 'bandpass', Math.min(f * 2, 5000), 0.9);
    bp.connect(gs);
    fuenteRuido(m, t, d + 0.02).connect(bp);
    return { g, fin };
  }

  /** Electrónico: dos sierras desafinadas ±8 centésimas + un seno una octava abajo, por un pasa-bajos resonante cuya frecuencia
   *  cae rápido ("pluck" de sintetizador). */
  function vozElectronico(m, t, o) {
    const f = o.f;
    const d = o.d || 0.16;
    const v = o.v;
    const g = ganancia(m);
    const fin = envolvente(g, t, 0.002, v, [[0.045, v * 0.7], [d, SILENCIO]]);
    const lp = filtro(m, 'lowpass', 1000, 6);
    lp.frequency.setValueAtTime(Math.min(f * (o.brillo || 9), 7000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 300), t + Math.min(d, 0.14));
    lp.connect(g);
    [-8, 8].forEach((cent) => {
      const os = oscilador(m, 'sawtooth', f, t, fin + 0.01);
      os.detune.value = cent;
      const gs = m.ctx.createGain();
      gs.gain.value = 0.5;
      os.connect(gs);
      gs.connect(lp);
    });
    const sub = oscilador(m, 'sine', f / 2, t, fin + 0.01);
    const gsub = m.ctx.createGain();
    gsub.gain.value = 0.1;
    sub.connect(gsub);
    gsub.connect(lp);
    return { g, fin };
  }

  /** Futurista: FM (portadora seno + modulador de razón 1,41, no armónica = timbre metálico) con índice que se apaga, un chirrido
   *  de afinación hacia arriba (`f0` → `f`) y un seno una octava arriba que brilla. `soplo` suma un barrido de ruido. Los ecos
   *  son notas más bajas que añade el paquete. */
  function vozFuturista(m, t, o) {
    const f = o.f;
    const f0 = o.f0 || f * 0.6;
    const gl = o.glis || 0.03;
    const d = o.d || 0.14;
    const v = o.v;
    const g = ganancia(m);
    const lp = filtro(m, 'lowpass', 6500, 0.7);
    lp.connect(g);
    const fin = envolvente(g, t, 0.003, v, [[Math.min(d * 0.35, 0.06), v * 0.6], [d, SILENCIO]]);
    const c = oscilador(m, 'sine', f0, t, fin + 0.01);
    c.frequency.setValueAtTime(f0, t);
    c.frequency.exponentialRampToValueAtTime(f, t + gl);
    const mo = oscilador(m, 'sine', f0 * 1.41, t, fin + 0.01);
    mo.frequency.setValueAtTime(f0 * 1.41, t);
    mo.frequency.exponentialRampToValueAtTime(f * 1.41, t + gl);
    const mg = m.ctx.createGain();
    mg.gain.setValueAtTime(f * (o.indice || 1.9), t);
    mg.gain.exponentialRampToValueAtTime(f * 0.3, t + d);
    mo.connect(mg);
    mg.connect(c.frequency);
    c.connect(lp);
    // brillo una octava arriba, un poco desafinado
    const br = oscilador(m, 'sine', f * 2, t, fin + 0.01);
    br.detune.value = 7;
    br.frequency.setValueAtTime(f0 * 2, t);
    br.frequency.exponentialRampToValueAtTime(f * 2, t + gl);
    const gb = m.ctx.createGain();
    gb.gain.value = 0.22;
    br.connect(gb);
    gb.connect(lp);
    if (o.soplo) {
      const gw = ganancia(m);
      envolvente(gw, t, 0.05, v * 0.28, [[d * 0.7, v * 0.2], [d, SILENCIO]]);
      const bp = filtro(m, 'bandpass', 500, 3);
      bp.frequency.setValueAtTime(500, t);
      bp.frequency.exponentialRampToValueAtTime(3600, t + d * 0.85);
      bp.connect(gw);
      fuenteRuido(m, t, d + 0.02).connect(bp);
    }
    return { g, fin };
  }

  // ------------------------------------------------------------------ paquetes
  /** Escala de un paquete: `n` toques dados → nota (tope 12), como ESCALA de la Marimba. */
  const nota = (esc, n) => esc[Math.min(Math.max(0, n | 0), esc.length - 1)];
  const cuantas = (b) => Math.min(5, Math.max(0, b | 0) + 2); // notas del combo (b = segundos de premio), igual que los paquetes de hoy
  const pent = (esc, k) => esc.slice(0, k);

  const ESC_PIANO = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319]; // la de la Marimba (do mayor pentatónica)
  const ESC_GUITARRA = [131, 147, 165, 196, 220, 262, 294, 330, 392, 440, 523, 587, 659]; // una octava abajo: guitarra
  const ESC_VIENTO = [392, 440, 494, 587, 659, 784, 880, 988, 1175, 1319, 1568, 1760, 1976]; // sol mayor pentatónica, registro de flauta
  const ESC_ELEC = [220, 262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175]; // la menor pentatónica
  const ESC_FUT = [330, 370, 415, 466, 523, 587, 659, 740, 831, 932, 1047, 1175, 1319]; // tonos enteros: suena "raro" y abierto

  const PAQUETES = {
    electronico: {
      nombre: 'Electrónico',
      voz: vozElectronico,
      nivel: 0.045,
      hit: (n) => [{ dt: 0, f: nota(ESC_ELEC, n), d: 0.16, v: 1 }],
      kill: () => [
        { dt: 0, f: 440, d: 0.2, v: 1 },
        { dt: 0.05, f: 659, d: 0.2, v: 0.9 },
        { dt: 0.1, f: 880, d: 0.34, v: 0.9, brillo: 14 },
      ],
      combo: (b) => pent([440, 523, 659, 784, 1047], cuantas(b)).map((f, i) => ({ dt: i * 0.065, f, d: 0.1, v: 0.8 })),
    },
    futurista: {
      nombre: 'Futurista',
      voz: vozFuturista,
      nivel: 0.047,
      hit: (n) => {
        const f = nota(ESC_FUT, n);
        return [{ dt: 0, f, d: 0.13, v: 1 }, { dt: 0.075, f, f0: f, d: 0.11, v: 0.26 }];
      },
      kill: () => [
        { dt: 0, f: 1480, f0: 330, glis: 0.22, d: 0.34, v: 1, soplo: true, indice: 1.8 },
        { dt: 0.1, f: 1480, f0: 1480, d: 0.2, v: 0.3 },
        { dt: 0.2, f: 1480, f0: 1480, d: 0.2, v: 0.16 },
      ],
      combo: (b) =>
        [659, 740, 831, 932, 1047].slice(0, cuantas(b)).flatMap((f, i) => [
          { dt: i * 0.07, f, d: 0.1, v: 0.9 },
          { dt: i * 0.07 + 0.06, f, f0: f, d: 0.08, v: 0.2 },
        ]),
    },
    piano: {
      nombre: 'Piano',
      voz: vozPiano,
      nivel: 0.028,
      hit: (n) => [{ dt: 0, f: nota(ESC_PIANO, n), d: 0.24, v: 1 }],
      kill: () => [
        { dt: 0, f: 523, d: 0.5, v: 0.85 },
        { dt: 0.035, f: 659, d: 0.5, v: 0.8 },
        { dt: 0.07, f: 784, d: 0.5, v: 0.8 },
        { dt: 0.105, f: 1047, d: 0.5, v: 0.75 },
      ],
      combo: (b) => pent([659, 784, 880, 1047, 1319], cuantas(b)).map((f, i) => ({ dt: i * 0.065, f, d: 0.16, v: 0.85 })),
    },
    guitarra: {
      nombre: 'Guitarra eléctrica',
      voz: vozGuitarra,
      nivel: 0.037,
      // toque: nota con la palma (palm mute); destruir: acorde de potencia rasgueado, abierto
      hit: (n) => [{ dt: 0, f: nota(ESC_GUITARRA, n), mute: true, d: 0.18, v: 1 }],
      kill: () => [
        { dt: 0, f: 196, d: 0.55, v: 0.8 },
        { dt: 0.014, f: 294, d: 0.55, v: 0.8 },
        { dt: 0.028, f: 392, d: 0.55, v: 0.8 },
      ],
      combo: (b) => pent([330, 392, 440, 523, 659], cuantas(b)).map((f, i) => ({ dt: i * 0.07, f, mute: true, d: 0.14, v: 0.9 })),
    },
    palitos: {
      nombre: 'Palitos',
      voz: vozPalitos,
      nivel: 0.058,
      hit: (n) => [{ dt: 0, f: 1500 + Math.min(Math.max(0, n | 0), 12) * 110, d: 0.09, v: 1, flam: true }],
      kill: () => [
        { dt: 0, f: 2300, d: 0.1, v: 1, flam: true },
        { dt: 0.06, f: 2900, d: 0.14, v: 1, flam: true },
        { dt: 0.12, f: 3300, d: 0.2, v: 0.8 },
      ],
      combo: (b) => [2200, 2420, 2640, 2860, 3080].slice(0, cuantas(b)).map((f, i) => ({ dt: i * 0.055, f, d: 0.07, v: 0.9 })),
    },
    viento: {
      nombre: 'Viento',
      voz: vozViento,
      nivel: 0.0275,
      hit: (n) => [{ dt: 0, f: nota(ESC_VIENTO, n), d: 0.18, v: 1 }],
      kill: () => [
        { dt: 0, f: 784, d: 0.26, v: 0.9, ataque: 0.02 },
        { dt: 0.09, f: 1175, d: 0.42, v: 1, ataque: 0.03 },
      ],
      combo: (b) => pent([784, 880, 988, 1175, 1319], cuantas(b)).map((f, i) => ({ dt: i * 0.07, f, d: 0.12, v: 0.9, ataque: 0.012 })),
    },
  };
  const IDS = Object.keys(PAQUETES);

  /** Duración (s) de una jugada: del golpe al final de la última nota. */
  function duracion(id, que, arg) {
    return Math.max.apply(null, PAQUETES[id][que](arg || 0).map((x) => x.dt + (x.d || 0.2) + 0.02));
  }

  function registrar(m, voz) {
    const ahora = m.ctx.currentTime;
    m.voces = m.voces.filter((x) => x.fin > ahora);
    m.voces.push(voz);
    while (m.voces.length > MAX_VOCES) {
      const vieja = m.voces.shift();
      try {
        vieja.g.gain.cancelScheduledValues(ahora);
        vieja.g.gain.setTargetAtTime(0, ahora, 0.004);
      } catch (e) {}
    }
  }

  /**
   * Programa una jugada de un paquete: que = 'hit' | 'kill' | 'combo', arg = n o b. `t0` (opcional) es el instante del golpe en el
   * reloj del contexto; si falta, suena ya. `destino` (opcional) sustituye a ctx.destination (solo al crear el motor).
   * Devuelve la duración de la jugada. Nunca lanza.
   */
  function tocar(ctx, id, que, arg, t0, destino) {
    try {
      const p = PAQUETES[id];
      if (!p || !ctx) return 0;
      const m = motorDe(ctx, destino);
      const t = (t0 == null ? ctx.currentTime : t0) + 0.005;
      p[que](arg || 0).forEach((nt) => {
        registrar(m, p.voz(m, t + nt.dt, Object.assign({}, nt, { v: (nt.v == null ? 1 : nt.v) * p.nivel })));
      });
      return duracion(id, que, arg);
    } catch (e) {
      return 0;
    }
  }

  global.TBSonidos = { ids: IDS, paquetes: PAQUETES, tocar, duracion, motorDe, MAX_VOCES, TAU };
})(typeof window !== 'undefined' ? window : globalThis);
