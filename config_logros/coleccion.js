// Premios (paletas, sonidos, efectos al destruir, fondos del campo) y logros.
// Réplica de la Colección (apps/client/src/screens/CollectionScreen.tsx). Requisitos de
// apps/client/src/cosmetics/catalog.ts, colores de cosmetics/palettes.ts y logros de
// packages/engine/src/achievements.ts.
//
// Se carga después de script.js y usa sus funciones: insignias(), inicioNivel(), inicioNivelHoy(), fmt().
// Los requisitos por insignia y por nivel siguen el interruptor Ahora / Con cambios.

// req: { tipo: 'siempre' | 'insignia' | 'nivel' | 'texto', ... }
const PALETAS = [
  { n: 'Clásica', req: { tipo: 'siempre' }, c: ['#e5484d', '#f76b15', '#e5a50a', '#30a46c', '#0091ff', '#6e56cf', '#d6409f', '#12a594', '#8e4ec6'] },
  { n: 'Alto contraste', req: { tipo: 'siempre' }, nota: 'Pensada para daltónicos', c: ['#ba4e00', '#cea500', '#d071b0', '#3ba0d8', '#6a52c8', '#00a88a', '#0072b2', '#5f6e98', '#b981c4'] },
  { n: 'Pastel', req: { tipo: 'insignia', tier: 'madera', step: 2 }, c: ['#d47a8c', '#d98a63', '#c79a3e', '#5fa889', '#5e95d6', '#8b8fd8', '#c477b0', '#4ea6a3', '#b884c8'] },
  { n: 'Neón', req: { tipo: 'insignia', tier: 'bronce', step: 1 }, c: ['#ff2e88', '#ff6a00', '#d9a800', '#00b85c', '#2398ff', '#5a3dff', '#f000b8', '#00a8a0', '#b026ff'] },
  { n: 'Retro', req: { tipo: 'insignia', tier: 'plata', step: 1 }, c: ['#b84a2e', '#d27d2d', '#c49a2c', '#63a23d', '#3f78c0', '#6c4fa8', '#b4456f', '#34a392', '#8c5a9e'] },
  { n: 'Dorado', req: { tipo: 'insignia', tier: 'oro', step: 1 }, c: ['#b8860b', '#c47a2c', '#d4a017', '#8b9a3b', '#93a4b4', '#666fa9', '#b8737a', '#45a28b', '#b481be'] },
  { n: 'Diamante', req: { tipo: 'insignia', tier: 'diamante', step: 1 }, brillo: true, c: ['#4f7cff', '#3fa0e8', '#df67b7', '#32ac8d', '#1658ca', '#7761e3', '#d16ce5', '#1fa4b0', '#9a57d5'] },
  { n: 'Constancia', req: { tipo: 'texto', texto: 'Juega el reto diario 7 días seguidos' }, c: ['#c2304f', '#e0782a', '#d9a400', '#21a868', '#2f6fd6', '#8e44c8', '#b8306a', '#1aa39c', '#5a4fd0'] },
];

const SONIDOS = [
  { n: '8 bits', req: { tipo: 'siempre' } },
  { n: 'Suave', req: { tipo: 'texto', texto: 'Termina tu primera partida' } },
  { n: 'Marimba', req: { tipo: 'insignia', tier: 'plata', step: 1 } },
];

const EFECTOS = [
  { n: 'Clásico', req: { tipo: 'siempre' }, glifo: '✹', color: '#0091ff' },
  { n: 'Chispas', req: { tipo: 'insignia', tier: 'madera', step: 3 }, glifo: '✦', color: '#9be7ff' },
  { n: 'Confeti', req: { tipo: 'texto', texto: 'Haz una racha de 25' }, glifo: '▰', color: '#ff6b9a' },
  { n: 'Corazones', req: { tipo: 'texto', texto: 'Invita a 1 amigo · necesitas una cuenta' }, glifo: '♥', color: '#ff4d8d' },
];

const FONDOS = [
  { n: 'Liso', req: { tipo: 'siempre' }, clase: 'liso' },
  { n: 'Grilla', req: { tipo: 'nivel', nivel: 5 }, clase: 'grilla' },
  { n: 'Estrellas', req: { tipo: 'nivel', nivel: 10 }, clase: 'estrellas' },
  { n: 'Aurora', req: { tipo: 'nivel', nivel: 20 }, clase: 'aurora' },
];

