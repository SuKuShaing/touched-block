# Estilo de los iconos de logros (para diseñar más)

Guía para quien (persona, Claude o un subagente) cambie o agregue iconos de logros. Los iconos son la propuesta de `cambios.md` → **CAMBIO-011**: cada logro tiene **su propio icono** y ese icono se dibuja en los **siete materiales** de las insignias, más un **estado vacío**. Desde el 2026-11-24 el icono es una **medalla hexagonal con el símbolo del logro dentro** (antes eran siluetas sueltas). Comparte el lenguaje de luz de las insignias (`ESTILO_INSIGNIAS.md`) pero se distingue de ellas por la forma: la insignia es redonda (Diamante, un rombo) y el logro es un hexágono.

## Dónde está cada cosa

- `logros_iconos/`: los 32 SVG, `<id>-<material>.svg`.
  - `id` y símbolo: `racha` (rayo, Máximo combo), `partidas` (play ▶, Partidas jugadas), `diasReto` (calendario con llama, Días seguidos de reto diario), `mejorReto` (**diana con flecha**, Mejor resultado en un reto diario; reemplaza a la copa por pedido del usuario, 2026-11-24).
  - `material`: `papel`, `carton`, `madera`, `bronce`, `plata`, `oro`, `diamante` y `vacio`.
- `herramientas/gen-logros.js`: el **único generador**. Tiene un símbolo por logro (`SYMBOLS` y la función `symbol()`) y una medalla por material (`MATS`). Regenera los 32 archivos, siempre idénticos (sin azar: las fibras del cartón usan un generador con semilla fija).

## Reglas

- **Medalla hexagonal**: hexágono con una **punta arriba y otra abajo** (vértices a -90°, -30°, 30°, 90°, 150° y 210°), esquinas redondeadas (r ≈ 4). `hexD(R, rr)` lo dibuja; el apotema es `R · 0,866`. Solo el Papel tiene el borde dentado (cinco dientes por lado, con las puntas en los vértices).
- **Lienzo** `viewBox="0 0 100 100"`, `width`/`height` 120. Un solo SVG por combinación: no hay versión `-small`.
- **Misma escala que las insignias**: Papel, Cartón, Madera y Bronce usan `R = 46,5` (disco de la insignia: 43; el hexágono es un poco más grande en vértice para pesar lo mismo) y cara `Rf = 38`. Plata (`R = 38,5`, `Rf = 32`) y Oro (`R = 37`, `Rf = 30`) son más chicos porque, como sus insignias, llevan adornos fuera de la medalla: laurel (Plata) y corona de laurel, rayos, cinta y rubí (Oro). Diamante: `R = 44`, gema de `G = 36,5` y rayos y brillo alrededor.
- **Como la insignia**: degradado del canto claro → medio → oscuro en diagonal (luz arriba a la izquierda), borde interior hundido con el degradado invertido, aro de brillo `hl`, medialuna de brillo en la cara, **sombra dura** negra al 42 % corrida `max(2, R · 0,07)` y **contorno oscuro** de 0,7 del color `edge` del material.
- **El símbolo va en relieve, en un tono contrastado de la familia del material** (`PAL` en el generador): sombra dura de 1,8 corrida hacia abajo, contorno oscuro, degradado vertical `sym` (arriba → abajo, como el `panel` de la insignia) y un brillo de borde por dentro (degradado `symHl`, recortado a la pieza, como `panelHl`).
- **Rayo y play llevan el mismo nivel de detalle que el calendario y la diana** (capas, contorno, brillo, sombra, un segundo elemento). Rayo: bisel en dos facetas (clara/oscura) recortadas al rayo, brillo especular, resplandor `boltGlow` y anillo de energía punteado detrás, y tres chispas amarillas con contorno `#7a2008` (acento fijo, como la llama). Play: disco (aro `sym`, aro claro fino, fondo hundido `sunk`, medialuna de brillo) con el triángulo en relieve, de tres facetas y color `light`, y un destello en el aro. El triángulo es el protagonista: claro sobre el disco oscuro, para leerse a 22 px. En el estado vacío son los mismos dibujos en gris.
- **Mismo tamaño y margen para los cuatro símbolos**: cada uno se diseña en un lienzo de 100 × 100 y se coloca con `k` (escala), `ox`, `oy` (`SYMBOLS`); la escala final es `k · Rf / 38`. El generador mide el margen de cada símbolo contra el borde de la cara con `TB_DEBUG=1 node config_logros/herramientas/gen-logros.js` y lo imprime; hoy el mínimo de cada símbolo va de 1,8 a 4,3 unidades (el rayo, el calendario y la diana son los más justos; el cálculo cuenta puntos de control de las curvas y la pluma de la flecha, así que el margen real es algo mayor). Un hexágono con punta arriba es angosto cerca de las puntas: un símbolo cuadrado necesita ser más chico que uno alto y delgado (el rayo).
- **Legibilidad a 38 px y 74 px** (tamaños del juego para un logro). A 22 px solo se garantiza el rayo y el play; el juego no muestra logros a ese tamaño. Para que el símbolo no se ensucie se simplificó: la diana tiene cuatro anillas y una flecha gruesa; el calendario, un cuerpo, una cabecera, dos anillas y la llama (sin cuadrícula de días).
- **IDs únicos por archivo**: todos los `id` de degradados y recortes llevan el prefijo `<logro>-<material>-` (p. ej. `racha-oro-rim`), así dos SVG en la misma página no chocan. El script de verificación de abajo lo comprueba.
- Sin `transform` ni `filter` (solo `clipPath`), sin imágenes, fuentes ni texto. Los trazados de los símbolos usan pares `x,y` (M, L, Q, C, Z) para poder escalarlos con texto (`T.d()`).

