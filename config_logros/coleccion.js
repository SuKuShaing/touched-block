// Premios (paletas, sonidos, efectos al destruir, fondos del campo) y logros.
// Réplica de la Colección (apps/client/src/screens/CollectionScreen.tsx). Requisitos de
// apps/client/src/cosmetics/catalog.ts, colores de cosmetics/palettes.ts y logros de
// packages/engine/src/achievements.ts.
//
// Se carga después de script.js y usa sus funciones: insignias(), inicioNivel(), inicioNivelHoy(), fmt().
// Los requisitos por insignia y por nivel siguen el interruptor Ahora / Con cambios.

// REQUISITOS (los usan PALETAS, SONIDOS, EFECTOS y FONDOS). Tipos:
//   { tipo: 'siempre' }                       desde el inicio.
//   { tipo: 'texto', texto }                  frase fija (los requisitos de hoy que no son insignia ni nivel).
//   { tipo: 'insignia', tier, step }          una insignia de AHORA/CAMBIOS (script.js). Con cambios, la fila dice su nombre
//                                             ("Insignia Papel · Llega al 4"): step 1, 2 y 3 de 'madera' son Papel, Cartón y Madera.
//   { tipo: 'nivel', nivel }                  nivel de experiencia (bloques).
//   { tipo: 'logro', id, nivel }              CAMBIO-025: el logro `id` de LOGROS en su material número `nivel` (1 = Papel … 7 = Diamante,
//                                             el mismo número que `achievementLevel` del motor). Umbral y texto salen de LOGROS.
//   { tipo: 'invitados', n }                  CAMBIO-025: invitar al n.º amigo (necesita una cuenta).
//
// CAMPOS: `req` es el requisito de HOY de un premio que ya existe (lo único que se usa en "Ahora"); `reqNuevo` (CAMBIO-025) es el que
// tiene con "Con cambios" si cambia (la fila muestra el de hoy tachado). Los premios con `nuevo: true` no existen hoy: su `req` ya es
// el de "Con cambios" y no llevan `reqNuevo` ni "Hoy".
//
// PALETAS (contrato de cada entrada; lo lee también el panel de vista previa, así que no renombrar):
//   id           el id del juego (cosmetics/catalog.ts). También lo llevan SONIDOS, EFECTOS y FONDOS: la vista previa
//                (preview.js) selecciona por `data-premio="<paleta|sonido|efecto|fondo>:<id>"`.
//   n            nombre visible.
//   req          requisito de HOY (el del juego). Con el interruptor en "Ahora" es lo único que se usa.
//   nivelNuevo   CAMBIO-016: con el interruptor en "Con cambios" la paleta se gana por este nivel (curva de CAMBIO-004)
//                en vez de por la insignia de `req`. Las "siempre" no lo llevan; Constancia usa `reqNuevo` (CAMBIO-025).
//   nuevo        CAMBIO-017: paleta que no existe hoy; solo se ve con "Con cambios" y lleva la marca "nuevo".
//   estilo       CAMBIO-017, 018 y 019: cómo se dibuja el bloque: 'plano' (por defecto: relleno liso) | 'cristal' | 'contorno'
//                | 'degrade' | 'esmerilado' | 'tenue' | 'boton'. En el juego es el campo `style` de la paleta
//                ('solid' | 'glass' | 'outline' | 'gradient' | 'frosted' | 'soft' | 'inset').
//   borde        CAMBIO-019: solo 'tenue': los 9 colores del borde (los de la Clásica). `colores` es el relleno atenuado.
//   colores      los 9 colores #rrggbb, en el orden de COLORS del motor (posición 0 = rojo de la Clásica … 8 = morado),
//                leídos de izquierda a derecha y de arriba abajo en la muestra de 3×3. `c` es el mismo arreglo
//                (nombre antiguo que usa vistaPrevia); se completa solo, abajo.
//   relleno      opacidad 0..1 del relleno sobre el respaldo opaco: solo para 'cristal' y 'contorno'
//                (cristal 0,5; contorno 0,55 = prueba provisional del usuario del 2026-11-25; 0 sería el contorno puro).
//   nota, brillo líneas extra de la fila ("Pensada para daltónicos", "Con brillo").
//
// Receta de dibujo de cada estilo (la misma en la web y en la app; ver CAMBIO-017):
//   respaldo  CAMBIO-022: los tres estilos translúcidos (cristal, contorno y esmerilado) llevan debajo de su relleno una capa
//             OPACA `#12121a`, así su color no depende del fondo del campo (preview.css; la muestra 3×3 de la fila va sobre el panel).
//   plano     fondo = color.
//   cristal   fondo = color al `relleno` + degradado blanco de arriba (.38 → 0 a 55 % del alto, ángulo 160°)
//             + borde de 1,5 px blanco al 55 % + hilo de luz blanco al 50 % en el borde de arriba.
//   contorno  fondo = el color del borde al `relleno` (0,55) sobre el respaldo + borde de 3 px del color pleno. El número sigue blanco.
//   degrade   CAMBIO-018: relleno OPACO con un degradé vertical de dos tonos del mismo color:
//             `linear-gradient(180deg, arriba, abajo)` con arriba = color mezclado 3,5 % con blanco y
//             abajo = color mezclado 3,5 % con negro (mezcla por canal en sRGB, ver `degradeTonos`). Sin borde ni brillo.
//             La vista previa y la muestra reciben los tonos en `--arriba` y `--abajo`.
//   esmerilado CAMBIO-019: vidrio esmerilado (glassmorfismo). `colores` son los 9 tintes; la capa es
//             `rgba(mezcla(#dde8ff, tinte, 35 % de tinte), 0,70)` + brillo diagonal blanco (.30 → .08) + borde de 1 px blanco al 45 %
//             + luz superior + sombra suave exterior `0 8px 24px` + grano, todo sobre el respaldo. Sin desenfoque en la vista previa
//             (con el respaldo no hay nada detrás que desenfocar; ver CAMBIO-022 en cambios.md). Variables: `--tinte` (la capa) y `--c`.
//   tenue     CAMBIO-019: relleno = color de la Clásica atenuado (`colores`, mismo matiz, saturación HSL × 0,55 y luminancia
//             relativa fija 0,29) + borde de 5 px del color de la Clásica (`borde`, tal cual; en la muestra 3×3 de la web, 4 px). Variables `--c` y `--borde`.
//   boton     CAMBIO-019: relleno opaco del color + sombras interiores `inset` (luz arriba-izquierda blanco .32, sombra
//             abajo-derecha negro .30) + la sombra exterior dura de siempre: relieve de botón físico.
const CLASICA = ['#e5484d', '#f76b15', '#e5a50a', '#30a46c', '#0091ff', '#6e56cf', '#d6409f', '#12a594', '#8e4ec6'];
const PALETAS = [
  { id: 'clasica', n: 'Clásica', req: { tipo: 'siempre' }, colores: ['#e5484d', '#f76b15', '#e5a50a', '#30a46c', '#0091ff', '#6e56cf', '#d6409f', '#12a594', '#8e4ec6'] },
  { id: 'contraste', n: 'Alto contraste', req: { tipo: 'siempre' }, nota: 'Pensada para daltónicos', colores: ['#ba4e00', '#cea500', '#d071b0', '#3ba0d8', '#6a52c8', '#00a88a', '#0072b2', '#5f6e98', '#b981c4'] },
  { id: 'pastel', n: 'Pastel', req: { tipo: 'insignia', tier: 'madera', step: 2 }, nivelNuevo: 3, colores: ['#d47a8c', '#d98a63', '#c79a3e', '#5fa889', '#5e95d6', '#8b8fd8', '#c477b0', '#4ea6a3', '#b884c8'] },
  { id: 'neon', n: 'Neón', req: { tipo: 'insignia', tier: 'bronce', step: 1 }, nivelNuevo: 7, colores: ['#ff2e88', '#ff6a00', '#d9a800', '#00b85c', '#2398ff', '#5a3dff', '#f000b8', '#00a8a0', '#b026ff'] },
  // CAMBIO-019: los colores de la Clásica atenuados + borde del color de la Clásica
  { id: 'tenue', n: 'Tenue', nuevo: true, estilo: 'tenue', req: { tipo: 'nivel', nivel: 9 }, nota: 'Relleno atenuado, borde intenso', borde: CLASICA, colores: ['#c97e81', '#c98156', '#b18f3a', '#57a17d', '#5399cd', '#968cc2', '#c17ea9', '#3fa196', '#a487bc'] },
  // CAMBIO-017: tonos claros y fríos tintados; al 50 % sobre el fondo oscuro cumplen la regla de no ventaja (ver cambios.md)
  { id: 'cristal', n: 'Cristal', nuevo: true, estilo: 'cristal', relleno: 0.5, req: { tipo: 'nivel', nivel: 12 }, nota: 'Translúcida, con brillo', colores: ['#ff9fb5', '#ffb88a', '#ffd666', '#94f0c2', '#85cbff', '#a8a7ff', '#ff9be0', '#6fe3d0', '#c79bff'] },
  { id: 'retro', n: 'Retro', req: { tipo: 'insignia', tier: 'plata', step: 1 }, nivelNuevo: 15, colores: ['#b84a2e', '#d27d2d', '#c49a2c', '#63a23d', '#3f78c0', '#6c4fa8', '#b4456f', '#34a392', '#8c5a9e'] },
  // CAMBIO-019: relleno opaco con relieve de botón (sombras interiores); colores "caramelo"
  { id: 'boton', n: 'Botón', nuevo: true, estilo: 'boton', req: { tipo: 'nivel', nivel: 16 }, nota: 'Relieve interior de botón', colores: ['#ed417d', '#e16a2f', '#c9a32f', '#1aaf6a', '#1b76c3', '#8c56e1', '#e873c5', '#13c4a4', '#b63bd7'] },
  // CAMBIO-017: colores saturados que se leen como borde sobre el fondo oscuro; relleno translúcido al 55 % (prueba provisional del usuario, 2026-11-25; antes 0, el contorno puro)
  { id: 'contorno', n: 'Contorno', nuevo: true, estilo: 'contorno', relleno: 0.55, req: { tipo: 'nivel', nivel: 18 }, nota: 'Borde intenso, relleno translúcido', colores: ['#ff4d6d', '#ff8a1f', '#ffc400', '#19e68c', '#3ab0ff', '#a89bff', '#ff3fb4', '#00e0c6', '#d484ff'] },
  // CAMBIO-018: degradé sutil entre dos tonos del mismo color (más claro arriba, más oscuro abajo); relleno opaco
  { id: 'degrade', n: 'Degradé', nuevo: true, estilo: 'degrade', req: { tipo: 'nivel', nivel: 22 }, nota: 'Degradé sutil, relleno opaco', colores: ['#d34566', '#ee7e0f', '#cea017', '#39aa62', '#2373da', '#8259ca', '#cb64c5', '#2eb79c', '#9c3eb9'] },
  { id: 'dorado', n: 'Dorado', req: { tipo: 'insignia', tier: 'oro', step: 1 }, nivelNuevo: 25, colores: ['#b8860b', '#c47a2c', '#d4a017', '#8b9a3b', '#93a4b4', '#666fa9', '#b8737a', '#45a28b', '#b481be'] },
  // CAMBIO-019: vidrio esmerilado (glassmorfismo): blanco-azulado lechoso con el color apenas insinuado
  { id: 'esmerilado', n: 'Esmerilado', nuevo: true, estilo: 'esmerilado', req: { tipo: 'nivel', nivel: 27 }, nota: 'Vidrio esmerilado, color insinuado', colores: ['#f4282e', '#c74710', '#d59a0a', '#2ebf6e', '#4893f4', '#7e66d6', '#f91395', '#19c4be', '#8534db'] },
  { id: 'diamante', n: 'Diamante', req: { tipo: 'insignia', tier: 'diamante', step: 1 }, nivelNuevo: 30, brillo: true, colores: ['#4f7cff', '#3fa0e8', '#df67b7', '#32ac8d', '#1658ca', '#7761e3', '#d16ce5', '#1fa4b0', '#9a57d5'] },
  { id: 'constancia', n: 'Constancia', nNuevo: 'Amistad', req: { tipo: 'texto', texto: 'Juega el reto diario 7 días seguidos' }, reqNuevo: { tipo: 'invitados', n: 2 }, colores:['#c2304f', '#e0782a', '#d9a400', '#21a868', '#2f6fd6', '#8e44c8', '#b8306a', '#1aa39c', '#5a4fd0'] },
];
// Valores por defecto: todas llevan `estilo`, `colores` y `c` (alias de `colores`).
PALETAS.forEach((p) => {
  p.estilo = p.estilo || 'plano';
  p.c = p.colores;
});

