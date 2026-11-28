// Réplica de la escala de etapas (StageTrack.tsx). Hitos de packages/engine/src/progress.ts.
const HITOS = ['4', '5', '6', '7', '8', '9', '+ −', '× ÷', '4 s', '3 s', '2 s', '1 s'];

// Hasta dónde llegó el jugador, en hitos (0 = recién empieza). Cambia este valor para probar.
const AVANCE = 0;

const pos = (i) => (i + 1) / HITOS.length; // milestonePos: cada hito ocupa el mismo ancho

const escala = document.getElementById('escala');
const caja = document.createElement('div');
caja.className = 'trackBox';

const pista = document.createElement('div');
pista.className = 'track';
const relleno = document.createElement('div');
relleno.className = 'fill';
relleno.style.width = `${(AVANCE / HITOS.length) * 100}%`;
pista.appendChild(relleno);
HITOS.slice(0, -1).forEach((_, i) => {
  const sep = document.createElement('div');
  sep.className = 'sep';
  sep.style.left = `${pos(i) * 100}%`;
  pista.appendChild(sep);
});
caja.appendChild(pista);

const perilla = document.createElement('div');
perilla.className = 'knob';
perilla.style.left = `${(AVANCE / HITOS.length) * 100}%`;
caja.appendChild(perilla);

HITOS.forEach((texto, i) => {
  const icono = document.createElement('span');
  icono.className = 'icon' + (pos(i) <= AVANCE / HITOS.length + 1e-9 ? ' on' : '');
  icono.style.left = `${pos(i) * 100}%`;
  icono.textContent = texto;
  caja.appendChild(icono);
});

escala.appendChild(caja);

let conCambios = false; // lo mueve el interruptor de arriba a la derecha (Ahora / Con cambios)

// ---------------------------------------------------------------- bloques destruidos y nivel
// Réplica de apps/client/src/lib/level.ts. LEVEL_FACTOR = 25.
//   Ahora:       el nivel n empieza en 25 · n · (n − 1) bloques (el nivel 1 parte en 0).
//   Con cambios: el nivel n empieza en 25 · n · (n + 1) bloques (el nivel 1 llega a los 50). CAMBIO-004.
const LEVEL_FACTOR = 25;
const NIVEL_MAX = 25; // hasta dónde se dibuja la recta en "Ahora"
// "Ahora": niveles que desbloquean un fondo del campo (apps/client/src/cosmetics/catalog.ts)
const PREMIOS_NIVEL = { 5: 'Grilla', 10: 'Estrellas', 20: 'Aurora' };

/**
 * Niveles que se marcan en celeste. Con cambios los fondos ya no se ganan por nivel (CAMBIO-025) y las paletas sí (CAMBIO-016 a
 * 019): salen de PALETAS (coleccion.js, que ya está cargado cuando se puede mover el interruptor).
 */
function premiosNivel() {
  if (!conCambios || typeof PALETAS === 'undefined') return PREMIOS_NIVEL;
  const out = {};
  PALETAS.forEach((p) => {
    const n = p.nivelNuevo ?? (p.nuevo && p.req.tipo === 'nivel' ? p.req.nivel : null);
    if (n != null) out[n] = p.n;
  });
  return out;
}

const inicioNivelHoy = (n) => LEVEL_FACTOR * n * (n - 1);
const inicioNivelNuevo = (n) => LEVEL_FACTOR * n * (n + 1);
const inicioNivel = (n) => (conCambios ? inicioNivelNuevo(n) : inicioNivelHoy(n));
const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // 2000 → "2.000"