## Cómo se resolvió cada material

| Material | Colores (`m`: claro → oscuro) | Símbolo | Qué lo identifica |
|---|---|---|---|
| Papel | canto `#ffffff` → `#ece2cb` → `#a8946f`, cara `#fffdf7` → `#e9dec4`, contorno `#6b5a3c` | azul tinta `#5d84b8` → `#34557f` | **borde dentado** (pirotín), pliegues radiales, hoja de cuaderno (renglones azules y margen rojo) |
| Cartón | canto `#ecd3a4` → `#b78d58` → `#6a4a25`, cara `#d9bb88` → `#ad8754`, contorno `#3f2a12` | cartón oscuro `#7a5230` → `#4a2f14` | kraft con **canto corrugado** (onda entre dos capas), fibras y canaletas |
| Madera | canto `#d0a46c` → `#8f6439` → `#4a2f15`, cara `#d8ad74` → `#9f7344`, contorno `#2e1706` | nogal `#8a4f2a` → `#3a1a09` | veta, nudo, anillos de crecimiento y **remaches de latón en las seis esquinas** |
| Bronce | bandas `#ffc193`, `#cd6f36`, `#f3a66f`, `#9a4718`, `#c96b32` | marrón `#7d3f14` → `#47200a` | canto estriado y reflejos en diagonal |
| Plata | bandas `#ffffff`, `#bcc5d1`, `#f1f4f8`, `#8d99a9`, `#c2cad5` | azul marino `#43526e` → `#222c42` | canto estriado, **laurel** y 1 destello |
| Oro | bandas `#fff4b0`, `#efb12a`, `#ffe27c`, `#c98400`, `#efb12a` | esmalte azul `#1f93ff` → `#0a4aa8` (el azul del bloque del juego) | **corona de laurel, rayos, cinta, rubí** arriba y 2 destellos |
| Diamante | `#e6faff` → `#79d3f8` → `#2390d2` | azul profundo `#1d6fb5` → `#0a3866` | **gema hexagonal tallada** (mesa y 18 facetas) en engaste de platino, rayos y **3 destellos** |

- **Llama del calendario y detalles de la diana:** conservan siempre su tinte cálido (llama `#ffc23a` → `#ff7a1a` → `#d93a12`, corazón `#fffbe0` → `#ffd23a`, contorno `#7a2008`; centro y plumas de la diana `#ff8a4a` → `#d93a12`), para que se lean en los siete materiales.
- **Estado vacío (`vacio`):** la misma medalla hexagonal en gris oscuro apagado (`#1b1b27`, cara `#222234`) con borde punteado `#5a5a7c`, sin sombra, sin textura y sin color, y el símbolo apagado (`#30304a` con borde `#5a5a7c`). Es el equivalente de `EmptyMedal` (círculo punteado `C.panelBorder` sobre `C.bg`).

## Cómo regenerar y verificar

- `node config_logros/herramientas/gen-logros.js` (desde cualquier carpeta) reescribe `logros_iconos/`. Para comprobar que la salida no cambió sin querer: correrlo dos veces y comparar `md5sum logros_iconos/*.svg`.
- Con `TB_DEBUG=1` imprime el margen de cada símbolo contra su cara.
- Para mirarlos: servir `config_logros/` con un `node` mínimo (p. ej. puerto 5176; Playwright no abre `file://`), armar una página que muestre los SVG a 170, 74, 38 y 22 px sobre el fondo del juego (`#12121a`) **junto a la insignia del mismo material** (`insignias/` o `insignias_nuevas/`), y abrir la web con el interruptor en "Con cambios": tabla de Logros (4 filas × 7 materiales, sin imágenes rotas), modal de familia y la sección "Logros en el celular". Guardar las capturas en `.playwright-mcp/` (ignorada por git).
- Para comprobar el SVG: cargar cada archivo con `DOMParser` (sin `parsererror`), que `viewBox` sea `0 0 100 100`, que ningún `id` se repita entre los 32 archivos y que todas las `url(#…)` apunten a un `id` del mismo archivo.
- Para agregar un logro: sumar su símbolo a `SYMBOLS` (`k`, `ox`, `oy`) y una rama en `symbol()` (diseñado en 100 × 100, con la sombra en `out.shadow` y las piezas en `out.body`). Las medallas se aplican solas; revisar el margen con `TB_DEBUG=1`.