// Logros (achievements.ts): cinco umbrales por logro, de Madera a Diamante.
// CAMBIO-010: con Papel y Cartón (CAMBIO-005) pasan a siete. Los números no se mueven de lugar:
// los materiales se corren dos lugares a la derecha y Oro y Diamante tienen umbrales nuevos.
const MATERIALES_HOY = [
  ['Madera', 'insignias/madera-1-small.svg'],
  ['Bronce', 'insignias/bronce-1-small.svg'],
  ['Plata', 'insignias/plata-1-small.svg'],
  ['Oro', 'insignias/oro-1-small.svg'],
  ['Diamante', 'insignias/diamante-1-small.svg'],
];
const MATERIALES_NUEVOS = [
  ['Papel', 'insignias_nuevas/madera-1-small.svg'],
  ['Cartón', 'insignias_nuevas/madera-2-small.svg'],
  ['Madera', 'insignias_nuevas/madera-3-small.svg'],
  ['Bronce', 'insignias/bronce-1-small.svg'],
  ['Plata', 'insignias/plata-1-small.svg'],
  ['Oro', 'insignias/oro-1-small.svg'],
  ['Diamante', 'insignias/diamante-1-small.svg'],
];

// CAMBIO-011: cada logro tiene su propio icono en los siete materiales (carpeta logros_iconos/).
// Archivos: <id>-<material>.svg y <id>-vacio.svg. Se dibujan a 38 px (fila de la Colección) y 74 px (celebración).
const MAT_ICONO = [
  ['Papel', 'papel'],
  ['Cartón', 'carton'],
  ['Madera', 'madera'],
  ['Bronce', 'bronce'],
  ['Plata', 'plata'],
  ['Oro', 'oro'],
  ['Diamante', 'diamante'],
];
const rutaIcono = (id, material) => `logros_iconos/${id}-${material}.svg`;

const LOGROS = [
  // CAMBIO-008: "Mejor racha" pasa a llamarse "Máximo combo" (con el interruptor en "Con cambios")
  { id: 'racha', desc: 'Bloques destruidos seguidos sin ningún error: tu mejor combo en una partida normal.', n: 'Mejor racha', nNuevo: 'Máximo combo', u: [10, 25, 50, 100, 200], uNuevo: [10, 25, 50, 100, 200, 300, 500], t: (v) => `Racha de ${fmt(v)}` },
  // CAMBIO-009: se quita este logro (los bloques destruidos ya se premian con el nivel de experiencia)
  { id: 'bloques', n: 'Bloques destruidos', quitar: true, u: [100, 500, 2000, 10000, 50000], t: (v) => `Destruye ${fmt(v)} bloques en total` },
  // CAMBIO-009: lo reemplaza este (solo aparece con el interruptor en 'Con cambios')
  { id: 'partidas', desc: 'Partidas terminadas, de cualquier modo (normales y de reto).', n: 'Partidas jugadas', nuevo: true, u: [], uNuevo: [10, 50, 150, 500, 1500, 3000, 6000], t: (v) => `Juega ${fmt(v)} partidas` },
  { id: 'diasReto', desc: 'Días seguidos jugando el reto diario (se perdona 1 día sin jugar por cada 7 jugados).', n: 'Días seguidos de reto diario', u: [3, 7, 14, 30, 100], uNuevo: [3, 7, 14, 30, 100, 200, 365], t: (v) => `Juega el reto ${fmt(v)} días seguidos` },
  { id: 'mejorReto', desc: 'Tu mejor resultado en un reto diario, como "mejor que el N %" de los jugadores.', n: 'Mejor resultado en un reto diario', u: [0, 50, 75, 90, 99], uNuevo: [0, 25, 50, 75, 90, 95, 99], t: (v, i) => (i === 0 ? 'Participa en un reto diario' : `Mejor que el ${v} % en un reto diario`) },
];

const imperativo = (g) => g.replace(/^Llegar\b/, 'Llega').replace(/^Terminar\b/, 'Termina');