function dibujarRecta() {
  const cont = document.getElementById('rectaBloques');
  cont.innerHTML = '';
  const premios = premiosNivel();
  const nivelesPremio = Object.keys(premios).map(Number);
  // con cambios la recta llega hasta la última paleta (nivel 30); en "Ahora", hasta el 25 como siempre
  const nivelMax = Math.max(NIVEL_MAX, ...nivelesPremio);
  // en cada modo caben las dos curvas (hoy y CAMBIO-004), para comparar posiciones dentro de la misma recta
  const max = Math.max(inicioNivelHoy(nivelMax), inicioNivelNuevo(nivelMax));
  const x = (bloques) => `${(bloques / max) * 100}%`;
  const caja = document.createElement('div');
  caja.className = 'trackBox rectaBloques';
  cont.appendChild(caja);
  const ancho = caja.clientWidth || 1; // px reales, para que los números no se monten

  const pista = document.createElement('div');
  pista.className = 'track';
  caja.appendChild(pista);

  // Arriba: cantidades de bloques (cada 2.000; en pantallas angostas, cada 4.000)
  const paso = ancho < 600 ? 4000 : 2000;
  for (let b = 0; b <= max; b += paso) {
    const n = document.createElement('span');
    n.className = 'cantidad';
    n.style.left = x(b);
    n.textContent = fmt(b);
    caja.appendChild(n);
  }

  // Con cambios: dónde empezarían con la curva de hoy los niveles que dan premio (marca gris), para ver cuánto se mueven
  if (conCambios) {
    nivelesPremio.forEach((n) => {
      const f = document.createElement('div');
      f.className = 'nivel fantasma';
      f.style.left = x(inicioNivelHoy(n));
      f.title = `Curva de hoy: nivel ${n} desde ${fmt(inicioNivelHoy(n))} bloques (paleta ${premios[n]})`;
      caja.appendChild(f);
    });
  }

  // Abajo: una marca por nivel. Al principio los niveles quedan muy juntos, así que el número solo
  // se escribe si no choca con el anterior (los que dan premio siempre llevan número).
  const px = (n) => (inicioNivel(n) / max) * ancho;
  const SEPARACION = 16; // px mínimos entre dos números de nivel
  const conNumero = [...nivelesPremio];
  for (let n = 1; n <= nivelMax; n++) {
    if (!conNumero.includes(n) && conNumero.every((m) => Math.abs(px(m) - px(n)) >= SEPARACION)) conNumero.push(n);
  }
  let anterior = null; // último nivel con premio escrito en la fila de arriba
  for (let n = 1; n <= nivelMax; n++) {
    const b = inicioNivel(n);
    const premio = premios[n];
    const marca = document.createElement('div');
    marca.className = 'nivel' + (premio ? ' premio' : '');
    marca.style.left = x(b);
    marca.title = `Nivel ${n}: desde ${fmt(b)} bloques${premio ? ` · desbloquea ${conCambios ? 'la paleta' : 'el fondo'} ${premio}` : ''}`;
    if (conNumero.includes(n)) marca.innerHTML = `<span>${n}</span>`;
    // dos niveles con premio pegados (p. ej. 15 y 16 en el celular): el segundo número baja una línea
    if (premio) {
      if (anterior !== null && px(n) - px(anterior) < SEPARACION) marca.classList.add('escalonado');
      else anterior = n;
    }
    caja.appendChild(marca);
  }

  // CAMBIO-007: el "nivel" pasa a presentarse como Experiencia
  const titulo = document.getElementById('tituloNivel');
  if (titulo) titulo.textContent = conCambios ? 'Experiencia: bloques destruidos y nivel' : 'Bloques destruidos y nivel';

  const f = document.getElementById('formulaNivel');
  if (f) {
    f.innerHTML = conCambios
      ? 'Con cambios: el nivel n empieza en <b>25 · n · (n + 1)</b> bloques. De 0 a 49 no hay nivel; el <b>nivel 1 llega a los 50</b>. En gris, dónde empezarían con la curva de hoy los niveles que dan premio.'
      : 'Hoy: el nivel n empieza en <b>25 · n · (n − 1)</b> bloques. El nivel 1 parte en 0 y el nivel 2 llega a los 50.';
  }

  const nota = document.getElementById('notaRecta');
  if (nota) {
    nota.textContent =
      'Arriba, bloques destruidos (más los de misiones). Abajo, en chico, el nivel al que llegas. ' +
      (conCambios
        ? 'En celeste, los niveles que desbloquean una paleta (CAMBIO-016); los fondos y los efectos ya no se ganan por nivel (CAMBIO-025).'
        : 'En celeste, los niveles que desbloquean un fondo.');
  }
}