const SONIDOS = [
  { id: '8bits', n: '8 bits', req: { tipo: 'siempre' } },
  { id: 'suave', n: 'Suave', req: { tipo: 'texto', texto: 'Termina tu primera partida' } },
  { id: 'marimba', n: 'Marimba', req: { tipo: 'insignia', tier: 'plata', step: 1 }, reqNuevo: { tipo: 'insignia', tier: 'madera', step: 1 } },
  // CAMBIO-024: 6 sonidos nuevos (solo con "Con cambios"; marcados "nuevo") y su `nota` (una frase). Los suena `sonidos.js` (sintetizadores;
  // `TBSonidos.paquetes[id]`), no hay archivos de audio.
  // CAMBIO-025: desde Marimba, un sonido por insignia y en este orden (escalón 1 de cada una): Marimba = Papel, Palitos = Cartón,
  // Electrónico = Madera, Viento = Bronce, Piano = Plata, Guitarra = Oro, Futurista = Diamante. 8 bits y Suave no cambian.
  { id: 'palitos', n: 'Palitos', nuevo: true, req: { tipo: 'insignia', tier: 'madera', step: 2 }, nota: 'Dos palitos de madera que chocan' },
  { id: 'electronico', n: 'Electrónico', nuevo: true, req: { tipo: 'insignia', tier: 'madera', step: 3 }, nota: 'Sintetizador: sierras con filtro que se cierra' },
  { id: 'viento', n: 'Viento', nuevo: true, req: { tipo: 'insignia', tier: 'bronce', step: 1 }, nota: 'Flauta: soplo suave con vibrato' },
  { id: 'piano', n: 'Piano', nuevo: true, req: { tipo: 'insignia', tier: 'plata', step: 1 }, nota: 'Piano sintético: cuerdas y golpe de martillo' },
  { id: 'guitarra', n: 'Guitarra eléctrica', nuevo: true, req: { tipo: 'insignia', tier: 'oro', step: 1 }, nota: 'Distorsionada: toque con la palma, acorde al destruir' },
  { id: 'futurista', n: 'Futurista', nuevo: true, req: { tipo: 'insignia', tier: 'diamante', step: 1 }, nota: 'Tonos metálicos que suben, con eco' },
];

