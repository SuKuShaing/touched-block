/*
 * Touched Block · bloques que se pueden tocar en la página (touchedblock.app).
 *
 * Una versión mínima del juego, sin dependencias: aparecen bloques con un número o una
 * operación; cada toque baja el contador y, al llegar a 0, el bloque explota. Cada bloque tiene
 * una barra de vida (3 a 5 s, como en el juego) y, si se acaba, se apaga. A veces aparece una
 * trampa (texto rojo, o una resta que da 0 o menos): tocarla solo muestra un aviso.
 *
 * Los colores, el rojo de las trampas, los combos y la vida de los bloques son los del motor
 * (packages/engine/src/constants.ts). El aspecto es el de apps/client/src/components/Block.tsx
 * y Fx.tsx. No decide nada del juego real: es solo una muestra.
 *
 * Los bloques viven en una capa (#blocks) que cubre el documento y se desplaza con él. La capa
 * no recibe toques (pointer-events: none); solo los bloques. Aparecen únicamente en espacios
 * libres: nunca encima de textos, botones, enlaces ni tarjetas, así que no estorban.
 */
(function () {
  'use strict';

  // ---- Datos del motor (packages/engine/src/constants.ts) ----
  var COLORS = ['#e5484d', '#f76b15', '#e5a50a', '#30a46c', '#0091ff', '#6e56cf', '#d6409f', '#12a594', '#8e4ec6'];
  var REDDISH = ['#e5484d', '#f76b15', '#d6409f'];
  var SAFE = ['#e5a50a', '#30a46c', '#0091ff', '#6e56cf', '#12a594', '#8e4ec6'];
  var LIFE_MIN = 3; // s
  var LIFE_MAX = 5; // s
  var BOMB_PENALTY = 30; // s (solo se muestra; aquí no hay reloj)
  var COMBO_REWARDS = [[3, 1], [5, 2], [10, 3], [15, 4], [20, 5]];
  var COMBO_CYCLE = 20;
  var SYM = { add: '+', sub: '−', mul: '×', div: '÷' };
  var BAD = '#ff6369'; // C.bad: partículas de la trampa
  var OP_WIDTH_RATIO = 1.7;

  var layer = document.getElementById('blocks');
  if (!layer || !document.body || !('requestAnimationFrame' in window)) return;

  var field = document.querySelector('[data-field]');
  var killedEl = document.querySelector('[data-killed]');
  var streakEl = document.querySelector('[data-streak]');
  var toastEl = document.querySelector('[data-toast]');
  var pauseBtn = document.querySelector('[data-pause]');
  var header = document.querySelector('.site-header');

  // Nunca encima de esto (más un margen). El campo de prueba no está en la lista: es su lugar.
  var AVOID =
    'h1,h2,h3,p,li,a,button,summary,details,table,img,.btn,.store,.stores,.card,.step,.stages,.split,' +
    '.download,.eyebrow,.chip,.field-hud,.field-hint,.site-footer,.avoid';

  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() {
    return !!(reduceMq && reduceMq.matches);
  }

  // ---- Almacenamiento local: solo comodidad (contador y pausa); todo en try/catch ----
  var KEY_KILLED = 'tbl_rotos';
  var KEY_PAUSED = 'tbl_pausa';
  function load(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function save(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {}
  }

  var blocks = [];
  var killed = parseInt(load(KEY_KILLED) || '0', 10) || 0;
  var streak = 0;
  var spawned = 0;
  var paused = load(KEY_PAUSED) === '1';
  var running = false;
  var raf = 0;
  var last = 0;
  var cooldown = 0.5;
  var toastTimer = 0;
  var lastWidth = window.innerWidth;

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }
  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  /** Como labelFontSize() de Block.tsx: la mitad del alto; las operaciones se achican hasta caber. */
  function fontSizeFor(label, w, h) {
    var base = Math.min(w, h) * 0.5;
    if (label.length <= 2) return base;
    return Math.min(base, (w * 0.86) / (label.length * 0.62));
  }

  function comboBonusFor(s) {
    if (s <= 0) return 0;
    var p = ((s - 1) % COMBO_CYCLE) + 1;
    for (var i = 0; i < COMBO_REWARDS.length; i++) if (COMBO_REWARDS[i][0] === p) return COMBO_REWARDS[i][1];
    return 0;
  }

  // ---- Qué bloque aparece: números y operaciones cortas (en la página no hay que tocar 25 veces) ----
  function trapsNow() {
    var n = 0;
    for (var i = 0; i < blocks.length; i++) if (blocks[i].trap && !blocks[i].dead) n++;
    return n;
  }

  function makeShape(allowTrap) {
    var r = Math.random();
    if (r < 0.5) {
      var n = randInt(1, 6);
      return { kind: 'num', value: n, label: String(n) };
    }
    if (r < 0.82) {
      var a = randInt(1, 4);
      var b = randInt(1, 4);
      if (Math.random() < 0.4) {
        // resta: si da 0 o menos es trampa (como en el juego); si no puede haber otra trampa, se da vuelta
        if (a - b <= 0 && !(allowTrap && Math.random() < 0.5)) {
          if (a === b) return { kind: 'add', value: a + b, label: a + SYM.add + b };
          var t = a;
          a = b;
          b = t;
        }
        return { kind: 'sub', value: a - b, label: a + SYM.sub + b };
      }
      return { kind: 'add', value: a + b, label: a + SYM.add + b };
    }
    if (Math.random() < 0.4) {
      var d = randInt(2, 3);
      var q = randInt(1, 3);
      return { kind: 'div', value: q, label: q * d + SYM.div + d };
    }
    var x = randInt(1, 3);
    var y = randInt(2, 3);
    return { kind: 'mul', value: x * y, label: x + SYM.mul + y };
  }

  function blockSize() {
    var w = window.innerWidth;
    return w < 480 ? 64 : w < 900 ? 72 : 82;
  }

  // ---- Dónde: espacio libre dentro de la parte visible de la página ----
  function docRect(el) {
    var r = el.getBoundingClientRect();
    return { l: r.left + window.scrollX, t: r.top + window.scrollY, r: r.right + window.scrollX, b: r.bottom + window.scrollY };
  }
  function viewRect() {
    var top = window.scrollY + (header ? header.getBoundingClientRect().height : 0) + 10;
    return {
      l: window.scrollX + 8,
      t: top,
      r: window.scrollX + document.documentElement.clientWidth - 8,
      b: window.scrollY + window.innerHeight - 10,
    };
  }
  function intersects(a, b, m) {
    return a.l < b.r + m && b.l < a.r + m && a.t < b.b + m && b.t < a.b + m;
  }
  function clip(a, b) {
    return { l: Math.max(a.l, b.l), t: Math.max(a.t, b.t), r: Math.min(a.r, b.r), b: Math.min(a.b, b.b) };
  }
  function fieldArea() {
    if (!field) return null;
    var f = docRect(field);
    // dentro del campo, sin el marcador de arriba ni la ayuda de abajo
    return { l: f.l + 12, t: f.t + 60, r: f.r - 12, b: f.b - 52 };
  }
  function inField(b) {
    var a = fieldArea();
    return !!a && b.x >= a.l - 1 && b.y >= a.t - 1 && b.x + b.w <= a.r + 1 && b.y + b.h <= a.b + 1;
  }

  function findSpot(w, h) {
    var view = viewRect();
    var areas = [];
    var fa = fieldArea();
    var inFieldCount = 0;
    for (var i = 0; i < blocks.length; i++) if (!blocks[i].dead && blocks[i].field) inFieldCount++;
    var fieldMax = window.innerWidth >= 900 ? 3 : 2;
    if (fa) {
      var vis = clip(fa, view);
      if (vis.r - vis.l >= w && vis.b - vis.t >= h && inFieldCount < fieldMax) areas.push({ rect: vis, field: true });
    }
    // fuera del campo, casi siempre como segunda opción (y siempre si el campo no se ve)
    if (!areas.length || Math.random() < 0.3) areas.push({ rect: view, field: false });
    if (areas.length > 1 && Math.random() < 0.3) areas.reverse();

    for (var k = 0; k < areas.length; k++) {
      var area = areas[k].rect;
      if (area.r - area.l < w || area.b - area.t < h) continue;
      // obstáculos que tocan esta zona
      var obstacles = [];
      var els = document.querySelectorAll(AVOID);
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (field && field.contains(el) && !el.matches('.field-hud,.field-hint,.chip,button')) continue;
        var r = docRect(el);
        if (r.r - r.l === 0 || r.b - r.t === 0) continue;
        if (intersects(r, area, 12)) obstacles.push(r);
      }
      if (!areas[k].field && field) obstacles.push(docRect(field)); // fuera del campo, nunca a medias sobre su borde
      for (var t = 0; t < 40; t++) {
        var x = area.l + Math.random() * (area.r - area.l - w);
        var y = area.t + Math.random() * (area.b - area.t - h);
        var c = { l: x, t: y, r: x + w, b: y + h };
        var ok = true;
        for (var o = 0; o < obstacles.length && ok; o++) if (intersects(c, obstacles[o], 10)) ok = false;
        for (var q = 0; q < blocks.length && ok; q++) {
          var bb = blocks[q];
          if (bb.dead) continue;
          if (intersects(c, { l: bb.x, t: bb.y, r: bb.x + bb.w, b: bb.y + bb.h }, 8)) ok = false;
        }
        if (ok) return { x: x, y: y, field: areas[k].field };
      }
    }
    return null;
  }

  // ---- Crear, tocar, explotar, apagarse ----
  function spawn() {
    var canTrap = spawned >= 2 && trapsNow() < 1; // las dos primeras, siempre normales
    var red = canTrap && Math.random() < 0.16; // BOMB_CHANCE del motor
    var shape = makeShape(canTrap && !red);
    var h = blockSize();
    var w = shape.kind === 'num' ? h : Math.round(h * OP_WIDTH_RATIO);
    var spot = findSpot(w, h);
    if (!spot) return false;
    var color = shape.kind === 'num' ? COLORS[(shape.value - 1) % COLORS.length] : pick(COLORS);
    if (red && REDDISH.indexOf(color) >= 0) color = pick(SAFE);
    var trap = red || shape.value <= 0;
    var total = Math.max(shape.value, 0);
    var life = rand(LIFE_MIN, LIFE_MAX);

    var el = document.createElement('div');
    el.className = 'blk spawn' + (red ? ' red' : '');
    el.style.left = spot.x + 'px';
    el.style.top = spot.y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.background = color;
    el.setAttribute('aria-hidden', 'true');
    var n = document.createElement('span');
    n.className = 'n';
    n.textContent = shape.label;
    n.style.fontSize = fontSizeFor(shape.label, w, h) + 'px';
    var bar = document.createElement('i');
    bar.className = 'life';
    el.appendChild(n);
    el.appendChild(bar);
    el.addEventListener('animationend', function (e) {
      if (e.animationName === 'blk-spawn' || e.animationName === 'fade-in' || e.animationName === 'blk-hit') {
        el.classList.remove('spawn', 'hit');
      }
    });

    var b = {
      el: el,
      num: n,
      bar: bar,
      kind: shape.kind,
      label: shape.label,
      value: shape.value,
      total: total,
      left: total,
      trap: trap,
      red: red,
      life: life,
      max: life,
      x: spot.x,
      y: spot.y,
      w: w,
      h: h,
      color: color,
      field: spot.field,
      dead: false,
    };
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      tap(b);
    });
    layer.appendChild(el);
    blocks.push(b);
    spawned++;
    return true;
  }

  function removeBlock(b) {
    b.dead = true;
    var i = blocks.indexOf(b);
    if (i >= 0) blocks.splice(i, 1);
  }

  function tap(b) {
    if (b.dead || paused) return;
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;
    if (b.trap) {
      removeBlock(b);
      b.el.remove();
      burst(cx, cy, BAD, 24);
      floatText(cx, cy, '−' + BOMB_PENALTY + 's', true);
      flash(b);
      if (b.field && field && !reduced()) restart(field, 'shake');
      streak = 0;
      updateHud();
      notify(
        b.red
          ? '¡Trampa! El texto rojo no se toca'
          : '¡Trampa! ' + b.label + ' = ' + String(b.value).replace('-', '−') + ': solo se tocan positivos',
        'bad',
        b
      );
      return;
    }
    b.left--;
    if (b.left > 0) {
      if (b.kind === 'num') b.num.textContent = String(b.left); // las operaciones mantienen lo escrito
      if (!reduced()) restart(b.el, 'hit');
      return;
    }
    // destruido
    removeBlock(b);
    b.el.remove();
    burst(cx, cy, b.color, 14);
    floatText(cx, cy, '+' + b.total + 's', false);
    killed++;
    streak++;
    save(KEY_KILLED, String(killed));
    updateHud();
    var bonus = comboBonusFor(streak);
    if (bonus) notify('+' + bonus + 's · ¡Combo ×' + streak + '!', 'gold', b);
  }

  function expire(b) {
    removeBlock(b);
    var el = b.el;
    // como el juego: el bloque se apaga (gris), con ✕ si era un bloque normal; la trampa, sin nada
    b.num.textContent = b.trap ? '' : '✕';
    b.num.style.fontSize = fontSizeFor('✕', b.w, b.h) + 'px';
    if (b.bar.parentNode) b.bar.remove();
    el.classList.remove('spawn', 'hit', 'red');
    el.classList.add('gone');
    setTimeout(function () {
      el.remove();
    }, 320);
    if (!b.trap) {
      if (streak >= 3) notify('Se escapó un bloque · racha de ' + streak, 'bad', b);
      streak = 0;
      updateHud();
    }
  }

  function restart(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // reinicia la animación
    el.classList.add(cls);
  }

  // ---- Efectos (Fx.tsx): partículas, "+Ns", destello ----
  function burst(cx, cy, color, count) {
    var rm = reduced();
    var n = rm ? 6 : count;
    for (var i = 0; i < n; i++) {
      var p = document.createElement('i');
      p.className = 'part';
      p.style.left = cx - 5 + 'px';
      p.style.top = cy - 5 + 'px';
      p.style.background = color;
      layer.appendChild(p);
      var a = Math.random() * Math.PI * 2;
      var d = rm ? 14 + Math.random() * 10 : 40 + Math.random() * 80;
      var rot = rm ? 0 : Math.random() * 400;
      var fall = rm ? 0 : 30;
      var dur = rm ? 300 : 450 + Math.random() * 250;
      var dx = Math.cos(a) * d;
      var dy = Math.sin(a) * d + fall;
      if (p.animate) {
        var anim = p.animate(
          [
            { transform: 'translate(0,0) rotate(0deg) scale(1)', opacity: 1 },
            { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg) scale(0.2)', opacity: 0 },
          ],
          { duration: dur, easing: 'cubic-bezier(0,0,0.58,1)', fill: 'forwards' }
        );
        anim.onfinish = removeSelf(p);
      } else {
        setTimeout(removeSelf(p), 10);
      }
    }
  }
  function removeSelf(el) {
    return function () {
      el.remove();
    };
  }
  function floatText(cx, cy, text, neg, small) {
    var f = document.createElement('div');
    f.className = 'float' + (neg ? ' neg' : '') + (small ? ' msg' : '');
    f.textContent = text;
    f.style.left = cx + 'px';
    f.style.top = cy - 30 + 'px';
    f.setAttribute('aria-hidden', 'true');
    layer.appendChild(f);
    setTimeout(removeSelf(f), small ? 1450 : 850);
  }
  function flash(b) {
    var f = document.createElement('div');
    f.className = 'flash';
    f.style.left = b.x - 6 + 'px';
    f.style.top = b.y - 6 + 'px';
    f.style.width = b.w + 12 + 'px';
    f.style.height = b.h + 12 + 'px';
    layer.appendChild(f);
    setTimeout(removeSelf(f), 450);
  }

  /** El aviso del campo se ve: ni bajo la cabecera ni fuera de la pantalla. */
  function toastVisible() {
    if (!toastEl) return false;
    var r = toastEl.getBoundingClientRect();
    var top = header ? header.getBoundingClientRect().bottom : 0;
    return r.top >= top && r.bottom <= window.innerHeight;
  }
  /** Aviso corto: en el campo si se ve; si no, junto al bloque. */
  function notify(text, tone, b) {
    if (toastVisible()) {
      toastEl.textContent = text;
      toastEl.className = 'field-toast on ' + tone;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
        toastEl.className = 'field-toast ' + tone;
      }, 1800);
    } else if (b) {
      floatText(b.x + b.w / 2, b.y + b.h + 40, text, tone === 'bad', true);
    }
  }

  function updateHud() {
    if (killedEl) killedEl.textContent = String(killed);
    if (streakEl) streakEl.textContent = String(streak);
  }

  // ---- Bucle ----
  function maxBlocks() {
    if (reduced()) return 2;
    return window.innerWidth >= 900 ? 5 : 3;
  }
  function frame(ts) {
    if (!running) return;
    var dt = last ? Math.min(ts - last, 100) / 1000 : 0;
    last = ts;
    for (var i = blocks.length - 1; i >= 0; i--) {
      var b = blocks[i];
      b.life -= dt;
      if (b.life <= 0) expire(b);
      else b.bar.style.transform = 'scaleX(' + (b.life / b.max).toFixed(4) + ')';
    }
    cooldown -= dt;
    if (cooldown <= 0) {
      if (blocks.length < maxBlocks() && spawn()) cooldown = 0.6 + Math.random() * 0.9;
      else cooldown = 0.4;
    }
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || paused || document.hidden) return;
    running = true;
    last = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }
  function clearAll() {
    for (var i = blocks.length - 1; i >= 0; i--) {
      blocks[i].dead = true;
      blocks[i].el.remove();
    }
    blocks.length = 0;
  }

  function setPaused(value) {
    paused = value;
    save(KEY_PAUSED, value ? '1' : '0');
    if (pauseBtn) {
      pauseBtn.setAttribute('aria-pressed', value ? 'true' : 'false');
      pauseBtn.setAttribute('aria-label', value ? 'Reanudar los bloques' : 'Pausar los bloques');
      pauseBtn.title = value ? 'Reanudar los bloques' : 'Pausar los bloques';
    }
    if (field) field.classList.toggle('paused', value);
    if (value) {
      stop();
      clearAll();
    } else {
      cooldown = 0.3;
      start();
    }
  }

  // la pestaña oculta no gasta nada (y al volver no se "pierde" el tiempo de los bloques)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });
  // al cambiar el ancho, el contenido se reacomoda: se quitan los bloques para no tapar nada
  window.addEventListener('resize', function () {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    clearAll();
  });
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () {
      setPaused(!paused);
    });
  }

  updateHud();
  setPaused(paused);
})();