dibujarRecta();
let esperaRecta;
window.addEventListener('resize', () => {
  clearTimeout(esperaRecta);
  esperaRecta = setTimeout(dibujarRecta, 100);
});

// ---------------------------------------------------------------- insignias
// Réplica de TIERS (packages/engine/src/progress.ts). `at` = segundos jugados en una partida.
// AHORA = cómo está hoy en el juego.
const AHORA = [
  { tier: 'madera', step: 1, name: 'Madera I', at: 0, goal: 'Terminar una partida' },
  { tier: 'madera', step: 2, name: 'Madera II', at: 40, goal: 'Llegar al 5' },
  { tier: 'madera', step: 3, name: 'Madera III', at: 100, goal: 'Llegar al 8' },
  { tier: 'bronce', step: 1, name: 'Bronce', at: 140, goal: 'Llegar a las sumas y restas' },
  { tier: 'plata', step: 1, name: 'Plata', at: 275, goal: 'Llegar a las multiplicaciones y divisiones' },
  { tier: 'oro', step: 1, name: 'Oro', at: 350, goal: 'Llegar a la etapa final' },
  { tier: 'diamante', step: 1, name: 'Diamante', at: 440, goal: 'Llegar a los bloques de 1 s' },
];

// CAMBIOS propuestos (todavía NO están en el juego; ver cambios.md). Clave: `${tier}-${step}`.
const CAMBIOS = {
  // CAMBIO-001 (cuándo) + CAMBIO-005 (diseño y nombre: Papel). `arte: true` = el SVG sale de insignias_nuevas/
  'madera-1': { at: 20, goal: 'Llegar al 4', name: 'Papel', arte: true },
  // CAMBIO-002 (cuándo) + CAMBIO-005 (Cartón)
  'madera-2': { at: 60, goal: 'Llegar al 6', name: 'Cartón', arte: true },
  // CAMBIO-005: solo cambia el diseño y el nombre (estrella de otra madera, puntas remachadas)
  'madera-3': { name: 'Madera', arte: true },
  // CAMBIO-003
  'diamante-1': { at: 410, goal: 'Llegar a los bloques de 2 s' },
};

/** Insignias según el interruptor, de menos a más puntos. `antes` guarda el valor de hoy si cambia. */
function insignias() {
  return AHORA.map((t) => {
    const c = conCambios && CAMBIOS[`${t.tier}-${t.step}`];
    return c ? { ...t, ...c, antes: t } : t;
  }).sort((a, b) => a.at - b.at);
}

const textoTiempo = (at) => (at === 0 ? 'Al terminar una partida' : `${at} s jugados`);

/** "Hoy: Madera I · Terminar una partida…": solo lo que cambió (nombre y/o cuándo se gana). */
function textoAntes(t) {
  const partes = [];
  if (t.antes.name !== t.name) partes.push(t.antes.name);
  if (t.antes.goal !== t.goal || t.antes.at !== t.at) partes.push(`${t.antes.goal} · ${textoTiempo(t.antes.at)}`);
  return partes.join(' · ') || 'solo cambia el diseño';
}

// `at` de cada hito de la escala (MILESTONES): 4…9, + −, × ÷, 4 s…1 s
const AT_HITOS = [20, 40, 60, 80, 100, 120, 140, 275, 350, 380, 410, 440];

// Réplica de trackPos (stagePath.ts): posición 0..1 de unos segundos en la pista
function trackPos(segundos) {
  const n = AT_HITOS.length;
  if (!(segundos > 0)) return 0;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    if (segundos < AT_HITOS[i]) return (i + (segundos - prev) / (AT_HITOS[i] - prev)) / n;
    prev = AT_HITOS[i];
  }
  return 1;
}