/** Los sonidos que existen en el modo actual: con "Ahora", los 3 de hoy; con "Con cambios", los 9 (CAMBIO-024). */
const sonidosVisibles = () => (conCambios ? SONIDOS : SONIDOS.filter((s) => !s.nuevo));

const EFECTOS = [
  { id: 'normal', n: 'Clásico', req: { tipo: 'siempre' }, glifo: '✹', color: '#0091ff' },
  { id: 'chispas', n: 'Chispas', req: { tipo: 'insignia', tier: 'madera', step: 3 }, reqNuevo: { tipo: 'logro', id: 'partidas', nivel: 1 }, glifo: '✦', color: '#9be7ff' },
  { id: 'confeti', n: 'Confeti', req: { tipo: 'texto', texto: 'Haz una racha de 25' }, reqNuevo: { tipo: 'logro', id: 'racha', nivel: 2 }, glifo: '▰', color: '#ff6b9a' },
  { id: 'corazones', n: 'Corazones', req: { tipo: 'texto', texto: 'Invita a 1 amigo · necesitas una cuenta' }, glifo: '♥', color: '#ff4d8d' },
  // CAMBIO-023: 6 efectos nuevos (solo con "Con cambios"; marcados "nuevo"). Contrato (lo lee preview.js, que dibuja el estallido en
  // `FX_NUEVOS`): `nuevo`, `req`, `glifo` y `color` (la fila y la etiqueta de la tabla de Logros) y `nota` (la descripción corta).
  // CAMBIO-025: se ganan por logros (`tipo: 'logro'`); aquí van de fácil a difícil.
  { id: 'burbujas', n: 'Burbujas', nuevo: true, req: { tipo: 'logro', id: 'mejorReto', nivel: 2 }, glifo: '○', color: '#8fd8ff', nota: 'Burbujas con reflejo que suben y revientan' },
  { id: 'emojis', n: 'Emojis', nuevo: true, req: { tipo: 'logro', id: 'diasReto', nivel: 1 }, glifo: '😎', color: '#ffd24a', nota: 'Emojis que saltan: 🎉 ⭐ 🔥 💥 😎 😍 💯 ✨' },
  { id: 'ondas', n: 'Ondas', nuevo: true, req: { tipo: 'logro', id: 'diasReto', nivel: 3 }, glifo: '◉', color: '#5ad0c0', nota: 'Anillos que se expanden y gotas' },
  { id: 'monedas', n: 'Monedas', nuevo: true, req: { tipo: 'logro', id: 'partidas', nivel: 4 }, glifo: '$', color: '#ffc933', nota: 'Monedas que giran y caen' },
  { id: 'rayos', n: 'Rayos', nuevo: true, req: { tipo: 'logro', id: 'racha', nivel: 4 }, glifo: '↯', color: '#e8f6ff', nota: 'Rayos en zigzag con un destello' },
  { id: 'fuegos', n: 'Fuegos artificiales', nuevo: true, req: { tipo: 'logro', id: 'mejorReto', nivel: 7 }, glifo: '❋', color: '#ff9f43', nota: 'Un cohete sube y estalla en chispas' },
  // CAMBIO-026: 2 efectos más, premios de dos escalones Diamante.
  { id: 'pixeles', n: 'Píxeles', nuevo: true, req: { tipo: 'logro', id: 'racha', nivel: 7 }, glifo: '▚', color: '#7dff8a', nota: 'El bloque se rompe en píxeles que saltan a pasos, como en 8 bits' },
  { id: 'fugaces', n: 'Estrellas fugaces', nuevo: true, req: { tipo: 'logro', id: 'diasReto', nivel: 7 }, glifo: '✯', color: '#ffe27a', nota: 'Estrellas con estela que cruzan el bloque en diagonal' },
];