/** Texto del requisito de una fila y, si cambia con el interruptor, el de hoy. */
function requisito(req) {
  if (req.tipo === 'siempre') return { texto: 'Desde el inicio' };
  if (req.tipo === 'texto') return { texto: req.texto };
  if (req.tipo === 'insignia') {
    const t = insignias().find((x) => x.tier === req.tier && x.step === req.step);
    return {
      texto: imperativo(t.goal),
      // solo es "cambio" si cambia cuándo se gana (el nuevo diseño no cambia el requisito)
      antes: t.antes && t.antes.goal !== t.goal ? imperativo(t.antes.goal) : null,
      medalla: archivo(t, true),
      nombre: t.name,
    };
  }
  // nivel
  const hoy = inicioNivelHoy(req.nivel);
  const ahora = inicioNivel(req.nivel);
  return {
    texto: `Llega al nivel ${req.nivel} · desde ${fmt(ahora)} bloques`,
    antes: ahora !== hoy ? `Llega al nivel ${req.nivel} · desde ${fmt(hoy)} bloques` : null,
  };
}

function vistaPrevia(tipo, f) {
  if (tipo === 'paletas') return `<div class="vpPaleta${f.brillo ? ' brillo' : ''}">${f.c.map((c) => `<i style="background:${c}"></i>`).join('')}</div>`;
  if (tipo === 'sonidos') return `<div class="vpIcono">♪</div>`;
  if (tipo === 'efectos') return `<div class="vpIcono" style="color:${f.color}">${f.glifo}</div>`;
  return `<div class="vpFondo ${f.clase}"></div>`;
}

function panelPremios(titulo, tipo, lista) {
  const filas = lista
    .map((f) => {
      const r = requisito(f.req);
      return (
        `<div class="filaColeccion${r.antes ? ' cambia' : ''}">` +
        vistaPrevia(tipo, f) +
        `<div class="textoColeccion"><div class="nombreColeccion">${f.n}</div>` +
        `<div class="reqColeccion">${r.medalla ? `<img src="${r.medalla}" alt="${r.nombre}" title="${r.nombre}">` : ''}<span>${r.texto}</span></div>` +
        (f.nota ? `<div class="reqColeccion"><span>${f.nota}</span></div>` : '') +
        (f.brillo ? `<div class="reqColeccion"><span>Con brillo</span></div>` : '') +
        (r.antes ? `<div class="antesColeccion">Hoy: ${r.antes}</div>` : '') +
        `</div></div>`
      );
    })
    .join('');
  return `<div class="panelJuego"><div class="capJuego">${titulo}</div><div class="listaColeccion">${filas}</div></div>`;
}