// Los diseños de hoy están en insignias/; los propuestos (CAMBIO-005) en insignias_nuevas/ y solo se usan con `arte`.
const archivo = (t, small) => `${t.arte ? 'insignias_nuevas' : 'insignias'}/${t.tier}-${t.step}${small ? '-small' : ''}.svg`;

caja.classList.add('conInsignias');
const lista = document.getElementById('lista');

// Dibuja las insignias pequeñas bajo la escala (en qué momento se gana cada una) y las tarjetas de abajo.
// Se vuelve a llamar cada vez que se mueve el interruptor Ahora / Con cambios.
function dibujarInsignias() {
  const ins = insignias();

  caja.querySelectorAll('.mini').forEach((el) => el.remove());
  ins.forEach((t) => {
    if (t.antes) {
      // fantasma donde está hoy, para ver cuánto se mueve
      const f = document.createElement('img');
      f.className = 'mini fantasma';
      f.src = archivo(t.antes, true); // el diseño de hoy
      f.alt = '';
      f.title = `${t.antes.name} hoy: ${t.antes.goal}`;
      f.style.left = `${trackPos(t.antes.at) * 100}%`;
      caja.appendChild(f);
    }
    const img = document.createElement('img');
    img.className = 'mini' + (t.antes ? ' cambia' : '');
    img.src = archivo(t, true);
    img.alt = t.name;
    img.title = `${t.name}: ${t.goal}`;
    img.style.left = `${trackPos(t.at) * 100}%`;
    caja.appendChild(img);
  });

  lista.innerHTML = '';

  // Estado vacío: antes de ganar la primera insignia la colección dibuja un hueco con borde punteado y
  // "Sin insignia" (EmptyMedal / TierCard en apps/client/src/screens/CollectionScreen.tsx).
  const primera = ins[0];
  const como = primera.at === 0 ? 'Termina una partida' : primera.goal.replace(/^Llegar/, 'Llega');
  const vacia = document.createElement('div');
  vacia.className = 'tarjeta vacia';
  vacia.innerHTML =
    `<div class="medallaVacia"></div>` +
    `<div class="nombre">Sin insignia</div>` +
    `<div class="meta">${como} para ganar ${primera.name}.</div>` +
    `<div class="tiempo">Estado vacío</div>`;
  lista.appendChild(vacia);

  ins.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'tarjeta' + (t.antes ? ' cambia' : '');
    card.innerHTML =
      `<img src="${archivo(t, false)}" alt="${t.name}">` +
      `<div class="nombre">${t.name}</div>` +
      `<div class="meta">${t.goal}</div>` +
      `<div class="tiempo">${textoTiempo(t.at)}</div>` +
      (t.antes ? `<div class="antes">Hoy: ${textoAntes(t)}</div>` : '');
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.addEventListener('click', () => abrirModal(t));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirModal(t);
      }
    });
    lista.appendChild(card);
  });
}

// ---------------------------------------------------------------- modal de tamaños
// Tamaños en que la app dibuja la insignia (TierBadge.tsx, BADGE_PX; TabIcons.tsx; medal.ts SHARE_BADGE).
// Bajo 30 px (SMALL_MEDAL_PX) la app usa la versión simple (-small).
const TAMANOS = [
  { px: 11, donde: 'Cofre de la pestaña Perfil (TabIcons)' },
  { px: 22, donde: 'sm: rankings, retos y pantalla de juego' },
  { px: 38, donde: 'md: perfil, perfil público y premios' },
  { px: 74, donde: 'lg: colección y celebración' },
  { px: 170, donde: 'Tarjeta de compartir' },
];

const modal = document.getElementById('modal');
const cerrar = () => {
  modal.hidden = true;
};

function abrirModal(t) {
  document.getElementById('modalTitulo').textContent = t.name;
  document.getElementById('modalMeta').textContent = t.goal;
  const cont = document.getElementById('modalTamanos');
  cont.innerHTML = '';
  TAMANOS.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'tamano';
    item.innerHTML =
      `<img src="${archivo(t, s.px < 30)}" width="${s.px}" height="${s.px}" alt="${t.name} a ${s.px} px">` +
      `<div class="px">${s.px} px</div>` +
      `<div class="donde">${s.donde}</div>`;
    cont.appendChild(item);
  });
  modal.hidden = false;
}