/**
 * CAMBIO-025: lugar de un premio en la lista con cambios: desde el inicio, después por material del logro (de Papel a Diamante; a
 * igual material, en el orden de las filas de LOGROS) y, al final, los de invitar amigos.
 */
function ordenPremio(f) {
  const req = f.reqNuevo || f.req;
  if (req.tipo === 'logro') return req.nivel * 100 + LOGROS.findIndex((l) => l.id === req.id);
  return req.tipo === 'invitados' || f.id === 'corazones' ? 1000 + (req.n || 1) : 0;
}
const porDificultad = (lista) => lista.slice().sort((a, b) => ordenPremio(a) - ordenPremio(b));

/** Los efectos que existen en el modo actual: con "Ahora", los 4 de hoy; con "Con cambios", los 12 (CAMBIO-023 y 026), ordenados (CAMBIO-025). */
const efectosVisibles = () => (conCambios ? porDificultad(EFECTOS) : EFECTOS.filter((e) => !e.nuevo));

const FONDOS = [
  { id: 'liso', n: 'Liso', req: { tipo: 'siempre' }, clase: 'liso' },
  { id: 'grilla', n: 'Grilla', req: { tipo: 'nivel', nivel: 5 }, reqNuevo: { tipo: 'logro', id: 'racha', nivel: 1 }, clase: 'grilla' },
  { id: 'estrellas', n: 'Estrellas', req: { tipo: 'nivel', nivel: 10 }, reqNuevo: { tipo: 'logro', id: 'partidas', nivel: 2 }, clase: 'estrellas' },
  { id: 'aurora', n: 'Aurora', req: { tipo: 'nivel', nivel: 20 }, reqNuevo: { tipo: 'logro', id: 'partidas', nivel: 3 }, clase: 'aurora' },
  // CAMBIO-022: 11 fondos nuevos (solo con el interruptor en "Con cambios"; marcados "nuevo"). Contrato (lo leen preview.js y
  // herramientas/prueba-fondos): `nuevo`, `req` (CAMBIO-025: logro o invitados), `clase` (= id; la miniatura es `.vpFondo.<clase>` y el campo
  // de la vista previa `.fx-<clase>`, ambos en extras-fondos.css), `nota` (la frase de la fila), `animado` (true: lluvia, nieve, luciérnagas)
  // y `prueba`: los colores base del fondo (el principal primero, luego otros tramos del degradé) que mide herramientas/prueba-fondos.
  { id: 'puntos', n: 'Puntos', nuevo: true, req: { tipo: 'logro', id: 'diasReto', nivel: 2 }, clase: 'puntos', nota: 'Puntos violetas y celestes sobre azul índigo', prueba: ['#141436', '#1a1742', '#11142f'] },
  { id: 'rayas', n: 'Rayas', nuevo: true, req: { tipo: 'logro', id: 'mejorReto', nivel: 1 }, clase: 'rayas', nota: 'Rayas diagonales violetas, del morado al azul', prueba: ['#1b1445', '#26164f', '#0d1c3f'] },
  { id: 'hexagonos', n: 'Hexágonos', nuevo: true, req: { tipo: 'logro', id: 'mejorReto', nivel: 3 }, clase: 'hexagonos', nota: 'Panal de líneas celestes sobre azul', prueba: ['#0b1f46', '#0c2550', '#0a1634'] },
  { id: 'circuito', n: 'Circuito', nuevo: true, req: { tipo: 'logro', id: 'racha', nivel: 3 }, clase: 'circuito', nota: 'Pistas de placa electrónica sobre verde azulado', prueba: ['#042723', '#07382c', '#031c20'] },
  { id: 'atardecer', n: 'Atardecer', nuevo: true, req: { tipo: 'logro', id: 'diasReto', nivel: 4 }, clase: 'atardecer', nota: 'Del azul índigo al ámbar, con el sol tras los montes', prueba: ['#43205a', '#171a4a', '#4a2a48', '#53321a'] },
  { id: 'oceano', n: 'Océano', nuevo: true, req: { tipo: 'logro', id: 'racha', nivel: 5 }, clase: 'oceano', nota: 'Agua azul con rayos de luz y burbujas', prueba: ['#073055', '#09385f', '#041c38'] },
  { id: 'bosque', n: 'Bosque nocturno', nuevo: true, req: { tipo: 'invitados', n: 3 }, clase: 'bosque', nota: 'Pinos verdes bajo la luna', prueba: ['#0b3739', '#0b2740', '#0b3a28', '#082a1a'] },
  { id: 'lluvia', n: 'Lluvia', nuevo: true, animado: true, req: { tipo: 'logro', id: 'mejorReto', nivel: 5 }, clase: 'lluvia', nota: 'Lluvia azul acero que cae (animado)', prueba: ['#152a47', '#1c3050', '#0d1c32'] },
  { id: 'nieve', n: 'Nieve', nuevo: true, animado: true, req: { tipo: 'logro', id: 'partidas', nivel: 6 }, clase: 'nieve', nota: 'Copos que bajan sobre lomas nevadas (animado)', prueba: ['#172f54', '#12244a', '#1e3a5e'] },
  { id: 'nebulosa', n: 'Nebulosa', nuevo: true, req: { tipo: 'logro', id: 'racha', nivel: 6 }, clase: 'nebulosa', nota: 'Nubes de gas violetas, turquesas y magentas', prueba: ['#1c0f42', '#150c36', '#100a2e'] },
  { id: 'luciernagas', n: 'Luciérnagas', nuevo: true, animado: true, req: { tipo: 'logro', id: 'diasReto', nivel: 6 }, clase: 'luciernagas', nota: 'Luces que laten sobre el pasto (animado)', prueba: ['#0a2e27', '#08202e', '#0c3520'] },
  // CAMBIO-026: 5 fondos más, para los escalones que quedaban sin premio.
  { id: 'topografia', n: 'Topografía', nuevo: true, req: { tipo: 'logro', id: 'mejorReto', nivel: 4 }, clase: 'topografia', nota: 'Curvas de nivel doradas sobre verde oliva', prueba: ['#1c2310', '#2b2b11', '#11200f'] },
  { id: 'ciudad', n: 'Ciudad nocturna', nuevo: true, req: { tipo: 'logro', id: 'partidas', nivel: 5 }, clase: 'ciudad', nota: 'Rascacielos con ventanas encendidas', prueba: ['#121a45', '#080d28', '#342866'] },
  { id: 'cristales', n: 'Cristales', nuevo: true, req: { tipo: 'logro', id: 'diasReto', nivel: 5 }, clase: 'cristales', nota: 'Cuarzos turquesas y violetas', prueba: ['#17103c', '#170b38', '#0b2640'] },
  { id: 'vitral', n: 'Vitral', nuevo: true, req: { tipo: 'logro', id: 'mejorReto', nivel: 6 }, clase: 'vitral', nota: 'Vidrios de colores con uniones de plomo', prueba: ['#122a6e', '#2f1866', '#0a4652', '#47380e'] },
  { id: 'galaxia', n: 'Galaxia', nuevo: true, animado: true, req: { tipo: 'logro', id: 'partidas', nivel: 7 }, clase: 'galaxia', nota: 'Una galaxia espiral que gira muy lento (animado)', prueba: ['#161242', '#0a0a2a', '#0a0c28'] },
];

