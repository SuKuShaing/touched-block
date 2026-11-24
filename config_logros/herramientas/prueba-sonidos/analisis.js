// CAMBIO-024: medición sin oídos de los paquetes de sonido con OfflineAudioContext (pico, RMS, duración, silencio inicial, DC, saltos al inicio/fin,
// afinación por FFT, centroide, caída de 20 dB, polifonía) frente a los 3 de hoy (copiados de apps/client/src/game/sounds.ts, beep de fx.web.ts).
// Uso: servir config_logros por HTTP (Playwright no abre file://), abrir herramientas/prueba-sonidos/medir.html y, en la consola, `await TBMedir.correr(false)`.
// `TBMedir.correr(k)` con un número k también envía por POST a /__wav/<id> la secuencia de cada paquete (×k) en WAV de 16 bits: hace falta un servidor que lo guarde
// (las muestras de ../../sonidos_muestras se guardaron así, con k = 8 para poder oírlas; los números de abajo y de resultados.json son SIN esa ganancia).
// Medición de los paquetes de sonido con OfflineAudioContext (sin oídos). Vive fuera de config_logros.
(function () {
  const SR = 44100;

  // ---------- referencia: los 3 paquetes de hoy, copiados de sounds.ts con el beep de fx.web.ts (sin ataque)
  function beep(ctx, t, f, d, tipo, v) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tipo || 'square';
    o.frequency.value = f;
    g.gain.setValueAtTime(v == null ? 0.05 : v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(t);
    o.stop(t + d);
  }
  const ESCALA = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319];
  const mazo = (ctx, t, f, d = 0.22, v = 0.08) => {
    beep(ctx, t, f, d, 'sine', v);
    beep(ctx, t, f * 4, 0.05, 'sine', v * 0.35);
  };
  const REF = {
    '8bits': {
      hit: (c, t, n) => beep(c, t, 300 + Math.min(n, 12) * 70, 0.07),
      kill: (c, t) => beep(c, t, 880, 0.15, 'triangle', 0.09),
      combo: (c, t, b) => [660, 830, 990, 1320, 1660].slice(0, Math.min(5, b + 2)).forEach((f, i) => beep(c, t + i * 0.065, f, 0.09, 'triangle', 0.06)),
    },
    suave: {
      hit: (c, t, n) => beep(c, t, 330 + Math.min(n, 12) * 35, 0.08, 'sine', 0.06),
      kill: (c, t) => {
        beep(c, t, 660, 0.12, 'sine', 0.07);
        beep(c, t + 0.06, 990, 0.14, 'sine', 0.05);
      },
      combo: (c, t, b) => [523, 587, 659, 784, 880].slice(0, Math.min(5, b + 2)).forEach((f, i) => beep(c, t + i * 0.07, f, 0.1, 'sine', 0.05)),
    },
    marimba: {
      hit: (c, t, n) => mazo(c, t, ESCALA[Math.min(Math.max(0, n), 12)], 0.16, 0.07),
      kill: (c, t) => {
        mazo(c, t, 784, 0.25, 0.09);
        mazo(c, t + 0.07, 1047, 0.2, 0.06);
      },
      combo: (c, t, b) => [659, 784, 880, 1047, 1319].slice(0, Math.min(5, b + 2)).forEach((f, i) => mazo(c, t + i * 0.065, f, 0.14, 0.06)),
    },
  };
  const NUEVOS = window.TBSonidos.ids;
  const TODOS = ['8bits', 'suave', 'marimba'].concat(NUEVOS);

  function jugada(id, que, c, t, arg) {
    if (REF[id]) REF[id][que](c, t, arg);
    else window.TBSonidos.tocar(c, id, que, arg, t);
  }

  async function render(prog, dur) {
    const ctx = new OfflineAudioContext(1, Math.ceil(SR * dur), SR);
    prog(ctx);
    const b = await ctx.startRendering();
    return b.getChannelData(0).slice();
  }

  // ---------- análisis
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re[i], re[j]] = [re[j], re[i]];
        [im[i], im[j]] = [im[j], im[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = i + k + len / 2;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
          const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -200);

  function espectro(x, ini, len) {
    const N = 16384;
    const re = new Float64Array(N), im = new Float64Array(N);
    const L = Math.min(len, x.length - ini, N);
    for (let i = 0; i < L; i++) re[i] = x[ini + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (L - 1)));
    fft(re, im);
    const mag = new Float64Array(N / 2);
    for (let k = 0; k < N / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    return mag;
  }

  function f0Auto(x, ini, len) {
    const minLag = Math.floor(SR / 3500), maxLag = Math.floor(SR / 70);
    let e0 = 0;
    for (let i = 0; i < len; i++) e0 += x[ini + i] * x[ini + i];
    if (e0 < 1e-12) return 0;
    const r = new Float64Array(maxLag + 1);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0, e1 = 0;
      for (let i = 0; i < len; i++) { s += x[ini + i] * x[ini + i + lag]; e1 += x[ini + i + lag] * x[ini + i + lag]; }
      r[lag] = s / Math.sqrt(e0 * e1 + 1e-18);
    }
    let mx = 0;
    for (let lag = minLag; lag <= maxLag; lag++) mx = Math.max(mx, r[lag]);
    for (let lag = minLag + 1; lag < maxLag; lag++) {
      if (r[lag] >= 0.9 * mx && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
        // interpolación parabólica
        const a = r[lag - 1], b = r[lag], c = r[lag + 1];
        const d = (a - c) / (2 * (a - 2 * b + c) || 1);
        f0Auto.r = r[lag]; return SR / (lag + d);
      }
    }
    return 0;
  }

  function medir(x) {
    let pico = 0, suma = 0;
    for (const v of x) { pico = Math.max(pico, Math.abs(v)); suma += v; }
    const umbral = pico * 0.01;
    let ini = 0, fin = x.length - 1;
    while (ini < x.length && Math.abs(x[ini]) < umbral) ini++;
    while (fin > 0 && Math.abs(x[fin]) < umbral) fin--;
    let s2 = 0;
    for (let i = ini; i <= fin; i++) s2 += x[i] * x[i];
    const rms = Math.sqrt(s2 / Math.max(1, fin - ini + 1));
    // primeros 2 ms: salto máximo entre muestras, y pico de la primera ms
    const n2 = Math.floor(SR * 0.002);
    let salto0 = 0;
    for (let i = 1; i < n2; i++) salto0 = Math.max(salto0, Math.abs(x[i] - x[i - 1]));
    // último tramo antes del silencio: salto máximo en los últimos 2 ms de la cola activa
    let saltoF = 0;
    for (let i = Math.max(1, fin - n2); i <= Math.min(x.length - 1, fin + 2); i++) saltoF = Math.max(saltoF, Math.abs(x[i] - x[i - 1]));
    // espectro: 150 ms desde el inicio
    const len = Math.min(Math.floor(SR * 0.15), fin - ini);
    const mag = espectro(x, ini, len);
    let num = 0, den = 0;
    for (let k = 1; k < mag.length; k++) { const f = (k * SR) / 16384; num += f * mag[k]; den += mag[k]; }
    const centroide = den ? num / den : 0;
    let acum = 0;
    let roll = 0;
    for (let k = 1; k < mag.length; k++) { acum += mag[k]; if (acum >= 0.85 * den) { roll = (k * SR) / 16384; break; } }
    let kp = 1;
    for (let k = 2; k < mag.length; k++) if (mag[k] > mag[kp]) kp = k;
    const picoEsp = (kp * SR) / 16384;
    // afinación: autocorrelación 25 ms después del inicio, 40 ms de ventana
    const aIni = ini + Math.floor(SR * 0.025);
    f0Auto.r = 0;
    const f0 = aIni + 3000 < x.length ? f0Auto(x, aIni, 1800) : 0;
    const tonal = f0Auto.r;
    // T20: ms desde el pico de la envolvente (máximo móvil de 2 ms) hasta que cae 20 dB
    const w = Math.floor(SR * 0.002);
    const env = [];
    for (let i = 0; i < x.length; i += w) { let mx = 0; for (let j = i; j < Math.min(x.length, i + w); j++) mx = Math.max(mx, Math.abs(x[j])); env.push(mx); }
    let ip = 0; env.forEach((v, i) => { if (v > env[ip]) ip = i; });
    let it = ip; while (it < env.length && env[it] > env[ip] / 10) it++;
    const t20 = Math.round((it - ip) * 2);
    const tAtaque = +(((ip * w) / SR) * 1000).toFixed(1);
    return {
      pico: +pico.toFixed(3), picoDb: +db(pico).toFixed(1), rmsDb: +db(rms).toFixed(1), durMs: Math.round(((fin - ini) / SR) * 1000),
      silencioIniMs: +((ini / SR) * 1000).toFixed(1), dc: +(suma / x.length).toExponential(1), primera: +x[0].toExponential(1), ultima: +x[x.length - 1].toExponential(1),
      salto0Rel: +(salto0 / (pico || 1)).toFixed(3), saltoFRel: +(saltoF / (pico || 1)).toFixed(3),
      centroide: Math.round(centroide), rolloff85: Math.round(roll), picoEsp: Math.round(picoEsp), f0: +f0.toFixed(1), tonal: +tonal.toFixed(2), t20, tAtaque,
    };
  }

  function wav16(x) {
    const b = new ArrayBuffer(44 + x.length * 2), v = new DataView(b);
    const s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    s(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); s(8, 'WAVE'); s(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    s(36, 'data'); v.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
    return b;
  }

  function centsCerca(x, f) {
    let ini = 0; const pk = x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
    while (Math.abs(x[ini]) < pk * 0.01) ini++;
    const mag = espectro(x, ini, Math.floor(SR * 0.15));
    const k0 = Math.floor((f * 0.96 * 16384) / SR), k1 = Math.ceil((f * 1.04 * 16384) / SR);
    let kp = k0;
    for (let k = k0; k <= k1; k++) if (mag[k] > mag[kp]) kp = k;
    const a = Math.log(mag[kp - 1] + 1e-12), b = Math.log(mag[kp] + 1e-12), c = Math.log(mag[kp + 1] + 1e-12);
    const d = (a - c) / (2 * (a - 2 * b + c) || 1);
    const fm = ((kp + d) * SR) / 16384;
    return { fm: +fm.toFixed(1), cents: +(1200 * Math.log2(fm / f)).toFixed(1), rel: +(20 * Math.log10(mag[kp] / Math.max(...mag))).toFixed(1) };
  }

  const SECUENCIA = [['hit', 2, 0], ['hit', 6, 0.4], ['hit', 10, 0.8], ['kill', 0, 1.25], ['combo', 3, 2.15]];

  async function correr(guardar) {
    const res = { paquetes: {}, sonoridad: {}, polifonia: {}, wav: {} };
    for (const id of TODOS) {
      const r = (res.paquetes[id] = {});
      const casos = [['hit', 2], ['hit', 6], ['hit', 10], ['kill', 0], ['combo', 1], ['combo', 3]];
      for (const [que, arg] of casos) {
        const x = await render((c) => jugada(id, que, c, 0.02, arg), 1.0);
        r[que + arg] = medir(x);
      }
      // secuencia completa
      const seq = await render((c) => SECUENCIA.forEach(([que, arg, t]) => jugada(id, que, c, 0.02 + t, arg)), 2.9);
      res.wav[id] = { ...medir(seq), bytes: 44 + seq.length * 2, seg: +(seq.length / SR).toFixed(2) };
      if (guardar) { const k = typeof guardar === 'number' ? guardar : 1; await fetch('/__wav/' + id, { method: 'POST', body: wav16(seq.map((v) => v * k)) }); }
    }
    // afinación: hit(n) para n = 1..12 y el f0 medido frente a la nota pedida (solo los nuevos con altura)
    res.afinacion = {};
    for (const id of NUEVOS) {
      const P = window.TBSonidos.paquetes[id];
      const filas = [];
      for (const n of [1, 3, 5, 7, 9, 12]) {
        const nt = P.hit(n)[0];
        const x = await render((c) => jugada(id, 'hit', c, 0.02, n), 0.6);
        const m = medir(x);
        const cc = centsCerca(x, nt.f); filas.push({ n, pedida: nt.f, fm: cc.fm, cents: cc.cents, relPico: cc.rel, f0: m.f0, picoEsp: m.picoEsp, centsAuto: m.f0 ? +(1200 * Math.log2(m.f0 / nt.f)).toFixed(0) : null, centsEsp: +(1200 * Math.log2(m.picoEsp / nt.f)).toFixed(0) });
      }
      res.afinacion[id] = filas;
    }
    // polifonía: 40 toques seguidos cada 30 ms (como machacar la pantalla) y un combo + destrucción encima
    for (const id of NUEVOS) {
      const x = await render((c) => { for (let i = 0; i < 40; i++) jugada(id, 'hit', c, 0.02 + i * 0.03, 1 + (i % 12)); jugada(id, 'kill', c, 0.5, 0); jugada(id, 'combo', c, 0.55, 3); }, 2.2);
      const m = medir(x);
      res.polifonia[id] = { pico: m.pico, rmsDb: m.rmsDb };
    }
    // sonoridad: media (en dB) de rmsDb por tipo
    const tipos = { hit: ['hit2', 'hit6', 'hit10'], kill: ['kill0'], combo: ['combo1', 'combo3'] };
    for (const id of TODOS) {
      res.sonoridad[id] = {};
      for (const [t, ks] of Object.entries(tipos)) res.sonoridad[id][t] = +(ks.reduce((a, k) => a + res.paquetes[id][k].rmsDb, 0) / ks.length).toFixed(1);
    }
    return res;
  }
  window.TBMedir = { correr, render, medir, TODOS, NUEVOS };
})();