modal.addEventListener('click', (e) => {
  if (e.target === modal) cerrar(); // clic en el fondo
});
document.getElementById('modalCerrar').addEventListener('click', cerrar);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrar();
});

// ---------------------------------------------------------------- interruptor Ahora / Con cambios
const interruptor = document.getElementById('interruptor');
function aplicarModo(valor) {
  conCambios = valor;
  interruptor.setAttribute('aria-checked', String(valor));
  document.body.classList.toggle('conCambios', valor);
  dibujarInsignias();
  dibujarRecta();
  if (typeof redibujarRetos === 'function') redibujarRetos();
  if (typeof redibujarMisiones === 'function') redibujarMisiones(); // `var` de más abajo, igual que redibujarRetos
  if (typeof redibujarColeccion === 'function') redibujarColeccion(); // `var` de más abajo (aún sin asignar en la 1.ª llamada)
}
interruptor.addEventListener('click', () => aplicarModo(!conCambios));

aplicarModo(false);

// ---------------------------------------------------------------- retos y misiones
// Réplica de packages/engine/src/daily.ts (DAILY_CALENDAR y reglas) y missions.ts (MISSION_POOL).
// Se ve como en el celular (DailyCard.tsx / MissionList.tsx), pero con todos los días y todas las misiones.

// Reto diario: lo que cambia cada día de la semana (0 = lunes … 6 = domingo, como `weekdayOf`).
const RETO_SEMANA = [
  { dia: 'Lunes', titulo: 'Partida normal', detalle: 'Sin modificadores: se juega como siempre.' },
  { dia: 'Martes', titulo: 'Directo a las sumas', detalle: 'Parte directo en las sumas y restas (140 s de partida).' },
  { dia: 'Miércoles', titulo: 'Solo 3 vidas', detalle: 'Tres vidas en vez de cinco.' },
  { dia: 'Jueves', titulo: 'Solo multiplicaciones y divisiones', detalle: 'Solo salen multiplicaciones y divisiones, y parte en su dificultad (275 s de partida).' },
  { dia: 'Viernes', titulo: 'Sin trampas rojas', detalle: 'No aparecen trampas rojas (las restas que dan 0 o menos siguen siendo trampa).' },
  { dia: 'Sábado', titulo: 'Directo a las multiplicaciones', detalle: 'Parte directo en las multiplicaciones y divisiones (275 s de partida).' },
  { dia: 'Domingo', titulo: 'Partida normal', detalle: 'Sin modificadores: se juega como siempre.' },
];

// CAMBIO-013: 8 retos nuevos. Con cambios el calendario deja de ser "uno por día de la semana" y pasa a ser un CICLO de 15 días
// (los 7 de hoy + estos 8, en este orden) contado desde el lunes 7 dic 2026 (RETO_INICIO_CICLO) y que luego se repite.
// Todos usan solo los modificadores que el motor ya tiene (`startAt`, `only`, `lives`, `noRed`), solos o combinados.
const RETO_INICIO_CICLO = '2026-12-07'; // lunes: el día 1 del ciclo (antes de esa fecha sigue el calendario de hoy)
const RETO_NUEVOS = [
  { titulo: 'Solo 4 vidas', detalle: 'Cuatro vidas en vez de cinco.' },
  { titulo: 'Solo números', detalle: 'No hay operaciones: solo salen números.' },
  { titulo: 'Solo sumas y restas', detalle: 'Solo salen sumas y restas, partiendo en las más fáciles ("1+1") y subiendo con el tiempo.' },
  { titulo: 'Sumas sin trampas rojas', detalle: 'Parte directo en las sumas y restas (140 s de partida) y no aparecen trampas rojas.' },
  { titulo: 'Solo 2 vidas', detalle: 'Dos vidas en vez de cinco.' },
  { titulo: 'Multiplicaciones con 3 vidas', detalle: 'Solo multiplicaciones y divisiones, desde su dificultad (275 s de partida) y con tres vidas.' },
  { titulo: 'Directo a la etapa final', detalle: 'Parte en la etapa final (350 s de partida): sale de todo y los bloques viven solo 4 s, bajando a 1 s.' },
  { titulo: 'Una sola vida', detalle: 'Una vida en vez de cinco. Cualquier error cuesta la partida.' },
];