/** Los fondos que existen en el modo actual: con "Ahora", los 4 de hoy; con "Con cambios", los 20 (CAMBIO-022 y 026), ordenados (CAMBIO-025). */
const fondosVisibles = () => (conCambios ? porDificultad(FONDOS) : FONDOS.filter((f) => !f.nuevo));

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

// CAMBIO-011: cada logro tiene su propio icono (medalla hexagonal con el símbolo dentro) en los siete materiales (carpeta logros_iconos/).
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
      // CAMBIO-025: con cambios la fila dice qué insignia es ("Insignia Papel · Llega al 4")
      texto: conCambios ? `Insignia ${t.name} · ${imperativo(t.goal)}` : imperativo(t.goal),
      // solo es "cambio" si cambia cuándo se gana (el nuevo diseño no cambia el requisito)
      antes: t.antes && t.antes.goal !== t.goal ? imperativo(t.antes.goal) : null,
      medalla: archivo(t, true),
      nombre: t.name,
    };
  }
  if (req.tipo === 'logro') {
    // CAMBIO-025: nombre, material, umbral y texto salen de LOGROS (no se escriben a mano)
    const l = LOGROS.find((x) => x.id === req.id);
    const i = req.nivel - 1;
    const [material, clave] = MAT_ICONO[i];
    const nombre = l.nNuevo || l.n;
    const meta = l.t(l.uNuevo[i], i);
    return {
      texto: `Logro ${nombre} · ${material} (${meta.charAt(0).toLowerCase()}${meta.slice(1)})`,
      medalla: rutaIcono(l.id, clave),
      nombre: `${nombre}, ${material}`,
      claseMedalla: 'medallaLogro',
    };
  }
  if (req.tipo === 'invitados') {
    const cual = req.n === 1 ? '1 amigo' : `un ${req.n}.${req.n === 3 ? 'er' : 'º'} amigo`;
    return { texto: `Invita a ${cual} · necesitas una cuenta` };
  }
  // nivel
  const hoy = inicioNivelHoy(req.nivel);
  const ahora = inicioNivel(req.nivel);
  return {
    texto: `Llega al nivel ${req.nivel} · desde ${fmt(ahora)} bloques`,
    antes: ahora !== hoy ? `Llega al nivel ${req.nivel} · desde ${fmt(hoy)} bloques` : null,
  };
}

