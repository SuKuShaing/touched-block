// Vista previa interactiva de los premios (sección Premios, bajo el panel Paletas).
//
// Hacer clic en una fila de Paletas, Sonidos, Efectos o Fondos la selecciona (cualquiera, esté desbloqueada o no: es un
// banco de análisis). El campo de la vista previa dibuja un grupo de 3×3 bloques con la paleta y el fondo elegidos; al
// tocar un bloque suena el sonido elegido, el bloque pierde un toque y, al llegar a 0, estalla con el efecto elegido y
// reaparece unos 700 ms después con otro número.
//
// Réplica del cliente (no importa nada de él; los valores están copiados). Archivos de donde sale cada cosa:
//   - Bloque:        apps/client/src/components/Block.tsx (radio 16, sombra 0 5px 0, número en negrita a 0,5 del alto,
//                    animaciones de aparición y de golpe, brillo de Diamante) y packages/engine/src/game.ts (los bloques
//                    numéricos muestran los toques que faltan; los de operación muestran la operación y miden 1,7:1).
//   - Estilos Cristal y Contorno: CAMBIO-017 de cambios.md (el contrato está en el comentario de PALETAS, coleccion.js).
//   - Fondos:        apps/client/src/components/FieldBackground.tsx (grilla de 44 px, 46 estrellas con la semilla
//                    20261112, y las tres luces de la aurora). Los 11 fondos nuevos de CAMBIO-022 (solo con "Con cambios") no
//                    se dibujan aquí: este archivo solo le pone al campo la clase `fx-<id>` y los dibuja extras-fondos.css.
//   - Efectos:       apps/client/src/components/Fx.tsx (makeSpecs / Burst: 14 partículas por estallido). Los 6 efectos nuevos de
//                    CAMBIO-023 (Burbujas, Emojis, Ondas, Monedas, Rayos, Fuegos artificiales; solo con "Con cambios") se definen
//                    más abajo en `FX_NUEVOS`: cada pieza trae `f(p)` (p = tiempo lineal 0..1 → posición, giro, escala, opacidad), que
//                    es la misma fórmula que correría un `useAnimatedStyle` de Reanimated; aquí se muestrea en fotogramas.
//   - Sonidos:       apps/client/src/game/sounds.ts (paquetes 8 bits, Suave y Marimba) y
//                    apps/client/src/platform/fx.web.ts (beep: oscilador + ganancia con rampa exponencial). Los 6 sonidos nuevos de
//                    CAMBIO-024 (Electrónico, Futurista, Piano, Guitarra eléctrica, Palitos y Viento; solo con "Con cambios") no están
//                    aquí: los sintetiza sonidos.js (que se carga antes) y este archivo solo los enchufa a `PAQUETES`.
//
// Se carga después de coleccion.js. `dibujarColeccion()` reescribe los paneles al cambiar el interruptor; este archivo
// guarda su panel aparte y lo vuelve a poner en el hueco (`#vistaPreviaSlot`) vía `window.alRedibujarPremios`.
(function () {
  'use strict';

  const grilla = document.getElementById('premiosGrilla');
  if (!grilla) return;

  // ------------------------------------------------------------------ selección
  const DEFECTO = { paleta: 'clasica', sonido: '8bits', efecto: 'normal', fondo: 'liso' };
  const sel = Object.assign({}, DEFECTO);
  const NOMBRES = { paleta: 'Paleta', sonido: 'Sonido', efecto: 'Efecto', fondo: 'Fondo' };

  /** Lo que existe en el modo actual (las paletas "nuevo" solo existen con el interruptor en "Con cambios"). */
  function lista(clave) {
    if (clave === 'paleta') return PALETAS.filter((p) => conCambios || !p.nuevo);
    if (clave === 'sonido') return SONIDOS.filter((s) => conCambios || !s.nuevo); // CAMBIO-024: los 6 sonidos nuevos solo con cambios
    if (clave === 'efecto') return EFECTOS.filter((e) => conCambios || !e.nuevo); // CAMBIO-023: los 6 efectos nuevos solo con cambios
    return FONDOS.filter((f) => conCambios || !f.nuevo); // CAMBIO-022: los 11 fondos nuevos solo con cambios
  }
  const actual = (clave) => lista(clave).find((x) => x.id === sel[clave]) || lista(clave).find((x) => x.id === DEFECTO[clave]);

  /** Si lo seleccionado ya no existe en este modo, vuelve al valor por defecto de ese panel. */
  function reconciliar() {
    Object.keys(DEFECTO).forEach((k) => {
      if (!lista(k).some((x) => x.id === sel[k])) sel[k] = DEFECTO[k];
    });
  }

  const reducirMovimiento = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ------------------------------------------------------------------ sonido (WebAudio)
  // fx.web.ts: un oscilador con ganancia que baja en rampa exponencial. Aquí se agrega un ataque de 4 ms (sin él, la
  // onda arranca de golpe y algunos oídos/altavoces oyen un chasquido). El contexto nace dentro de un gesto.
  let ac = null;
  function contexto() {
    try {
      if (!ac || ac.state === 'closed') {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ac = new Ctor();
      }
      return ac;
    } catch (e) {
      return null;
    }
  }

  /** Gesto del usuario en los premios: crea o reanuda el contexto (y el búfer en silencio que pide iOS). */
  function despertar() {
    try {
      const c = contexto();
      if (!c) return;
      if (c.state !== 'running') {
        c.resume().catch(() => {});
        const src = c.createBufferSource();
        src.buffer = c.createBuffer(1, 1, c.sampleRate);
        src.connect(c.destination);
        src.start(0);
      }
    } catch (e) {}
  }
  ['pointerup', 'touchend', 'mousedown', 'click', 'keydown'].forEach((t) => grilla.addEventListener(t, despertar, { capture: true, passive: true }));

  function beep(f, d, tipo, v) {
    try {
      const c = contexto();
      if (!c) return;
      if (c.state !== 'running') c.resume().catch(() => {});
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = tipo || 'square';
      o.frequency.value = f;
      const t = c.currentTime;
      const vol = v == null ? 0.05 : v;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(d, 0.02));
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + d);
    } catch (e) {}
  }

  let timersSonido = [];
  const despues = (ms, fn) => timersSonido.push(setTimeout(fn, ms));
  /** Notas seguidas: la primera al tiro, las demás cada `gap` ms. */
  function arpegio(notas, gap, tocar) {
    notas.forEach((f, i) => (i === 0 ? tocar(f) : despues(i * gap, () => tocar(f))));
  }

  const suave = (f, d, v) => beep(f, d == null ? 0.12 : d, 'sine', v == null ? 0.06 : v);
  const ESCALA = [262, 294, 330, 392, 440, 523, 587, 659, 784, 880, 1047, 1175, 1319];
  function mazo(f, d, v) {
    d = d == null ? 0.22 : d;
    v = v == null ? 0.08 : v;
    beep(f, d, 'sine', v);
    beep(f * 4, 0.05, 'sine', v * 0.35);
  }

  // Solo los sonidos que usa la vista previa: toque (hit), destruir (kill) y combo (para la muestra de la fila).
  const PAQUETES = {
    '8bits': {
      hit: (n) => beep(300 + Math.min(n, 12) * 70, 0.07),
      kill: () => beep(880, 0.15, 'triangle', 0.09),
      combo: (b) => arpegio([660, 830, 990, 1320, 1660].slice(0, Math.min(5, b + 2)), 65, (f) => beep(f, 0.09, 'triangle', 0.06)),
    },
    suave: {
      hit: (n) => suave(330 + Math.min(n, 12) * 35, 0.08, 0.06),
      kill: () => {
        suave(660, 0.12, 0.07);
        despues(60, () => suave(990, 0.14, 0.05));
      },
      combo: (b) => arpegio([523, 587, 659, 784, 880].slice(0, Math.min(5, b + 2)), 70, (f) => suave(f, 0.1, 0.05)),
    },
    marimba: {
      hit: (n) => mazo(ESCALA[Math.min(Math.max(0, n), 12)], 0.16, 0.07),
      kill: () => {
        mazo(784, 0.25, 0.09);
        despues(70, () => mazo(1047, 0.2, 0.06));
      },
      combo: (b) => arpegio([659, 784, 880, 1047, 1319].slice(0, Math.min(5, b + 2)), 65, (f) => mazo(f, 0.14, 0.06)),
    },
  };
  // CAMBIO-024: los 6 sonidos nuevos (solo con "Con cambios") los sintetiza sonidos.js en el reloj del contexto (no con setTimeout):
  // cada jugada programa sus notas. `muestraSonido` los usa igual que a los de arriba (hit, hit, kill, combo).
  if (window.TBSonidos) {
    window.TBSonidos.ids.forEach((id) => {
      const tocarNuevo = (que, arg) => {
        const c = contexto();
        if (c && c.state !== 'running') c.resume().catch(() => {});
        return window.TBSonidos.tocar(c, id, que, arg);
      };
      PAQUETES[id] = { hit: (n) => tocarNuevo('hit', n), kill: () => tocarNuevo('kill', 0), combo: (b) => tocarNuevo('combo', b) };
    });
  }
  const paquete = (id) => PAQUETES[id || sel.sonido] || PAQUETES['8bits'];

  /** Muestra corta del paquete (sounds.preview del juego): dos golpes, destruir y un combo. */
  function muestraSonido(id) {
    timersSonido.forEach(clearTimeout);
    timersSonido = [];
    const p = paquete(id);
    p.hit(1);
    despues(110, () => p.hit(2));
    despues(220, () => p.kill());
    despues(480, () => p.combo(1));
  }

  // ------------------------------------------------------------------ el panel
  const panel = document.createElement('div');
  panel.className = 'panelJuego vpPanel';
  panel.id = 'vistaPrevia';
  panel.innerHTML =
    '<div class="capJuego">Vista previa</div>' +
    '<div class="vpCampo vpPlano" id="vpCampo">' +
    '<div class="vpFondoCampo" aria-hidden="true"></div>' +
    '<div class="vpBloques"></div>' +
    '<div class="vpFx" aria-hidden="true"></div>' +
    '</div>' +
    '<div class="vpSeleccion" id="vpSeleccion" aria-live="polite"></div>' +
    '<div class="vpAyuda"><b>Toca un bloque.</b><span class="vpAyudaLarga"> Un número muestra los toques que faltan; en una operación, toca tantas veces como su resultado.</span></div>' +
    '<div class="vpAyuda vpDondeIra">En el juego irá al final de la Colección, después de "Fondos del campo" (CAMBIO-020), y allí solo se podrán probar los premios desbloqueados (aquí se puede elegir todo).</div>';
  const campo = panel.querySelector('#vpCampo');
  const capaFondo = panel.querySelector('.vpFondoCampo');
  const capaBloques = panel.querySelector('.vpBloques');
  const capaFx = panel.querySelector('.vpFx');
  const lineaSel = panel.querySelector('#vpSeleccion');

  // ------------------------------------------------------------------ bloques
  // En el juego el bloque numérico es cuadrado y muestra los toques que faltan; el de operación mide 1,7:1 y muestra la
  // operación (el jugador cuenta de memoria). Aquí cada casilla del 3×3 mide 1,7:1 y guarda el color de su posición.
  const OPERACIONES = { 1: ['3−2', '2−1'], 2: ['1+1', '4÷2', '3−1'], 3: ['2+1', '1+2', '4−1'], 4: ['2+2', '3+1', '2×2', '8÷2'] };
  const azar = Math.random; // solo decoración: no hay motor ni replay aquí
  const celdas = [];

  function sortear(c) {
    let total, op, etiqueta;
    do {
      total = 1 + Math.floor(azar() * 4);
      op = azar() < 0.3;
      etiqueta = op ? OPERACIONES[total][Math.floor(azar() * OPERACIONES[total].length)] : String(total);
    } while (etiqueta === c.etiqueta); // reaparece con otro número
    c.total = total;
    c.left = total;
    c.op = op;
    c.etiqueta = etiqueta;
    c.bq.className = 'vpBq ' + (op ? 'op' : 'num');
    c.txt.textContent = etiqueta;
    pintarAria(c);
  }

  function pintarAria(c) {
    c.bq.setAttribute('aria-label', c.op ? `Bloque ${c.etiqueta}: faltan ${c.left} toques` : `Bloque ${c.left}: faltan ${c.left} toques`);
  }

  for (let i = 0; i < 9; i++) {
    const cel = document.createElement('div');
    cel.className = 'vpCel';
    const bq = document.createElement('button');
    bq.type = 'button';
    bq.innerHTML = '<span class="vpBrillo"></span><span class="vpBrilloPunto"></span><span class="vpTexto"></span>';
    cel.appendChild(bq);
    capaBloques.appendChild(cel);
    const c = { i, bq, txt: bq.querySelector('.vpTexto'), total: 0, left: 0, op: false, etiqueta: '', vivo: true, timer: 0 };
    bq._c = c;
    sortear(c);
    celdas.push(c);
  }

  const CSS_EASE = 'cubic-bezier(0.25, 0.1, 0.25, 1)';
  const SPAWN_EASE = 'cubic-bezier(0.2, 1.6, 0.4, 1)';

  /** Golpe: 0,8 → 1,08 (72 ms) → 1 (48 ms), como Block.tsx. */
  function animarGolpe(c) {
    if (reducirMovimiento() || !c.bq.animate) return;
    c.bq.animate(
      [
        { transform: 'scale(0.8)', easing: CSS_EASE },
        { transform: 'scale(1.08)', offset: 0.6, easing: CSS_EASE },
        { transform: 'scale(1)' },
      ],
      { duration: 120 },
    );
  }

  /** Aparición: escala 0 → 1 y giro −20° → 0 en 250 ms (con "reducir movimiento", solo un fundido). */
  function animarAparicion(c) {
    if (!c.bq.animate) return;
    if (reducirMovimiento()) c.bq.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 150 });
    else c.bq.animate([{ transform: 'scale(0) rotate(-20deg)' }, { transform: 'scale(1) rotate(0deg)' }], { duration: 250, easing: SPAWN_EASE });
  }

  function reaparecer(c) {
    c.timer = 0;
    sortear(c);
    c.vivo = true;
    c.bq.classList.remove('fuera');
    c.bq.removeAttribute('aria-disabled');
    animarAparicion(c);
  }

  function tocar(c) {
    if (!c.vivo) return;
    c.left--;
    paquete().hit(c.total - c.left); // en el juego el toque final también suena como toque, y después como destrucción
    if (c.left > 0) {
      if (!c.op) c.txt.textContent = String(c.left);
      pintarAria(c);
      animarGolpe(c);
      return;
    }
    paquete().kill();
    estallido(c);
    // en el juego el bloque destruido desaparece de inmediato (la salida animada gris es la de los que se escapan)
    c.vivo = false;
    c.bq.classList.add('fuera');
    c.bq.setAttribute('aria-disabled', 'true');
    c.timer = setTimeout(() => reaparecer(c), 700);
  }

  capaBloques.addEventListener('click', (e) => {
    const bq = e.target.closest('.vpBq');
    if (bq && bq._c) tocar(bq._c);
  });

  // ------------------------------------------------------------------ efectos al destruir (Fx.tsx)
  const SPARK = '#fff3b0';
  const HEART = '♥';

  /** Mismas fórmulas que makeSpecs de Fx.tsx. */
  function especificaciones(efecto, n, color, colores) {
    const r = azar;
    return Array.from({ length: n }, (_, i) => {
      const a = r() * Math.PI * 2;
      switch (efecto) {
        case 'chispas':
          return { a, d: 60 + r() * 90, rot: 0, rot0: (a * 180) / Math.PI + 90, dur: 330 + r() * 220, fall: 10, end: 0.3, w: 3, h: 13, radius: 2, color: i % 2 ? SPARK : color };
        case 'confeti':
          return { a, d: 40 + r() * 80, rot: 300 + r() * 500, rot0: r() * 180, dur: 450 + r() * 250, fall: 60, end: 0.7, w: 6, h: 10, radius: 1, color: colores[Math.floor(r() * colores.length)] };
        case 'corazones':
          return { a, d: 30 + r() * 70, rot: r() * 60 - 30, rot0: 0, dur: 450 + r() * 250, fall: -25, end: 0.5, w: 16, h: 13 + Math.round(r() * 5), radius: 0, color, glyph: HEART };
        default:
          return { a, d: 40 + r() * 80, rot: r() * 400, rot0: 0, dur: 450 + r() * 250, fall: 30, end: 0.2, w: 10, h: 10, radius: 3, color };
      }
    });
  }

  // ------------------------------------------------------------------ efectos nuevos (CAMBIO-023)
  // Cada efecto devuelve una lista de piezas: { w, h, ox, oy (centro respecto al del bloque), delay, dur (ms), clase, css, texto,
  // hijo, f }. `f(p)` (p lineal de 0 a 1) da { x, y (px, desde su sitio), r (grados), s (escala), sx (escala horizontal), o }.
  // En React Native cada pieza es un `Animated.View` (o `Animated.Text`) con un solo valor compartido
  // `withDelay(delay, withTiming(1, { duration: dur, easing: Easing.linear }))` y un `useAnimatedStyle` que evalúa esta misma f(p).
  // Con "reducir movimiento" (`suaves`): menos piezas, más cortas (×0,7), sin giro ni vaivén ni parpadeo.
  // Ojo: una pieza con `delay` espera en su punto de partida con la opacidad de f(0); por eso las que tienen retraso empiezan en o = 0.
  const EMOJIS = ['🎉', '⭐', '🔥', '💥', '😎', '😍', '💯', '✨']; // Unicode ≤ 6.1: Android 4.4+ / iOS 6+ (no hay ninguno reciente)
  const TAU = Math.PI * 2;
  const rango = (a, b) => a + azar() * (b - a);
  const cuad = (p) => 1 - (1 - p) * (1 - p); // salida suave (ease-out cuadrático), sin bezier: se escribe igual en el worklet
  const tramo = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a))); // 0 antes de a, 1 después de b
  const val = (o) => Object.assign({ x: 0, y: 0, r: 0, s: 1, sx: 1, o: 1 }, o);
  const pieza = (o) => Object.assign({ w: 10, h: 10, ox: 0, oy: 0, delay: 0, clase: '', css: '', texto: '', hijo: '' }, o);

  const FX_NUEVOS = {
    // 6 burbujas (o 3): círculo de borde claro + reflejo (2 nodos cada una), suben con vaivén y revientan al final.
    burbujas(color, colores, suaves) {
      return Array.from({ length: suaves ? 3 : 6 }, () => {
        const S = Math.round(rango(14, 26));
        const rise = rango(70, 125);
        const amp = suaves ? 0 : rango(4, 9);
        const freq = rango(1, 2);
        const fase = rango(0, TAU);
        const rf = Math.max(3, Math.round(S * 0.22));
        return pieza({
          w: S, h: S, ox: rango(-34, 34), oy: rango(-5, 5), delay: suaves ? 0 : rango(0, 100), dur: rango(520, 760) * (suaves ? 0.7 : 1),
          clase: 'vpBurbuja', css: `background:${rgba(color, 0.25)}`,
          hijo: `<b class="vpReflejo" style="width:${rf}px;height:${rf}px"></b>`,
          f: (p) => {
            const pop = tramo(p, 0.78, 1); // revienta: crece un poco y se desvanece
            return val({ x: amp * Math.sin(TAU * freq * p + fase), y: -rise * cuad(p), s: (suaves ? 1 : 0.5 + 0.5 * tramo(p, 0, 0.15)) + (suaves ? 0 : 0.35 * pop), o: Math.min(1, p * 10) * (1 - pop) });
          },
        });
      });
    },
    // 6 emojis (o 3) de un grupo de 8: salen en abanico, saltan (escala 0,4 → 1,2 → 1 → 0,85) y se desvanecen. Cada uno con su color.
    emojis(color, colores, suaves) {
      const n = suaves ? 3 : 6;
      const mezcla = EMOJIS.map((e) => [azar(), e]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      return mezcla.slice(0, n).map((glifo, i) => {
        const a = (i / n) * TAU + rango(-0.4, 0.4);
        const d = rango(35, 85);
        const S = Math.round(rango(20, 26));
        const giro = suaves ? 0 : rango(-25, 25);
        return pieza({
          w: Math.round(S * 1.3), h: Math.round(S * 1.3), dur: rango(550, 750) * (suaves ? 0.7 : 1),
          clase: 'vpEmoji', css: `font-size:${S}px`, texto: glifo,
          f: (p) => {
            const q = cuad(p);
            const s = p < 0.25 ? 0.4 + 0.8 * (p / 0.25) : p < 0.5 ? 1.2 - 0.2 * tramo(p, 0.25, 0.5) : 1 - 0.15 * tramo(p, 0.5, 1);
            return val({ x: Math.cos(a) * d * q * (suaves ? 0.5 : 1), y: (Math.sin(a) * d - 14) * q * (suaves ? 0.5 : 1), r: giro * q, s: suaves ? 1 : s, o: 1 - tramo(p, 0.6, 1) });
          },
        });
      });
    },
    // 3 anillos (borde del color del bloque, blanco, color) que nacen cada 90 ms y 6 gotas (o 1 anillo y 3 gotas). Los anillos miden
    // 96 px y solo cambian de escala (0,2 → 1) para no tocar el layout; el borde de 4 px crece con la escala.
    ondas(color, colores, suaves) {
      const anillos = (suaves ? [0] : [0, 1, 2]).map((i) =>
        pieza({
          w: 96, h: 96, delay: i * 90, dur: suaves ? 380 : 520, clase: 'vpOnda', css: `border-color:${i === 1 ? 'rgba(255,255,255,0.85)' : color}`,
          f: (p) => val({ s: 0.2 + 0.8 * cuad(p), o: Math.min(1, p * 20) * 0.95 * (1 - p) }),
        }),
      );
      const nGotas = suaves ? 3 : 6;
      const gotas = Array.from({ length: nGotas }, (_, i) => {
        const a = (i / nGotas) * TAU + rango(-0.3, 0.3);
        const d = rango(40, 75) * (suaves ? 0.6 : 1);
        return pieza({
          w: 6, h: 6, dur: rango(450, 600) * (suaves ? 0.7 : 1), clase: 'vpPunto', css: `background:${color}`,
          f: (p) => val({ x: Math.cos(a) * d * cuad(p), y: Math.sin(a) * d * cuad(p) + (suaves ? 0 : 22) * p * p, s: 1 - 0.6 * p, o: 1 - p * p }),
        });
      });
      return anillos.concat(gotas);
    },
    // 6 monedas (o 3): parábola con gravedad (sube ~60 px y cae), giran sobre su eje (escala horizontal |cos|) y se desvanecen al final.
    monedas(color, colores, suaves) {
      return Array.from({ length: suaves ? 3 : 6 }, () => {
        const A = rango(260, 320); // impulso inicial hacia arriba
        const E = rango(50, 90); // cuánto más abajo que el bloque termina
        const B = A + E; // y(p) = −A·p + B·p²  → y(1) = E
        const dx = rango(-60, 60);
        const vueltas = rango(2.5, 4);
        const fase = rango(0, 3);
        return pieza({
          w: 18, h: 18, delay: suaves ? 0 : rango(0, 80), dur: rango(600, 760) * (suaves ? 0.7 : 1), clase: 'vpMoneda',
          f: (p) => val({ x: dx * p * (suaves ? 0.5 : 1), y: (-A * p + B * p * p) * (suaves ? 0.5 : 1), sx: suaves ? 1 : Math.max(0.12, Math.abs(Math.cos(TAU * vueltas * p + fase))), o: Math.min(1, p * 20) * (1 - tramo(p, 0.7, 1)) }),
        });
      });
    },
    // 5 rayos (o 2) en zigzag de 2 trazos cada uno (1 nodo por trazo) y un destello central: 11 nodos. Un solo parpadeo
    // (encendido, apagado, encendido: menos de 3 por segundo); con "reducir movimiento", sin parpadeo.
    rayos(color, colores, suaves) {
      const n = suaves ? 2 : 5;
      const piezas = [];
      const trazo = (cx, cy, largo, ang, col, dir) =>
        pieza({
          w: Math.round(largo), h: 4, ox: cx, oy: cy, dur: suaves ? 300 : 420, clase: 'vpTrazo', css: `background:${col}`,
          f: (p) => {
            const o = suaves ? 1 - p : p < 0.18 ? 1 : p < 0.34 ? 0.3 : p < 0.58 ? 1 : 1 - tramo(p, 0.58, 1);
            return val({ x: Math.cos(dir) * 10 * cuad(p), y: Math.sin(dir) * 10 * cuad(p), r: ang, o });
          },
        });
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rango(-0.4, 0.4);
        const LA = rango(22, 30);
        const LB = rango(16, 24);
        const b = a + (azar() < 0.5 ? -1 : 1) * rango(0.6, 1.05);
        const r0 = 8;
        const sx = Math.cos(a) * r0, sy = Math.sin(a) * r0;
        const ex = sx + Math.cos(a) * LA, ey = sy + Math.sin(a) * LA;
        piezas.push(trazo(sx + Math.cos(a) * LA / 2, sy + Math.sin(a) * LA / 2, LA, (a * 180) / Math.PI, '#ffffff', a));
        piezas.push(trazo(ex + Math.cos(b) * LB / 2, ey + Math.sin(b) * LB / 2, LB, (b * 180) / Math.PI, color, a));
      }
      piezas.push(pieza({ w: 24, h: 24, dur: 180, clase: 'vpPunto', css: 'background:#ffffff', f: (p) => val({ s: 0.3 + 0.9 * cuad(p), o: (1 - p) * (1 - p) }) }));
      return piezas;
    },
    // 1 estela que sube 46 px en 290 ms y, desde allí, 10 chispas (o 5) en dos anillos con un poco de gravedad y un fogonazo: 12 nodos, 850 ms en total.
    fuegos(color, colores, suaves) {
      const SUBE = 46;
      const piezas = [];
      if (!suaves) {
        piezas.push(pieza({ w: 3, h: 12, dur: 290, clase: 'vpTrazo', css: 'background:#fff3b0', f: (p) => val({ y: -SUBE * p, o: p < 0.95 ? 1 : 0 }) }));
      }
      const n = suaves ? 5 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rango(-0.15, 0.15);
        const d = (i % 2 ? rango(30, 42) : rango(52, 68)) * (suaves ? 0.6 : 1); // dos anillos: grande (pares) y chico (impares)
        piezas.push(
          pieza({
            w: 7, h: 7, oy: -SUBE, delay: suaves ? 0 : 290, dur: (suaves ? 0.7 : 1) * 560, clase: 'vpPunto', css: `background:${i % 3 === 0 ? '#ffffff' : color}`,
            f: (p) => val({ x: Math.cos(a) * d * cuad(p), y: Math.sin(a) * d * cuad(p) + (suaves ? 0 : 18) * p * p, s: 1 - 0.5 * p, o: Math.min(1, p * 14) * (1 - tramo(p, 0.75, 1)) }),
          }),
        );
      }
      // el fogonazo del estallido (1 nodo): un punto blanco que crece y se apaga en 160 ms
      if (!suaves) piezas.push(pieza({ w: 16, h: 16, oy: -SUBE, delay: 290, dur: 160, clase: 'vpPunto', css: 'background:#ffffff', f: (p) => val({ s: 0.5 + 1.1 * cuad(p), o: Math.min(1, p * 30) * (1 - p) }) }));
      return piezas;
    },
  };

  /** Dibuja un estallido de FX_NUEVOS en (x, y) del campo. Cada pieza se quita sola al terminar (y por un temporizador de respaldo). */
  function estallidoNuevo(x, y, color, colores, suaves) {
    FX_NUEVOS[sel.efecto](color, colores, suaves).forEach((pz) => {
      const el = document.createElement('div');
      el.className = 'vpPart ' + pz.clase;
      el.style.cssText = `left:${x + pz.ox - pz.w / 2}px;top:${y + pz.oy - pz.h / 2}px;width:${pz.w}px;height:${pz.h}px;${pz.css}`;
      if (pz.texto) el.textContent = pz.texto;
      if (pz.hijo) el.innerHTML = pz.hijo;
      capaFx.appendChild(el);
      const quitar = () => el.remove();
      if (el.animate) {
        const N = 20; // fotogramas por pieza: sobra para que el vaivén y el giro de las monedas se vean redondos
        const kf = Array.from({ length: N + 1 }, (_, k) => {
          const v = pz.f(k / N);
          return { offset: k / N, opacity: v.o, transform: `translate(${v.x}px, ${v.y}px) rotate(${v.r}deg) scale(${v.sx * v.s}, ${v.s})` };
        });
        const an = el.animate(kf, { duration: pz.dur, delay: pz.delay, easing: 'linear', fill: 'both' });
        an.onfinish = quitar;
      } else {
        el.style.opacity = '0';
      }
      setTimeout(quitar, pz.delay + pz.dur + 150); // por si la animación no corre (pestaña en segundo plano)
    });
  }

  function estallido(c) {
    try {
      const p = actual('paleta');
      const color = p.colores[c.i];
      const f = campo.getBoundingClientRect();
      const b = c.bq.getBoundingClientRect();
      const x = b.left - f.left - campo.clientLeft + b.width / 2;
      const y = b.top - f.top - campo.clientTop + b.height / 2;
      const suaves = reducirMovimiento(); // más suave: menos partículas, más cortas y sin giro
      if (FX_NUEVOS[sel.efecto]) return estallidoNuevo(x, y, color, p.colores, suaves); // CAMBIO-023
      const specs = especificaciones(sel.efecto, suaves ? 6 : 14, color, p.colores);
      specs.forEach((s) => {
        if (suaves) {
          s.d *= 0.5;
          s.fall *= 0.5;
          s.rot = 0;
        }
        const el = document.createElement('div');
        el.className = 'vpPart' + (s.glyph ? ' vpGlifo' : '');
        el.style.left = x - s.w / 2 + 'px';
        el.style.top = y - s.h / 2 + 'px';
        el.style.width = s.w + 'px';
        el.style.height = s.h + 'px';
        if (s.glyph) {
          el.textContent = s.glyph;
          el.style.color = s.color;
          el.style.fontSize = s.h + 'px';
          el.style.lineHeight = s.h + 'px';
        } else {
          el.style.backgroundColor = s.color;
          el.style.borderRadius = s.radius + 'px';
        }
        capaFx.appendChild(el);
        const quitar = () => el.remove();
        if (el.animate) {
          const an = el.animate(
            [
              { opacity: 1, transform: `translate(0px, 0px) rotate(${s.rot0}deg) scale(1)` },
              { opacity: 0, transform: `translate(${Math.cos(s.a) * s.d}px, ${Math.sin(s.a) * s.d + s.fall}px) rotate(${s.rot0 + s.rot}deg) scale(${s.end})` },
            ],
            { duration: s.dur, easing: 'cubic-bezier(0, 0, 0.58, 1)', fill: 'forwards' },
          );
          an.onfinish = quitar;
        }
        setTimeout(quitar, s.dur + 120); // por si la animación no corre (pestaña en segundo plano)
      });
    } catch (e) {}
  }

  // ------------------------------------------------------------------ paleta
  /** Colores y estilo (plano | cristal | contorno | degrade) de los 9 bloques; brillo de Diamante. */
  function aplicarPaleta() {
    const p = actual('paleta');
    campo.classList.remove('vpPlano', 'vpCristal', 'vpContorno', 'vpDegrade', 'vpEsmerilado', 'vpTenue', 'vpBoton', 'vpConBrillo');
    campo.classList.add('vp' + p.estilo.charAt(0).toUpperCase() + p.estilo.slice(1));
    if (p.brillo) campo.classList.add('vpConBrillo');
    celdas.forEach((c) => {
      // coleccion.js (varsPaleta): --c, --relleno, --arriba/--abajo (degradé), --tinte (esmerilado) y --borde (tenue)
      Object.entries(varsPaleta(p, c.i)).forEach(([k, v]) => c.bq.style.setProperty(k, v));
    });
  }

  // ------------------------------------------------------------------ fondo (FieldBackground.tsx)
  const CELDA_GRILLA = 44;
  const AURORA = [
    'radial-gradient(75% 30% at 18% 0%, rgba(61,220,151,0.16), rgba(61,220,151,0) 100%)',
    'radial-gradient(70% 28% at 80% 4%, rgba(79,140,255,0.15), rgba(79,140,255,0) 100%)',
    'radial-gradient(90% 26% at 50% 18%, rgba(176,108,255,0.10), rgba(176,108,255,0) 100%)',
  ].join(', ');

  /** 46 estrellas: posiciones fijas (Park–Miller, semilla 20261112), en % del campo. */
  const ESTRELLAS = (() => {
    let seed = 20261112;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: 46 }, () => ({ x: rnd() * 100, y: rnd() * 100, s: 1.5 + rnd() * 1.8, o: 0.18 + rnd() * 0.45 }));
  })();

  function lineas(w, h) {
    const cols = Math.floor(w / CELDA_GRILLA);
    const filas = Math.floor(h / CELDA_GRILLA);
    const ox = (w - cols * CELDA_GRILLA) / 2; // lo que sobra se reparte a los dos lados
    const oy = (h - filas * CELDA_GRILLA) / 2;
    const frag = document.createDocumentFragment();
    for (let i = 0; i <= cols; i++) {
      const l = document.createElement('i');
      l.className = 'vpLinea v';
      l.style.left = ox + i * CELDA_GRILLA + 'px';
      frag.appendChild(l);
    }
    for (let j = 0; j <= filas; j++) {
      const l = document.createElement('i');
      l.className = 'vpLinea h';
      l.style.top = oy + j * CELDA_GRILLA + 'px';
      frag.appendChild(l);
    }
    return frag;
  }

  let medida = '';
  function aplicarFondo() {
    capaFondo.textContent = '';
    capaFondo.style.backgroundImage = '';
    medida = '';
    capaFondo.className = 'vpFondoCampo';
    if (FONDOS.some((f) => f.nuevo && f.id === sel.fondo)) {
      capaFondo.classList.add('fx-' + sel.fondo); // CAMBIO-022: se dibujan con CSS (extras-fondos.css)
    } else if (sel.fondo === 'grilla') {
      dibujarGrilla();
    } else if (sel.fondo === 'estrellas') {
      const frag = document.createDocumentFragment();
      ESTRELLAS.forEach((st) => {
        const e = document.createElement('i');
        e.className = 'vpEstrella';
        e.style.cssText = `left:${st.x}%;top:${st.y}%;width:${st.s}px;height:${st.s}px;border-radius:${st.s / 2}px;opacity:${st.o}`;
        frag.appendChild(e);
      });
      capaFondo.appendChild(frag);
    } else if (sel.fondo === 'aurora') {
      capaFondo.style.backgroundImage = AURORA;
    }
  }

  function dibujarGrilla() {
    if (sel.fondo !== 'grilla') return;
    const w = Math.round(capaFondo.clientWidth);
    const h = Math.round(capaFondo.clientHeight);
    if (!w || !h || medida === w + 'x' + h) return;
    medida = w + 'x' + h;
    capaFondo.textContent = '';
    capaFondo.appendChild(lineas(w, h));
  }
  if (window.ResizeObserver) new ResizeObserver(dibujarGrilla).observe(capaFondo);

  // ------------------------------------------------------------------ selección: filas y línea de estado
  function marcarFilas() {
    grilla.querySelectorAll('[data-premio]').forEach((el) => {
      const [clave, id] = el.dataset.premio.split(':');
      const on = sel[clave] === id;
      el.classList.toggle('seleccionada', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function pintarLinea() {
    lineaSel.textContent = Object.keys(NOMBRES)
      .map((k) => `${NOMBRES[k]}: ${actual(k).n}`)
      .join(' · ');
  }

  function elegir(fila) {
    const [clave, id] = fila.dataset.premio.split(':');
    if (!(clave in sel)) return;
    sel[clave] = id;
    marcarFilas();
    pintarLinea();
    if (clave === 'paleta') aplicarPaleta();
    else if (clave === 'fondo') aplicarFondo();
    else if (clave === 'sonido') muestraSonido(id); // confirmación: suena de inmediato
  }

  grilla.addEventListener('click', (e) => {
    const fila = e.target.closest('[data-premio]');
    if (fila) elegir(fila);
  });
  grilla.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-premio]')) {
      e.preventDefault();
      elegir(e.target);
    }
  });

  /** Lo llama dibujarColeccion() (coleccion.js) después de reescribir los paneles. */
  function alRedibujar() {
    const slot = document.getElementById('vistaPreviaSlot');
    if (slot && panel.parentNode !== slot) slot.appendChild(panel);
    reconciliar();
    marcarFilas();
    pintarLinea();
    aplicarPaleta();
    aplicarFondo();
  }
  // global a propósito (como `redibujarColeccion`): coleccion.js lo consulta con typeof
  window.alRedibujarPremios = alRedibujar;
  alRedibujar();
})();