// Reglas del reto (daily.ts)
const RETO_REGLAS = [
  ['Un reto nuevo cada día', 'El mismo para todos, con la fecha local de cada jugador. El reto #1 fue el 12 nov 2026.'],
  ['Intentos', '3 por día con cuenta (cuenta el mejor) · 1 por día como invitado.'],
  ['Vidas', '5, igual para todos (sin los corazones extra por invitar amigos).'],
  ['Racha de días', 'Cuenta los días seguidos jugando el reto. Se perdona 1 día sin jugar por cada 7 jugados.'],
  ['Ranking del día', 'Cada reto tiene su ranking de ese día; el resumen de ayer sale en la tarjeta ("Habrías quedado 1.º de 3").'],
  ['Cuándo aparece', 'Se desbloquea con la 2.ª visita o la 3.ª partida terminada, junto con las misiones.'],
];

// CAMBIO-013: con cambios se agrega una fila a las reglas (el calendario pasa a ser un ciclo de 15 días)
const RETO_REGLA_CALENDARIO = ['Calendario', 'Un ciclo de 15 días que se repite, contado desde el lunes 7 dic 2026 (día 1). Antes de esa fecha sigue el calendario de hoy.'];

/** Dibuja las reglas y las tarjetas de los retos según el interruptor Ahora / Con cambios, y el contador del título. */
function dibujarRetos() {
  const reglas = conCambios ? [RETO_REGLAS[0], RETO_REGLA_CALENDARIO, ...RETO_REGLAS.slice(1)] : RETO_REGLAS;
  document.getElementById('retosReglas').innerHTML =
    `<div class="capJuego">Cómo funciona el reto del día</div>` +
    reglas.map(([t, d]) => `<div class="filaRegla"><b>${t}</b><span>${d}</span></div>`).join('');

  // Ahora: "Reto de los lunes". Con cambios: "Día N de 15" (el ciclo ya no depende del día de la semana)
  const tarjeta = (r, titulo, nueva) =>
    `<div class="panelJuego tarjetaReto${nueva ? ' nuevoReto' : ''}">` +
    `<div class="capJuego acento">${titulo}${nueva ? ' · nuevo' : ''}</div>` +
    `<div class="tituloReto">${r.titulo}</div>` +
    `<div class="detalleReto">${r.detalle}</div>` +
    `</div>`;
  const total = RETO_SEMANA.length + RETO_NUEVOS.length;
  const tarjetas = conCambios
    ? [
        ...RETO_SEMANA.map((r, i) => tarjeta(r, `Día ${i + 1} de ${total}`, false)),
        ...RETO_NUEVOS.map((r, i) => tarjeta(r, `Día ${RETO_SEMANA.length + i + 1} de ${total}`, true)),
      ]
    : RETO_SEMANA.map((r) => tarjeta(r, `Reto de los ${r.dia.toLowerCase()}${/o$/.test(r.dia) ? 's' : ''}`, false));
  document.getElementById('retosSemana').innerHTML = tarjetas.join('');

  const contador = document.getElementById('retosContador');
  contador.textContent = `${tarjetas.length} retos`;
  contador.classList.toggle('acento', conCambios);
}
var redibujarRetos = dibujarRetos; // `var` a propósito: aplicarModo() (más arriba) la llama
dibujarRetos();