/** "Llega al nivel 3 · desde 300 bloques" (la curva sigue el interruptor, como en los fondos). */
const textoNivel = (n) => `Llega al nivel ${n} · desde ${fmt(inicioNivel(n))} bloques`;

/** Un requisito de HOY dicho como se ve en "Ahora" (para la línea tachada "Hoy: …"), aunque el interruptor esté en "Con cambios". */
function textoHoy(req) {
  if (req.tipo === 'insignia') return imperativo(AHORA.find((t) => t.tier === req.tier && t.step === req.step).goal);
  if (req.tipo === 'nivel') return `Llega al nivel ${req.nivel} · desde ${fmt(inicioNivelHoy(req.nivel))} bloques`;
  return requisito(req).texto; // 'siempre' y 'texto' no cambian con el interruptor
}

/**
 * Requisito de un sonido, efecto o fondo (y de las paletas con `reqNuevo`). En "Ahora", el de hoy. Con cambios: si tiene `reqNuevo`
 * (CAMBIO-025), ese, con el de hoy tachado; los premios nuevos no existen hoy, así que no llevan "Hoy".
 */
function requisitoDe(f) {
  if (conCambios && f.reqNuevo) return { ...requisito(f.reqNuevo), antes: textoHoy(f.req) };
  const r = requisito(f.req);
  return f.nuevo ? { ...r, antes: null } : r;
}

/**
 * Requisito de una paleta. En "Ahora", el de hoy. Con cambios (CAMBIO-016 y 017) las que dependían de una insignia
 * piden un nivel, con lo que pide el juego hoy tachado y sin miniatura de insignia; las nuevas piden su nivel sin "Hoy".
 * Constancia pide invitar a un 2.º amigo (CAMBIO-025).
 */
function requisitoPaleta(p) {
  if (!conCambios) return requisito(p.req);
  if (p.reqNuevo) return requisitoDe(p);
  if (p.nivelNuevo != null) {
    const hoy = AHORA.find((t) => t.tier === p.req.tier && t.step === p.req.step);
    return { texto: textoNivel(p.nivelNuevo), antes: imperativo(hoy.goal) };
  }
  if (p.req.tipo === 'nivel') return { texto: textoNivel(p.req.nivel) }; // paleta nueva: no existe hoy, no hay "Hoy"
  return requisito(p.req);
}

