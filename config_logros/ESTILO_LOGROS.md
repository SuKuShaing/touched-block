# Estilo de los iconos de logros (para diseñar más)

Guía para quien (persona, Claude o un subagente) cambie o agregue iconos de logros. Los iconos son la propuesta de `cambios.md` → **CAMBIO-011**: cada logro tiene **su propio icono** (no una medalla) y ese icono se dibuja en los **siete materiales** de las insignias, más un **estado vacío**. Comparte el lenguaje de luz de las insignias (`ESTILO_INSIGNIAS.md`), pero **no debe parecer una insignia**.

## Dónde está cada cosa

- `logros_iconos/`: los 32 SVG, `<id>-<material>.svg`.
  - `id`: `racha` (rayo, Máximo combo), `partidas` (play, Partidas jugadas), `diasReto` (calendario con llama, Días seguidos de reto diario), `mejorReto` (copa de trofeo, Mejor resultado en un reto diario).
  - `material`: `papel`, `carton`, `madera`, `bronce`, `plata`, `oro`, `diamante` y `vacio`.
- `herramientas/gen-logros.js`: el **único generador**. Tiene una forma por logro (`SHAPES`) y siete pieles de material (`MATS`). Regenera los 32 archivos, siempre idénticos (sin azar: las fibras del cartón usan un generador con semilla fija).

## Reglas

- **La silueta del objeto es el icono.** Nada de disco, placa redonda, aro ni la estrella de las medallas. El play es un **triángulo redondeado con grosor**, no un círculo con un triángulo. La copa es de **trofeo** (asas, pie, nudo, base de dos escalones), para que en papel o cartón no parezca un vaso desechable.
- **Lienzo** `viewBox="0 0 100 100"`, `width`/`height` 120. Un solo SVG por combinación: no hay versión `-small`.
- **Luz arriba a la izquierda**: cada pieza lleva un degradado en diagonal claro → medio → oscuro, con el mismo orden de colores que el canto de la insignia de su material. Lleva también un brillo de borde por dentro: el degradado `hl` de las medallas como trazo de 2,6 recortado a la pieza (hace de aro de brillo).
- **Contorno oscuro de 0,7** del color `edge` del material, y **sombra dura** negra al 42 % corrida 3 unidades hacia abajo, más el grosor.
- **Grosor** en el rayo (4,5) y en el play (5): copias de la forma en el tono oscuro del material, corridas hacia abajo, como el bloque del juego en relieve. El calendario y la copa no lo necesitan.
- Sin `transform` ni `filter` (solo `clipPath`), sin imágenes ni fuentes externas. Los trazados usan pares `x,y`, así que se corren (`shift`) o reflejan (`mirror`) con texto.
- Cada pieza tiene un tono: `m` (material), `md` (más oscuro: cabecera del calendario, pie y base de la copa, borde de la boca) o `ml` (más claro: la hoja del calendario).
- **Tamaños del juego: 38 px** (fila de la Colección) **y 74 px** (celebración). Los iconos deben leerse a 38 px. Papel tiene que distinguirse de Cartón y Plata de Diamante.

## Cómo se resolvió cada material

| Material | Colores (`m`: claro → oscuro) | Contorno | Qué lo identifica |
|---|---|---|---|
| Papel | `#fdf6e6` → `#ecdcbb` → `#b9a37b` | `#6b5a3c` | crema cálido (para no confundirlo con Plata), renglones azules `#7ea6dd`, margen rojo `#e26464` en la primera pieza y un **pliegue en diagonal** (mitad algo más oscura y doblez blanco) |
| Cartón | `#ecd3a4` → `#c39a62` → `#7a5630` | `#3f2a12` | kraft: canaletas verticales, fibras y una **banda rayada por dentro del borde** (el canto cortado deja ver la onda del corrugado) |
| Madera | `#e2b77c` → `#b07f4a` → `#6e4824` (tono oscuro: nogal `#8a4f2a` → `#3a1a09`; claro: arce `#f2d6a2` → `#c99558`) | `#2e1706` | veta en curvas, nudo en las piezas grandes y **remaches de latón** (degradado `nail`), como la insignia Madera |
| Bronce | bandas `#ffc193`, `#cd6f36`, `#f3a66f`, `#9a4718`, `#c96b32` | `#3d1a04` | reflejos en diagonal del metal pulido |
| Plata | bandas `#ffffff`, `#bcc5d1`, `#f1f4f8`, `#8d99a9`, `#c2cad5` | `#2c3340` | reflejos y **1 destello** |
| Oro | bandas `#fff4b0`, `#efb12a`, `#ffe27c`, `#c98400`, `#efb12a` | `#553400` | reflejos y **2 destellos** |
| Diamante | `#e6faff` → `#79d3f8` → `#2390d2` | `#1d4a66` | **tallado**: abanico de facetas desde el centro de cada pieza (claras hacia la luz) con una mesa en rombo y **3 destellos** |

- **Llama del calendario:** conserva siempre su tinte cálido (`#ffc23a` → `#ff7a1a` → `#d93a12`, corazón `#fffbe0` → `#ffd23a`, contorno `#7a2008`), para que se lea como llama en los siete materiales. El calendario es el que lleva el material.
- **Estado vacío (`vacio`):** la misma silueta en gris oscuro apagado (`#1f1f2d`, cabecera y base `#242433`) con borde punteado `#4a4a66`, sin sombra, sin textura y sin color en la llama. Es el equivalente de `EmptyMedal` (círculo punteado `C.panelBorder` sobre `C.bg`).

## Cómo regenerar y verificar

- `node config_logros/herramientas/gen-logros.js` (desde cualquier carpeta) reescribe `logros_iconos/`. Para comprobar que la salida no cambió sin querer: `md5sum` de la carpeta antes y después.
- Para mirarlos: armar una página con los SVG como data URI y cargarla con `page.setContent` desde Playwright (`browser_run_code_unsafe`; Playwright no abre `file://`). Mostrarlos a 74, 38 y 22 px sobre el fondo del juego (`#12121a`), junto a las siete insignias. Guardar las capturas en `.playwright-mcp/` (ignorada por git).
- Para agregar un logro: sumar su forma a `SHAPES` con sus piezas (`d`, `tone`, `tex`), su `depth`, los puntos de los remaches (`rivets`, dentro de las piezas) y los de los destellos (`spark`, tres puntos sobre el objeto). Las pieles se aplican solas.