// Misiones del día: salen 3 del pool (13 hoy, 28 con CAMBIO-014 y CAMBIO-015), de tipos distintos e iguales para todos ese día. `premio` = bloques extra para el nivel.
const MISIONES = [
  { titulo: 'Racha de 10', tipo: 'Racha en una partida', meta: '10', premio: 20 },
  { titulo: 'Racha de 15', tipo: 'Racha en una partida', meta: '15', premio: 30 },
  { titulo: 'Racha de 25', tipo: 'Racha en una partida', meta: '25', premio: 50 },
  { titulo: 'Llega al 5', tipo: 'Llegar a una etapa', meta: '40 s', premio: 20 },
  { titulo: 'Llega al 8', tipo: 'Llegar a una etapa', meta: '100 s', premio: 30 },
  { titulo: 'Llega a las sumas y restas', tipo: 'Llegar a una etapa', meta: '140 s', premio: 50 },
  { titulo: 'Llega a las multiplicaciones y divisiones', tipo: 'Llegar a una etapa', meta: '275 s', premio: 60 },
  { titulo: 'Destruye 30 bloques hoy', tipo: 'Bloques en el día', meta: '30', premio: 20 },
  { titulo: 'Destruye 60 bloques hoy', tipo: 'Bloques en el día', meta: '60', premio: 30 },
  { titulo: 'Destruye 120 bloques hoy', tipo: 'Bloques en el día', meta: '120', premio: 50 },
  { titulo: 'Juega 3 partidas hoy', tipo: 'Partidas en el día', meta: '3', premio: 20 },
  { titulo: 'Juega 5 partidas hoy', tipo: 'Partidas en el día', meta: '5', premio: 30 },
  { titulo: 'Juega el reto del día', tipo: 'Reto del día', meta: '1', premio: 40 },
];

// Misiones nuevas (solo con el interruptor en "Con cambios"): 13 de hoy + 15 = 28 posibles.
// CAMBIO-014: "Sigue a un jugador hoy". Es un tipo nuevo (`follow`), así que cuenta como distinto de los demás. Solo se puede cumplir
// con cuenta, pero se sortea igual para todos: a un invitado se le muestra bloqueada ("Crea tu cuenta para desbloquearla").
// "Invita a alguien" queda para más adelante.
// CAMBIO-015: 14 más (7 + 7 para diluir "Juega el reto del día"), solo con datos que `DayAgg` ya tiene (racha, etapa alcanzada,
// bloques y partidas del día). El orden de esta lista es el que tendrían al final de `MISSION_POOL` (importa para el sorteo).
// Fecha desde la que rige el pool de 28 (antes, el de 13 de hoy): el lunes en que también arranca el ciclo de retos (RETO_INICIO_CICLO).
// En el motor sería MISSIONS_POOL_FROM.
const MISIONES_INICIO_POOL = '2026-12-07';
const MISIONES_TEXTO_BLOQUEADA = 'Crea tu cuenta para desbloquearla';
let misionVerComo = 'cuenta'; // selector "Ver como" de la fila de seguir: 'cuenta' | 'invitado' (solo esa fila, local a la sección)