/** #rrggbb → rgba(r, g, b, a) */
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** CAMBIO-018: mezcla un color con otro (blanco o negro) en la proporción `t`, por canal en sRGB. */
function mezclarHex(hex, destino, t) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v, i) => Math.round(v * (1 - t) + destino[i] * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Cuánto se aclara arriba y se oscurece abajo el degradé (3,5 %). Con más, el bloque empieza a parecer un botón brillante; ver CAMBIO-018. */
const DEGRADE_MEZCLA = 0.035;

/** Los dos tonos del degradé de un color base: [arriba, abajo]. */
const degradeTonos = (hex) => [mezclarHex(hex, [255, 255, 255], DEGRADE_MEZCLA), mezclarHex(hex, [0, 0, 0], DEGRADE_MEZCLA)];

/** CAMBIO-019, Esmerilado: la capa de vidrio = blanco-azulado mezclado con 35 % del tinte, al 70 % de opacidad. */
const ESMERILADO_BASE = '#dde8ff';
const ESMERILADO_TINTE = 0.35;
const ESMERILADO_OPACIDAD = 0.7;
const aRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const esmeriladoTintado = (hex) => mezclarHex(ESMERILADO_BASE, aRgb(hex), ESMERILADO_TINTE);

/** Variables CSS de la casilla `i` de una paleta (las leen la muestra de 3×3 y la vista previa). */
function varsPaleta(p, i) {
  const c = p.colores[i];
  const [arriba, abajo] = degradeTonos(c);
  return {
    '--c': c,
    '--relleno': rgba(c, p.relleno ?? 1),
    '--arriba': arriba,
    '--abajo': abajo,
    '--tinte': rgba(esmeriladoTintado(c), ESMERILADO_OPACIDAD),
    '--borde': p.borde ? p.borde[i] : c,
  };
}

function vistaPrevia(tipo, f) {
  if (tipo === 'paletas') {
    const celdas = f.colores
      .map((_, i) => `<i style="${Object.entries(varsPaleta(f, i)).map(([k, v]) => `${k}:${v}`).join(';')}"></i>`)
      .join('');
    return `<div class="vpPaleta ${f.estilo}${f.brillo ? ' brillo' : ''}">${celdas}</div>`;
  }
  if (tipo === 'sonidos') return `<div class="vpIcono">♪</div>`;
  if (tipo === 'efectos') return `<div class="vpIcono" style="color:${f.color}">${f.glifo}</div>`;
  return `<div class="vpFondo ${f.clase}"></div>`;
}

/** Clave de `data-premio` de cada panel (la lee preview.js). */
const CLAVE_PREMIO = { paletas: 'paleta', sonidos: 'sonido', efectos: 'efecto', fondos: 'fondo' };

function panelPremios(titulo, tipo, lista, pie = '') {
  const filas = lista
    .map((f) => {
      const r = tipo === 'paletas' ? requisitoPaleta(f) : requisitoDe(f);
      // la fila se puede seleccionar (preview.js pone la clase `seleccionada` y aria-pressed)
      return (
        `<div class="filaColeccion${r.antes || f.nuevo ? ' cambia' : ''}" role="button" tabindex="0" aria-pressed="false" data-premio="${CLAVE_PREMIO[tipo]}:${f.id}">` +
        vistaPrevia(tipo, f) +
        `<div class="textoColeccion"><div class="nombreColeccion">${(conCambios && f.nNuevo) || f.n}${f.nuevo ? ' <span class="etiquetaNueva">nuevo</span>' : ''}</div>` +
        `<div class="reqColeccion">${r.medalla ? `<img${r.claseMedalla ? ` class="${r.claseMedalla}"` : ''} src="${r.medalla}" alt="${r.nombre}" title="${r.nombre}">` : ''}<span>${r.texto}</span></div>` +
        (f.nota ? `<div class="reqColeccion"><span>${f.nota}</span></div>` : '') +
        (f.brillo ? `<div class="reqColeccion"><span>Con brillo</span></div>` : '') +
        (r.antes ? `<div class="antesColeccion">Hoy: ${f.nNuevo ? `${f.n} · ` : ''}${r.antes}</div>` : '') +
        `</div></div>`
      );
    })
    .join('');
  return `<div class="panelJuego"><div class="capJuego">${titulo}</div><div class="listaColeccion">${filas}</div>${pie ? `<div class="pieJuego arriba">${pie}</div>` : ''}</div>`;
}

/** Pie del panel Paletas con los cambios (CAMBIO-016, 017 y 025). */
const PIE_PALETAS =
  '<b>Por nivel (CAMBIO-016):</b> las paletas ya no se ganan por la insignia sino por el nivel (bloques destruidos); la curva es la de CAMBIO-004. ' +
  '<b>Seis paletas nuevas, seis estilos de dibujo (CAMBIO-017, 018 y 019):</b> Cristal (translúcido con brillo), Contorno (borde intenso, relleno translúcido al 55 %, prueba provisional), Degradé (degradé sutil del mismo color), Tenue (relleno atenuado con borde intenso), Botón (relieve interior) y Esmerilado (vidrio esmerilado) cambian cómo se dibuja el bloque, no solo los colores. ' +
  'Clásica y Alto contraste no cambian. <b>Constancia pasa a llamarse Amistad</b> y se gana invitando a un 2.º amigo (CAMBIO-025).';

/** Pie del panel Fondos con los cambios (CAMBIO-022 y 025). */
const PIE_FONDOS =
  '<b>Dieciséis fondos nuevos (CAMBIO-022 y 026):</b> de 4 a 20. <b>Ya no se ganan por nivel (CAMBIO-025):</b> 18 se ganan con los logros, Bosque nocturno invitando a un 3.er amigo y Liso viene desde el inicio. Son de color pero oscuros, para que los bloques destaquen; no cambian el color de ningún bloque (Cristal, Contorno y Esmerilado van sobre un respaldo opaco). ' +
  'De los dieciséis, doce son estáticos; <b>Lluvia, Nieve, Luciérnagas y Galaxia</b> tienen una animación lenta (se detiene con "reducir movimiento"). Se pueden hacer con lo que el juego ya tiene instalado.';

/** Pie del panel Sonidos con los cambios (CAMBIO-024 y 025). */
const PIE_SONIDOS =
  '<b>Seis sonidos nuevos (CAMBIO-024):</b> Palitos, Electrónico, Viento, Piano, Guitarra eléctrica y Futurista. <b>Un sonido por insignia (CAMBIO-025):</b> de Marimba (Papel) a Futurista (Diamante); 8 bits y Suave no cambian. ' +
  'Son <b>sintetizadores que imitan al instrumento</b> (no grabaciones): se reconocen, pero no suenan como el real. No hay archivos de audio: en el juego se generarán una vez con código y se reutilizarán desde la memoria (aquí suenan en vivo). ' +
  'Haz clic en una fila para oírla y toca bloques en la "Vista previa".';

/** Pie del panel Efectos con los cambios (CAMBIO-023 y 025). */
const PIE_EFECTOS =
  '<b>Ocho efectos nuevos (CAMBIO-023 y 026):</b> de 4 a 12. <b>Se ganan con los logros (CAMBIO-025)</b>, salvo Clásico (desde el inicio) y Corazones (1.er amigo). ' +
  'Burbujas, Emojis, Ondas, Monedas, Rayos, Fuegos artificiales, Píxeles y Estrellas fugaces se dibujan con vistas, texto y Reanimated (hasta 12 piezas por estallido, ≤ 0,86 s). ' +
  'Los <b>emojis</b> los dibuja cada sistema con su propio diseño (Android, iOS y web no se ven igual). Pruébalos en la "Vista previa".';

/** CAMBIO-025: los efectos y fondos que entrega el escalón `nivel` (1 = Papel) del logro `id`. La regla es uno como máximo. */
function premiosDeEscalon(id, nivel) {
  const deLista = (tipo, lista) =>
    lista
      .filter((f) => {
        const req = f.reqNuevo || f.req;
        return req.tipo === 'logro' && req.id === id && req.nivel === nivel;
      })
      .map((f) => ({ tipo, f }));
  return [...deLista('efecto', EFECTOS), ...deLista('fondo', FONDOS)];
}

/** Etiqueta "Premio: <nombre>" bajo un escalón de la tabla de Logros, con el glifo del efecto o la miniatura del fondo. */
function etiquetaPremio({ tipo, f }) {
  const dibujo =
    tipo === 'efecto'
      ? `<span class="glifoPremio" style="color:${f.color}" aria-hidden="true">${f.glifo}</span>`
      : `<span class="fondoPremio" aria-hidden="true"><span class="vpFondo ${f.clase}"></span></span>`;
  return `<div class="premioLogro" data-escalon-premio="${tipo}:${f.id}" title="${tipo === 'efecto' ? 'Efecto al destruir' : 'Fondo del campo'}">${dibujo}<span>Premio: ${f.n}</span></div>`;
}

function dibujarColeccion() {
  dibujarCelular(); // la tarjeta del celular también sigue el interruptor
  // Columna izquierda: Paletas y, debajo, el hueco de la "Vista previa" (preview.js mete ahí su panel, que no se
  // destruye al redibujar). Columna derecha: Sonidos, Efectos y Fondos.
  document.getElementById('premiosGrilla').innerHTML =
    `<div class="colPremios">` +
    panelPremios('Paletas', 'paletas', PALETAS.filter((p) => conCambios || !p.nuevo), conCambios ? PIE_PALETAS : '') +
    `<div id="vistaPreviaSlot" class="vpSlot"></div></div>` +
    `<div class="colPremios">` +
    panelPremios('Sonidos', 'sonidos', sonidosVisibles(), conCambios ? PIE_SONIDOS : '') +
    panelPremios('Efectos al destruir', 'efectos', efectosVisibles(), conCambios ? PIE_EFECTOS : '') +
    panelPremios('Fondos del campo', 'fondos', fondosVisibles(), conCambios ? PIE_FONDOS : '') +
    `</div>`;
  if (typeof alRedibujarPremios === 'function') alRedibujarPremios(); // `var` de preview.js (carga después de este archivo)

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
              const premio = conCambios ? premiosDeEscalon(l.id, i + 1).map(etiquetaPremio).join('') : '';
              return `<td${nueva}>${ico}<b>${fmt(v)}</b><small>${l.t(v, i)}</small>${premio}</td>`;
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
    (conCambios ? `<br><b>Un icono por logro (CAMBIO-011):</b> una medalla hexagonal cuyo símbolo dice qué logro es; el material dice hasta dónde llegaste. Haz clic en un icono para ver toda su familia. ` : '') +
    (conCambios
      ? `<br><b>Premios (CAMBIO-025 y 026):</b> cada uno de los 28 escalones entrega un premio, un efecto al destruir o un fondo del campo (10 efectos y 18 fondos, ninguno repetido; los otros dos de cada lista se ganan al inicio y por invitar). `
      : '') +
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