function dibujarColeccion() {
  dibujarCelular(); // la tarjeta del celular también sigue el interruptor
  document.getElementById('premiosGrilla').innerHTML =
    panelPremios('Paletas', 'paletas', PALETAS) +
    panelPremios('Sonidos', 'sonidos', SONIDOS) +
    panelPremios('Efectos al destruir', 'efectos', EFECTOS) +
    panelPremios('Fondos del campo', 'fondos', FONDOS);

  document.getElementById('logrosTabla').innerHTML =
    `<div class="tablaEnvuelta"><table class="tablaLogros"><thead><tr><th>Logro</th>` +
    (conCambios
      ? // con cambios los iconos van en las celdas: el encabezado solo lleva el nombre del material
        MATERIALES_NUEVOS.map(([n], i) => `<th${i < 2 ? ' class="nueva"' : ''}>${n}</th>`).join('')
      : MATERIALES_HOY.map(([n, src]) => `<th><img src="${src}" alt="" width="20" height="20"> ${n}</th>`).join('')) +
    `</tr></thead><tbody>` +
    LOGROS.filter((l) => (conCambios ? !l.quitar : !l.nuevo))
      .map((l) => {
        const nombre = conCambios && l.nNuevo ? l.nNuevo : l.n;
        const conIcono = conCambios && l.id !== 'bloques';
        const boton = (src, aria) => `<button type="button" class="iconoLogro" data-logro="${l.id}" aria-label="${aria}"><img src="${src}" width="38" height="38" alt=""></button>`;
        return (
          `<tr${conCambios && (l.nNuevo || l.nuevo) ? ' class="cambia"' : ''}><th scope="row"><div class="nombreLogro">` +
          (conIcono ? boton(rutaIcono(l.id, 'vacio'), `Ver los siete materiales de ${nombre}`) : '') +
          `<div>${nombre}` +
          (conCambios && l.nNuevo ? `<div class="antesColeccion">Hoy: ${l.n}</div>` : '') +
          (conCambios && l.nuevo ? `<div class="etiquetaNueva">Logro nuevo</div>` : '') +
          `</div></div></th>` +
          (conCambios ? l.uNuevo : l.u)
            .map((v, i) => {
              const nueva = conCambios && !l.nuevo && !l.u.includes(v) ? ' class="nueva"' : '';
              const ico = conIcono ? boton(rutaIcono(l.id, MAT_ICONO[i][1]), `${nombre}, ${MAT_ICONO[i][0]}: ver toda la familia`) : '';
              return `<td${nueva}>${ico}<b>${fmt(v)}</b><small>${l.t(v, i)}</small></td>`;
            })
            .join('') +
          `</tr>`
        );
      })
      .join('') +
    `</tbody></table></div>` +
    `<div class="pieJuego arriba">Cada logro sube de material cuando la estadística llega al umbral. ` +
    (conCambios
      ? `<b>Se quita "Bloques destruidos"</b> (esa cantidad ya se premia con el nivel de experiencia) y <b>se añade "Partidas jugadas"</b>, que cuenta todas las partidas terminadas, normales y de reto (ver CAMBIO-009). `
      : `"Bloques destruidos" cuenta solo los bloques reales (no los de las misiones). `) +
    (conCambios
      ? `<br><b>Siete materiales (CAMBIO-010):</b> los números no cambian de lugar, los materiales se corren dos lugares a la derecha. Ejemplo: Máximo combo 10 hoy da Madera y pasaría a dar Papel. Oro y Diamante tienen umbrales nuevos (resaltados). `
      : '') +
    (conCambios ? `<br><b>Un icono por logro (CAMBIO-011):</b> el icono dice qué logro es y el material dice hasta dónde llegaste. Haz clic en un icono para ver toda su familia. ` : '') +
    `Los dos del reto diario solo existen si el reto existe.</div>`;
}

/** Modal con la familia de un logro: los siete materiales y el estado vacío, a 74 y 38 px (CAMBIO-011). */
function abrirModalLogro(id) {
  const l = LOGROS.find((x) => x.id === id);
  if (!l) return;
  const nombre = l.nNuevo || l.n;
  document.getElementById('modalTitulo').textContent = nombre;
  document.getElementById('modalMeta').textContent = l.desc;
  const tarjeta = (src, titulo, sub) =>
    `<div class="tamano familiaItem"><div class="parImg"><img src="${src}" width="74" height="74" alt="${titulo}"><img src="${src}" width="38" height="38" alt=""></div>` +
    `<div class="px">${titulo}</div><div class="donde">${sub}</div></div>`;
  document.getElementById('modalTamanos').innerHTML =
    `<p class="modalNota">Tamaños que usa el juego: <b>74 px</b> (celebración) y <b>38 px</b> (fila de la Colección).<br>` +
    `Texto de la celebración al subir de material: hoy <s>¡Logro de Plata!</s> → ahora <b>¡${nombre} · Plata!</b></p>` +
    MAT_ICONO.map(([n, k], i) => tarjeta(rutaIcono(id, k), n, `${fmt(l.uNuevo[i])} · ${l.t(l.uNuevo[i], i)}`)).join('') +
    tarjeta(rutaIcono(id, 'vacio'), 'Sin nada todavía', 'Estado vacío');
  modal.hidden = false;
}

document.getElementById('logrosTabla').addEventListener('click', (e) => {
  const boton = e.target.closest('[data-logro]');
  if (boton) abrirModalLogro(boton.dataset.logro);
});