/** '2026-12-07' → 'lunes 7 dic 2026' */
function etiquetaFecha(clave) {
  const [a, m, d] = clave.split('-').map(Number);
  const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dias[new Date(Date.UTC(a, m - 1, d)).getUTCDay()]} ${d} ${meses[m - 1]} ${a}`;
}

const MISIONES_NUEVAS = [
  { titulo: 'Sigue a un jugador hoy', tipo: 'Seguir a un jugador', meta: '1', premio: 20, soloCuenta: true, nota: 'Se cumple al empezar a seguir a alguien hoy (no cuentan los seguimientos por invitación).' },
  { titulo: 'Racha de 20', tipo: 'Racha en una partida', meta: '20', premio: 40 },
  { titulo: 'Racha de 40', tipo: 'Racha en una partida', meta: '40', premio: 60 },
  { titulo: 'Llega al 9', tipo: 'Llegar a una etapa', meta: '120 s', premio: 40 },
  { titulo: 'Llega a los bloques de 4 s', tipo: 'Llegar a una etapa', meta: '350 s', premio: 60 },
  { titulo: 'Destruye 90 bloques hoy', tipo: 'Bloques en el día', meta: '90', premio: 40 },
  { titulo: 'Destruye 250 bloques hoy', tipo: 'Bloques en el día', meta: '250', premio: 60 },
  { titulo: 'Juega 6 partidas hoy', tipo: 'Partidas en el día', meta: '6', premio: 30 },
  { titulo: 'Racha de 30', tipo: 'Racha en una partida', meta: '30', premio: 50 },
  { titulo: 'Racha de 50', tipo: 'Racha en una partida', meta: '50', premio: 60 },
  { titulo: 'Llega al 7', tipo: 'Llegar a una etapa', meta: '80 s', premio: 30 },
  { titulo: 'Destruye 180 bloques hoy', tipo: 'Bloques en el día', meta: '180', premio: 50 },
  { titulo: 'Destruye 400 bloques hoy', tipo: 'Bloques en el día', meta: '400', premio: 60 },
  { titulo: 'Juega 10 partidas hoy', tipo: 'Partidas en el día', meta: '10', premio: 40 },
  { titulo: 'Juega 15 partidas hoy', tipo: 'Partidas en el día', meta: '15', premio: 50 },
];

/** Dibuja la lista de misiones y su contador según el interruptor Ahora / Con cambios. */
function dibujarMisiones() {
  const fila = (m, nueva) => {
    // un invitado ve bloqueada la que solo se cumple con cuenta (solo cambia cómo se dibuja: el trío del día es el mismo para todos)
    const bloqueada = nueva && m.soloCuenta && misionVerComo === 'invitado';
    return (
      (nueva && m.soloCuenta
        ? `<div class="verComoMision" role="radiogroup" aria-label="Ver la misión de seguir como"><span>Ver como:</span>` +
          [['cuenta', 'con cuenta'], ['invitado', 'invitado']]
            .map(([v, t]) => `<button type="button" role="radio" aria-checked="${misionVerComo === v}" data-vercomo="${v}">${t}</button>`)
            .join('') +
          `</div>`
        : '') +
      `<div class="filaMision${nueva ? ' nuevaMision' : ''}${bloqueada ? ' bloqueadaMision' : ''}">` +
      (bloqueada ? `<div class="marca"><span class="candado" aria-hidden="true"></span></div>` : `<div class="marca"></div>`) +
      `<div class="textoMision"><div class="tituloMision">${m.titulo}${nueva ? ' <span class="etiquetaNueva">nuevo</span>' : ''}</div>` +
      `<div class="tipoMision">${m.tipo} · meta ${m.meta}</div>` +
      (bloqueada
        ? `<div class="notaMision">${MISIONES_TEXTO_BLOQUEADA}</div>`
        : nueva && m.nota
          ? `<div class="notaMision">${m.nota}</div>`
          : '') +
      `</div><div class="premioMision">+${m.premio}</div></div>`
    );
  };
  const filas = [...MISIONES.map((m) => fila(m, false)), ...(conCambios ? MISIONES_NUEVAS.map((m) => fila(m, true)) : [])];
  const total = MISIONES.length + (conCambios ? MISIONES_NUEVAS.length : 0);
  document.getElementById('misionesLista').innerHTML =
    `<div class="cabezaJuego"><span class="capJuego">Misiones posibles</span><span class="capJuego${conCambios ? ' acento' : ''}" id="misionesContador">${total}</span></div>` +
    `<div class="pieJuego arriba">Cada día salen 3, de tipos distintos y las mismas para todos. Al cumplirlas suman bloques extra al nivel.` +
    (conCambios ? ` Desde el ${etiquetaFecha(MISIONES_INICIO_POOL)} salen de las ${total}; antes, de las ${MISIONES.length} de hoy.` : '') +
    `</div>` +
    filas.join('');
}

// selector "Ver como" (delegado: la lista se vuelve a dibujar al cambiar)
document.getElementById('misionesLista').addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-vercomo]');
  if (!b || b.getAttribute('data-vercomo') === misionVerComo) return;
  misionVerComo = b.getAttribute('data-vercomo');
  dibujarMisiones();
});
var redibujarMisiones = dibujarMisiones; // `var` a propósito: aplicarModo() (más arriba) la llama
dibujarMisiones();