// ---------------------------------------------------------------- Logros en el celular
// Réplica de AchievementRow (CollectionScreen.tsx): medalla/icono de 38 px, "Nombre · Material", barra de progreso con el
// color del material y "meta · llevas N". Hoy usa la medalla de insignia; con cambios, el icono propio (CAMBIO-011).
const CARAS_HOY = ['#c49a63', '#db7a40', '#cfd6e0', '#ffcf47', '#9be7ff']; // TIER_LOOK[...].face (tiers.ts)
const CARAS_NUEVAS = ['#ecdcbb', '#c39a62', '#b07f4a', '#db7a40', '#cfd6e0', '#ffcf47', '#9be7ff']; // Papel, Cartón y Madera: tono medio de ESTILO_LOGROS.md
const TIER_HOY = ['madera', 'bronce', 'plata', 'oro', 'diamante'];

/** Valor del jugador de ejemplo: número entero, o null si el campo está vacío. */
function valorEjemplo(id) {
  const el = document.getElementById('ej_' + id);
  if (!el || el.value === '') return null;
  const n = Number(el.value);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

function filaCelular(l, nuevo, ultima) {
  const th = nuevo ? l.uNuevo : l.u;
  const mats = nuevo ? MAT_ICONO : MATERIALES_HOY;
  const caras = nuevo ? CARAS_NUEVAS : CARAS_HOY;
  const pct = l.id === 'mejorReto';
  const raw = valorEjemplo(l.id);
  const v = raw === null && !pct ? 0 : raw; // solo el resultado del reto puede ser "nunca participó"
  let nivel = 0;
  if (v !== null) th.forEach((t) => { if (v >= t) nivel++; });
  const sig = nivel < th.length ? th[nivel] : null;
  const prev = nivel > 0 ? th[nivel - 1] : 0;
  const ratio = sig === null ? 1 : Math.min(1, Math.max(0, ((v ?? 0) - prev) / Math.max(1, sig - prev)));
  const nombre = nuevo && l.nNuevo ? l.nNuevo : l.n;
  const mat = nivel > 0 ? mats[nivel - 1][0] : null;
  const color = nivel > 0 ? caras[nivel - 1] : '#77ccff';
  let icono;
  if (nuevo) icono = `<img src="${rutaIcono(l.id, nivel > 0 ? MAT_ICONO[nivel - 1][1] : 'vacio')}" width="38" height="38" alt="">`;
  else if (nivel > 0) icono = `<img src="insignias/${TIER_HOY[nivel - 1]}-1.svg" width="38" height="38" alt="">`;
  else icono = '<div class="medallaVacia"></div>';
  const texto = sig === null ? '¡Nivel máximo!' : `${l.t(sig, nivel)}${v !== null ? ` · llevas ${fmt(v)}${pct ? ' %' : ''}` : ''}`;
  return (
    `<div class="itemCelular${ultima ? ' ultimo' : ''}"><div class="cajaMedalla">${icono}</div><div class="textoCelular">` +
    `<div class="nombreCelular">${nombre}${mat ? `<span class="matCelular"> · ${mat}</span>` : ''}</div>` +
    `<div class="barraCelular"><div style="width:${ratio * 100}%;background:${color}"></div></div>` +
    `<div class="pequeCelular">${texto}</div></div></div>`
  );
}

/** Dibuja la tarjeta del celular: la de hoy o la de con cambios, según el interruptor. */
function dibujarCelular() {
  const nuevo = conCambios;
  const filas = LOGROS.filter((l) => (nuevo ? !l.quitar : !l.nuevo));
  document.getElementById('celularActual').innerHTML =
    `<div class="seccionCelular"><div class="tituloCelular">Logros</div><div class="listaCelular">` +
    filas.map((l, i) => filaCelular(l, nuevo, i === filas.length - 1)).join('') +
    `</div></div>`;
  const etiqueta = document.getElementById('celularEtiqueta');
  etiqueta.textContent = nuevo ? 'Con cambios' : 'Hoy';
  etiqueta.classList.toggle('acento', nuevo);
}

document.querySelectorAll('.simulador input').forEach((el) => el.addEventListener('input', dibujarCelular));
dibujarCelular();

// `var` a propósito: aplicarModo() (script.js) lo consulta con typeof y se ejecuta antes de que este archivo cargue.
var redibujarColeccion = dibujarColeccion;
dibujarColeccion();
