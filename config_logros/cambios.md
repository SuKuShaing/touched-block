# Cambios por hacer (config_logros)

Lista de cambios (001 a 027) a logros, niveles, insignias, retos y premios. **Al 2026-11-27 los 27 están aplicados en la rama `feat/premios-y-logros`, sin desplegar** (nada publicado, ningún dato borrado, sin probar en teléfono). Cada entrada conserva su texto original: su "Estado", sus "el juego no se tocó" y sus líneas de código son de cuando se escribió; el estado actual es la línea **"Estado en el juego"**. Donde una entrada contradiga a otra posterior, vale la resolución de `PLAN_IMPLEMENTACION.md` (secciones A y B). Un cambio nuevo sigue necesitando que el usuario diga "aplica el cambio X" (ver `CLAUDE.md` de esta carpeta).

La web (`index.html`) tiene un interruptor arriba a la derecha: **Ahora** muestra cómo está hoy el juego y **Con cambios** muestra estos cambios (marcados en celeste, con la posición de hoy en gris). Los valores propuestos están en `CAMBIOS` de `script.js`; si se agrega o cambia una entrada aquí, hay que reflejarla allí.

Estados: `propuesto` · `aprobado` (el usuario dijo que sí) · `aplicado` (ya está en el juego) · `descartado`.

## Contexto para quien lea esto sin haber visto la conversación

- **Touched Block** es un juego táctil de supervivencia contra el reloj. Cada partida pasa por **etapas** que van cambiando con los segundos jugados: aparecen los números 4, 5, 6, 7, 8, 9 (a los 20, 40, 60, 80, 100 y 120 s), luego las sumas y restas (140 s), las multiplicaciones y divisiones (275 s) y la etapa final, donde la vida de los bloques baja a 4, 3, 2 y 1 s (350, 380, 410 y 440 s).
- Las **insignias** (Madera I, II, III, Bronce, Plata, Oro, Diamante) se ganan según los **segundos de la partida normal más larga** del jugador. Hoy: Madera I 0 s (terminar una partida), Madera II 40 s, Madera III 100 s, Bronce 140 s, Plata 275 s, Oro 350 s, Diamante 440 s. Los umbrales son provisorios.
- Las insignias son cosméticas, pero varios **premios** dependen de ellas: Madera II → paleta Pastel, Madera III → efecto Chispas, Bronce → paleta Neón, Plata → paleta Retro y sonido Marimba, Oro → paleta Dorado, Diamante → paleta Diamante.
- Dónde viven en el código: `packages/engine/src/progress.ts` (`TIERS`, `tierIndexForTicks`) y los premios en `apps/client/src/cosmetics/catalog.ts`. Las reglas del juego viven solo en el motor (`packages/engine/src/constants.ts`); las insignias no son reglas: no cambian partidas ni rankings.
- Regla del proyecto: **no reiniciar rankings ni récords** (no subir `RULES_VERSION` ni cambiar `tb_best5`/`tb_hist5`). Cambiar umbrales de insignias es compatible con eso: la insignia se recalcula siempre desde el récord de duración, no se guarda como "ganada".

---

## CAMBIO-001 · Madera I se gana al llegar al 4

- **Estado:** aprobado (propuesto 2026-11-20; el 2026-11-26 el usuario confirmó: "ese cambio irá"). Todavía no aplicado en el juego. De él depende el sonido Marimba por la insignia Papel (CAMBIO-025).
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** Madera I pasa de "Terminar una partida" (0 s) a **"Llegar al 4" (20 s)**.
- **Por qué:** pedido del usuario. Queda alineada con la primera etapa de la escala (aparece el 4).
- **Dónde:** `packages/engine/src/progress.ts` → `TIERS[0]`: `at: numAt(4)` (= 20) y `goal: 'Llegar al 4'`.
- **Ojo (no es solo cambiar el número):**
  - `tierIndexForTicks` empieza con `let i = 0` y devuelve 0 para cualquier partida con `ticks >= 0`. Con Madera I en 20 s, una partida de menos de 20 s **seguiría dando Madera I** si no se cambia esa función: debe devolver `-1` cuando `ticks < TIERS[0].at × 60`.
  - `tierIndexOfStats` (`apps/client/src/cosmetics/catalog.ts`) da índice ≥ 0 si `runs > 0 || bestTicks > 0`; hay que ajustarlo para que "terminó partidas pero ninguna llegó a 20 s" sea sin insignia (−1).
  - Texto del estado vacío: "Termina una partida para ganar Madera I." pasa a "Llega al 4 para ganar Madera I." (`CollectionScreen.tsx`, `EmptyMedal`/`TierCard`).
  - La celebración "¡Tu primera insignia!" (`celebrations.ts`: `reachedText`, y `endPrize.ts`: `firstTier`) asume que Madera I es terminar una partida (`t.at <= 0`); revisar los textos ("Terminaste tu primera partida.").
  - El sonido **Suave** se gana con `runs: 1` (terminar 1 partida), no con la insignia; no cambia. Pero la primera partida corta ya no daría ninguna insignia, solo Suave.
  - Tests que asumen Madera I con 0 s: `packages/engine/test/progress.test.ts` (`tierForTicks(0)` y `TIERS.map(t => t.at)`), `apps/client/src/cosmetics/catalog.test.ts` (línea ~107, "la primera partida da Suave y Madera I"), `apps/client/src/game/endPrize.test.ts` (líneas ~21 y ~140).
- **Efecto en jugadores existentes:** quien tenga como mejor partida menos de 20 s pasaría de Madera I a "sin insignia". Probablemente casi nadie, pero **no se reinicia nada** (se recalcula solo).

## CAMBIO-002 · Madera II se gana al llegar al 6

- **Estado:** propuesto (2026-11-20)
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** Madera II pasa de "Llegar al 5" (40 s) a **"Llegar al 6" (60 s)**.
- **Por qué:** pedido del usuario.
- **Dónde:** `packages/engine/src/progress.ts` → `TIERS[1]`: `at: numAt(6)` (= 60) y `goal: 'Llegar al 6'`.
- **Ojo:**
  - Sube el umbral: quien tenía entre 40 y 59 s como mejor partida **baja de Madera II a Madera I** y pierde el desbloqueo de la paleta **Pastel** (que exige Madera II). Si la tenía elegida, `active.ts` debería volver a la por defecto; revisar.
  - Las **misiones** "Llega al 5" (`llega5`, 20 bloques) y "Llega al 8" usan `MILESTONES` aparte y no cambian. No hay misión "Llega al 6".
  - Tests: `progress.test.ts` (`TIERS.map(t => t.at)`), `endPrize.test.ts` (línea ~53, "Madera II → Pastel", `secs(...)`).
  - Texto de la celebración y de la Colección salen de `goal`; se actualizan solos.

## CAMBIO-003 · Diamante se gana al llegar a los bloques de 2 s

- **Estado:** propuesto (2026-11-20)
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** Diamante pasa de "Llegar a los bloques de 1 s" (440 s) a **"Llegar a los bloques de 2 s" (410 s)**.
- **Por qué:** pedido del usuario. Hoy 440 s es la última etapa; en la práctica casi nadie llega.
- **Dónde:** `packages/engine/src/progress.ts` → `DIAMOND_AT` pasa de `LIFE_STAGE_START + (LIFE_STAGE_FIRST − LIFE_STAGE_LAST) × LIFE_STAGE_STEP` (440) a `LIFE_STAGE_START + (LIFE_STAGE_FIRST − 2) × LIFE_STAGE_STEP` (410), y `goal: 'Llegar a los bloques de 2 s'`. Hoy el texto usa `LIFE_STAGE_LAST` (1); no dejar el número a mano.
- **Ojo:**
  - Baja el umbral: quien ya tenía entre 410 y 439 s **gana Diamante** y la paleta Diamante sin jugar de nuevo (se recalcula).
  - Oro (350 s) y Diamante (410 s) quedan a 60 s; no hay conflicto con otras insignias.
  - Tests: `progress.test.ts` (`TIERS.map(t => t.at)` debe ser `[20, 60, 100, 140, 275, 350, 410]` si se aplican los tres), `catalog.test.ts` (línea ~76, `TIERS[6].at`).

## Al aplicar los tres, además

- Actualizar la tabla "Hitos e insignias" de `docs/reglas-y-balance.md` (líneas ~96-107; hoy dice "40 s = Madera II" y "440 s = Diamante" y "Terminar una partida | Madera I") y anotar la decisión y su motivo en `docs/historia-y-decisiones.md`.
- Actualizar la réplica de esta carpeta: `AHORA` ← valores nuevos, vaciar `CAMBIOS` y mover las entradas de arriba a `aplicado`. Los `insignias/*.svg` no cambian.
- Correr `pnpm --filter @tb/engine test` y `pnpm --filter @tb/client exec tsc --noEmit` y los tests del cliente. La API usa `tierRefForTicks` (`apps/api/src/stats/stats.service.ts`) para la insignia de los rankings: se actualiza al reconstruir el motor (`pnpm --filter @tb/engine build`) y desplegar la API con un tag; hasta entonces los rankings mostrarían la insignia con los umbrales viejos.
- No toca `RULES_VERSION` ni las claves locales: no reinicia nada.

---

## CAMBIO-004 · El nivel 1 llega a los 50 bloques (la curva se corre un nivel)

- **Estado:** propuesto (2026-11-20). El usuario vio la comparación y la aprobó como idea ("así me gusta"); falta que diga "aplica".
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** el nivel n deja de empezar en `25 · n · (n − 1)` bloques y pasa a empezar en **`25 · n · (n + 1)`**. De 0 a 49 bloques no hay nivel (nivel 0); el **nivel 1 llega a los 50**. Se mantiene el factor 25 y la forma de la curva (triangular: subir del nivel n al n+1 cuesta `50 · (n + 1)` bloques).
- **Por qué:** pedido del usuario. Hoy "Nivel 1" se tiene con 0 bloques, así que no hay una primera meta; con el cambio, el primer nivel se gana al destruir 50 bloques.
- **Contexto de la fórmula actual:** `LEVEL_FACTOR = 25` en `apps/client/src/lib/level.ts`; es un valor *provisorio* que el usuario confirmó tal cual el 12 nov 2026 (ver `docs/historia-y-decisiones.md`, línea ~210). No hay una razón de balance documentada para el 25. Cuentan los bloques destruidos en total **más** los bloques extra de las misiones (`totalKilled + bonusXp`).
- **Comparación (bloques en que empieza cada nivel):**

  | Nivel | Hoy | Con el cambio |
  |---|---|---|
  | 1 | 0 | 50 |
  | 2 | 50 | 150 |
  | 5 (fondo Grilla) | 500 | 750 |
  | 10 (fondo Estrellas) | 2.250 | 2.750 |
  | 20 (fondo Aurora) | 9.500 | 10.500 |
  | 25 | 15.000 | 16.250 |

  Costo de subir: 1→2 pasa de 50 a 100; 2→3 de 100 a 150; 5→6 de 250 a 300; 10→11 de 500 a 550; 20→21 de 1.000 a 1.050.
- **Dónde (todo en el cliente; el nivel no pasa por el motor ni por la API):**
  - `apps/client/src/lib/level.ts`: `levelStart(n)` → `LEVEL_FACTOR * n * (n + 1)`; `levelFor` debe poder dar nivel **0** (hoy parte en 1 y usa `Math.max(1, …)`); la estimación pasa a `floor((−1 + sqrt(1 + 4x/F)) / 2)`. Actualizar el comentario del archivo.
  - `apps/client/src/lib/level.test.ts`: reescribir los valores (hoy asumen `levelStart(1) = 0`, `levelFor(0).level = 1`, etc.).
  - `apps/client/src/screens/CollectionScreen.tsx` (~líneas 133-150): hoy muestra el número del nivel y "Te faltan N bloques para el nivel {lv.level + 1}". Con 0 bloques mostraría "Nivel 0" (o "Sin nivel") y "Te faltan 50 bloques para el nivel 1". Decidir el texto con el usuario.
  - `apps/client/src/screens/ProfileScreen.tsx` (~línea 632): `"Sin insignia · Nivel ${lv.level}"` → con nivel 0 decidir si se muestra "Nivel 0" o se omite.
  - `apps/client/src/lib/collectionScore.ts` (línea 11): suma `levelFor(...).level` al puntaje de novedades; todos bajan 1 punto. Como guarda el máximo (`collectionSeen`), no se enciende un punto falso; revisar su test.
  - `apps/client/src/cosmetics/catalog.ts` usa `levelStart(req.n)` (líneas ~196 y ~255) y no necesita cambios de código, pero **cambia lo que cuestan los fondos** (ver abajo). Revisar `catalog.test.ts`.
- **Efectos en jugadores existentes:**
  - **Todos bajan exactamente un nivel** con los mismos bloques (el nivel nuevo = el nivel de hoy − 1).
  - Los fondos de nivel se vuelven más caros si se mantienen en los niveles 5, 10 y 20: Grilla 500 → 750, Estrellas 2.250 → 2.750, Aurora 9.500 → 10.500. Quien tenga entre 500 y 749 bloques y ya usaba Grilla la perdería (se recalcula; el fondo elegido debería volver al liso en `active.ts`; verificar).
  - **Alternativa si no se quiere encarecer los fondos:** dejar su costo igual y cambiar sus requisitos a los niveles **4, 9 y 19** (500, 2.250 y 9.500 bloques). Es solo cambiar la numeración en `catalog.ts` y en los textos. Decisión pendiente del usuario.

- **No toca** `RULES_VERSION`, rankings, récords ni claves locales (`tb_*`): el nivel es cosmético y se recalcula.
- **Al aplicar:** actualizar `docs/reglas-y-balance.md` (línea ~165, "El nivel n pide `25 · n · (n − 1)`"), `docs/plan-jugabilidad.md` (sección 2.3) y anotar la decisión en `docs/historia-y-decisiones.md`; y en esta carpeta, `inicioNivelHoy` en `script.js` pasa a la fórmula nueva y se quita el modo "Con cambios" de la recta.
- **Cómo verlo en esta carpeta:** el interruptor Ahora / Con cambios de la web mueve las marcas de la recta "Bloques destruidos y nivel" (en gris, dónde estaban hoy los niveles de los fondos).

---

## CAMBIO-005 · Las tres maderas pasan a ser Papel, Cartón y Madera (dibujos nuevos)

- **Estado:** propuesto (2026-11-20). Los **nombres nuevos** (Papel / Cartón / Madera) son una propuesta: el usuario debe confirmarlos antes de aplicar.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Nombres Papel, Cartón y Madera (B1).
- **Qué:** las tres primeras insignias dejan de ser "el mismo disco de madera con I, II o III" y pasan a ser tres materiales:
  - **Madera I → Papel**: disco de papel crema con el borde dentado (cortado con tijera de picos, como un pirotín), pliegues radiales finos en el borde, cara de **hoja de cuaderno** (renglones azules y margen rojo) y, al centro, el bloque del juego en **azul tinta** con la **esquina de arriba a la derecha doblada** y una estrella blanca. Sin clavos ni numeral.
  - **Madera II → Cartón**: disco kraft con el **canto corrugado** (la onda entre dos capas, como el borde de una caja cortada), fibras del kraft y canaletas muy suaves en la cara, y el bloque del juego en cartón oscuro con estrella kraft clara, **pegado con un trozo de cinta de embalar** arriba. Sin clavos ni numeral.
  - **Madera III → Madera**: el mismo disco de madera de hoy (canto, anillos, veta, nudo), sin numeral. Conserva el **bloque central cuadrado** como las demás insignias (sombra al 40 %, `panelHl`, barrita blanca), pero el bloque es de **arce** (madera clara, con veta horizontal fina) y lleva encima una **estrella de nogal** (otra madera, más oscura y rojiza, con su propia veta vertical) con **un remache de latón en cada una de sus 5 puntas**. Es la única de las tres con bloque claro y glifo oscuro (al revés que Cartón, que tiene bloque oscuro y estrella clara). Se quitan los clavos de arriba del canto (marcaban la división I/II/III y ya no hacen falta).
- **Por qué:** pedido del usuario. Hoy las tres maderas se distinguen solo por el numeral y por 1, 2 o 3 clavos, que a 22 px casi no se ven. Con tres materiales distintos la progresión se lee sola: **Papel < Cartón < Madera < Bronce < Plata < Oro < Diamante**, y cada una se reconoce por color y silueta incluso chica (Papel: blanco con borde dentado; Cartón: kraft claro con bloque; Madera: madera con bloque claro y estrella oscura; Bronce: cobre con bloque).
- **Dónde están los diseños:** `config_logros/insignias_nuevas/` (mismos nombres que `insignias/`; los usará la web con el interruptor Ahora / Con cambios):
  - `madera-1.svg` / `madera-1-small.svg` → Papel
  - `madera-2.svg` / `madera-2-small.svg` → Cartón
  - `madera-3.svg` / `madera-3-small.svg` → Madera

  Siguen el lenguaje de `medalSvg()`: lienzo 100×100 (`viewBox="0 0 100 100"`; `width`/`height` 120 la grande y 28 la chica, como en `insignias/`), luz arriba a la izquierda (degradados en diagonal claro → medio → oscuro en el canto, `rimIn` invertido para el borde hundido, aro de brillo `hl`, medialuna de brillo en la cara), sombra dura negra al 42 % corrida hacia abajo `max(2, R·0.07)`, contorno oscuro de 0,7, bloque central con sombra al 40 %, `panelHl` y barrita blanca, y glifo con sombra al 45 %. Sin transformaciones ni filtros (solo `clipPath`), para que se pueda pasar tal cual a `SvgNode` / react-native-svg. Las `-small` siguen la regla de hoy: sin texturas finas (renglones, pliegues, fibras, veta, anillos), sin `panelHl` ni barrita, aro de brillo más grueso (1,8), bloque más grande (`Rf·1.12`) y estrella/remaches más grandes.
- **Colores principales:**
  - Papel: canto `#ffffff` → `#ece2cb` → `#a8946f`; cara (radial) `#fffdf7` → `#e9dec4`; contorno `#6b5a3c`; renglones `#7ea6dd`, margen `#e26464`; bloque `#5d84b8` → `#34557f` (tinta, más apagado que el azul de Oro); doblez `#ffffff` → `#c9d6e6`; estrella `#ffffff` → `#dfe8f3`. Borde dentado: 30 dientes de 2,6 (20 de 3,4 en la chica).
  - Cartón: canto `#ecd3a4` → `#b78d58` → `#6a4a25`; cara (radial) `#d9bb88` → `#ad8754`; contorno y onda `#3f2a12`; fibras `#5a3a16`; bloque `#8c6439` → `#5b3c1c`; estrella `#f6e2bd` → `#d9b47a`; cinta `#fff6dc` → `#e7d3a2` (traslúcida, 80-85 %). Onda: 34 ondas (16 en la chica).
  - Madera: canto, cara, veta y anillos iguales a los de hoy (`METAL.madera`: canto `#d0a46c` → `#8f6439` → `#4a2f15`, cara `#d8ad74` → `#9f7344`, contorno `#2e1706`); estrella de nogal `#8a4f2a` → `#5e3017` → `#3a1a09` con contorno `#1e0c02` y brillo de canto `#ffd9b0`; bloque de arce `#f2d6a2` → `#c99558` (vertical, como `panel`) con contorno `#6b4220` y veta `#9a6a36`; remaches con el degradado `nail` de hoy (`#fff6cf` → `#e2b54a` → `#7a5310`). Bloque del mismo tamaño que en las demás (`Rf·1.04`, `Rf·1.12` en la chica); estrella de radio `S·0.42` (`S·0.45` en la chica, S = lado del bloque), radio interior a la mitad, con la sombra y el corrimiento del glifo de `panel()`; remaches de radio 1,55 (2,3 en la chica). A 22 px los remaches son apenas puntitos dorados: se priorizó que se lea la estrella oscura sobre el bloque claro.
- **Qué hay que tocar en el juego al aplicarlo:**
  - `apps/client/src/cosmetics/medal.ts` → `medalSvg()` / `roundMedal()`: hoy `tier === 'madera'` dibuja el mismo disco para los tres `step`, el numeral con `roman()` (dentro de `panel()`, rama `spec.emblem === 'tier' && spec.tier === 'madera'`) y los clavos del canto según `step` (bloque "división de Madera", ángulos `[-90]`, `[-108, -72]`, `[-128, -90, -52]`). Hay que: (1) agregar los materiales papel y cartón (en `METAL` o como casos aparte, según `step` 1 y 2 de `madera`), con el borde dentado (Papel), el canto corrugado y la cinta (Cartón) y la esquina doblada del bloque (Papel); (2) para `step` 3, mantener `panel()` pero con un degradado de bloque de arce (nuevo `METAL.madera.panel`) y, en lugar de `roman()`, la estrella de nogal (degradado propio, contorno, veta recortada a la estrella) con 5 remaches (`nail`) en las puntas; (3) borrar `roman()` (ninguna de las tres lo usa) y los clavos del canto; (4) actualizar el comentario de cabecera ("Madera (disco con veta, clavos = división I/II/III)…", "número romano (Madera)") y el de `MedalSpec.emblem`/`step`. Los SVG de `insignias_nuevas/` sirven de referencia exacta de coordenadas.
  - **Logros (ojo):** la medalla del material de logro "Madera" se dibuja con `{ tier: 'madera', step: 1, emblem: 'star' }` (`CollectionScreen.tsx` ~línea 346: `mat.toLowerCase()` + `step: 1`). Si `step` 1 pasa a ser Papel, el logro "Madera" se vería de papel. Decidir: o el logro Madera usa `step: 3` (la madera nueva, que ya lleva estrella), o `medalSvg` dibuja madera siempre que `emblem === 'star'`. En esta carpeta ya está resuelto: con "Con cambios", la cabecera "Madera" de la tabla de logros (`coleccion.js`) usa `insignias_nuevas/madera-3-small.svg`.
  - `packages/engine/src/achievements.ts` → `ACHIEVEMENT_MATERIALS` (`'Madera', 'Bronce', …`): **puede quedar igual**; los logros siguen con 5 materiales y "Madera" sigue existiendo. Solo hay que cuidar el dibujo (punto anterior).
  - `packages/engine/src/progress.ts` → `TIERS[0..2].name`: "Madera I" → **"Papel"**, "Madera II" → **"Cartón"**, "Madera III" → **"Madera"**. Los `tier: 'madera'` y `step: 1..3` **no cambian** (son la referencia `TierRef` que guarda y devuelve la API: `tierIndexOf`, `tierRefForTicks` en `apps/api/src/stats/stats.service.ts`). Actualizar los comentarios ("0 = Madera I … 6 = Diamante", "\"Madera II\", \"Bronce\"…"). Celebraciones, premios y Colección toman el texto de `name` y se actualizan solos ("¡Subiste a Cartón!", "¡Tu primera insignia: Papel!" se leen bien).
  - `apps/client/src/cosmetics/tiers.ts` → `TIER_LOOK` es por `TierId` (un solo color, `madera: '#c49a63'`, para las tres). Si la barra de avance de la Colección debe mostrar el color de cada una, pasar a un color por índice (p. ej. Papel `#ece2cb`, Cartón `#c9a26c`, Madera `#c49a63`).
  - `apps/client/src/components/TierBadge.tsx`: solo el comentario ("Madera I–III"); el código pasa `tier`/`step` y no cambia.
  - Tarjeta de compartir: `apps/client/src/platform/share.web.ts` (`loadMedal` → `medalSvg({ tier, step, emblem: 'tier' })`) y `ShareCardHost.native.tsx` (`TierBadge` + `t.name`) usan el mismo dibujo y el nombre: se actualizan solos; verificar que "Cartón" (con tilde) se vea bien en el canvas.
  - Tests: `apps/client/src/cosmetics/medal.test.ts` ("las divisiones de Madera se distinguen" sigue valiendo, renombrarlo; el test de ids/referencias cubrirá los degradados y recortes nuevos `fold`, `tape`, `star`, `starHl`, `sc`, `pc`), `catalog.test.ts` (~107-110, `'Madera I'`), `endPrize.test.ts` (~21, 24, 53-61, 140: `'Madera I'`, `'Madera II'`, `'Madera III'`, "¡Subiste a Madera II!"), `celebrations.test.ts` (~163, `name: 'Madera I'`).
  - Textos fijos que nombran "Madera I": `CollectionScreen.tsx` ~línea 103 ("Termina una partida para ganar Madera I." → "…ganar Papel."; con CAMBIO-001, "Llega al 4 para ganar Papel."); comentarios de `celebrations.ts` (~28, 51, 168) y de `catalog.ts` (Pastel = `tierIdx('madera', 2)` → Cartón; Chispas = `tierIdx('madera', 3)` → Madera; el código no cambia).
  - Docs al aplicar: `docs/reglas-y-balance.md` (tabla "Hitos e insignias"), `docs/plan-jugabilidad.md` (~línea 277) y anotar la decisión en `docs/historia-y-decisiones.md`. En esta carpeta: regenerar `insignias/` con el `medalSvg()` nuevo y actualizar los nombres en `script.js` / `coleccion.js`.
- **No toca** `RULES_VERSION`, rankings, récords ni claves locales: es solo dibujo y nombres; la API sigue guardando `{ tier: 'madera', step }`.
- **Dudas para el usuario:** (1) confirmar los nombres Papel / Cartón / Madera; (2) si el logro de material "Madera" debe verse como la insignia Madera nueva (bloque de arce con estrella de nogal remachada): es lo que se propone; (3) el bloque central de Papel quedó en azul tinta (de cuaderno); si se prefiere gris grafito, es solo cambiar su degradado; (4) **numerales:** hoy Madera I y II llevan "I" y "II" en el bloque central; en estos diseños Papel y Cartón llevan una **estrella** en su lugar (el pedido solo mencionaba quitar el numeral de Madera III). Si se prefiere que Papel y Cartón conserven "I" y "II", hay que rehacer el glifo central de esos dos (el resto del diseño sirve). Pendiente de decidir con el usuario.

---

## CAMBIO-006 · El cuadro de Logros va entre Nivel y Paletas en la Colección

- **Estado:** propuesto (2026-11-20).
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** en la pestaña **Colección** del juego, el cuadro (sección) **"Logros"** pasa a mostrarse **justo debajo de "Nivel" y antes de "Paletas"**. Hoy está al final de la pantalla, después de Paletas, Sonidos, Efectos al destruir y Fondos del campo.
- **Orden hoy (arriba → abajo):** Insignia · Nivel · Paletas · Sonidos · Efectos al destruir · Fondos del campo · Logros.
- **Orden propuesto:** Insignia · Nivel (se llamaría Experiencia con CAMBIO-007) · **Logros** · Paletas · Sonidos · Efectos al destruir · Fondos del campo (y, al final, la Vista previa de CAMBIO-020).
- **Por qué:** pedido del usuario (lo marcó sobre una captura de la Colección en el celular, con una línea entre la tarjeta de Nivel y la de Paletas). Insignia, Nivel y Logros son **progreso del jugador**; Paletas, Sonidos, Efectos y Fondos son **premios para elegir**. Agruparlos así deja el progreso junto arriba, sin tener que bajar toda la lista de premios para llegar a los logros.
- **Dónde (solo el cliente; es un cambio de orden, no de lógica):**
  - `apps/client/src/screens/CollectionScreen.tsx`, el render (~líneas 426-460): hoy va `<TierCard>`, `<LevelCard>`, luego el `TYPE_ORDER.map(...)` con las secciones de premios y, al final, `<Section title="Logros">` con las `AchievementRow`. Mover el bloque `<Section title="Logros">…</Section>` para que quede entre `<LevelCard stats={stats} />` y el `TYPE_ORDER.map(...)`. Opcional: extraerlo a un componente (`AchievementsCard`) como ya son `TierCard` y `LevelCard`.
  - Nada más depende del orden: el punto de novedad de la pestaña (`lib/collectionScore.ts`, `lib/collectionNews.ts`) cuenta cosas, no secciones; la API y el motor no se tocan. Revisar que no haya un test o una captura que asuma el orden.
- **Efecto en los jugadores:** solo visual. Quien baja por la Colección ve los logros antes que los premios. No se reinicia ni se recalcula nada (no toca `RULES_VERSION`, rankings, récords ni claves `tb_*`).
- **En esta carpeta:** la web (`index.html`) hoy muestra "Premios" y después "Logros" (un panel por cada tipo de premio). Para reflejar este cambio con el interruptor Ahora / Con cambios habría que mover la sección de Logros entre "Bloques destruidos y nivel" y "Premios" cuando esté en "Con cambios". **Todavía no está hecho**: el usuario solo pidió anotarlo.

---

## CAMBIO-007 · El "Nivel" pasa a llamarse "Experiencia"

- **Estado:** propuesto (2026-11-20).
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** el concepto que hoy se llama **Nivel** (se sube destruyendo bloques; más los bloques extra de las misiones) pasa a presentarse como **Experiencia**. En la Colección, el cuadro que hoy dice **"NIVEL"** pasa a decir **"EXPERIENCIA"**. Dentro del cuadro se sigue hablando de niveles: "Nivel 1", "Nivel 10".
- **Decisiones del usuario (2026-11-20):**
  1. Se mantiene la palabra **"nivel"** (Nivel 1, Nivel 10); lo que cambia es que queda claro que es el nivel **de experiencia**.
  2. La unidad **sigue siendo "bloques"** ("0 bloques destruidos", "Te faltan 50 bloques para el nivel 2"). No se introducen puntos de experiencia (XP).
  3. Las **misiones no cambian**: siguen diciendo "Bloques extra para tu nivel" (con su +20, +30…).
  4. "Nivel 1" **a secas** dentro del cuadro. Fuera de ese cuadro la decisión quedó abierta ("mmm…"): propuesta por defecto, dejar también "nivel" a secas en el Perfil, los fondos y las celebraciones, y aclarar "nivel de experiencia" solo donde no hay contexto (landing y textos legales). Confirmar con el usuario.
- **Por qué:** pedido del usuario. "Nivel" a secas es ambiguo: los logros también tienen "niveles" (sus 5 materiales, "Nivel máximo", Madera a Diamante) y las insignias tienen escalones. Con "Experiencia" queda claro qué es cada cosa.
- **Qué NO cambia:** la fórmula (`LEVEL_FACTOR`, ver CAMBIO-004), cómo se gana, los fondos por nivel (Grilla/Estrellas/Aurora), el motor, la API, los rankings, `bonusXp` (el campo interno ya usaba la idea de experiencia) y los nombres internos del código (`levelFor`, `levelStart`, `xpOf`…). No toca `RULES_VERSION` ni claves `tb_*`. Es solo texto.
- **Dónde implementarlo:**
  - **Juego (cliente):**
    - `apps/client/src/screens/CollectionScreen.tsx` línea ~136: `<Section title="Nivel">` → `title="Experiencia"`. Lo demás del cuadro queda ("Nivel {n}", "N bloques destruidos", "Te faltan N bloques para el nivel N+1"). Es el único cambio visible obligatorio. Actualizar también el comentario de ~línea 371 (`/coleccion`: insignia, nivel, premios…).
    - `apps/client/src/lib/level.ts` (comentario de cabecera: "Nivel del jugador…") y `apps/client/src/app/(tabs)/coleccion.tsx` (comentario): mencionar que el nivel es el de experiencia. Opcional.
    - `apps/client/src/screens/ProfileScreen.tsx` línea ~632: `` `${…} · Nivel ${lv.level}` ``. Por defecto no cambia; si el usuario lo pide, "Nivel {n} de experiencia".
    - `MissionList.tsx` (líneas ~29 y ~37) y `celebrations.ts` (~304): **no cambian** (decisión 3).
    - `catalog.ts` (~122) y `celebrations.ts` (~247), requisitos de los fondos ("Llega al nivel 5", "Por llegar al nivel 5"): por defecto no cambian.
    - Revisar tests que dependan de esos textos (`catalog.test.ts`, `celebrations.test.ts`).
  - **Landing** (`apps/landing/public/`, se despliega aparte con `deploy-landing.yml`; son páginas legales, así que revisar que el cambio de palabra no cambie el sentido):
    - `index.html` ~277: "gana nivel con cada bloque roto" → p. ej. "sube tu nivel de experiencia con cada bloque roto".
    - `terminos/index.html` ~162: "las insignias, el nivel, las misiones…" → "…el nivel de experiencia…".
    - `privacidad/index.html` ~254: fila "Rankings, retos, insignias, nivel y Colección" → "nivel de experiencia".
    - `eliminar-cuenta/index.html` ~91: "tus estadísticas, insignia, nivel y premios de misiones" → "nivel de experiencia".
  - **Docs:** `docs/reglas-y-balance.md` (~línea 165), `docs/plan-jugabilidad.md` (sección 2.3 y otras), `docs/arquitectura.md`, `docs/api.md`, `docs/historia-y-decisiones.md` (anotar la decisión) y `docs/pendientes.md`: donde "nivel" nombre este concepto, decir "nivel de experiencia".
  - **Esta carpeta:** la recta "Bloques destruidos y nivel" pasa a titularse "Experiencia: bloques destruidos y nivel" con el interruptor en "Con cambios" (ya hecho en `index.html`/`script.js`); al aplicar, actualizar los textos de `coleccion.js` si cambian los requisitos de los fondos, y los de CAMBIO-004/006 que nombran "Nivel".
- **Relación con otros cambios:** CAMBIO-004 (la curva) y CAMBIO-006 (orden de la Colección: Insignia · **Experiencia** · Logros · Paletas…). Conviene aplicarlos juntos, porque los tres tocan `CollectionScreen.tsx`.
- **Efecto en los jugadores:** solo cambia una palabra. No se pierde ni se recalcula nada.

---

## CAMBIO-008 · El logro "Mejor racha" pasa a llamarse "Máximo combo"

- **Estado:** propuesto (2026-11-20).
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** el logro que hoy se llama **"Mejor racha"** pasa a llamarse **"Máximo combo"**. Sus umbrales (10, 25, 50, 100, 200) y su cálculo no cambian.
- **Qué es (para quien no vio la conversación):** es el **combo más largo en una sola partida**: bloques destruidos seguidos sin ningún error (se corta al tocar una trampa, fallar un toque —que cuesta una vida— o dejar escapar un bloque). El logro toma el **máximo** de todas las partidas (no la suma), y solo cuentan las partidas normales sin modificadores (`countsForBest`; el reto diario no suma). En el motor es `bestStreak` (`packages/engine/src/game.ts`); los combos del juego dan segundos extra a las rachas 3, 5, 10, 15 y 20 (ciclo de 20) y un corazón cada 25 (`COMBO_REWARDS`, `HEART_COMBO` en `constants.ts`).
- **Por qué:** pedido del usuario. El juego ya llama "combo" a esa mecánica (tutorial, premio de segundos, "¡Combo!"); "racha" confunde con la **racha de días** del reto diario, que es otra cosa. Con el cambio, "racha" queda solo para los días seguidos.
- **Dónde implementarlo (solo texto; el id interno `racha` y `bestStreak` no cambian):**
  - `packages/engine/src/achievements.ts` línea ~27: `{ id: 'racha', name: 'Mejor racha', … }` → `name: 'Máximo combo'` (y el comentario de ~línea 20 y el de `AchievementId` de ~línea 10). El nombre se muestra en la Colección y en la celebración del logro ("¡Logro de Plata!" + nombre), que lo toman de `name`. Ojo: es el **motor**, pero el nombre no afecta partidas ni replay; igual hay que reconstruirlo (`pnpm --filter @tb/engine build`) y correr sus tests (`packages/engine/test/achievements.test.ts` puede comparar el nombre).
  - **Textos del logro** (decisión abierta, ver abajo): `achievementGoal` en `achievements.ts` dice "Racha de {n}".
  - Revisar los tests del cliente que mencionen "Mejor racha" (`celebrations.test.ts`, `catalog.test.ts`).
- **Lo que quedaría inconsistente si solo se cambia el logro (decisión del usuario pendiente):**
  1. La **pantalla final de la partida** dice "Mejor racha: N" (`apps/client/src/screens/GameScreen.tsx` ~línea 852). ¿Pasa a "Máximo combo: N"? Recomendado, para que coincida con el logro.
  2. Los **textos de la meta** "Racha de 10 / 25 / 50…" (`achievementGoal`), el premio **Confeti** ("Haz una racha de 25", `catalog.ts`), su celebración ("Por hacer una racha de 25", `celebrations.ts`) y las **misiones** "Racha de 10 / 15 / 25" (`packages/engine/src/missions.ts`: ids `racha10`, `racha15`, `racha25`; los **ids no deben cambiar**, solo los `title`). Con el nombre nuevo sonarían mejor "Combo de 10", "Haz un combo de 25"…
  3. La **política de privacidad** (`apps/landing/public/privacidad/index.html`, ~líneas 163 y 168) nombra "mejor racha" entre los datos que se guardan. Es la misma cifra; revisar si se actualiza la palabra (página legal, se despliega aparte con `deploy-landing.yml`).
  4. Los comentarios y nombres internos (`bestStreak`, `streak`, `racha`) pueden quedar: son código.
- **Efecto en los jugadores:** solo cambian palabras. No se pierde ni se recalcula nada; no toca `RULES_VERSION`, rankings, récords ni claves `tb_*`. Ojo: las **misiones** tienen `title` en el motor, que valida el servidor, pero el título no entra en el replay.
- **Cómo verlo en esta carpeta:** en la tabla de Logros, con el interruptor en "Con cambios", la fila pasa a "Máximo combo" con "Hoy: Mejor racha" debajo. Los textos de la meta ("Racha de 10") todavía no cambian en la web: esperan la decisión de arriba.

---

## CAMBIO-009 · "Bloques destruidos" se reemplaza por el logro "Partidas jugadas"

- **Estado:** propuesto (2026-11-20).
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** el logro **"Bloques destruidos"** (hoy 100 / 500 / 2.000 / 10.000 / 50.000, de Madera a Diamante) se **elimina** y en su lugar se añade **"Partidas jugadas"**. Los otros logros quedan: Máximo combo (CAMBIO-008), Días seguidos de reto diario y Mejor resultado en un reto diario (estos dos el usuario los quiere conservar tal cual).
- **Por qué se quita "Bloques destruidos":** pedido del usuario. La cantidad de bloques destruidos **ya se premia con el nivel** (de experiencia, ver CAMBIO-007): ambos salen de la misma cifra (`stats.totalKilled`), así que eran dos premios por lo mismo. `achievementValues` lo muestra: `bloques: s.totalKilled`, y el nivel usa `totalKilled + bonusXp` (`lib/level.ts`).
- **Por qué "Partidas jugadas":** mide **constancia** (cuántas veces vuelve el jugador), algo que ni el nivel, ni las insignias (partida más larga), ni el combo premian. Funciona también como invitado y **no necesita cambios en la API**: la estadística ya existe (`CatalogStats.runs`; en la cuenta es `PlayerStats.totalRuns`; con sesión el cliente toma el máximo entre la del dispositivo y la del servidor). Cuenta **todas** las partidas terminadas (normales, de reto y duelos), igual que los bloques. Riesgo asumido: premia jugar mucho, incluso partidas cortas; como es solo cosmético y sin ventaja, se acepta.
- **Nota:** los umbrales de abajo son los de cinco materiales; **CAMBIO-010** los pasa a siete (Papel y Cartón antes de Madera; Oro y Diamante con umbrales nuevos) y fija los números definitivos propuestos.
- **Umbrales propuestos (provisorios, como todos los logros):** Madera **10** · Bronce **50** · Plata **150** · Oro **500** · Diamante **1.500** partidas. Con partidas de 1 a 2 minutos, Diamante serían unas 25 a 50 horas de juego. Texto de la meta: "Juega N partidas". **Pendiente:** el usuario puede ajustar los números.
- **Otros candidatos descartados por ahora** (anotados por si se quiere otro logro más adelante):
  - **Amigos invitados** (`invitedCount`): umbrales posibles 1 · 3 · 10 · 25 · 50. Solo con cuenta, como los del reto diario; depende de otras personas.
  - Necesitan estadísticas nuevas en la API: misiones completadas (hoy solo se guarda la suma de bloques extra, no cuántas), veces en el top 10 de un reto diario, partidas sin perder una vida.
- **Dónde implementarlo (motor y cliente; sin tocar la API ni la base de datos):**
  - `packages/engine/src/achievements.ts`: reemplazar la entrada `{ id: 'bloques', … }` de `ACHIEVEMENTS` (~línea 28) por `{ id: 'partidas', name: 'Partidas jugadas', thresholds: [10, 50, 150, 500, 1500] }`; en `AchievementId` (~línea 16) cambiar `'bloques'` por `'partidas'`; en `achievementGoal` (~línea 75) el `case 'partidas'` devuelve `` `Juega ${fmt(t)} partidas` ``. Actualizar los comentarios de cabecera (~líneas 9-14). Reconstruir el motor (`pnpm --filter @tb/engine build`).
  - `packages/engine/test/achievements.test.ts`: cambiar `bloques` por `partidas` en los umbrales esperados (~línea 14), el caso `achievementLevel('bloques', 1999)` (~línea 31) y los `achievementGoal('bloques', …)` (~líneas 60-61).
  - `apps/client/src/game/celebrations.ts`: `achievementValues` (~línea 75): `partidas: s.runs` en vez de `bloques: s.totalKilled`; y la lista `['racha', 'bloques', 'diasReto']` de `runCelebrations` (~línea 124) pasa a `['racha', 'partidas', 'diasReto']`.
  - `apps/client/src/screens/CollectionScreen.tsx`: el `case 'bloques'` de `achievementValue` (~línea 325) pasa a `case 'partidas': return stats.runs;`. La fila se dibuja sola porque la pantalla recorre `ACHIEVEMENTS`.
  - Tests del cliente que mencionan `ach:bloques:…`: `celebrations.test.ts` (~líneas 57 y 100) y `celebrationQueue.test.ts` (revisar). Pasan a `ach:partidas:…`, ajustando los valores de las partidas de los casos.
  - Docs al aplicar: `docs/reglas-y-balance.md` (~línea 154, tabla de logros), `docs/plan-jugabilidad.md` (§5.3), `docs/arquitectura.md` (~línea 25) y la decisión en `docs/historia-y-decisiones.md`.
  - `apps/api`: nada que tocar. Un id **nuevo** (`partidas`) en vez de reutilizar `bloques` evita confundir las claves viejas con las nuevas.
- **Qué NO cambia:** `totalKilled` y `UserStats` (siguen existiendo: alimentan el nivel y las estadísticas), la fórmula del nivel, los rankings, `RULES_VERSION` y las claves `tb_*`. Ningún premio del catálogo depende de este logro (revisado en `catalog.ts`).
- **Efecto en los jugadores (revisar antes de aplicar):**
  - Quien ya tenía materiales de "Bloques destruidos" deja de verlos; en su lugar aparece "Partidas jugadas" **ya con el material que le corresponda** por las partidas que lleva (se recalcula desde las estadísticas, no se guarda "ganado"). Quien lleva muchas partidas lo verá subido de inmediato.
  - **Celebraciones:** `achievementUps` compara el antes y el después de una partida, así que no debería disparar nada retroactivo; aun así hay que probar que, al actualizar, no salga una avalancha de celebraciones de "Partidas jugadas" para quien ya lleva muchas (mirar cómo siembra `celebrationQueue` lo que el jugador ya tenía; hay un test `seeded`).
  - **Punto de novedad de la Colección** (`lib/collectionScore.ts`: `ownedKeys` + nivel, y se guarda el máximo visto): la cuenta cambia al quitar un logro y añadir otro. Para la mayoría subirá un poco (se enciende el punto una vez, que es razonable); para quien tenía muchos niveles de "Bloques destruidos" y pocas partidas, bajará, y no verá el punto por premios nuevos hasta superar su máximo anterior. Caso leve; decidir al aplicar si se acepta o se ajusta `collectionSeen` una vez.
  - Las claves `ach:bloques:N` guardadas en celebraciones pendientes se ignoran: `celebrationFromKey` devuelve `null` para un logro que ya no existe (verificado en el código; respaldarlo con un test).
- **Relación con otros cambios:** CAMBIO-007 (el nivel pasa a llamarse Experiencia: refuerza que los bloques destruidos se premian ahí) y CAMBIO-008 (también toca `achievements.ts`). Conviene aplicarlos juntos.
- **Cómo verlo en esta carpeta:** en la tabla de Logros, con el interruptor en "Con cambios", la fila "Bloques destruidos" desaparece y en su lugar aparece "Partidas jugadas" con la etiqueta "Logro nuevo"; el pie de la tabla lo explica. Con "Ahora" vuelve la fila original.

---

## CAMBIO-010 · Los logros pasan de 5 a 7 materiales (Papel y Cartón al principio)

- **Estado:** propuesto (2026-11-20).
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Umbrales por confirmar (B4).
- **Qué:** con las insignias nuevas **Papel** y **Cartón** (CAMBIO-005) los logros pasan a tener **siete** materiales, de menor a mayor: **Papel · Cartón · Madera · Bronce · Plata · Oro · Diamante** (hoy: Madera · Bronce · Plata · Oro · Diamante).
- **Regla pedida por el usuario (sobre una captura de la tabla de Logros con flechas):** los **números de cada logro no se mueven de lugar**: los cinco umbrales de hoy pasan a ser los de los cinco primeros niveles, y los **materiales se corren dos lugares a la derecha** (Madera pasa al 3.er lugar, Bronce al 4.º, Plata al 5.º). Los dos primeros lugares (los umbrales más bajos) son de Papel y Cartón, y hay que **crear dos umbrales más altos** para Oro y Diamante.
- **Tabla de umbrales propuesta** (los números en **negrita** son los nuevos; el resto son los de hoy, con otro material):

  | Logro | Papel | Cartón | Madera | Bronce | Plata | Oro | Diamante |
  |---|---|---|---|---|---|---|---|
  | Máximo combo (CAMBIO-008) | 10 | 25 | 50 | 100 | 200 | **300** | **500** |
  | Partidas jugadas (CAMBIO-009) | 10 | 50 | 150 | 500 | 1.500 | **3.000** | **6.000** |
  | Días seguidos de reto diario | 3 | 7 | 14 | 30 | 100 | **200** | **365** |
  | Mejor resultado en un reto diario (%) | 0 | **25** | **50** | **75** | **90** | **95** | **99** |

  Hoy (cinco materiales): combo 10/25/50/100/200 · bloques 100/500/2.000/10.000/50.000 (se quita, CAMBIO-009) · días 3/7/14/30/100 · resultado 0/50/75/90/99.
- **Decisiones que tomé yo y el usuario debe confirmar (los números son provisorios):**
  1. **Máximo combo:** Oro 300 y Diamante 500 son un salto razonable en la escala, pero un combo de 200 ya es una partida casi perfecta y larga; **300 y 500 podrían ser inalcanzables en la práctica**. Revisar con datos reales de jugadores (¿alguien ha pasado de 100?) antes de fijarlos.
  2. **Partidas jugadas:** 3.000 y 6.000 partidas son decenas o cientos de horas; es a propósito (Diamante debe ser muy difícil), pero se puede bajar. Los cinco primeros números son los que propuse en CAMBIO-009.
  3. **Días seguidos de reto diario:** 200 y 365 (un año seguido). Recordar que se perdona 1 día sin jugar por cada 7 jugados.
  4. **Mejor resultado en un reto diario es la excepción a la regla:** es un porcentaje y no puede pasar de 99 ("mejor que el 99 %"), así que **no se pueden crear dos umbrales más altos** que 99. Propuesta: **reparto nuevo** en siete pasos (0 · 25 · 50 · 75 · 90 · 95 · 99). Participar sigue dando el primer material (ahora Papel). Alternativas: dejar este logro con menos materiales (hoy el código exige siempre cinco) o dejarlo como está y que sus materiales corran igual.
- **Dónde implementarlo en el juego (motor y cliente; sin tocar la API ni la base de datos):**
  - `packages/engine/src/achievements.ts`: `ACHIEVEMENT_MATERIALS` pasa a `['Papel', 'Cartón', 'Madera', 'Bronce', 'Plata', 'Oro', 'Diamante']` (~línea 6); `thresholds` deja de ser una tupla de 5 y pasa a una de 7 (~línea 23); los umbrales de `ACHIEVEMENTS` (~líneas 27-30) pasan a los de la tabla de arriba; `achievementMaterial` (~línea 56) y `achievementLevel` ya se adaptan solas al largo de la lista. Actualizar los comentarios ("cinco niveles", "de Madera a Diamante"). `achievementGoal` no cambia (el nivel 1 de `mejorReto` sigue siendo "Participa en un reto diario").
  - `packages/engine/test/achievements.test.ts`: la lista de materiales (~línea 13), los umbrales esperados (~línea 14), los extremos de `achievementMaterial` (`1` → Papel, `7` → Diamante, ~líneas 56-58) y cualquier prueba que asuma 5 niveles (`achievementLevel` máximo 7, `achievementNext`).
  - **El dibujo de la medalla de un logro:** **lo resuelve CAMBIO-011** (cada logro tiene su propio icono en los siete materiales). Ya **no hay que mapear** Papel y Cartón a `{ madera, 1 }` / `{ madera, 2 }` para dibujarlos. Solo queda el color de la barra de progreso por material (`TIER_LOOK[...]` en `CollectionScreen.tsx` ~línea 357), que debe incluir Papel y Cartón.
  - `apps/client/src/game/celebrations.ts`: el tipo `AchievementMaterial` sale del motor, no hay más que revisar; verificar que las claves `ach:<id>:<nivel>` con nivel 6 y 7 se aceptan en `celebrationFromKey` (usa `achievementMaterial`, que ya las acepta).
  - Tests del cliente: `celebrations.test.ts`, `celebrationQueue.test.ts` (casos con niveles de logro y sus materiales).
  - Docs al aplicar: `docs/reglas-y-balance.md` (~línea 154, tabla de logros), `docs/plan-jugabilidad.md` (§5.3, "logros de cinco niveles" → siete), `docs/arquitectura.md` (~línea 25) y la decisión en `docs/historia-y-decisiones.md`.
  - **Orden de aplicación:** va después de CAMBIO-005 (que crea Papel y Cartón) y conviene junto con CAMBIO-008 y CAMBIO-009 (los tres tocan `achievements.ts`).
- **Qué NO cambia:** la API, `UserStats`, el cálculo de los valores (combo, partidas, días, porcentaje), los rankings, `RULES_VERSION` y las claves `tb_*`. Ningún premio del catálogo depende de los logros (revisado en `catalog.ts`).
- **Efecto en los jugadores (importante, aprobar expresamente):**
  - **Todos "bajan" de material** en los logros que ya tenían, porque el mismo número ahora vale un material menos: con combo 100, hoy Oro, pasaría a Bronce; con combo 200, hoy Diamante, a Plata; con 10, hoy Madera, a Papel. No se pierde ningún progreso real (los logros se recalculan desde las estadísticas y no se guarda nada como "ganado"), pero **es una bajada visible** y quien tenía Diamante deja de tenerlo.
  - Al subir un material después, la celebración sale con el material nuevo (Papel/Cartón al principio; Oro y Diamante más lejos).
  - El punto de novedad de la Colección (`lib/collectionScore.ts`) cuenta los niveles de logro de cada uno: el nivel numérico de cada logro no cambia, solo su material, así que ese número **no baja** (salvo lo ya anotado en CAMBIO-009 por el logro que se reemplaza). Verificarlo con un test.
  - Si se prefiere **no bajar a nadie**, la alternativa es la contraria: los números viajan con su material (Madera 10, Bronce 25, Plata 50, Oro 100, Diamante 200 se quedan igual) y Papel y Cartón reciben **dos umbrales nuevos más bajos** (p. ej. combo 3 y 5). Es lo que menos cambia para quien ya juega. Anotada por si el usuario la prefiere; lo pedido por él es lo de arriba.
- **Cómo verlo en esta carpeta:** en la tabla de Logros, con el interruptor en "Con cambios", aparecen siete columnas (Papel y Cartón con el dibujo nuevo, Madera con la estrella); los umbrales nuevos y las columnas Papel y Cartón se resaltan en celeste y el pie lo explica. Con "Ahora" vuelven las cinco de hoy. En pantallas angostas la tabla se desliza de lado.

---

## CAMBIO-011 · Cada logro tiene su propio icono, en los siete materiales (ya no usa las insignias)

- **Estado:** propuesto (2026-11-20). Los diseños los hace el subagente de diseño contra este encargo; lo que entregue se anota abajo, en "Diseños entregados". **Rediseñado el 2026-11-24 por pedido del usuario:** los iconos pasaron de siluetas sueltas a **medallas hexagonales con el símbolo dentro**, y la copa se cambió por una diana con flecha (ver "Diseños entregados").
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** hoy un logro se dibuja con **la misma medalla redonda que las insignias** (`TierBadge` con `tier: material.toLowerCase()`, `step: 1` y una estrella): un logro "Plata" se ve como la insignia Plata. En su lugar, **cada logro tiene un icono propio**: una **medalla hexagonal** (la insignia es redonda, así que no se confunden) **con el símbolo del logro dentro**, y ese icono se dibuja en **los siete materiales** (Papel, Cartón, Madera, Bronce, Plata, Oro, Diamante; ver CAMBIO-010). El icono dice **qué logro es**; el material dice **hasta dónde llegó** el jugador.
- **Por qué:** pruebas con usuarios. La insignia se gana por la **partida más larga**; los logros se ganan por **otras estadísticas**, pero se dibujan igual (mismo disco, mismos materiales, mismos colores), y los jugadores los confunden: no entienden que son dos progresos distintos.
- **Los cuatro iconos (decisión del usuario, 2026-11-20):**

  | Logro (id interno) | Símbolo dentro de la medalla hexagonal | Archivo |
  |---|---|---|
  | Máximo combo (`racha`) | **Rayo** | `racha-<material>.svg` |
  | Partidas jugadas (`partidas`) | **Botón de play ▶** | `partidas-<material>.svg` |
  | Días seguidos de reto diario (`diasReto`) | **Calendario con llama** | `diasReto-<material>.svg` |
  | Mejor resultado en un reto diario (`mejorReto`) | **Diana con flecha** (antes una copa; cambio pedido por el usuario el 2026-11-24, no le gustaba la copa) | `mejorReto-<material>.svg` |

  `<material>` = `papel`, `carton`, `madera`, `bronce`, `plata`, `oro`, `diamante`. Cada icono se entrega en **los siete materiales** (28 archivos) más su **estado vacío** (`<id>-vacio.svg`, 4 archivos). Carpeta: `config_logros/logros_iconos/`.
- **Otras decisiones del usuario:** (1) **estado vacío: sí**: mientras el jugador no tiene ni el primer material se ve la **silueta apagada del icono** (como `EmptyMedal` hoy con la insignia), no un disco vacío. (2) **Un solo generador** para todo (`config_logros/herramientas/gen-logros.js`): un símbolo por logro y siete "pieles" de material. (3) **Marco común (2026-11-24):** los cuatro comparten la medalla hexagonal (antes eran siluetas libres, sin marco ni base); lo que cambia entre logros es el símbolo. (4) **Los textos cambian también** (ver abajo).
- **Reglas de diseño (el subagente diseña contra esto):**
  - **No debe confundirse con una insignia.** La insignia es redonda (y Diamante un rombo); el logro es una **medalla hexagonal** (punta arriba y abajo) con **el símbolo del logro dentro** (rayo, play, calendario con llama, diana con flecha). Sin la estrella ni el bloque central de las insignias: el símbolo ocupa el lugar del bloque. El play es un **triángulo redondeado**, no un círculo con un triángulo.
  - **El mismo lenguaje de luz y volumen de las insignias** (ver `ESTILO_INSIGNIAS.md` y `herramientas/`): luz arriba a la izquierda, degradado claro → medio → oscuro, canto oscuro de 0,7, brillo, **sombra dura** negra al 42 % corrida hacia abajo. `viewBox="0 0 100 100"`, sin `transform` ni `filter` (solo `clipPath`), sin imágenes ni fuentes externas.
  - **Los siete materiales deben leerse como la misma escala que las insignias**, con los **mismos colores base**: Papel, Cartón y Madera como en `insignias_nuevas/` (CAMBIO-005); Bronce, Plata, Oro y Diamante como en `insignias/` (`TIER_LOOK` de `apps/client/src/cosmetics/tiers.ts`). La **medalla hexagonal** está "hecha de" ese material (papel con borde dentado, cartón corrugado, madera con remaches, bronce, plata con laurel, oro con corona y cinta, diamante tallado) y el símbolo va en relieve, en un tono contrastado de la misma familia (azul tinta en Papel, nogal en Madera, esmalte azul en Oro…).
  - **Legibilidad a 38 px** (tamaño de la fila de la Colección) y a **74 px** (celebración): son los **únicos tamaños que usa el juego** para un logro (`BADGE_PX.md` = 38 y `BADGE_PX.lg` = 74). Papel y Cartón deben distinguirse entre sí a 38 px, y también Plata de Diamante. Un solo SVG por combinación (no hay versión `-small`: no se usa por debajo de 30 px).
  - **Calendario con llama:** que la llama se lea como llama en los siete materiales (puede conservar un tinte cálido) y que el calendario lleve el material.
  - **Estado vacío:** la misma medalla hexagonal en gris oscuro apagado, con borde punteado y el símbolo apagado (como la tarjeta "Sin insignia" de la web y `EmptyMedal` en `CollectionScreen.tsx`), sin material.
- **Textos (decisión del usuario: sí):** hoy la celebración dice **"¡Logro de Plata!"** (`apps/client/src/game/celebrations.ts` ~línea 293, `title`), que suena a medalla. Pasa a nombrar **el logro y el material**: p. ej. `¡Máximo combo · Plata!` (kicker "Logro nuevo", sub "Racha de 50."). Revisar si el campo `name` del modal es opcional para no repetir el nombre. La etiqueta accesible `Logro ${material}` (`CelebrationModal.tsx` ~línea 139) pasa a `${nombre del logro}, ${material}`. En la Colección la fila ya dice "Máximo combo · Plata": no cambia.
- **Dónde implementarlo en el juego (cliente; sin tocar la API ni el motor, salvo los nombres de CAMBIO-008/010):**
  - Nuevo módulo de dibujo, como `cosmetics/medal.ts` pero para logros (p. ej. `cosmetics/achievementIcon.ts`): devuelve el SVG de `(logro, material)` y del estado vacío, para la web y la app (el mismo `SvgNode` / `MedalImage` de las medallas). Los iconos viven como **SVG propios**, no se derivan de `medalSvg()`.
  - Nuevo componente (p. ej. `components/AchievementIcon.tsx`, hermano de `TierBadge.tsx`) con tamaños 38 y 74.
  - `apps/client/src/screens/CollectionScreen.tsx` (`AchievementRow`, ~líneas 333-368): sustituir `TierBadge` / `EmptyMedal` por el icono del logro (vacío si `level === 0`). El color de la barra (`TIER_LOOK[...]`) pasa a un color por material que incluya Papel y Cartón.
  - `apps/client/src/components/CelebrationModal.tsx` (`PrizeVisual`, caso `achievement`, ~líneas 132-141): el icono del logro a 74 px; quitar el `glyph` de estrella.
  - `apps/client/src/game/celebrations.ts` (`title` de la celebración, ver arriba) y tests (`celebrations.test.ts`).
  - Docs al aplicar: `docs/reglas-y-balance.md` (logros), `docs/arquitectura.md` y la decisión (motivo: pruebas con usuarios) en `docs/historia-y-decisiones.md`.
- **Efecto en los jugadores:** solo visual; no cambia ninguna estadística ni umbral. Resuelve la confusión insignia/logro.
- **Relación con otros cambios:** **simplifica CAMBIO-010**: como el logro ya no se dibuja con la insignia, **no hay que mapear Papel y Cartón a `{ madera, 1 }` y `{ madera, 2 }`**; el icono propio los resuelve. Usa los mismos materiales de CAMBIO-005 y los nombres de CAMBIO-008 / 009. Conviene aplicarlo junto con CAMBIO-010.
- **Cómo verlo en esta carpeta:** con el interruptor en "Con cambios", la tabla de Logros muestra **el icono de cada logro en cada material** (en lugar de las medallas del encabezado) y su medalla vacía al lado del nombre. **Al hacer clic en cualquier icono se abre un modal con toda la familia** (los siete materiales y el estado vacío, a 74 y a 38 px) y con el texto de la celebración, antes y después. Debajo hay además una sección **"Logros en el celular"**: la tarjeta "Logros" de la Colección tal como la dibuja el celular, con un jugador de ejemplo editable; sigue el interruptor (con "Ahora" se ve la de hoy y con "Con cambios" la nueva, una sola a la vez).
- **Diseños entregados** (rediseño del 2026-11-24: medallas hexagonales con el símbolo dentro): los 32 SVG están en `config_logros/logros_iconos/` (`<id>-<material>.svg`, 120 px, `viewBox` 100). Los genera `config_logros/herramientas/gen-logros.js`, que los reproduce idénticos byte a byte. La guía de estilo es `config_logros/ESTILO_LOGROS.md`.
  - **Medalla:** hexágono con una punta arriba y otra abajo, con el mismo lenguaje que las insignias: canto en degradado, borde interior hundido, aro de brillo, medialuna de brillo en la cara, sombra dura al 42 % y contorno oscuro. Mismo lienzo (`viewBox 100`) y misma escala: Papel, Cartón, Madera y Bronce llenan el lienzo como el disco de la insignia; Plata y Oro son más chicos y llevan laurel (y Oro corona de rayos, cinta y rubí), igual que sus insignias.
  - **Símbolos** (relieve en un tono oscuro del material, con brillo en el borde y sombra):
    - **Rayo** (`racha`): rayo de siete puntas con bisel en dos facetas (clara a la izquierda, oscura a la derecha), brillo especular, un resplandor cálido con anillo de energía punteado detrás y tres chispas amarillas (retoque del 2026-11-24).
    - **Play** (`partidas`): botón de reproducir: disco con aro, aro claro fino, fondo hundido y brillo de vidrio, con el triángulo redondeado en relieve (tres facetas, sombra) y un destello en el aro (retoque del 2026-11-24).
    - **Calendario con llama** (`diasReto`): cuerpo y cabecera oscuros, dos anillas claras y la llama encima. La llama conserva siempre su tinte cálido (`#ffc23a` → `#ff7a1a` → `#d93a12`, corazón amarillo).
    - **Diana con flecha** (`mejorReto`, reemplaza a la copa): cuatro anillas (oscura, clara, oscura y centro rojo) con una flecha gruesa clavada en el centro y dos plumas rojas en la cola.
  - **Materiales** (mismas bases que las insignias; la tabla completa está en `ESTILO_LOGROS.md`):
    - **Papel**: hexágono de papel crema con el borde dentado (cinco dientes por lado, como el pirotín de la insignia), cara de hoja de cuaderno (renglones azules, margen rojo) y símbolo en azul tinta.
    - **Cartón**: kraft con el canto corrugado (onda entre dos capas), fibras y canaletas; símbolo en cartón oscuro.
    - **Madera**: tablero de madera con veta y nudo, y un remache de latón en cada una de las seis esquinas; símbolo en nogal.
    - **Bronce, Plata y Oro**: las bandas de color de `medal.ts`, canto estriado y reflejos en diagonal. Plata lleva laurel, 1 destello y símbolo azul marino; Oro lleva corona de laurel, rayos, cinta, rubí arriba, 2 destellos y símbolo en esmalte azul.
    - **Diamante**: gema hexagonal tallada (mesa central y 18 facetas, más claras hacia la luz) en un engaste de platino, con rayos y 3 destellos; símbolo azul profundo.
  - **Estado vacío:** la misma medalla en `#1b1b27` con borde punteado `#5a5a7c` (un poco más claro que antes para que se vea a 38 px), cara `#222234` y el símbolo apagado en `#30304a` con borde fino; sin sombra ni color.
  - **Verificado** a 170, 74, 38 y 22 px sobre `#12121a` y junto a la insignia de Oro (misma escala). A 38 px se distinguen los cuatro símbolos y los siete materiales: Papel (crema con borde dentado) contra Cartón (kraft), y Plata (gris) contra Diamante (azul). La tabla de Logros no muestra imágenes rotas, el modal de familia muestra los siete materiales y el estado vacío, y la tarjeta del celular los muestra a 38 px.
  - **Límites a 22 px:** el símbolo mide casi la mitad de la medalla, así que a 22 px el rayo y el play se leen bien, el calendario se ve como un cuadrado oscuro con una llama y la diana como círculos concéntricos (la flecha se pierde). Cartón y Madera se distinguen sobre todo por el tono. No hace falta arreglarlo: el juego no muestra logros a 22 px.
  - **Decisiones abiertas para el usuario:**
    1. Si la llama debe tomar el color del material, sobre todo en Plata y Diamante. Hoy es siempre cálida, que se lee mejor.
    2. Si el estado vacío debe ser más visible o más apagado a 38 px.
    3. Si la diana debe llevar el centro y las plumas en rojo (hoy, en los siete materiales) o en un tono de la familia del material.
    4. Si Plata y Oro deben ser tan chicos como sus insignias (llevan laurel) o mantener el tamaño de Bronce para que el símbolo se lea más grande.

---

## CAMBIO-012 · Ver en grande y compartir insignias, logros y premios ganados

- **Estado:** propuesto (2026-11-20). Solo está anotado: todavía no se maquetó en la web de esta carpeta.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Sin maqueta; con el comportamiento por defecto B6.
- **Qué (cuatro piezas, todas con el mismo botón de compartir):**
  1. **Logro:** al tocar el **icono de un logro** en la Colección (la fila `AchievementRow`, con su icono de 38 px) se abre una **ventana (modal) que lo muestra en grande**, con su nombre, su material, su meta y el progreso, y un botón **Compartir**.
  2. **Insignia:** al tocar la **medalla de la tarjeta "Insignia"** de la Colección (`TierCard`, hoy a 74 px) se abre una ventana equivalente que la muestra en grande, con su nombre, la partida más larga que la dio y el botón **Compartir**.
  3. **Premio recién ganado:** la ventana de celebración que sale **al terminar una partida** con un premio nuevo (`CelebrationModal`: insignia, logro, paleta, sonido, efecto, fondo) también lleva un **botón con el icono de compartir**, junto a "¡Genial!".
  4. **Compartir con imagen:** lo que se comparte es una **tarjeta con la imagen** del premio (como la tarjeta del resultado de la partida), más un texto y el link del juego.
- **Por qué:** pedido del usuario. Hoy las medallas y los iconos se ven pequeños (22, 38 o 74 px), no se pueden mirar en detalle y **no se pueden compartir**; compartir existe solo para el resultado de la partida (`EndPanel`), el reto diario (`DailyResult`) y la invitación (Perfil). Una insignia o un logro nuevo es justo lo que el jugador quiere mostrar, y cada tarjeta compartida lleva el link del juego: es la forma más natural de que llegue gente nueva.
- **Lo que ya existe y se reutiliza (no hay que inventar el compartir):**
  - `apps/client/src/platform/share.types.ts`: la interfaz `Share` (`prepareCard`, `shareResult`, `shareText`, `copyText`) y los resultados `shared | copied | cancelled | failed`. Implementaciones: `share.web.ts` (la tarjeta se dibuja en un `<canvas>` de 1080 × 1080; usa la Web Share API con archivo y, si no se puede, comparte solo texto o copia al portapapeles) y `share.native.ts` (con `components/ShareCardHost.native.tsx` y `lib/shareCardStore.ts`, que dibujan la tarjeta fuera de pantalla y la capturan a PNG).
  - `ResultCard` ya admite una insignia (`tier`) y se dibuja a 170 px (`SHARE_BADGE` en `cosmetics/medal.ts`, función `drawBadge`).
  - Los textos viven en `lib/shareText.ts` (`resultText`, `inviteText`) y el aviso de "copiado" en `notifyShare` (`EndPanel.tsx`).
- **Dónde implementarlo (solo cliente):**
  - **Tarjeta de premio:** extender `ResultCard` o crear un tipo hermano (p. ej. `PrizeCard`, distinguido por `kind: 'tier' | 'achievement' | 'item'`) y un método `share.sharePrize(card, text, url)` en las dos plataformas. La imagen grande de un **logro** es su icono de CAMBIO-011 (a 170 px o más); la de una **insignia**, `medalSvg()`; la de un **premio cosmético**, su vista previa (paleta 3 × 3, efecto, fondo) o, en una primera versión, solo texto.
  - **Textos nuevos** en `lib/shareText.ts`, siempre en español y con "Touched Block" en inglés, p. ej. "¡Conseguí la insignia Plata en Touched Block! ¿Me superas?" y "¡Logro Máximo combo · Oro en Touched Block!".
  - **Un componente de ventana reutilizable** (p. ej. `components/PrizeModal.tsx`) para los casos 1 y 2: imagen grande, título, subtítulo, botón Compartir y cerrar (tocar fuera o "atrás" en Android). Con el mismo estilo que `CelebrationModal` (tarjeta de 320 px, `C.panel`, borde del color del premio), pero **sin confeti ni rayos**: es una consulta, no una celebración.
  - **`CollectionScreen.tsx`:** el icono de `AchievementRow` (~líneas 344-351) y la medalla de `TierCard` (~línea 98) pasan a ser `Pressable` que abren esa ventana; con `accessibilityLabel` como "Ver la insignia Plata en grande" y "Ver el logro Máximo combo, Oro, en grande".
  - **`CelebrationModal.tsx`** (~líneas 290-301): añadir el botón de compartir junto al botón principal. Debe respetar la pausa anti-toque de la celebración (`CELEBRATION_TAP_GUARD_MS`, 600 ms: toques que venían de la partida) igual que "¡Genial!", y **compartir no debe cerrar la ventana ni pasar a la siguiente** celebración de la cola ("1 de 3"). En la web hay que llamar a `share.prepareCard(...)` al mostrar la celebración, para no perder el gesto del usuario al compartir (así lo hace ya `EndPanel`).
  - **Icono de compartir:** hace falta un icono vectorial pequeño y propio (flecha saliendo de una caja, estilo `TabIcons.tsx`), usado en los tres lugares, con la etiqueta accesible "Compartir".
- **Decisiones que el usuario debe confirmar:**
  1. **Estado vacío:** si el logro todavía no tiene su primer material (icono vacío) o no hay insignia, ¿se puede tocar? Propuesta: sí, la ventana muestra la silueta con "Todavía no lo tienes" y **sin** botón de compartir.
  2. **Qué premios se comparten desde la celebración:** el pedido dice "cuando gano un premio". Propuesta: primero **insignia y logro**, con imagen; **premios cosméticos** (paleta, sonido, efecto, fondo) con una tarjeta sencilla o solo texto; y el aviso del **reto diario** (`feature`) sin botón de compartir.
  3. **"En grande":** propuesta de 170 px en la ventana (el mismo tamaño de la tarjeta de compartir), que cabe en la tarjeta de 320 px; confirmar si se quiere más grande.
  4. **Quién aparece en la tarjeta:** como en la tarjeta del resultado, el usuario solo si tiene cuenta (es público); un invitado comparte sin nombre.
- **Qué NO cambia:** la API, el motor, las estadísticas, los umbrales y los rankings; no toca `RULES_VERSION` ni las claves `tb_*`. No se comparte ningún dato nuevo (solo lo que ya muestra la tarjeta del resultado: nombre de usuario público, si lo hay), así que **no cambia la política de privacidad**; confirmarlo al aplicarlo.
- **Pruebas y docs al aplicar:** tests de los textos nuevos (`shareText`) y de la tarjeta; probar en web y en Android con la hoja de compartir real; actualizar `docs/arquitectura.md` (compartir) y anotar la decisión en `docs/historia-y-decisiones.md`.
- **Relación con otros cambios:** depende de **CAMBIO-011** (iconos de logro, que se muestran en grande y se dibujan en la tarjeta) y de **CAMBIO-005** (diseños nuevos de Papel, Cartón y Madera para la insignia). Conviene aplicarlo después de ellos, porque usa sus imágenes.
- **Cómo verlo en esta carpeta:** todavía no hay maqueta. Si el usuario la pide, se agregaría con el interruptor "Con cambios": el icono del logro y la medalla de la insignia abrirían la ventana grande, y la celebración mostraría el botón de compartir.

---

## CAMBIO-013 · 8 retos del día nuevos (ciclo de 15 días)

- **Estado:** propuesto (2026-11-23), con las decisiones del usuario ya tomadas (ver abajo). Solo está anotado y maquetado en la web de esta carpeta (interruptor "Con cambios"); el juego no se tocó.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Rige desde el 2026-12-07.
- **Qué:** hoy el reto del día tiene **7 retos**, uno por día de la semana, y se repiten igual cada semana (lunes y domingo son los dos "Partida normal", así que solo hay 6 distintos). Se **agregan 8 retos nuevos** y el calendario deja de depender del día de la semana: pasa a ser un **ciclo de 15 días** que se cuenta desde un lunes fijo y, al terminar, **vuelve a empezar**. Los días 1 a 7 del ciclo son los 7 retos de hoy (en el mismo orden); los días 8 a 15 son los nuevos. En la web, junto al título "Retos" hay un contador que cambia entre "7 retos" (Ahora) y "15 retos" (Con cambios).
- **El ciclo (día 1 = lunes 7 de diciembre de 2026):**

| Día del ciclo | Reto | `mods` (los que ya tiene `GameMods`) |
|---|---|---|
| 1 | Partida normal | `null` |
| 2 | Directo a las sumas | `{ startAt: ADD_START }` |
| 3 | Solo 3 vidas | `{ lives: 3 }` |
| 4 | Solo multiplicaciones y divisiones | `{ only: 'mul', startAt: MUL_START }` |
| 5 | Sin trampas rojas | `{ noRed: true }` |
| 6 | Directo a las multiplicaciones | `{ startAt: MUL_START }` |
| 7 | Partida normal | `null` |
| 8 | **Solo 4 vidas** (nuevo) | `{ lives: 4 }` |
| 9 | **Solo números** (nuevo) | `{ only: 'num' }` |
| 10 | **Solo sumas y restas** (nuevo) | `{ only: 'add' }` (parte en las más fáciles, "1+1") |
| 11 | **Sumas sin trampas rojas** (nuevo) | `{ startAt: ADD_START, noRed: true }` |
| 12 | **Solo 2 vidas** (nuevo) | `{ lives: 2 }` |
| 13 | **Multiplicaciones con 3 vidas** (nuevo) | `{ only: 'mul', startAt: MUL_START, lives: 3 }` |
| 14 | **Directo a la etapa final** (nuevo) | `{ startAt: LIFE_STAGE_START }` (350 s: sale de todo y los bloques viven 4 s, bajando a 1 s) |
| 15 | **Una sola vida** (nuevo) | `{ lives: 1 }` |

  Los nuevos van de más fáciles a más duros. Como el ciclo mide 15 días y no 7, **el reto ya no cae siempre en el mismo día de la semana**: el día 16 es el día 1 otra vez (martes 22 dic 2026), y así sigue. Son 14 retos distintos en 15 días (solo "Partida normal" aparece dos veces, en los días 1 y 7).
- **Decisiones del usuario (cerradas, 2026-11-23):**
  1. La dificultad de "Una sola vida" y "Directo a la etapa final" **está bien**.
  2. Se **agrega "Solo 4 vidas"** (por eso son 8 nuevos y no 7).
  3. El orden lo elige quien implementa: se contó desde un lunes y se repite (el de la tabla de arriba).
  4. **Fecha de inicio: lunes 2026-12-07**, es el día 1 del ciclo. Queda así y de ahí se cuenta. Si el cambio no alcanza a publicarse antes de esa fecha, **no se mueve el ciclo hacia atrás**: se elige el siguiente lunes y se actualiza esta fila y `RETO_INICIO_CICLO` en `script.js`.
  5. **Los retos nuevos no incluyen un día "Partida normal"** (los dos que hay son los de hoy).
- **Por qué:** pedido del usuario. Con 7 retos que se repiten, a la segunda semana el jugador ya los conoce todos; con 15 hay más variedad y más razones para volver cada día. No requiere reglas nuevas del motor: son combinaciones de modificadores que ya existen y ya están validados (`validateMods`, `game.ts`).
- **Dónde implementarlo:**
  - `packages/engine/src/daily.ts`: agregar `DAILY_CYCLE_FROM = '2026-12-07'` y una lista `DAILY_CYCLE` de 15 entradas (las 7 de `DAILY_CALENDAR` + las 8 nuevas). `dailyModsFor(fecha)`: si la fecha es **anterior** a `DAILY_CYCLE_FROM`, usa `DAILY_CALENDAR[weekdayOf(fecha)]` como hoy; si no, `DAILY_CYCLE[(dayIndex(fecha) − dayIndex(DAILY_CYCLE_FROM)) mod 15]`. Aritmética entera, sin `Date`, como el resto del archivo. Usar las constantes `ADD_START`, `MUL_START`, `LIFE_STAGE_START` y `DAILY_FEW_LIVES` (no escribir los números a mano).
  - **Importante, no cambiar el pasado:** la API valida cada partida de reto repitiéndola con los modificadores de **su fecha** (`apps/api/src/daily/daily.service.ts:120`, `dailyModsFor(date)`), y el cliente también (`apps/client/src/lib/daily.ts:111`). Por eso las fechas anteriores a `DAILY_CYCLE_FROM` deben seguir dando exactamente lo de hoy: si no, las partidas ya jugadas y el resumen de ayer dejarían de coincidir.
  - Tests: `packages/engine/test/daily.test.ts` (líneas ~108-124: la semana y la copia) y `packages/engine/test/mods.test.ts` (~línea 320, que valida los `mods` de todo `DAILY_CALENDAR`: debe incluir también el ciclo). Casos nuevos: un día antes de `DAILY_CYCLE_FROM` (calendario de hoy), el día 1, el día 15, el día 16 (vuelve al 1) y que un lunes y un domingo del primer ciclo coinciden con hoy.
  - Docs: tabla de `docs/reglas-y-balance.md` (~línea 125), `docs/api.md` (~línea 906: "calendario por día de la semana" deja de ser cierto), `docs/arquitectura.md` (línea de `daily.ts`) y `docs/historia-y-decisiones.md`.
- **Qué más afecta:**
  - **Misiones:** `apps/client/src/lib/missions.ts` y la API cuentan la racha y la duración de la partida del reto para las misiones solo si ese día **no tiene modificadores** (`plainDaily`). Con el ciclo, los días sin modificadores son 2 de 15 (días 1 y 7), antes eran 2 de 7: las misiones de racha y de duración rinden menos a través del reto. Sigue sirviendo para "Juega el reto del día", partidas y bloques.
  - **Textos que dicen "cada semana" o "cada día de la semana"** (tarjeta del reto, tutorial, landing): revisarlos al aplicar.
  - Rankings, récords y claves `tb_*`: **no cambian**. Las partidas de reto no cuentan para el ranking general ni el récord (D6). Cada reto sigue teniendo su ranking del día. No sube `RULES_VERSION`.
- **Qué NO cambia:** los 7 retos de hoy, las reglas del reto (5 vidas salvo el reto que las cambie, 3 intentos con cuenta y 1 de invitado, racha de días con perdón), la numeración del reto (#1 = 12 nov 2026) y el motor de juego.
- **Relación con las misiones:** los retos nuevos (`DAILY_CYCLE_FROM`) y las misiones nuevas de CAMBIO-014 y CAMBIO-015 (`MISSIONS_POOL_FROM`) arrancan **el mismo lunes 2026-12-07**; si se corre uno, se corren los dos.
- **Cómo verlo en esta carpeta:** sección "Retos". Con el interruptor en "Con cambios" el contador pasa de "7 retos" a "15 retos", las tarjetas se llaman "Día 1 de 15" … "Día 15 de 15" (los 8 nuevos con borde celeste y la marca "nuevo") y las reglas suman una fila "Calendario".

---

## CAMBIO-014 · Misión "Sigue a un jugador hoy"

- **Estado:** propuesto (2026-11-23), por decisión del usuario. Solo está anotado y maquetado en la web de esta carpeta (interruptor "Con cambios"); el juego no se tocó. La misión **"Invita a alguien" queda para más adelante** (no descartada): ver la sección "Pendiente para más adelante" al final de esta entrada. No está maquetada.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Rige desde el 2026-12-07; "Invita a alguien" sigue pendiente.
- **Qué:** se agrega al pool de misiones del día una misión nueva, **"Sigue a un jugador hoy"**: tipo nuevo "Seguir a un jugador" (`follow`), meta 1, premio **+20 bloques extra** para el nivel (como las misiones más fáciles). Se cumple al **empezar a seguir a alguien ese día**. **Solo se puede cumplir con cuenta** (un invitado no puede seguir a nadie), **pero se sortea y se ve igual para todos**: `missionsFor(fecha)` es idéntico para cualquiera. A un **invitado** se le muestra **bloqueada**, con el texto exacto **"Crea tu cuenta para desbloquearla"**, y al tocarla lo lleva a crear la cuenta (decisión del usuario, 2026-11-23; ver "Consecuencias de mostrarla bloqueada a invitados"). El pool pasa de 13 a 14 misiones (28 con CAMBIO-015); siguen saliendo 3 por día. En la web, la sección "Misiones" cambia el contador "Misiones posibles" de 13 (Ahora) a 28 (Con cambios) y muestra la fila nueva con borde celeste, la marca "nuevo" y un selector "Ver como: con cuenta | invitado" que solo cambia esa fila.
- **Por qué:** pedido del usuario. Seguir a otros jugadores ya existe; una misión es una forma suave de empujar al jugador a usar el lado social (perfiles públicos, rankings). Premio chico para que no distorsione el nivel.
- **Lo que ya existe (hechos verificados en el código):**
  - **Seguir:** modelo `Follow` (`apps/api/prisma/schema.prisma:277-287`) con `followerId`, `followeeId` y `createdAt`; clave primaria `(followerId, followeeId)`. Endpoints `POST` y `DELETE /follows/:userId` (`apps/api/src/social/social.controller.ts:37-46`). `follow()` (`social.service.ts:47-56`): sin aceptación, no se puede seguir a uno mismo (`follow_self`), respeta bloqueos (`user_blocked`, `follow_blocked`) y es idempotente (`createMany` con `skipDuplicates`). **`unfollow()` borra la fila** (`social.service.ts:79-81`): no queda historial.
  - **Dónde se sigue hoy en el cliente:** `PublicProfileScreen.tsx:48-49` y `ProfileScreen.tsx:470-471` (botón seguir / dejar de seguir). No se revisó el flujo completo para llegar a un perfil.
  - **Misiones:** `MISSION_POOL` con 13 entradas, `MISSIONS_PER_DAY = 3`, `missionsFor(fecha)` y `DayAgg` en `packages/engine/src/missions.ts` (`MissionKind` en la línea 17, pool en 52-66, `missionsFor` en 85-96, `DayAgg` en 99-110, `missionProgress` en 119-141). El servidor arma `DayAgg` en `apps/api/src/missions/missions.service.ts:33-49` (`dayAgg`, hoy solo consulta `Run`) y premia en `:55-73`; el cliente invitado lo arma en `apps/client/src/lib/missions.ts:28-48` (`dayAggFrom`, solo historial local).
  - **El premio se da una sola vez por usuario, fecha y misión** (`MissionReward`, `missions.service.ts:60-70`) y suma a `bonusXp`, que solo afecta el nivel (cosmético; `docs/historia-y-decisiones.md`, línea 206).
- **Qué pasa con `missionsFor` al agregar una entrada (el punto delicado).** El trío del día sale así (`missions.ts:85-96`): semilla `hashString("misiones:" + fecha)` (FNV-1a), y 3 veces: `candidates[floor(random × candidates.length)]`, quitando después todas las candidatas del mismo `kind`. **El índice depende de `candidates.length`**, así que agregar una entrada, **también al final del pool**, cambia el multiplicador (de 13 a 14) y el resultado de casi todos los días. Simulé el algoritmo exacto (mismo FNV-1a y mulberry32) con 730 días desde el 12 nov 2026:
  - Con la misión nueva al final del pool, el trío **queda idéntico solo en el 13 % de los días** (97 de 730); el primer sorteo coincide en el 52 %. Al principio del pool, solo el 10 %. **Orden en el pool no ayuda.**
  - **Cambian los días pasados y el día de hoy.** Ejemplo real: el 2026-11-12 hoy da `llega5, destruye30, reto` y con 14 entradas daría `llega5, destruye30, sigue`. Lo que ya se cobró no se pierde (`MissionReward` guarda la fecha y el id), pero la pantalla de un día pasado mostraría otras misiones, y **un cliente viejo (APK ya repartido, web en caché) y la API nueva calcularían tríos distintos para el mismo día**.
  - **Hace falta una fecha de inicio**, igual que en CAMBIO-013 (`DAILY_CYCLE_FROM`). Y se confirma un efecto en el test del motor: `packages/engine/test/missions.test.ts:71-74` fija `missionsFor('2026-11-12')`; sin fecha de inicio ese test se rompería (con ella no).
  - **Sale ~1 de cada 4 días:** en la simulación, `sigue` cae en 190 de 730 días (26 %).
- **Recomendación (la solución más segura):**
  1. **Fecha de inicio** `MISSIONS_POOL_FROM = '2026-12-07'` en `missions.ts` (nombre propuesto; en la web, `MISIONES_INICIO_POOL`). Antes de esa fecha, `missionsFor` usa **exactamente el pool de hoy (13 entradas, mismo orden, mismo algoritmo)**: ningún día pasado ni de hoy cambia. Desde esa fecha usa el pool completo (28 con CAMBIO-015). `MISSION_POOL` tiene todas (las nuevas al final) y `missionsFor` filtra las nuevas si la fecha es anterior. Comparar con `dayIndex`, aritmética entera, como el resto del motor.
  2. **Qué fecha (cerrada):** **lunes 2026-12-07**, el mismo día que arranca el ciclo de retos de CAMBIO-013. Ese día el listado pasa de 13 a 28 misiones (CAMBIO-014 y CAMBIO-015 entran juntos). La fecha debe quedar al menos 2 días después de publicar, porque el servidor acepta fechas de UTC−12 a UTC+14 (`apps/api/src/common/dates.ts`, `isWithinDateWindow`). Si no se alcanza a publicar antes, **no se mueve hacia atrás**: se elige el **siguiente lunes para retos y misiones a la vez** (`DAILY_CYCLE_FROM` y `MISSIONS_POOL_FROM` cambian juntas).
  3. **Invitados (decidido): `missionsFor(fecha)` no cambia de firma ni distingue entre cuenta e invitado.** El trío es el mismo para todos, así que se mantiene el determinismo cliente/servidor y no hay segundo sorteo. La diferencia está solo en cómo se **dibuja** la misión `follow` cuando no hay sesión: bloqueada, con "Crea tu cuenta para desbloquearla" (ver "Dónde implementarlo" y "Consecuencias…"). Esto **reemplaza** el plan anterior (descartar `follow` y sortear otra para los invitados).
  4. **Invitados: nunca se cumple ni se premia localmente.** Como invitado `followedToday` es siempre `false`, así que la fila no avanza, y la rama de premios del invitado (`rewardMissions`, `lib/missions.ts:93-101`) no la premia.
- **Dónde implementarlo:**
  - `packages/engine/src/missions.ts`: `MissionKind` suma `'follow'` (y su comentario); entrada `{ id: 'sigue', kind: 'follow', target: 1, title: 'Sigue a un jugador hoy', reward: 20 }` al **final** de `MISSION_POOL` (no cambiar el orden ni los ids existentes); `MISSIONS_POOL_FROM` (la firma de `missionsFor(fecha)` **no cambia**); campo nuevo en `DayAgg` (`followedToday: boolean`) y un `case 'follow'` en `missionProgress` (`value = agg.followedToday ? 1 : 0`). Sin `Date` ni `Math` raro.
  - `apps/api/src/missions/missions.service.ts` (`dayAgg`, línea 33): una consulta más en el `Promise.all`: `follow.count` con `followerId = userId` y `createdAt` entre `start` y `end` (los mismos que ya calcula `localDayStart(date, tz)`, así usa la misma zona horaria que el resto de las misiones). `followedToday: count > 0`.
  - `apps/client/src/lib/missions.ts` (`dayAggFrom`, línea 31): `followedToday: false` (un invitado no puede seguir). `guestMissions` y `missionViews` siguen llamando a `missionsFor(fecha)` sin cambios.
  - Cliente, fila bloqueada: `MissionList.tsx` (variante `home`, filas en `:51-65`) hoy no usa `kind` ni sabe si hay sesión. Habría que pasarle si el jugador es invitado (`useViewer().loggedIn`, ya lo usa `useTodayMissions`, `dailyHooks.ts:69`) y, para una misión `follow` de un invitado: atenuar la fila, mostrar un candado en vez de "0/1", el texto "Crea tu cuenta para desbloquearla" y volverla un `Pressable` que lleve a **`router.navigate('/perfil')`**, que es donde ya está el inicio de sesión (`ProfileScreen.tsx:765-772`, sección "Cuenta" con `LoginOptions`) y el mismo gesto que usa la Colección (`CollectionScreen.tsx:422`) y Rankings (`RankingsScreen.tsx:278`). `doneCount` y el contador `hechas/total` (`:44-49`) siguen igual. No cambia `MissionView`. `accessibilityLabel` de la fila: "Sigue a un jugador hoy: bloqueada, crea tu cuenta para desbloquearla".
- **Qué más afecta:**
  - **Tests:** `packages/engine/test/missions.test.ts` (`:57` tipos distintos y `:68` "con el tiempo aparecen todas" siguen valiendo; agregar: fechas anteriores a `MISSIONS_POOL_FROM` idénticas a hoy (fijar varias, no solo `:73`), el primer día desde la fecha, y el avance de `follow`; que un invitado nunca cumple ni premia `follow`); `apps/client/src/lib/missions.test.ts` (`:49`, `:54`, `:66`, comparan `dayAggFrom` con `toEqual`: suman `followedToday: false`; y los `DayAgg` de `:79`, `:101`, `:126`, `:138`); `apps/api/src/missions/missions.service.spec.ts:52` y `apps/api/test/missions.e2e-spec.ts:114-122` (`DayAgg` completo, más un caso con y sin follow ese día).
  - **Docs al aplicar:** `docs/reglas-y-balance.md` (tabla de misiones, línea ~144: fila "Seguir a un jugador, solo con cuenta (20)" y la fecha de inicio), `docs/api.md` (tabla de `DayAgg` de la línea ~1007: fila `followedToday`; el ejemplo de `kind` no lista tipos, así que el contrato JSON no cambia, solo hay un `kind` nuevo posible), `docs/arquitectura.md` (línea de `missions.ts`) y `docs/historia-y-decisiones.md` (por qué la fecha de inicio y el trato a los invitados).
  - **Privacidad:** `apps/landing/public/privacidad/index.html:148-149` ya declara que se guarda "a quién sigues" para calcular invitaciones y corazones, y `:242` dice que esas listas no son públicas. Ahora además se usa para **calcular misiones**: revisar el texto al aplicar y agregar "y las misiones del día" (no hay dato nuevo, solo un uso nuevo). Confirmarlo.
  - **Clientes viejos:** ver 4c en "Consecuencias de mostrarla bloqueada a invitados".
- **Riesgos y cómo quedan:**
  1. **Cuentas falsas** (login con Google): pueden cumplirla en segundos. El premio es chico (+20), una sola vez por día y misión, y solo suma `bonusXp` (nivel cosmético); no toca rankings, récords ni `RULES_VERSION`. Se acepta.
  2. **Quitar y volver a poner el follow:** la fila se borra y se recrea con otra `createdAt`, así que el jugador puede "cumplirla" siguiendo de nuevo a alguien que ya seguía. Contar "seguidos distintos hoy" **no lo evita** (la clave es `(seguidor, seguido)`, solo hay una fila por pareja). Como el premio es único por usuario, fecha y misión, no se multiplica: el abuso máximo es +20 en cada día en que sale (~1 de cada 4). **Recomendación: aceptarlo**, por el premio chico. Evitarlo de verdad exigiría una tabla de historial de seguimientos.
  3. **Seguir por invitación cuenta sin querer (decidido: se excluye).** `setInviter` (`social.service.ts:32-38`) crea **dos** seguimientos al instante, con la fecha de hoy: el del invitado hacia quien lo invitó y el de quien invitó hacia el invitado. Sin filtro, **quien invitó cumpliría la misión sin hacer nada** el día en que alguien pone su nombre en "¿Quién te invitó?". Cómo se excluye: ver "Decisiones cerradas".
  4. **Quien ya sigue a todos los que puede:** la misión pide un seguimiento **nuevo** hoy. No es un problema real (basta seguir a cualquiera que aún no se siga), pero conviene que el jugador sepa dónde.
  5. **Acoso por "seguir a cualquiera":** las listas de seguidores y seguidos no son públicas (`privacidad/index.html:242`) y no hay aceptación ni aviso de que alguien te siguió; el incentivo de la misión no crea ningún canal nuevo hacia otros jugadores. (Solo leído el código del servidor; no se revisó si el cliente muestra el número de seguidores en algún lado.)
- **Decisiones cerradas (usuario, 2026-11-23):**
  1. **Premio +20: de acuerdo.** (El tope de la prueba del motor es 60, `missions.test.ts:25`, así que cabe.)
  2. **Quitar y volver a seguir: aceptado.** El premio es único por usuario, fecha y misión (`MissionReward`), así que el abuso máximo es +20 los días en que sale.
  3. **Los seguimientos que vienen de una invitación NO cuentan.** Cómo implementarlo, la forma más simple tras leer `social.service.ts` (sin migración):
     - `follow()` (`:47-56`) y `setInviter()` (`:32-38`) escriben la misma fila `Follow` y la tabla **no dice de dónde vino**; lo único que distingue una invitación es el campo `User.invitedById` (que `setInviter` fija en `:24-27`).
     - En `dayAgg`, leer primero `invitedById` del jugador y contar solo los `Follow` del día con `followerId = userId` que **no** sean hacia su `invitedById` (el del invitado hacia quien lo invitó) **ni** hacia alguien cuyo `invitedById` sea el jugador (el de quien invitó hacia el invitado). En Prisma: `followeeId: { not: me.invitedById }` (solo si no es null) y `NOT: { followee: { invitedById: userId } }`.
     - **Qué se pierde:** seguir a propósito a tu invitador o a tu invitado no cuenta para la misión (aceptable).
     - **Ojo al aplicarlo (no probado):** en SQL, `<>` y `NOT` descartan las filas con `NULL`; como `invitedById` casi siempre es `NULL`, hay que escribir el filtro como `OR: [{ invitedById: null }, { invitedById: { not: userId } }]` dentro de `followee` y cubrirlo con un test e2e (usuario sin invitador, con invitador y con invitado).
     - **Alternativa más exacta pero con migración:** una columna `source` en `Follow` (`'manual' | 'invite'`), escrita por `setInviter` y leída por `dayAgg`. Solo conviene si más adelante se quiere distinguir también en otros lugares; hoy no hace falta.
  4. **NO se agrega una tabla "el servidor guarda el trío del día"** (fecha → tres misiones). Solo se haría si fuera muy necesario y no lo es: la fecha de inicio resuelve que los días pasados no cambien, y evita una migración y un endpoint nuevos.
  5. **Al tocar la fila bloqueada se lleva al Perfil** (`router.navigate('/perfil')`, donde ya está el inicio de sesión), **sin** abrir una hoja de login en la misma pantalla (decidido por el usuario, 2026-11-24). Es lo más simple y no necesita código nuevo de login; el invitado vuelve al inicio a mano.
  5. **Fecha de inicio: lunes 2026-12-07**, la misma de CAMBIO-013. Si no se alcanza a publicar antes, no se mueve hacia atrás: se elige el siguiente lunes para retos y misiones a la vez. Constante propuesta `MISSIONS_POOL_FROM` (detalle en la recomendación 1 y 2).
  6. **Los invitados no pierden nada:** ni retos ni misiones se ocultan. La misión se muestra **bloqueada** con "Crea tu cuenta para desbloquearla" y lleva a crear la cuenta. Esto cierra el debate "retos y misiones solo con cuenta" **sin ocultar nada**.
- **Qué NO cambia:** las 13 misiones de hoy (ids, metas, premios), los tríos de todos los días anteriores a la fecha de inicio, las misiones por día (3), los rankings, los récords, las claves `tb_*` y `RULES_VERSION`; tampoco el contrato de la API (solo aparece un `kind` nuevo) ni `missionsFor(fecha)` (misma firma, igual para todos). Lo único que cambia en el cliente es cómo `MissionList` dibuja la fila `follow` de un invitado.
- **Consecuencias de mostrarla bloqueada a invitados** (lectura del código; lo que no se probó se marca):
  - **4a. Qué pasa con lo que el invitado ya jugó ese día al crear la cuenta.** *No se sube su historial.* La API no tiene ningún endpoint para importar partidas locales: los únicos `POST` de juego son `runs`, `runs/:id/finish` y `runs/:id/claim` (`apps/api/src/runs/runs.controller.ts:14,21,29`). `tb_hist5` (historial) y `tb_miss1` (misiones premiadas) se quedan solo en el dispositivo. Lo que sí pasa:
    - **Partidas del reto de invitado:** al iniciar sesión se reclaman solas si terminaron hace menos de 1 h (`useClaimPendingDaily`, `apps/client/src/api/dailyHooks.ts:117-148`; `pendingDailyClaims`, `lib/daily.ts:386-393`; `CLAIM_WINDOW_MS` = 1 h, `apps/api/src/runs/runs.service.ts:31`), y solo si la cuenta aún no jugó ese reto (`:272-282`). Se asignan a la cuenta (`assign`, `:298-304`) y pasan a contar para sus misiones del servidor, que se calculan solo con filas `Run` de la cuenta (`missions.service.ts:36-41`).
    - **Partida normal recién terminada:** se reclama si estaba en la pantalla final cuando inició sesión (`EndPanel.tsx:152-157` y `:136-150`), con el mismo límite de 1 h. Si se inicia sesión más tarde, **no hay reclamo**.
    - **Estadísticas del dispositivo:** la Colección usa el **máximo** campo a campo entre lo local y lo de la cuenta, no la suma (`lib/stats.ts:163-172`, incluido `bonusXp`). Los bloques extra que el invitado ya cobró en el dispositivo no se pierden, pero tampoco se suman a los de la cuenta; y si el servidor vuelve a premiar la misma misión del mismo día, tampoco se duplica (`docs/historia-y-decisiones.md`, línea 190).
    - **Qué se le promete:** **solo** "Crea tu cuenta para desbloquearla". No prometer "conserva tu progreso de hoy": el progreso de misiones de hoy de un invitado **puede reiniciarse** en la cuenta (las partidas no reclamadas no cuentan en el servidor). Es lo mismo que ocurre hoy con cualquier invitado que inicia sesión; la misión nueva no lo empeora.
  - **4b. Qué ve hoy un invitado y cómo llegar al login.** `MissionList` (variante `home`, `components/MissionList.tsx:42-67`) dibuja las 3 misiones con `hechas/total`, sin distinguir invitado de cuenta, y se muestra a los invitados siempre que el reto y las misiones estén desbloqueados (`GameScreen.tsx:289` y `:789`; la condición es `features.accounts`, no `loggedIn`, `lib/daily.ts:528-529`). Las filas no son tocables hoy. **No hay una función "abrir login" reutilizable**: el login vive en la pantalla `/perfil` (`ProfileScreen.tsx:765-772`, `LoginOptions`), y quien lo pide desde otro lugar hace `router.navigate('/perfil')` (`CollectionScreen.tsx:422`, `RankingsScreen.tsx:278`). La fila bloqueada haría lo mismo; el invitado vuelve a mano al inicio. (Alternativa más cara: abrir `LoginOptions` en una hoja desde la misma pantalla, como ya hace `PlayerMenu.tsx:215`. No es necesario.)
  - **4c. APK viejos.**
    - **Con cuenta, el cliente NO calcula el trío: muestra el que manda el servidor** (`useTodayMissions`, `dailyHooks.ts:68-96`: con sesión usa `server.data?.missions`; `fetchMissions` es un `GET /missions` sin validación de tipos, `api/daily.ts:122-123`). Un cliente viejo que recibe `kind: 'follow'` **no se rompe**: en el cliente el `kind` solo se lee en `progressLabel` (`lib/missions.ts:121-124`, `m.kind === 'reach' ? … : …`), así que `follow` cae en "0/1" o "Lista", y `MissionList` no usa `kind`; no hay `switch` exhaustivo ni etiquetas por tipo. (El `switch` exhaustivo de `missionProgress`, `missions.ts:119-141`, solo corre para invitados, con datos locales.) **El cliente viejo simplemente muestra la misión nueva como cualquier otra y se la puede cumplir.** No probado en un APK real.
    - **Invitado con APK viejo:** calcula el trío con su pool de 13 (`guestMissions`, `lib/missions.ts:104-106`), sin pedirle nada al servidor. Desde el 7 dic ve **otro trío** que el de un cliente nuevo para el mismo día: en la simulación de 730 días desde el 2026-12-07, **el trío de 28 es distinto al de 13 todos los días (0 de 730 coinciden)**. Es **solo cosmético**: cada dispositivo es coherente consigo mismo, los ids no cambian, los premios son locales (`tb_miss1`) y nada se valida contra el servidor. Lo único que se pierde es que "las mismas para todos" deja de ser cierto para quien no actualizó, y no ve la misión de seguir ni las 14 nuevas de CAMBIO-015.
    - **No hace falta forzar la actualización.** Basta la fecha de inicio. (Opinión mía: es un efecto conocido y no justifica bloquear a nadie.)
  - **4d. Cuántos días ve un invitado la misión bloqueada.** Con el pool de **28** (CAMBIO-015) y el algoritmo exacto (FNV-1a + mulberry32), en 730 días desde el 2026-12-07 **`sigue` aparece en el trío en 111 días (15,2 %, algo más de 1 de cada 7)**; en los primeros 90 días, en 13. Máximo 3 días seguidos con ella. **Esos días el invitado tiene 2 de 3 misiones jugables** (las otras dos son de los demás tipos y siempre se pueden cumplir sin cuenta). Los otros 619 días no ve nada bloqueado. Referencia: con 21 eran 122 días (16,7 %). Estimando con muestreo aleatorio (400 000 trios) la frecuencia "de largo plazo" con 28 es ~14,1 %: los 730 días son una muestra y varían ±1,3 puntos. (Cuenta mía con una copia del algoritmo; no se corrió contra el motor real.)
  - **4e. Riesgo de UX: que parezca una trampa para forzar el registro.** Mitigación más simple: (1) **un solo texto honesto**, sin urgencia ni amenaza ("Crea tu cuenta para desbloquearla", sin "pierdes tu premio"); (2) **es solo 1 de 3** y nunca bloquea las otras dos (ver 4d); (3) **premio chico (+20)**, así que no hay sensación de perder algo importante; (4) que **no genere ningún aviso negativo**: la pantalla final solo lista las recién cumplidas (`newlyCompleted`, `lib/missions.ts:111-115`), así que una misión que no se cumple no aparece; (5) no mostrar ventanas emergentes: solo el toque en la fila. Con eso es una invitación, no una puerta cerrada. Opinión mía; no hay datos de retención que lo respalden.
- **Pendiente para más adelante: misión "Invita a alguien".** Por decisión del usuario se pospone, no se descarta, y **no está maquetada**. Motivos: hoy la invitación es **declarativa** (cualquiera escribe un nombre en "¿Quién te invitó?" y se cuenta al instante, sin que el invitado juegue ni nada más), **no hay protección contra cuentas falsas**, y ya da un corazón extra **permanente** (`livesFor`, tope 8; `social.service.ts:12-14, 43-44`), o sea que una misión repetible encima premiaría doblemente un acto fácil de falsear. Antes habría que **exigir que el invitado juegue algo** (por ejemplo, una partida válida terminada) para que la invitación cuente como premiable, y recién ahí mirar una misión.
- **Cómo verlo en esta carpeta:** sección "Misiones". Con el interruptor en "Ahora" el contador "Misiones posibles" dice 13 y no aparece la nueva. En "Con cambios" dice 28 (en celeste: 14 de CAMBIO-014 más las 14 de CAMBIO-015), y después de las 13 de hoy aparece "Sigue a un jugador hoy" con borde celeste, la marca "nuevo", "Seguir a un jugador · meta 1" y "+20". Sobre esa fila hay un selector **"Ver como: con cuenta | invitado"** (solo afecta esa fila): con cuenta se ve normal y con la nota de cómo se cumple; como invitado se ve atenuada, con un candado y el texto "Crea tu cuenta para desbloquearla" en celeste. Tras esa fila siguen las 14 de CAMBIO-015. Una línea bajo el título dice que desde el lunes 7 dic 2026 salen del pool completo y antes del de 13.

---

## CAMBIO-015 · 14 misiones más (de 14 a 28 posibles)

- **Estado:** propuesto (2026-11-23); decisiones cerradas por el usuario el 2026-11-24 (ver "Decisiones cerradas"). Solo está anotado y maquetado en la web de esta carpeta (interruptor "Con cambios"); el juego no se tocó. Va junto a **CAMBIO-014**: 13 de hoy + "Sigue a un jugador hoy" + estas 14 = **28 misiones posibles**.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Rige desde el 2026-12-07.
- **Qué:** se agregan 14 misiones al pool, solo con datos que `DayAgg` ya tiene (`runs`, `killed`, `bestStreak`, `maxTicks`; `packages/engine/src/missions.ts:99-110`). **No hay tipos nuevos, ni campos nuevos en `DayAgg`, ni cambios en la API o en el cliente**: son filas nuevas de `MISSION_POOL` y `missionProgress` ya las sabe calcular. Siguen saliendo 3 por día, de tipos distintos.
- **Aclaración de lo pedido:** el usuario pidió sumar "7 más" para diluir la frecuencia de "Juega el reto del día". Se interpreta como **7 misiones más** (7 + 7 = 14 nuevas), no como retos del día (modificadores de partida): agregar retos de ese tipo no cambiaría cuántos días sale esa misión.
- **Las 14, en el orden en que irían al final de `MISSION_POOL`** (el orden importa para el sorteo; van después de `sigue`):

| # | Misión | Tipo | Meta | Premio | Por qué esta meta |
|---|---|---|---|---|---|
| 1 | Racha de 20 | Racha en una partida | 20 | +40 | Entre "Racha de 15" (+30) y "Racha de 25" (+50). Un combo completo es de 20 (`COMBO_CYCLE`, `constants.ts:63`); el logro "Mejor racha" parte en 10 y 25 (`achievements.ts:27`). |
| 2 | Racha de 40 | Racha en una partida | 40 | +60 | Entre el nivel 2 (25) y el 3 (50) del logro de racha: difícil pero posible; un solo error la reinicia. |
| 3 | Llega al 9 | Llegar a una etapa | 120 s | +40 | El hito del 9 cae en 120 s (`(9 − 3) × NUM_STEP`, `progress.ts:43`), entre "Llega al 8" (100 s, +30) y "Llega a las sumas y restas" (140 s, +50). |
| 4 | Llega a los bloques de 4 s | Llegar a una etapa | 350 s | **+60** | Es la etapa final (`LIFE_STAGE_START` = 350, `constants.ts:31`), la meta de la insignia Oro (`progress.ts:121`): la más difícil que pide una misión (6 min). Con +60 iguala a "Llega a las multiplicaciones y divisiones" (275 s) y no toca el tope de la prueba. |
| 5 | Destruye 90 bloques hoy | Bloques en el día | 90 | +40 | Entre "Destruye 60" (+30) y "Destruye 120" (+50). |
| 6 | Destruye 250 bloques hoy | Bloques en el día | 250 | +60 | Sigue la escalera (120 → +50). Con la cadencia de aparición (`spawnCooldown`, `constants.ts:119`: 0,8 s en promedio al empezar y ~0,55 s desde los 120 s) una partida de 350 s genera como tope teórico unos 600 bloques (cuenta mía; los que se destruyen de verdad son menos), así que 250 se logra en una buena partida o en 2 o 3 normales. |
| 7 | Juega 6 partidas hoy | Partidas en el día | 6 | +30 | **Casi igual a "Juega 5 partidas hoy" (+30)**: pedido del usuario (antes era 8). Ver la nota abajo. |
| 8 | Racha de 30 | Racha en una partida | 30 | +50 | Llena el hueco entre 25 (+50) y 40 (+60). |
| 9 | Racha de 50 | Racha en una partida | 50 | +60 | Es el nivel 3 del logro "Mejor racha" (`achievements.ts:27`): la meta de racha más alta del pool; el corazón de recuperación aparece cada 25 (`HEART_COMBO`, `constants.ts:75`) y ayuda a sostenerla. |
| 10 | Llega al 7 | Llegar a una etapa | 80 s | +30 | El hito del 7 cae en 80 s (`(7 − 3) × NUM_STEP`, `progress.ts:43`), entre "Llega al 5" (40 s, +20) y "Llega al 8" (100 s, +30). |
| 11 | Destruye 180 bloques hoy | Bloques en el día | 180 | +50 | Entre "Destruye 120" (+50) y "Destruye 250" (+60). |
| 12 | Destruye 400 bloques hoy | Bloques en el día | 400 | +60 | Del orden de dos buenas partidas largas (mismo tope teórico por partida que arriba, ~600); es la meta de bloques más alta. |
| 13 | Juega 10 partidas hoy | Partidas en el día | 10 | +40 | Sigue a "Juega 5" y "Juega 6" (+30); `runs` cuenta también las del reto. |
| 14 | Juega 15 partidas hoy | Partidas en el día | 15 | +50 | Meta de constancia, la más alta de partidas. |

  **Escalera de premios:** +20 / +30 / +50 / +60, más **+40** (ya existía en "Juega el reto del día"). **Tope 60**, así que **no se toca la prueba del motor** (`missions.test.ts:25` pide de 20 a 60). **No medí cuántos bloques o partidas hace un jugador real por día, ni cuánto dura una partida promedio:** las metas de 250 y 400 bloques y de 10 y 15 partidas son estimaciones; conviene mirar el historial real (`k` y partidas por día) antes de aplicar.
- **Entradas por tipo con las 28** (el sorteo elige entre entradas, así que esto reparte la frecuencia): Racha **7** (10, 15, 20, 25, 30, 40, 50) · Llegar a una etapa **7** (al 5, al 7, al 8, al 9, sumas y restas, multiplicaciones y divisiones, bloques de 4 s) · Bloques en el día **7** (30, 60, 90, 120, 180, 250, 400) · Partidas en el día **5** (3, 5, 6, 10, 15) · Reto del día **1** · Seguir a un jugador **1**. Ningún tipo domina: los cuatro principales quedan entre 5 y 7.
- **Por qué:** pedido del usuario: más variedad, que las mismas misiones no se repitan tan seguido y que "Juega el reto del día" salga menos; y metas más altas para quien ya llega lejos (hoy la más difícil es la de 275 s).
- **Dónde implementarlo:**
  - `packages/engine/src/missions.ts`: 14 entradas al **final** de `MISSION_POOL` (después de `sigue` de CAMBIO-014; no cambiar el orden ni los ids existentes): `racha20`, `racha40`, `llega9` (`reach('llega9', milestone('num', 9), 40)`), `llegaFinal` (`reach('llegaFinal', milestone('life', LIFE_STAGE_FIRST), 60)`: el nombre del hito sale de `MILESTONES` y el título queda "Llega a los bloques de 4 s"), `destruye90`, `destruye250`, `juega6`, `racha30`, `racha50`, `llega7` (`milestone('num', 7)`), `destruye180`, `destruye400`, `juega10` y `juega15`. Usar las constantes del motor, no números sueltos, para las metas de tiempo.
  - `packages/engine/test/missions.test.ts`: **no hay que subir ningún tope** (`:25` sigue valiendo: todas entre 20 y 60). `:22` (al menos 10), `:45` (una sola de reto) y `:68` ("con el tiempo aparecen todas" en 730 días) **se espera que sigan valiendo**: en mi simulación aparecen las 28 y la menos frecuente ("Destruye 60 bloques hoy") sale 60 días de 730; no lo corrí contra el motor real. Agregar los casos de las nuevas en el avance.
  - Nada en la API ni en el cliente (`MissionList.tsx`, `lib/missions.ts`): no enumeran misiones. El título más largo sigue siendo "Llega a las multiplicaciones y divisiones".
  - Docs al aplicar: `docs/reglas-y-balance.md` (tabla de misiones, líneas ~144-150) y `docs/historia-y-decisiones.md`.
- **Efecto en el sorteo de `missionsFor` (se resuelve junto con CAMBIO-014, fecha cerrada: lunes 2026-12-07, `MISSIONS_POOL_FROM`):** al cambiar el tamaño del pool cambia el trío de casi todos los días, igual que se explicó en CAMBIO-014 ("Qué pasa con `missionsFor`…"). Con el pool de 28 simulé los 730 días desde el 2026-12-07: **ningún día (0 de 730) queda igual que con las 13 de hoy**. Por eso la **fecha de inicio** debe cubrir las dos cosas: **una sola fecha** a partir de la cual rige el pool de 28 y antes de la cual rige el de 13 de hoy. No se repite aquí la recomendación: ver CAMBIO-014, sección "Recomendación" (fecha cerrada: lunes 2026-12-07, junto con los retos de CAMBIO-013). **Ojo:** como el orden de las entradas cambia el sorteo, el orden de la tabla de arriba es parte del cambio; si se reordena, hay que volver a simular.
- **Cambia la frecuencia de cada misión (cuenta mía con la copia exacta del algoritmo; "Hoy" son 730 días desde el 2026-11-12 y "Con 28" 730 días desde el 2026-12-07):**

| Misión o tipo | Hoy (13) | Con 28 |
|---|---|---|
| Algún "Llegar a una etapa" | 80 % de los días | 74 % |
| Algún "Bloques en el día" | 70 % | 68 % |
| Alguna racha | 67 % | 69 % |
| Alguna "Partidas en el día" | 54 % | 59 % |
| **"Juega el reto del día"** | **30 %** (220 de 730 días en el mismo período de 12-07) | **14,8 %** (108 de 730 días) |
| "Sigue a un jugador hoy" | — | **15,2 %** (111 de 730 días) |

  - **"Juega el reto del día" baja a la mitad** (de ~30 % a ~15 %). Con muestreo aleatorio (400 000 tríos) la frecuencia de largo plazo es 29,5 % con 13, **18,6 % con 21** y **14,1 % con 28**; los 730 días son una muestra y varían ±1,3 puntos. (Con 21, la cifra de 15 % que se anotó antes era un resultado de esa muestra: el valor esperado era ~19 %.) O sea que los 7 más de este cambio bajan el reto de ~19 % a ~14 %.
  - **"Sigue a un jugador hoy":** 111 días de 730 (15,2 %): ese es el número de días en que un invitado ve la fila bloqueada (con 21 eran 122). Esos días el invitado tiene 2 de 3 misiones jugables.
  - **El trío coincide con el de hoy:** 0 de 730 días.
- **Decisiones cerradas (usuario, 2026-11-24):**
  1. **"Llega a los bloques de 4 s": +60** (no +80). Así no se toca el tope de la prueba del motor (`missions.test.ts:25`).
  2. **"Juega el reto del día" a la mitad de frecuencia: NO se pesa el sorteo.** Se diluye agregando **7 misiones más** (pool de 28); ver la aclaración arriba. No se cambia el algoritmo del sorteo.
  3. **"Destruye 250 bloques hoy" se queda en 250. "Juega 8 partidas hoy" pasa a "Juega 6 partidas hoy".** Premio propuesto para la de 6: **+30** (igual que la de 5); alternativa +40.
- **Nota para el usuario sobre "Juega 6 partidas hoy":** queda casi igual que "Juega 5 partidas hoy" (+30): la diferencia es una sola partida. Con +30 ambas valen lo mismo, y como son del mismo tipo **nunca salen juntas el mismo día**. Si no se quiere esa casi-duplicada, la salida más simple es quitar "Juega 6" (el pool queda en 27) o subirla a 7; no se cambió nada más.
- **Decisiones que el usuario debe confirmar:** ninguna de las anteriores sigue abierta. Quedan solo dos detalles menores: el **premio de "Juega 6 partidas hoy"** (+30 propuesto, o +40) y las **metas estimadas** (250 y 400 bloques; 10 y 15 partidas), a contrastar con datos reales.
- **Qué NO cambia:** `DayAgg`, `missionProgress`, la API (solo aparecen ids nuevos), el cliente, las 13 misiones de hoy (ids, metas, premios), las misiones por día (3), el algoritmo del sorteo, los rankings, los récords, las claves `tb_*`, `RULES_VERSION` y el tope de premios de la prueba del motor.
- **Cómo verlo en esta carpeta:** sección "Misiones". Con el interruptor en "Ahora": contador 13. En "Con cambios": contador **28** (en celeste) y, después de las 13 de hoy, 15 filas con borde celeste y la marca "nuevo": la de seguir a un jugador (con su selector "Ver como: con cuenta | invitado") y las 14 de este cambio.

---

## CAMBIO-016 · Las paletas se ganan por el nivel del jugador, no por la insignia

- **Estado:** propuesto (2026-11-24), por decisión del usuario. Maquetado en la web de esta carpeta (sección "Premios", panel "Paletas", interruptor "Con cambios"); el juego no se tocó. Los niveles son una propuesta que el usuario revisará.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Niveles por confirmar (B9).
- **Reemplazado por CAMBIO-025:** Constancia se gana invitando a un 2.º amigo; Marimba pasa a la insignia Papel, Chispas y los fondos a logros (las otras paletas siguen por nivel como aquí).
- **Qué:** hoy cinco paletas se ganan por la **insignia** (la partida más larga): Pastel (Madera II), Neón (Bronce), Retro (Plata), Dorado (Oro) y Diamante (Diamante). Pasan a ganarse por el **nivel** (bloques destruidos + bloques extra de misiones, `lib/level.ts`), igual que ya hacen los fondos (Grilla 5, Estrellas 10, Aurora 20). Clásica y Alto contraste siguen "Desde el inicio"; **Constancia** (7 días seguidos de reto) no cambia (ver decisiones). Con CAMBIO-017 se suman dos paletas nuevas que también van por nivel.
- **Por qué:** pedido del usuario. Las insignias miden **una** partida larga (habilidad); el nivel mide **todo lo jugado** (constancia). Además, así las paletas dejan de depender de qué insignia se mueva (CAMBIO-001, 002, 003, 005): esos cambios ya no tocan ningún premio salvo Chispas y Marimba.
- **Niveles propuestos.** Se mantuvo el reparto pedido (progresivo, en el orden en que hoy se ganan y sin chocar con los fondos 5, 10 y 20). "Hoy" = fórmula `25·n·(n−1)` (`lib/level.ts:24-27`); "CAMBIO-004" = `25·n·(n+1)`, la que usa la web con el interruptor en "Con cambios". En la web aparece como "Llega al nivel N · desde X bloques" con la curva nueva.

  | Paleta | Hoy se gana con | Nivel propuesto | Desde X bloques (fórmula de hoy) | Desde X bloques (CAMBIO-004) | Cuesta subir el último nivel (CAMBIO-004) |
  |---|---|---|---|---|---|
  | Pastel | Madera II (Llega al 5, 40 s) | **3** | 150 | **300** | 150 |
  | Neón | Bronce (sumas y restas, 140 s) | **7** | 1.050 | **1.400** | 350 |
  | Cristal (nueva, CAMBIO-017) | — | **12** | 3.300 | **3.900** | 600 |
  | Retro | Plata (multiplicaciones y divisiones, 275 s) | **15** | 5.250 | **6.000** | 750 |
  | Contorno (nueva, CAMBIO-017) | — | **18** | 7.650 | **8.550** | 900 |
  | Dorado | Oro (etapa final, 350 s) | **25** | 15.000 | **16.250** | 1.250 |
  | Diamante | Diamante (1 s, 440 s; 2 s, 410 s con CAMBIO-003) | **30** | 21.750 | **23.250** | 1.500 |
  | *(Grilla, Estrellas, Aurora, ya existen)* | nivel | *5, 10, 20* | *500 · 2.250 · 9.500* | *750 · 2.750 · 10.500* | — |

  Ningún nivel choca con 5, 10 ni 20. Entre Estrellas (10) y Aurora (20) caen Cristal, Retro y Contorno: es donde el jugador ya tiene el hábito de jugar, así que van más juntas. Pastel en 3 es el primer premio por nivel (300 bloques con la curva nueva).
- **Cuántos bloques hacen falta frente a cuántos puede destruir una partida (solo lo que sale de las constantes; sin datos reales de jugadores):**
  - Una partida no puede generar más de un bloque cada `spawnCooldown(t, r) = 0,5 + 0,6·r − 0,25·min(t/120, 1)` segundos (`constants.ts:119`; con `r` = 0,5 de promedio: 0,8 s al empezar, 0,55 s desde los 120 s). Eso da un **tope teórico de bloques generados** (cuenta mía; ignora el límite de bloques a la vez `maxConcFor`, `constants.ts:118`, y los toques que cuesta destruir cada uno, así que lo destruido de verdad es menos): ≈ 53 al llegar a 40 s, 82 a 60 s, 216 a 140 s, 462 a 275 s, 598 a 350 s, 707 a 410 s y 762 a 440 s. Coincide con el "unos 600 en 350 s" de CAMBIO-015.
  - Con eso, **partidas mínimas** (si todas llegaran hasta la etapa de la insignia de hoy con el tope teórico) para llegar al nivel de la tabla con la curva de CAMBIO-004: Pastel 300 bloques ÷ 82 (60 s) ≈ **4** partidas; Neón 1.400 ÷ 216 ≈ **7**; Retro 6.000 ÷ 462 ≈ **13**; Dorado 16.250 ÷ 598 ≈ **27**; Diamante 23.250 ÷ 707 ≈ **33** (con la meta de 2 s, CAMBIO-003). Son pisos teóricos; en la práctica serán bastante más.
  - **El nivel suma bloques extra de misiones** (`bonusXp`, `level.ts:30-33`; premios de 20 a 60, 3 misiones por día): para quien juega a diario eso aporta hasta 180 por día y pesa mucho en los primeros niveles (Pastel y Neón). Sin datos reales no se puede decir cuánto.
- **Dónde implementarlo (todo en el cliente; el nivel no pasa por el motor ni por la API):**
  - `apps/client/src/cosmetics/catalog.ts:139-143`: Pastel, Neón, Retro, Dorado y Diamante pasan de `{ kind: 'tier', index: tierIdx(...) }` a `{ kind: 'level', n: 3 | 7 | 15 | 25 | 30 }`. El tipo `level` ya existe (`:47-48`), su texto sale solo (`goalOf`, `:121-122` → "Llega al nivel 3"), su condición también (`meets`, `:195-196`) y su "te faltan N bloques" (`missingText`, `:254-257`). `tierIdx`, `TIERS` y `tierIndexOfStats` siguen en uso (Marimba, Chispas, insignias). Mantener el orden del catálogo por nivel (ver CAMBIO-017) para que la Colección los muestre de menor a mayor.
  - `apps/client/src/cosmetics/catalog.test.ts`: `:62-63` (`goal` de Neón y Pastel), `:70-76` (Neón, Retro y Diamante por `bestTicks`: reescribir con `totalKilled`), `:101-104` (`newlyUnlocked` esperaba `neon`), `:122-126` y `:151-153` (`missingText`/`lockedLine` de Neón pasan de "te faltaron 28 s" a bloques), `:165-180` (`resolveSelection` con `pro`: 3.000 bloques ya no desbloquea Retro; subir `totalKilled` o cambiar el caso).
  - `apps/client/src/game/endPrize.test.ts` (~línea 53, "Madera II → Pastel") y los tests de celebraciones que usen paletas (`celebrations.test.ts`, `celebrationQueue.test.ts`): revisar los que dependan de que una paleta salga por la insignia.
  - Docs al aplicar: `docs/reglas-y-balance.md:168-187` (tabla de premios: Pastel "Madera II", Neón "Bronce", Retro "Plata", Dorado "Oro", Diamante "Diamante" pasan a "Nivel N"), `docs/plan-jugabilidad.md:330-349` (misma tabla y la sección de paletas), `docs/arquitectura.md:69` y la decisión en `docs/historia-y-decisiones.md`.
  - Si **CAMBIO-004 no se aplica**, los mismos niveles piden menos bloques (columna "fórmula de hoy"): decidir juntos. Si se aplica, todos bajan un nivel con los mismos bloques y los niveles de esta tabla ya cuentan con eso.
- **Qué más afecta:**
  - **Selección guardada y respaldo.** La selección vive en `tb_set1` (`settings.ts:17, 38`) y **no se borra nunca**. `resolveSelection` (`catalog.ts:283-291`) la valida contra lo desbloqueado cada vez que se dibuja (`active.ts:36-46`): si la paleta elegida ya no cumple su requisito, **se usa la Clásica sin avisar** y el id sigue guardado; cuando el jugador vuelva a cumplirlo, la paleta reaparece sola. Nada se pierde en disco, pero la partida siguiente **se ve con otros colores**.
  - **Quién gana y quién pierde (por no existir "ganado" guardado, `catalog.ts:4-6`, todo se recalcula en cuanto se publica el cliente).** *Pierde* la paleta quien la tenía por insignia y tiene menos nivel que el pedido: el caso más probable es **Dorado y Diamante** (27 y 33 partidas mínimas teóricas arriba) y, en menor grado, Retro. Alguien que llegó una sola vez a Diamante con una gran partida (≤ 762 bloques) pasa a necesitar ~23.250 bloques. *Gana* quien tiene mucho nivel y una insignia baja (muchas partidas cortas): por ejemplo, con 300 bloques destruidos en partidas de 20 s ya tiene Pastel sin haber llegado al 6. Una paleta nueva por nivel (Cristal, Contorno) la ganan igual los veteranos con nivel alto.
  - **Celebraciones.** `newlyUnlocked` y las claves `item:palette:<id>` (`celebrations.ts:45`) comparan "antes/después" de una partida y recuerdan lo ya celebrado: quien recupera una paleta que ya celebró **no la verá celebrar otra vez**; quien la gana por primera vez por nivel sí. No probado: comprobar cómo se comporta el aviso la primera vez que se abre la app actualizada (las paletas que de golpe estén ganadas o perdidas).
  - **Rankings, insignias y marcos.** El marco "Dorado"/"Diamante" del ranking que mencionan los docs (`reglas-y-balance.md:181-182`) depende de la **insignia**, no de la paleta; este cambio no lo toca.
  - **Colección:** el requisito pasa de "Llega a las sumas y restas · te faltaron 28 s" a "Llega al nivel 7 · te faltan N bloques" (mismo formato que Grilla/Estrellas/Aurora).
- **Decisiones que el usuario debe confirmar:**
  1. **Niveles** 3 · 7 · 12 · 15 · 18 · 25 · 30 (tabla de arriba). Lo más delicado es el salto Dorado → Diamante: de 25 a 30 hay solo 7.000 bloques (≈ 10 partidas perfectas de 440 s), mucho menos que la distancia que hoy los separa en habilidad (350 s contra 410 o 440 s). Alternativa si se quiere mantener la separación: dejar Dorado en 22 y Diamante en 30, o bajar ambos (p. ej. 20 no vale: choca con Aurora).
  2. **Constancia** (7 días seguidos de reto) hoy no depende de insignia y se deja igual. ¿Debe pasar también a nivel? Mi recomendación: **no**; premia una conducta distinta (volver cada día) y es la única paleta que se gana con el reto. Si pasa a nivel, ese premio exclusivo desaparece.
  3. **Qué pasa con quien ya tenía la paleta por insignia.** Opciones: (a) **solo nivel**, como se pidió (algunos veteranos pierden Dorado/Diamante hasta subir de nivel); (b) *nivel **o** la insignia de hoy* (nadie pierde, pero la paleta deja de ser "solo por nivel" y vuelve a depender de qué insignia se mueva); (c) bajar los niveles de Dorado y Diamante. Mi recomendación: **(a) con (c) si los datos lo piden**, y antes de aplicar **contar con una consulta a la base** (estadísticas `totalKilled`, `bonusXp` y la mejor duración por cuenta) cuántas cuentas perderían cada paleta; el dato real manda sobre mis pisos teóricos. No diseñé (b).
- **Qué NO cambia:** `RULES_VERSION`, rankings, récords, las claves `tb_*` (incluida `tb_set1`), las insignias y sus umbrales (CAMBIO-001 a 003 y 005 siguen valiendo igual), el motor, la API, los sonidos ni los efectos (Marimba y Chispas siguen por insignia), ni los fondos.
- **Cómo verlo en esta carpeta:** sección "Premios", panel "Paletas". En "Ahora" es idéntico a hoy (8 paletas con su insignia). En "Con cambios" hay 10: las cinco con insignia piden "Llega al nivel N · desde X bloques" (curva nueva), con lo de hoy tachado ("Hoy: Llega al 5") y **sin** la miniatura de la insignia; Constancia no cambia.

---

## CAMBIO-017 · Dos paletas nuevas: "Cristal" (vidrio) y "Contorno" (borde intenso, relleno translúcido; antes "solo el borde")

- **Estado:** propuesto (2026-11-24), por decisión del usuario. Maquetado en la web de esta carpeta con el interruptor en "Con cambios" (marcadas "nuevo"); el juego no se tocó. Los colores son una propuesta. **Contorno es ahora provisional, con relleno translúcido al 55 %** (decisión del usuario, 2026-11-25, para ver cómo se ve y si se parece mucho a Tenue; ver "Contorno al 55 %" al final de este cambio). Prueba en Android: ver CAMBIO-021.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Contorno con relleno 0,55; abierto el brillo de Cristal frente a la trampa roja (`../docs/pendientes.md`).
- **Actualización (2026-11-26):** Cristal y Contorno se dibujan sobre un respaldo opaco `#12121a`, ver CAMBIO-022 (reemplaza lo que aquí se dice sobre depender del fondo).
- **Qué:** se agregan dos paletas, **Cristal** (nivel 12) y **Contorno** (nivel 18), ganadas por nivel (CAMBIO-016). **No son solo nueve colores: son un estilo de dibujo del bloque.** Hasta hoy una paleta solo cambia el `backgroundColor` del bloque (`paletteColor`, `palettes.ts:95-99`; `Block.tsx:93`) y, en Diamante, suma un brillo (`shine`, `Block.tsx:97-104`). Estas dos cambian **cómo se pinta el bloque**:
  - **Campo nuevo `style` en la paleta** (`palettes.ts:27-33`, interfaz `Palette`): `'solid'` (por defecto; lo que hacen todas hoy) · `'glass'` (Cristal) · `'outline'` (Contorno). En la web es `estilo: 'plano' | 'cristal' | 'contorno'` (mismo significado) y `colores` (los 9 hex); ver el comentario de `PALETAS` en `coleccion.js`, que es el contrato que leerá la vista previa.
  - **Cristal** (`glass`): relleno translúcido (el color al **50 %** sobre el fondo oscuro), degradado blanco de arriba (blanco .38 → 0 a 55 % del alto, 160°), borde claro (1,5 px, blanco al 55 %) y un hilo de luz arriba (blanco al 50 %). El número sigue blanco.
  - **Contorno** (`outline`): borde de **3 px** del color pleno y **relleno del mismo color al 55 %** sobre el fondo (provisional, decisión del usuario del 2026-11-25; la propuesta original era sin relleno); el número sigue blanco. (Ver el riesgo de las trampas más abajo: es el punto más importante de este cambio.)
- **Por qué:** pedido del usuario: más variedad y premios con identidad propia más allá del tono.
- **Colores (9, en el orden de `COLORS` del motor y de la muestra 3×3 de izquierda a derecha y de arriba abajo; posición 0 = el rojo de la Clásica … 8 = el morado):**

  | Pos. | Familia | Cristal (tintes claros y fríos) | Contorno (saturados) |
  |---|---|---|---|
  | 0 | rojo | `#ff9fb5` | `#ff4d6d` |
  | 1 | naranja | `#ffb88a` | `#ff8a1f` |
  | 2 | amarillo *(SAFE)* | `#ffd666` | `#ffc400` |
  | 3 | verde *(SAFE)* | `#94f0c2` | `#19e68c` |
  | 4 | azul *(SAFE)* | `#85cbff` | `#3ab0ff` |
  | 5 | violeta *(SAFE)* | `#a8a7ff` | `#a89bff` |
  | 6 | rosa | `#ff9be0` | `#ff3fb4` |
  | 7 | verde azulado *(SAFE)* | `#6fe3d0` | `#00e0c6` |
  | 8 | morado *(SAFE)* | `#c79bff` | `#d484ff` |

  Se respetó la **familia de color de cada posición** (el 3 sigue siendo amarillo, el 5 verde, etc.) para que el jugador que asocia número y color no se desoriente. Las posiciones 0, 1 y 6 (rojizas) **nunca llevan trampa roja** (el motor las cambia por un color de `SAFE`: `constants.ts:95-97`, `game.ts:325-327`), así que ahí va la identidad libre de cada paleta.
- **La regla de no ventaja (lo más delicado).** La regla de `palettes.ts:9-23` y `palettes.test.ts:102-131` compara, en las seis posiciones SAFE, el tono y el contraste del texto rojo de la trampa `#ff2a2a` (`theme.ts:16`) contra el color del bloque, y pide que el texto blanco se lea igual o mejor. Con los valores de la Clásica (cálculo mío, con las mismas funciones): el rojo contrasta **entre 1,16 y 1,73** con los colores SAFE y el blanco **≥ 2,16** con los nueve. Dos hallazgos:
  1. **Con estas paletas el color del bloque no es el que se ve.** Sobre un tinte claro, "pasar el test" con el hex crudo sería un espejismo: el hex de Cristal tiene luminancia por encima del tope que acepta el test para el blanco, y al 50 % sobre el fondo oscuro (`#12121a`, `theme.ts:3`) queda mucho más oscuro. Por eso la comprobación debe hacerse sobre el **color efectivo** (color al relleno sobre `C.bg`). Efectivos de Cristal al 50 %: `#895968 #896552 #897440 #53816e #4c6f8d #5d5d8d #89577d #417b75 #6d578d`. Con ellos, **las seis reglas se cumplen**: tonos SAFE 43 / 155 / 152 / 120 / 174 / 96° (media 123,3; la Clásica, 119,5), contraste con el rojo 1,21 / 1,19 / 1,42 / 1,64 / 1,30 / 1,65 (rango pedido 1,16–1,73; el mínimo está a 0,03 del borde) y blanco ≥ 4,4. Con relleno de 46 % o de 54 % **ya no se cumple**: el margen es chico, por eso el 50 % queda como constante de la receta.
  2. **Contorno sin relleno sí da ventaja.** Sin relleno, el texto rojo queda directamente sobre el fondo oscuro: contraste **4,98** con `#ff2a2a`, frente a 1,16–1,73 en cualquier paleta de hoy. La trampa roja sería **tres veces más visible** que en la Clásica, en contra de la regla ("ninguna paleta puede hacer más visibles las trampas", `plan-jugabilidad.md:50`, `palettes.ts:9-10`). **No vuelve ambigua la trampa ni baja el contraste del número** (el blanco sobre el fondo da 18,6), pero sí rompe la regla. **La web ya no lo dibuja sin relleno (2026-11-25): lo dibuja con el relleno al 55 %**, para el que se eligieron los 9 hex y con el que cumple las seis reglas: efectivos `#943248 #94541d #94740c #168759 #286998 #655d98 #942b6f #088379 #7d5198`; tonos 46 / 156 / 155 / 112 / 175 / 83° (media 121,0); rojo 1,18 / 1,21 / 1,58 / 1,57 / 1,24 / 1,60; blanco ≥ 4,4. En la web el campo `relleno` vale ahora 0,55 (con 0 se vería el contorno puro). Es la primera decisión de abajo (ya tomada, provisional).
  - **Depende del fondo (dato nuevo).** Una paleta translúcida hereda lo que hay detrás: la regla solo se puede comprobar sobre el fondo **Liso**. Con el resplandor de Aurora arriba del campo (`FieldBackground.tsx:93-97`, hasta 16 % de verde o 15 % de azul) estimo (cálculo mío, no medido en el juego) que el contraste con el rojo baja a ~1,0–1,4 en Cristal y Contorno con relleno: las trampas **se esconden un poco más** en la franja de arriba, la dirección contraria a la ventaja. Grilla (rayas al 5 %) lo mueve poco (≥ 1,11). Se acepta o se sube el relleno de Cristal (decisión 3).
  - **Alto contraste (daltónicos).** Esa paleta sigue siendo un conjunto de colores (D9, `historia-y-decisiones.md:153`) y **no se puede combinar** con un estilo: el estilo va con la paleta. Cristal y Contorno **no** se pensaron para daltónicos (la identidad de cada color depende del tono, como en las demás), y el vidrio estrecha el rango de luminancias (en las posiciones SAFE, luminancia efectiva entre ~0,12 y 0,19), lo que los hace un poco menos distinguibles entre sí; el número sigue impreso, así que no se pierde información.
  - **Cómo se ven las trampas (regla del CLAUDE.md de la raíz).** El motor sigue eligiendo el color por posición: una trampa roja nunca cae en una posición rojiza (`REDDISH` → `SAFE`). Con `style` solo cambia el pintado: el texto de la trampa sigue siendo `#ff2a2a` con su sombra (`Block.tsx:131-136`) en **todos los estilos y también en los bloques que no son trampa** (el brillo de Diamante ya sigue ese principio: igual en todos, `Block.tsx:97-100`).
- **"Vidrio falso" y no desenfoque real (decidido: sin blur real, 2026-11-26).** Cristal se dibuja con un relleno translúcido, un degradado y un borde claro, **sin `BlurView`**. Motivo en una frase: el blur real en Android exige un `BlurTargetView` y una pasada de desenfoque **por bloque** (hasta 6 a la vez más los que se apagan) que es un costo extra (cuánto, se medirá más adelante, sin alarma: el usuario dice que la versión actual va muy bien en celulares lentos), mientras que el degradado y el borde son una sola `View` que se ve igual en web y app. Verificado en el repo: `expo-blur` ya está (`package.json`, `~58.0.6`) pero se usa solo en la barra de pestañas (`TabBarBlur.tsx:1-11`, donde en Android hay que envolver cada pantalla en un `BlurTargetView`); **no** está `expo-linear-gradient`, pero no hace falta: el juego ya usa `backgroundImage: 'linear-gradient(...)'` en `FieldBackground.tsx:89-100` y `CelebrationModal.tsx:63-70` (react-native-web y React Native ≥ 0.80; el cliente usa 0.88.1).
- **Dónde implementarlo (cliente):**
  - `apps/client/src/cosmetics/palettes.ts`: `PaletteId` suma `'cristal' | 'contorno'` (`:25`); `Palette` suma `style?: 'solid' | 'glass' | 'outline'` (`:27-33`, por defecto `'solid'`) y, si se quiere, `fill?: number` (el relleno 0–1: Cristal 0,5, Contorno 0 ó 0,55 según la decisión); entradas nuevas en `PALETTES` (`:37-79`) con los hex de arriba; `getPalette` y `paletteColor` no cambian (siguen traduciendo por posición). Actualizar el comentario de cabecera (`:3-24`): la regla se mide sobre el **color efectivo**.
  - `apps/client/src/components/Block.tsx`: hoy `backgroundColor` fijo (`:93`) y un `shine` opcional (`:52, 97-104`). Con `style`: **solid** igual que hoy; **glass** = `backgroundColor` con el color al `fill`, `borderWidth` 1,5 con `rgba(255,255,255,.55)`, una `View` interior absoluta con `backgroundImage` (degradado blanco) y otra con el hilo de luz; **outline** = fondo transparente (o color al `fill`) y `borderWidth` 3 con el color. Cuidar: `overflow: 'hidden'` y `borderRadius: 16` (`:116-124`) recortan bien el degradado; el `boxShadow: '0 5px 0 rgba(0,0,0,.35)'` (`:123`) es de sombra exterior y no debería verse a través del bloque (no verificado en Android); la barra de vida (`:137-143`) y el texto no cambian; el bloque apagado (`gone`, `C.gone`) se dibuja con el mismo estilo (gris) y el corazón de recuperación (`#ff4d8d`, fuera de `COLORS`) conserva su color. Con el borde, el contenido se achica en el grosor del borde (tamaño `border-box`): comprobar que el número de las operaciones (bloques rectangulares 1,7:1) sigue cabiendo (`labelFontSize`, `:37-42`).
  - Las demás vistas de la paleta, que hoy pintan cuadrados lisos y quedarían sin el estilo: `CollectionScreen.tsx:158-172` (`Preview`, muestra 3×3), `CelebrationModal.tsx:82-90` (`PaletteView`, la celebración de "paleta nueva"), `PrizeCard.tsx:11-14` (cuatro colores). Convendría un único componente de muestra que lea `style`.
  - `apps/client/src/cosmetics/catalog.ts`: dos ítems nuevos, **en el orden de nivel** (Clásica, Alto contraste, Pastel, Neón, **Cristal**, Retro, **Contorno**, Dorado, Diamante, Constancia): `item('cristal', 'palette', 'Cristal', { kind: 'level', n: 12 }, { note: 'Translúcida, con brillo' })` e `item('contorno', 'palette', 'Contorno', { kind: 'level', n: 18 }, { note: 'Borde intenso, relleno translúcido' })`. El test `catalog.test.ts:38-41` ("cada paleta del catálogo existe y al revés") fallará hasta que existan en los dos lados.
  - `apps/client/src/cosmetics/palettes.test.ts`: los `it.each(PALETTE_IDS)` (`:73-78`, `:102-131`) miden hoy el hex crudo y **fallarían con Cristal** (blanco y rango del rojo). Hay que medir el **color efectivo** (`color` mezclado con `C.bg` al `fill`) cuando `style !== 'solid'`; para Contorno, según la decisión 1. Agregar un test de que `getPalette('cristal').style === 'glass'` (`:152` es el análogo de `shine`).
  - `apps/client/src/components/Fx.tsx:110-113`: las partículas usan los 9 colores de la paleta **sólidos**; no hace falta cambiarlas (confeti y chispas se ven bien con el color pleno). Opcional.
  - Docs: `docs/reglas-y-balance.md` (tabla de premios `:168-185` y la regla de no ventaja `:187`: aclarar que se mide sobre el color efectivo y por qué), `docs/plan-jugabilidad.md:345-349`, `docs/arquitectura.md:69` (`palettes.ts`) y `docs/historia-y-decisiones.md`.
- **Qué más afecta:**
  - **Rendimiento en Android.** Cristal agrega 1 o 2 `View` hijas por bloque (hasta ~6 a la vez más los que se apagan): barato. Contorno no agrega vistas. Se medirá más adelante en el emulador `Pixel_Mi_Device` (no medido, sin alarma: el usuario dice que la versión actual va muy bien en celulares lentos).
  - **Prueba en Android:** ver CAMBIO-021.
  - **Selección guardada.** Un id nuevo en `tb_set1` no choca con nadie: un cliente viejo que reciba `cristal` o `contorno` (por ejemplo, si algún día se sincroniza) lo trata como Clásica (`getPalette`/`isPaletteId`, `palettes.ts:85-92`).
  - **Tarjeta de compartir.** `share.web.ts` y `ShareCardHost.native.tsx` no usan paletas (buscado en `apps/client/src`: solo `Block`, `Fx`, `CollectionScreen`, `CelebrationModal` y `PrizeCard` las usan), así que no cambian.
  - **Onboarding:** las demos (`onboarding/demos.tsx`) usan `Block` con la paleta activa, así que mostrarán el estilo elegido.
- **Decisiones que el usuario debe confirmar:**
  1. **Contorno: ¿sin relleno o con relleno al 55 %?** **PROVISIONAL (2026-11-25): relleno translúcido al 55 %**, para ver cómo se ve y si se parece mucho a Tenue. No se descarta volver al contorno puro (B) ni quitar la paleta (C). Detalle, motivo y opciones descartadas por ahora: ver "Contorno al 55 %" al final de este cambio.
  2. ~~Vidrio falso vs blur real~~ **CERRADA: vidrio falso (decidido: sin blur real, 2026-11-26**; además, con el respaldo opaco de CAMBIO-022 no hay nada detrás que desenfocar).
  3. **Cristal al 50 %.** El margen de la regla es de ~0,03 y con Aurora las trampas se esconden un poco más. Si se prefiere más margen hay que subir el relleno y oscurecer los tintes; se vería menos "vidrio" y más "plástico".
  4. **Niveles 12 y 18** y los **colores** (tabla de arriba): a revisar a la vista en la web y, mejor, en el juego.
  5. **Cristal se ve apagado en la muestra** (al 50 % sobre el fondo oscuro los tintes claros pierden fuerza; ver la captura): es el precio de cumplir la regla. Si se quiere más vivo, la salida es otra regla (p. ej. medirla sobre el color pleno) y no es mi decisión.
- **Qué NO cambia:** `RULES_VERSION`, rankings, récords, las claves `tb_*`, el motor (que sigue eligiendo el color por posición) y la API. La selección de las demás paletas.
- **Relación con otros cambios:** va con **CAMBIO-016** (las dos entran por nivel) y supone la curva de **CAMBIO-004** (los "desde X bloques" de la tabla de CAMBIO-016).
- **Cómo verlo en esta carpeta:** sección "Premios", panel "Paletas", con el interruptor en "Con cambios": aparecen **Cristal** (después de Neón) y **Contorno** (después de Retro) con la marca "nuevo", su muestra 3×3 dibujada por CSS según el estilo y su nivel con la curva nueva (sin "Hoy": no existen hoy). Con "Ahora" no se ven.

### Contorno al 55 %: provisional y comparación con Tenue (2026-11-25)

- **Decisión del usuario (2026-11-25):** a Contorno se le pone un relleno al 55 % **para ver cómo se ve, y para ver si se parece mucho a Tenue**. Es una prueba visual **provisional**: no se descarta aún volver al contorno puro ni quitar la paleta. En la web: `relleno: 0.55` en `PALETAS` (`coleccion.js`), el relleno es el color del borde al 55 % sobre el fondo, el borde sigue siendo de 3 px del color pleno, y la fila dice "Borde intenso, relleno translúcido".
- **Por qué hacía falta relleno:** el contorno puro **falla `palettes.test.ts`**. Con relleno 0, bajo el número queda el fondo `#12121a` en las 9 posiciones y la trampa roja contrasta **4,98** contra el rango 1,156–1,730 (caso difícil ≤ 1,256); la regla de tono es **imposible de cumplir con cualquier rojo** (con las 6 posiciones SAFE sobre el mismo color, la regla 2 pide ≤ 50,47° y la 3 pide ≥ 99,46°: el barrido de 636.056 colores RGB no dio ninguno). Detalle: `config_logros/herramientas/prueba-paletas/CONTORNO-PURO.md`.
- **Opciones descartadas por ahora:** **B**, contorno puro cambiando las reglas del test (eximir el tono para el estilo `outline` y parametrizar el rojo y el número por paleta; el rojo oscuro `#4d101a` cumpliría el contraste con margen 0,010, pero la trampa quedaría más difícil de ver que en cualquier otra paleta; es una decisión de reglas del usuario). **C**, quitar la paleta.
- **La ventana de opacidad es estrecha.** Pasa las seis reglas **solo con opacidad entre 0,53 y 0,55** (y 0,85); falla en 0,52 (caso difícil de contraste) y en 0,56 (rango de contraste del rojo). **El 55 % está en el borde de una ventana de 0,03.** Con mi copia de las fórmulas (en 0,55 coincide con `RESULTADOS.md`: rango de contraste +0,023, caso difícil +0,077, tono +2,94 y +4,59, blanco +2,25), el margen más justo por opacidad es: 0,53 → **+0,010**; **0,54 → +0,044** (rango +0,056, caso difícil +0,044; tono +3,02 y +4,80; blanco +2,37); 0,55 → **+0,023**. **Sí: 0,54 daría más margen** (casi el doble que 0,55) y queda en el centro de la ventana; el cambio visual es de 1 punto de opacidad. No se aplicó 0,54 porque el usuario pidió el 55 %; no se corrió vitest con 0,54.
- **Comparación honesta Contorno (55 %) vs Tenue, sobre Liso** (`#12121a`; capturas lado a lado sobre Liso y Grilla, mirándolas; hex calculados con mi copia de las fórmulas, no son del juego):

  | Pos. | Relleno Contorno | Relleno Tenue | ΔE rellenos | Borde Contorno | Borde Tenue (Clásica) | ΔE bordes |
  |---|---|---|---|---|---|---|
  | 0 | `#943248` | `#c97e81` | 28,1 | `#ff4d6d` | `#e5484d` | 14,3 |
  | 1 | `#94541d` | `#c98156` | 19,6 | `#ff8a1f` | `#f76b15` | 14,2 |
  | 2 | `#94740c` | `#b18f3a` | **12,0** | `#ffc400` | `#e5a50a` | 14,9 |
  | 3 | `#168759` | `#57a17d` | 15,4 | `#19e68c` | `#30a46c` | 31,4 |
  | 4 | `#286998` | `#5399cd` | 18,6 | `#3ab0ff` | `#0091ff` | 23,1 |
  | 5 | `#655d98` | `#968cc2` | 19,0 | `#a89bff` | `#6e56cf` | 29,4 |
  | 6 | `#942b6f` | `#c17ea9` | 30,6 | `#ff3fb4` | `#d6409f` | 15,0 |
  | 7 | `#088379` | `#3fa196` | **11,5** | `#00e0c6` | `#12a594` | 22,8 |
  | 8 | `#7d5198` | `#a487bc` | 23,1 | `#d484ff` | `#8e4ec6` | 22,2 |

  - **Relleno:** ΔE entre posiciones equivalentes de 11,5 a 30,6 (media 19,7); la ΔE mínima entre colores de la Clásica es 11,7, así que solo el amarillo (12,0) y el verde azulado (11,5) están cerca de ser "el mismo color", el resto se distingue con claridad. **Luminancia relativa** del relleno: Contorno 0,090–0,188 (media 0,138; L* medio 43,5); Tenue fija en 0,29 (L* medio 60,8). Es la diferencia más grande: Contorno es **oscuro y saturado**, Tenue **claro y lavado**. Blanco sobre el relleno: Contorno ≥ 4,41; Tenue ≥ 3,06.
  - **Borde:** Contorno **3 px**, color propio, vivo y más claro que el de la Clásica (ΔE de 14,2 a 31,4, media 20,8); Tenue **5 px** con los 9 colores de la Clásica tal cual. El borde de Contorno contrasta siempre con su relleno (ΔE 31–44); el de Tenue, a veces poco (ΔE 8 en el verde azulado, 16 en el verde; hasta 44).
  - **A ojo (capturas):** los dos son "ficha con borde de color y relleno del mismo matiz", pero Contorno se ve como **neón sobre oscuro** (línea fina y brillante, relleno hondo) y Tenue como **pastel con marco grueso** (relleno claro y opaco, marco intenso). En la **muestra 3×3 de 44 px** se parecen más: las dos son un cuadradito de color con un centro pequeño; ahí solo distingue el centro oscuro (Contorno) del centro claro (Tenue).
  - **Veredicto:** **no se parecen mucho** a escala de juego: comparten el recurso (borde + relleno del mismo matiz), pero difieren en luminosidad (0,14 contra 0,29), grosor (3 contra 5 px) y carácter (oscuro vivo contra claro lavado). Se acercan en el amarillo y el verde azulado (ΔE 12) y en la muestra chica. Si se mantiene Contorno, lo que lo distingue es el **relleno oscuro hecho con su propio borde al 55 %**, el **borde fino y más brillante**, y que su relleno es translúcido (el fondo asoma, p. ej. una línea de la Grilla da `#9a384d` en vez de `#943248`) mientras el de Tenue es opaco. No propongo cambios de reglas. (No verifiqué el radio de las esquinas en el juego; en la web de esta carpeta es el mismo.)

### Resultado de la prueba real (`palettes.test.ts`)

- **Cómo se hizo (2026-11-25):** se ejecutó el `palettes.test.ts` real del juego sobre una copia en `config_logros/herramientas/prueba-paletas/`, **sin alterar el juego** (`bash config_logros/herramientas/prueba-paletas/correr.sh`; informe en `RESULTADOS.md` de esa carpeta). **Solo se midió sobre fondo Liso** (`#12121a`).
- **Cristal: pasa con el color efectivo** (50 % sobre el fondo); margen más justo **+0,030** (rango de contraste del rojo). **Contorno 55 %: pasa con el efectivo**; margen más justo **+0,023** (con 0 de relleno **falla**: ver arriba). **Los hex crudos de Cristal y Contorno fallan** (son tintes claros pensados para mezclarse con el fondo): Cristal en rango de contraste (2,760 contra 1,156–1,730, pos. 3), caso difícil (1,702) y blanco (1,355); Contorno en rango (2,341, pos. 2), caso difícil (1,521) y blanco (1,597). No hay un ajuste mínimo del hex.
- **Nota para quien implemente.** Hoy la prueba mide **un solo color por bloque** (`PALETTES[id].colors`). Hay dos caminos: **(1)** adaptar `palettes.test.ts` para medir el color efectivo cuando el estilo no es sólido; **(2)** guardar en el catálogo el **color efectivo ya mezclado** como color base (`colors`) y que el estilo solo agregue brillo y borde encima, con lo que la prueba actual pasa **sin tocarla**. **Recomiendo el (2)**, porque es viable en el código de hoy: `Block.tsx:93` pinta `backgroundColor = paletteColor(color, pal)`, que devuelve `PALETTES[id].colors[i]` (`palettes.ts:94-99`), y la prueba lee ese mismo arreglo (`palettes.test.ts:73-78`, `:102-131`); `Palette` (`palettes.ts:27-33`) solo necesita un campo para el color del borde de Contorno (`accents?: readonly string[]`; Tenue usa el color del motor, que ya recibe `Block`, y Cristal el borde blanco). Además, medir lo que de verdad se pinta hace que la regla valga también sobre Grilla y Aurora, que con el relleno translúcido no se probaron. **Contras a revisar:** las partículas usan `getPalette(palette).colors` (`Fx.tsx:113`) y saldrían oscuras en Contorno (usar `accents`); el relleno deja de ser translúcido (el fondo ya no asoma); el (2) **no sirve para Esmerilado**, que lleva su capa translúcida sobre un respaldo opaco (**decidido: sin blur real, 2026-11-26**), pero ahí la prueba ya pasa en crudo con el ajuste de `#19c4be` (CAMBIO-019). Si el (2) no convence, queda el (1).

---

## CAMBIO-018 · Paleta "Degradé": un degradé sutil entre dos tonos del mismo color

- **Estado:** propuesto (2026-11-24), por decisión del usuario. Maquetado en la web de esta carpeta (panel "Paletas" y "Vista previa", interruptor "Con cambios"); el juego no se tocó. **Nombre propuesto: "Degradé"**; alternativa en una línea: **"Satén"** (un acabado suave, sin la palabra técnica). Nivel y colores: a confirmar.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** una paleta nueva donde cada bloque lleva un degradé vertical **muy sutil entre dos tonos de su propio color** (un poco más claro arriba, un poco más oscuro abajo). Es un **tercer estilo de dibujo del bloque**, después de `'glass'` y `'outline'` (CAMBIO-017): **`style: 'gradient'`** en el juego (`Palette.style`, `palettes.ts:27-33`) y `estilo: 'degrade'` en la web. El relleno es **opaco** (a diferencia de Cristal), sin borde y sin brillo; el número sigue blanco y la trampa roja `#ff2a2a`.
- **Por qué:** pedido del usuario. Da profundidad sin cambiar la identidad del color y sin parecerse a Cristal (translúcido, con borde y brillo) ni a Diamante (reflejo blanco diagonal del 45 % y dos destellos, `Block.tsx:97-104`, `coleccion.css .vpPaleta.brillo`).
- **El degradé, con exactitud.**
  - **Fórmula:** `arriba = mezcla(base, blanco, 3,5 %)` y `abajo = mezcla(base, negro, 3,5 %)`, por canal en sRGB y redondeado (`canal·0,965 + 255·0,035` y `canal·0,965`). Constante `DEGRADE_MEZCLA = 0,035` (en la web, `coleccion.js`: `degradeTonos`).
  - **Dirección:** vertical, `linear-gradient(180deg, arriba, abajo)` (de arriba hacia abajo, sin diagonal: el número va centrado y queda sobre el tono medio).
  - **Qué tan sutil es (medido con ΔE de CIELAB, cálculo mío):** entre los dos extremos de un mismo bloque la diferencia es **ΔE ≈ 3,2** (un jugador atento la nota; cuesta verla a simple vista en un bloque chico). Para comparar: con ±8 % sería ΔE 7,4 (un "botón brillante"), con ±5 % sería 4,6. El valor se eligió **por la regla de no ventaja**, no a ojo (ver abajo): subirlo rompe el margen en dos colores.
- **Los 9 colores base (orden de `COLORS` del motor y de la muestra 3×3; posición 0 = el rojo de la Clásica … 8 = el morado) y sus dos tonos:**

  | Pos. | Familia | Base | Tono de arriba (+3,5 % blanco) | Tono de abajo (+3,5 % negro) | Blanco sobre el tono claro |
  |---|---|---|---|---|---|
  | 0 | rojo (frambuesa) | `#d34566` | `#d54c6b` | `#cc4362` | 4,14 |
  | 1 | naranja | `#ee7e0f` | `#ef8317` | `#e67a0e` | 2,65 |
  | 2 | amarillo *(SAFE)* | `#cea017` | `#d0a31f` | `#c79a16` | 2,35 |
  | 3 | verde *(SAFE)* | `#39aa62` | `#40ad67` | `#37a45f` | 2,84 |
  | 4 | azul *(SAFE)* | `#2373da` | `#2b78db` | `#226fd2` | 4,36 |
  | 5 | violeta *(SAFE)* | `#8259ca` | `#865fcc` | `#7d56c3` | 4,64 |
  | 6 | rosa (orquídea) | `#cb64c5` | `#cd69c7` | `#c461be` | 3,26 |
  | 7 | verde azulado *(SAFE)* | `#2eb79c` | `#35ba9f` | `#2cb197` | 2,42 |
  | 8 | morado | `#9c3eb9` | `#9f45bb` | `#973cb3` | 5,19 |

  Se respetó la familia de color de cada posición (el 3 sigue siendo amarillo, el 5 verde…). Identidad propia: colores algo más "de terciopelo" (menos eléctricos que la Clásica, más profundos que Pastel y más vivos que Retro/Dorado). Distancia ΔE con el color de la **Clásica** en la misma posición: 19,9 · 13,2 · 10,1 · 8,7 · 12,5 · 7,1 · 19,4 · 8,4 · 9,6 (la más cercana es el violeta, 7,1).
- **Comprobación de la regla de no ventaja (obligatoria).** Hecha con una copia mía de las funciones de `palettes.ts` (`hue`, `hueDistance`, `luminance`, `contrastRatio`) y de los umbrales de `palettes.test.ts:102-131`; **no se corrió vitest**. Se evaluaron **tres conjuntos de 9 colores**: los bases, los tonos de arriba y los de abajo (y la luminancia, que sube o baja de forma monótona entre ellos, así que si los dos extremos de un color caen en la misma franja admitida, todo el degradé también). Referencia de la Clásica: rojo `#ff2a2a` contrasta 1,156–1,730 con sus colores SAFE; blanco ≥ 2,161; tono 42,5–173,1°.

  | Regla | Base | Arriba | Abajo |
  |---|---|---|---|
  | Tono SAFE en el rango de la Clásica ±5° (37,5–178,1°) | 45 · 142 · 146 · 98 · 168 · 74 ✓ | ✓ (igual ±1°) | ✓ |
  | Caso más difícil de tono (mínimo ≤ 50,5°) | 45° ✓ | 45° ✓ | 45° ✓ |
  | Tono medio dentro de ±20° de la Clásica (119,5°) | 112,2° ✓ | 112,2° ✓ | 112,3° ✓ |
  | Contraste con el rojo en cada SAFE (1,156–1,730) | 1,54 · 1,26 · 1,24 · 1,33 · 1,49 · 1,48 ✓ | 1,59 · 1,32 · 1,17 · 1,24 · 1,54 · 1,39 ✓ | 1,44 · 1,18 · 1,31 · 1,41 · 1,40 · 1,55 ✓ |
  | Caso más difícil de contraste (mínimo ≤ 1,256) | 1,24 ✓ | 1,17 ✓ | 1,18 ✓ |
  | Blanco ≥ 2,161 en los 9 | mín. 2,42 ✓ | mín. 2,35 ✓ | mín. 2,60 ✓ |

  - **Margen (honesto, es chico):** el límite inferior de contraste (1,156) queda a **0,014** en el azul del tono de arriba (1,17) y a **0,024** en el verde del tono de abajo (1,18); el superior (1,730) a ≥ 0,14. El blanco sobre el tono más claro del amarillo da 2,35 (mínimo admitido 2,161, margen 0,19; en el verde azulado 2,42). **Por qué tan justo:** el rojo de la trampa tiene luminancia 0,231 y el test excluye la franja de luminancia 0,193–0,275 (el rojo "desaparecería") y pide un caso muy difícil (contraste ≤ 1,256, luminancia ≈ 0,174–0,193 o 0,275–0,303), que es una franja de solo ~0,02: un degradé de ±3,5 % ya ocupa casi todo ese ancho. Por eso el azul (luminancia base 0,177) fija la franja baja y el verde (0,305) la alta.
  - **Más intensidad no cabe:** con ±5 % el azul de arriba baja a 1,14 y el verde de abajo a 1,15 (ambos **debajo** de 1,156: la regla falla); con ±8 % a 1,08. Si el usuario quiere un degradé más visible, hay que revisar la regla (p. ej. medirla en el centro del bloque, donde va el número, y no en los extremos).
  - **Ningún color base queda demasiado cerca de otro:** la distancia ΔE mínima entre cualquier muestra (arriba, base, abajo) de dos posiciones distintas es **15,5** (violeta y morado); la de la Clásica es 11,7.
  - **Trampas y fondo rojizo/SAFE (regla del CLAUDE.md de la raíz):** el motor sigue eligiendo el color por posición y, si una trampa roja cae sobre un color rojizo (`REDDISH`: posiciones 0, 1 y 6), la cambia por uno de `SAFE` (`constants.ts:95-97`, `game.ts:325-327`); las posiciones 0, 1 y 6 nunca llevan trampa roja, así que ahí el color es libre. Con el degradé el número rojo sigue siendo `#ff2a2a` con su sombra (`Block.tsx:131-136`), igual en todos los bloques; el degradé no depende del fondo (es opaco), así que **no hereda el problema de Aurora de Cristal**.
- **Nivel de desbloqueo: 22 (propuesta del usuario, la confirmo).** Va por nivel como las demás (CAMBIO-016). **12.650 bloques** con la curva de CAMBIO-004 (11.550 con la fórmula de hoy). Encaja entre Contorno (18: 8.550) y Dorado (25: 16.250): sube 4 niveles tras Contorno y 3 antes de Dorado (la escalera queda 3 · 7 · 12 · 15 · 18 · **22** · 25 · 30, pasos de 3 a 5 niveles) y no choca con los fondos (5, 10 y 20; Aurora 20 = 10.500). Cuesta subir del nivel 21 al 22: 1.100 bloques. Con el tope teórico de bloques por partida de CAMBIO-016 (≈ 598 en una partida de 350 s) serían al menos ~21 partidas de esa duración (cuenta mía; sin datos reales).
- **Dónde implementarlo (cliente).** Depende de la infraestructura de estilos de **CAMBIO-017** (el campo `style` y su soporte en `Block.tsx`); se implementa después o junto con él.
  - `apps/client/src/cosmetics/palettes.ts`: `PaletteId` suma `'degrade'` (`:25`); `Palette.style` suma `'gradient'` (`:27-33`); entrada nueva en `PALETTES` (`:37-79`) con los 9 hex base; una función `gradientStops(hex)` y la constante `GRADIENT_MIX = 0.035` que devuelvan `[arriba, abajo]`. Comentario de cabecera (`:3-24`): la regla se mide también sobre los dos extremos.
  - `apps/client/src/components/Block.tsx`: hoy `backgroundColor` fijo (`:93`). Con `style === 'gradient'`: dejar `backgroundColor: base` (respaldo) y añadir `backgroundImage: 'linear-gradient(180deg, arriba, abajo)'`. No agrega vistas hijas, borde ni sombra nueva; el `boxShadow` (`:123`), `overflow: 'hidden'` y `borderRadius: 16` (`:116-124`) quedan igual y recortan el degradé. El bloque apagado (`gone`, `C.gone`) y el corazón (`#ff4d8d`, fuera de `COLORS`) usan el mismo estilo sin cambios.
  - `apps/client/src/cosmetics/catalog.ts`: `item('degrade', 'palette', 'Degradé', { kind: 'level', n: 22 }, { note: 'Degradé sutil' })` en el orden de nivel (… Contorno, **Degradé**, Dorado …). `catalog.test.ts:38-41` ("cada paleta del catálogo existe y al revés") fallará hasta que existan en los dos lados.
  - Vistas de la paleta que hoy pintan cuadrados lisos y quedarían sin el degradé: `CollectionScreen.tsx:158-172` (`Preview`), `CelebrationModal.tsx:82-90` (`PaletteView`) y `PrizeCard.tsx:11-14`; mismo punto que en CAMBIO-017 (un componente de muestra común que lea `style`).
  - `apps/client/src/cosmetics/palettes.test.ts`: los `it.each(PALETTE_IDS)` (`:73-78`, `:102-131`) ya miden los colores base y **pasan**; hay que **agregar** la misma batería sobre `gradientStops` (conjunto de arriba y de abajo). Un test de `getPalette('degrade').style === 'gradient'` (análogo de `:152`).
  - Docs al aplicar: `docs/reglas-y-balance.md` (`:168-187`: premio nuevo "Degradé · nivel 22" y la regla medida también en los extremos), `docs/plan-jugabilidad.md:330-349`, `docs/arquitectura.md:69` y `docs/historia-y-decisiones.md`.
- **Qué más afecta:**
  - **Rendimiento en Android.** Un `linear-gradient` por bloque es barato: no suma vistas ni usa blur (a diferencia de `BlurView`, que en Android pide un `BlurTargetView`, `TabBarBlur.tsx:1-11`), y el juego ya usa `backgroundImage` con degradés en `FieldBackground.tsx:89-100` y `CelebrationModal.tsx:63-70` (react-native-web y React Native ≥ 0.80; el cliente usa 0.88.1; no está `expo-linear-gradient` y no hace falta). No se midió en el emulador `Pixel_Mi_Device` (hasta ~6 bloques a la vez más los que se apagan; se medirá más adelante, sin alarma). Prueba en Android: ver CAMBIO-021.
  - **Selección guardada y respaldo.** Igual que CAMBIO-016: la selección vive en `tb_set1` (`settings.ts:17, 38`) y `resolveSelection` (`catalog.ts:283-291`) usa la Clásica sin avisar si la paleta no está desbloqueada (el id sigue guardado). Un cliente viejo que reciba `degrade` lo trata como Clásica (`isPaletteId`, `palettes.ts:85-92`).
  - **Tarjeta de compartir:** `share.web.ts` y `ShareCardHost.native.tsx` no usan paletas (solo `Block`, `Fx`, `CollectionScreen`, `CelebrationModal` y `PrizeCard`), no cambian. Las partículas de `Fx.tsx:110-113` usan el color base plano (opcional).
  - **Onboarding:** las demos (`onboarding/demos.tsx`) usan `Block` con la paleta activa, así que mostrarán el degradé.
  - **Alto contraste (daltónicos):** igual que en CAMBIO-017, el estilo va con la paleta y Degradé no se pensó para daltónicos (la identidad de cada color depende del tono, como en las demás).
- **Decisiones que el usuario debe confirmar:**
  1. **Nombre:** "Degradé" (propuesto) o "Satén".
  2. **Nivel:** 22 (12.650 bloques con CAMBIO-004; 11.550 hoy). Alternativa: 21 (11.550 / 10.500), pegado a Aurora (20).
  3. **Intensidad del degradé:** 3,5 % (propuesto; cumple la regla en los tres conjuntos pero con margen de 0,014 en el peor color y se nota poco) frente a 5 % o más (más visible, pero falla la regla en dos colores: ver arriba). Mantenerlo o aceptar revisar la regla.
  4. **Los 9 colores base** (tabla): a verlos en el juego; el más cercano a la Clásica es el violeta (ΔE 7,1) y se puede alejar sin romper la regla si se prefiere.
- **Qué NO cambia:** `RULES_VERSION`, rankings, récords, las claves `tb_*` (incluida `tb_set1`), el motor (sigue eligiendo el color por posición), la API, las demás paletas y el comportamiento de la vista previa con ellas.
- **Relación con otros cambios:** va con **CAMBIO-016** (se gana por nivel, curva de CAMBIO-004) y comparte con **CAMBIO-017** el campo `style` del bloque.
- **Cómo verlo en esta carpeta:** sección "Premios", panel "Paletas". Con "Ahora" hay 8 paletas, como hoy; con "Con cambios", 11: **Degradé** (después de Contorno, con la marca "nuevo", "Llega al nivel 22 · desde 12.650 bloques" y sin "Hoy") con su muestra 3×3 dibujada con el degradé. Al hacer clic en su fila, el panel **"Vista previa"** (debajo de Paletas) dibuja los bloques con el degradé; toca un bloque para destruirlo (suena y estalla con el efecto elegido) y cambia el fondo a Liso o Aurora para compararlo.

### Resultado de la prueba real (`palettes.test.ts`)

- **Cómo se hizo (2026-11-25):** el `palettes.test.ts` real del juego se ejecutó sobre una copia en `config_logros/herramientas/prueba-paletas/`, **sin alterar el juego** (`bash config_logros/herramientas/prueba-paletas/correr.sh`; informe: `RESULTADOS.md` de esa carpeta). **Solo se midió sobre fondo Liso.**
- **Degradé pasa las 7 reglas** en el color base y en los dos extremos (+3,5 % de blanco arriba, de negro abajo), y también con el hex crudo. **Margen más justo: +0,011, en el extremo de arriba** (azul `#2b78db`, pos. 4, rango de contraste del rojo); el de abajo +0,026 y el base +0,082 (caso difícil +0,018). Coincide con el 3,5 % elegido aquí.

---

## CAMBIO-019 · Tres paletas más (Esmerilado, Tenue y Botón)

- **Estado:** propuesto (2026-11-24), por decisión del usuario. Maquetado en la web de esta carpeta (panel "Paletas" y "Vista previa", interruptor "Con cambios"); el juego no se tocó. Con CAMBIO-017 y 018 quedan **14 paletas** (las 8 de hoy + 6 nuevas: Tenue, Cristal, Botón, Contorno, Degradé, Esmerilado). Comparte con CAMBIO-017 y 018 la infraestructura del campo `style` del bloque; se implementa junto o después.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Esmerilado sin desenfoque.
- **Actualización (2026-11-26):** Esmerilado se dibuja sobre un respaldo opaco `#12121a`, ver CAMBIO-022 (alternativa A; **decidido: sin blur real, 2026-11-26**: Esmerilado queda como está en la web).
- **Qué:** tres paletas que cambian **cómo se dibuja el bloque**, no solo los colores. Valores nuevos de `Palette.style` (`palettes.ts:27-33`): `'frosted'` (Esmerilado), `'soft'` (Tenue) e `'inset'` (Botón); en la web, `estilo: 'esmerilado' | 'tenue' | 'boton'` (contrato en el comentario de `PALETAS`, `coleccion.js`). Todas van **por nivel** (CAMBIO-016).
- **Cómo se midió la regla de no ventaja (igual que CAMBIO-017 y 018).** Con una copia mía de las funciones de `palettes.ts` (`hue`, `hueDistance`, `luminance`, `contrastRatio`) y de los umbrales de `palettes.test.ts:102-131` (**no se corrió vitest**), sobre el **color efectivo que queda bajo el número**, no sobre el hex. Referencia de la Clásica: el rojo `#ff2a2a` contrasta 1,156–1,730 con sus colores SAFE (posiciones 2, 3, 4, 5, 7 y 8), caso más difícil ≤ 1,256; blanco ≥ 2,161; tono 42,5–173,1° (media 119,5°); distancia ΔE (CIELAB) mínima entre sus colores: 11,7. Fondo base: `#12121a` (`theme.ts:3`).

### 019-A · Esmerilado (`'frosted'`): vidrio esmerilado (glassmorfismo sin desenfoque real)

- **Nombre propuesto: "Esmerilado"** (alternativa: "Glassmorfismo"; en una frase, el primero lo entiende cualquiera y el segundo es el término técnico).
- **Qué es:** un cristal **lechoso blanco-azulado** (frosted glass) con el color de cada bloque **apenas insinuado**, borde fino de 1 px claro con luz arriba, sombra suave exterior y grano (**decidido: sin blur real, 2026-11-26**).
- **En qué se diferencia de Cristal (CAMBIO-017):** Cristal es una **gema coloreada** (el color al 50 % sobre el fondo oscuro, se ve más oscuro y saturado, borde blanco de 1,5 px, sin blur ni grano); Esmerilado es **claro, lechoso y casi gris-azulado** (70 % de blanco-azulado, el color solo se insinúa), con grano. Las capturas lado a lado (misma paleta de posiciones sobre Aurora) se ven claramente distintas.
- **Fórmula exacta:**
  - Tinte base de cada bloque (`colores`, los 9 hex que identifican a cada uno): `#f4282e #c74710 #d59a0a #2ebf6e #4893f4 #7e66d6 #f91395 #19c4be #8534db` (familias de la Clásica: rojo, naranja, amarillo, verde, azul, violeta, rosa, verde azulado, morado).
  - Capa de vidrio: `tintado = mezcla(#dde8ff, tinte, 35 % de tinte)` → `#e5a5b6 #d5b0ab #dacda9 #a0dacc #a9cafb #bcbbf1 #e79dda #98dbe8 #bea9f2`, pintada como `rgba(tintado, 0,70)`.
  - Brillo: degradado diagonal `linear-gradient(135deg, rgba(255,255,255,.30) 0%, rgba(255,255,255,.08) 60%)` encima (en el centro del bloque, donde va el número, vale ≈ .117).
  - Borde: 1 px `rgba(255,255,255,.45)`; luz superior `inset 0 1px 0 rgba(255,255,255,.6)`; sombra exterior suave `0 8px 24px rgba(0,0,0,.35)` (reemplaza la dura `0 5px 0` de `Block.tsx:123`).
  - Web: todo sobre el respaldo opaco `#12121a`, más una capa de grano (ruido SVG al 22 %). El número sigue blanco. **Decidido: sin blur real, 2026-11-26.**
- **Ajuste de 2026-11-25:** posición 7 de `#1cc7c2` a `#19c4be` para pasar `palettes.test.ts` con el color crudo (ΔE 1,2, imperceptible). Efecto en la capa y el color efectivo de esa posición: tintado `#99dcea` → `#98dbe8`, efectivo sobre Liso `#82aab6` → `#81aab4` (ΔE 1,2 entre ambos efectivos); en la comprobación de abajo cambian solo el tono de esa posición (166° → 168°, dentro del tope de 178,1°), la media (124,0° → 124,4°) y el blanco mínimo (2,51 → 2,52); el contraste con el rojo de esa posición sigue en 1,49 (1,491 → 1,485) y la ΔE mínima entre los 9 sigue en 8,2 (recalculado con mi copia de las fórmulas). Los números de Grilla, Aurora y Estrellas (más abajo) no se recalcularon: el cambio es de centésimas.
- **Colores efectivos sobre Liso** (capa + brillo del centro sobre `#12121a`): `#b08995 #a7908e #a9a18d #85a9a3 #8ba0c0 #9796ba #b183ab #81aab4 #988bba`.
- **Comprobación (Liso, estricta) y márgenes:**

  | Regla | Resultado |
  |---|---|
  | Tono SAFE en 37,5–178,1° | 43 · 170 · 144 · 118 · 168 · 103 ✓ (el más justo, 170°, a 8° del tope) |
  | Caso más difícil de tono (≤ 50,5°) · media (119,5 ± 20°) | 43° ✓ · 124,4° ✓ |
  | Contraste con el rojo en cada SAFE (1,156–1,730) | 1,45 · 1,46 · 1,40 · 1,32 · 1,49 · 1,20 ✓ (margen mínimo 0,044; máximo 0,24) |
  | Caso más difícil de contraste (≤ 1,256) | 1,20 ✓ (margen 0,056) |
  | Blanco ≥ 2,161 en los 9 | mín. 2,52 ✓ (margen 0,36) |
  | Distancia ΔE entre los 9 colores efectivos | mín. **8,2** (la de la Clásica: 11,7): **es la más baja de todas las paletas**, el precio de "color apenas insinuado". Se distinguen, pero menos. |

  - **Sobre los otros fondos:** ya no aplica. Desde CAMBIO-022 el bloque lleva un respaldo opaco `#12121a` y su color no depende del fondo (**decidido: sin blur real, 2026-11-26**).
- **Cómo se hace en el juego (decidido: sin blur real, 2026-11-26; reemplaza el plan anterior de desenfoque):** "vidrio falso". Dentro del bloque, un respaldo opaco `#12121a` (CAMBIO-022, alternativa A); encima la capa blanco-azulada al 70 % con el tinte (la fórmula de arriba), el brillo diagonal, el borde de 1 px claro, la luz superior y la sombra exterior; el número queda sobre todo. No hace falta ningún componente nuevo ni envolver el campo, el costo es el de un bloque con degradado y borde, y se ve igual en web y app. Forma de escribirlo: CAMBIO-022, "Dónde implementarlo", punto 7.
- **El grano** (ruido) **no se hace en la app**: no hay una forma barata y verificada de dibujarlo (`backgroundImage` solo admite degradados; no probé `feTurbulence` en `react-native-svg`). Sin grano la diferencia con la web es pequeña.
- **Nivel propuesto: 27** (el pedido). **18.900 bloques** con la curva de CAMBIO-004 (17.550 hoy). Es la más "premium" (la más difícil de dibujar y la más vistosa): va después de Dorado (25: 16.250; 2.650 de diferencia) y antes de Diamante (30: 23.250; 4.350).

### 019-B · Tenue (`'soft'`): los colores de la Clásica atenuados, con borde intenso

- **Nombre propuesto: "Tenue".**
- **Qué es:** relleno = el color de la Clásica **atenuado** (más apagado y claro, menos saturado), y un **borde de 5 px del color de la Clásica tal cual** (antes 2,5 px, luego 4 px; se subió a 5 el 2026-11-25 a pedido del usuario; en la muestra 3×3 de la web, 4 px) (el borde es el color original del motor: más intenso que el relleno). El número sigue blanco.
- **Fórmula exacta del relleno:** mismo **matiz** que la Clásica (el de HSL), **saturación × 0,55** y **luminosidad HSL ajustada hasta que la luminancia relativa WCAG sea 0,29** (igual en los 9; sale de bajar la saturación y subir o bajar la luminosidad lo justo). Se eligió 0,29 y **no** "mezclar con el fondo" porque mezclar con `#12121a` (a cualquier proporción, probé 35–60 %) deja a los colores oscuros y rompe la regla (el rojo de la trampa contrasta 1,3–3,5 con ellos, hasta el doble del tope de la Clásica); y bajar solo la saturación deja la luminancia de cada color donde estaba y cae en la franja prohibida (0,193–0,275) en varios. Con luminancia fija el resultado queda dentro de la franja admitida en los 9.

  | Pos. | Borde = Clásica | Relleno (atenuado) | ΔE relleno–borde |
  |---|---|---|---|
  | 0 | `#e5484d` | `#c97e81` | 39 |
  | 1 | `#f76b15` | `#c98156` | 42 |
  | 2 *(SAFE)* | `#e5a50a` | `#b18f3a` | 30 |
  | 3 *(SAFE)* | `#30a46c` | `#57a17d` | 16 |
  | 4 *(SAFE)* | `#0091ff` | `#5399cd` | 34 |
  | 5 *(SAFE)* | `#6e56cf` | `#968cc2` | 44 |
  | 6 | `#d6409f` | `#c17ea9` | 36 |
  | 7 *(SAFE)* | `#12a594` | `#3fa196` | **8** |
  | 8 *(SAFE)* | `#8e4ec6` | `#a487bc` | 43 |

- **Comprobación (el relleno es opaco: no depende del fondo):** tono 43 · 151 · 154 · 109 · 173 · 87° ✓ (media 119,6°, la de la Clásica 119,5°); contraste con el rojo **1,22 · 1,21 · 1,21 · 1,22 · 1,20 · 1,21** (rango 1,156–1,730 ✓, margen mínimo **0,046**; caso más difícil 1,20 ≤ 1,256 ✓ margen 0,035); blanco mín. **3,06** ✓ (margen 0,90); ΔE mínima entre rellenos **6,7** (violeta y morado), pero con el borde de la Clásica (mín. 11,7) los 9 se distinguen. Límites: el borde del verde azulado casi no se nota sobre su relleno (ΔE 8).
- **Grosor del borde (2026-11-25): 5 px en el bloque** (antes 2,5 px; luego 4 px; el usuario pidió subirlo otra vez a 5), **4 px en la muestra 3×3 de la web** (casillas de ~12,7 px: 4 px deja ~4,7 px de relleno visible; el escalado estrictamente proporcional daría menos de 1 px y no se notaría). Comprobado en las capturas de la web (vista previa con bloques de ~70 px): el borde se ve claramente grueso y el número sigue legible (con 5 px, en el bloque mínimo de 66 px el interior mide 56×56 y la letra, la mitad del alto = 33 px, con `lineHeight` 38 px, cabe; en una operación de 112×66 el interior es de 102×56 y `labelFontSize` limita la letra al 86 % del ancho del bloque, 96 px, así que también cabe). **El bloque no se ve "achicado":** el borde va dentro del tamaño del bloque (en la web `box-sizing: border-box`, y en RN el `borderWidth` también va dentro de `width`/`height`); lo que cambia es que el relleno atenuado ocupa menos (interior ≈ 72 % del área contra ≈ 86 % con 2,5 px) y el color intenso gana presencia. **Los números de contraste no cambian**: el relleno es el mismo y el borde no queda bajo el número (se midió siempre sobre el relleno). Detalles a verificar en el juego (CAMBIO-021), no medidos: la barra de vida blanca de abajo (`Block.tsx:137-143`) se dibuja dentro del borde, así que sería 10 px más corta en el ancho de 66 px, y el borde del verde azulado (ΔE 8 con su relleno) sigue siendo el menos visible.
- **Hallazgos a decidir:**
  1. **Todas las trampas quedan "en el extremo difícil" (≈ 1,21).** La regla se cumple, pero la Clásica va de 1,16 a 1,73 con media 1,35; con luminancia fija Tenue las pone todas en ~1,21. No es más fácil, es **algo más difícil en promedio**.
  2. **Se parece a Pastel** (también apagada y mate; ΔE entre sus colores de 3 a 14): la diferencia es el borde intenso y que parte de los colores de la Clásica. Y se parece a Contorno con relleno (la variante recomendada de CAMBIO-017). Ver decisiones.
- **Nivel propuesto: 9** (el pedido). **2.250 bloques** con la curva de CAMBIO-004 (1.800 hoy). Queda a 850 bloques de Neón (7: 1.400) y a solo 500 de Estrellas (10: 2.750); alternativa: nivel 8 (1.800 bloques con la curva nueva; 1.400 hoy), a 400 de Neón y 950 de Estrellas.

### 019-C · Botón (`'inset'`): relieve interior de botón físico

- **Nombre propuesto: "Botón".**
- **Qué es:** relleno **opaco** del color y **sombras interiores**: luz clara arriba-izquierda y sombra oscura abajo-derecha (botón **en relieve**); se mantiene la sombra exterior dura de siempre.
- **Fórmula exacta:** `box-shadow: 0 5px 0 rgba(0,0,0,.35), inset 3px 3px 4px rgba(255,255,255,.32), inset -3px -4px 5px rgba(0,0,0,.30)`. (Variante **hundido**, si se prefiere: invertir los dos `inset`.)
- **Los 9 colores base (más "caramelo": vivos y algo más claros que la Clásica):** `#ed417d #e16a2f #c9a32f #1aaf6a #1b76c3 #8c56e1 #e873c5 #13c4a4 #b63bd7`.
- **Las sombras no tocan el número.** El bloque mide como mínimo 66 px (`blockSizeFor`, `constants.ts:120`) y el número ocupa la mitad central; las sombras llegan a ~8 px del borde. Por eso **el color bajo el número es el color base**, y la regla se mide sobre el base. Los bordes claros y oscuros (`#f37ea7…` y `#a62e58…` para el primero) quedan fuera del texto.
- **Comprobación (base):** tono 45 · 152 · 153 · 97 · 169 · 73° ✓ (media 114,7°); contraste con el rojo **1,56 · 1,31 · 1,27 · 1,24 · 1,68 · 1,22** (rango ✓; margen **0,066** abajo y **0,05** arriba; caso más difícil 1,22 ≤ 1,256 ✓, margen 0,036); blanco mín. **2,22** (el amarillo; margen 0,06); ΔE mínima entre colores **19,7**; ΔE con la Clásica por posición 27 · 16 · 17 · 10 · 20 · 12 · 17 · 15 · 21 (el más cercano, el verde, 10).
- **Cómo se hace en el juego (verificado en el repo):**
  - `Block.tsx:123` ya usa `boxShadow` (`'0 5px 0 rgba(0,0,0,0.35)'`), igual que `ui.tsx:201` y `:213`. React Native del cliente es **0.88.1** y Expo SDK **58** (`package.json`). `boxShadow` con `inset` está soportado: `processBoxShadow.js:27, 104-105, 145-152` lo parsea (también en cadena, con varias sombras separadas por comas) y Android lo dibuja con `InsetBoxShadowDrawable` (`uimanager/drawable/InsetBoxShadowDrawable.kt`, aplicado desde `BackgroundStyleApplicator.kt:382-388`).
  - **Límite:** `MIN_INSET_BOX_SHADOW_SDK_VERSION = 29` (`InsetBoxShadowDrawable.kt:30`): las sombras interiores se dibujan desde **Android 10**; en versiones anteriores el bloque saldría sin relieve (no probé cuál es el `minSdk` de la app ni qué se ve en Android 9).
  - **Fallback si no se quiere depender de eso:** un `backgroundImage` con `linear-gradient(180deg, rgba(255,255,255,.22), transparent 25%, transparent 75%, rgba(0,0,0,.25))` (como el de `FieldBackground.tsx:89-100`), que da luz arriba y sombra abajo pero no el matiz izquierda-derecha.
- **Nivel propuesto: 16** (el pedido). **6.800 bloques** con la curva de CAMBIO-004 (6.000 hoy). Queda a 800 bloques de Retro (15: 6.000) y a 1.750 de Contorno (18: 8.550); alternativa: 17 (7.650 · 7.650 − 6.000 = 1.650 de Retro y 900 de Contorno).

### Niveles de las tres (resumen) y reparto completo

| Paleta | Nivel | Desde X bloques (fórmula de hoy) | Desde X bloques (CAMBIO-004) |
|---|---|---|---|
| Tenue | **9** | 1.800 | **2.250** |
| Botón | **16** | 6.000 | **6.800** |
| Esmerilado | **27** | 17.550 | **18.900** |

Reparto con todo lo propuesto (nivel de CAMBIO-004): Pastel 3 (300) · *Grilla 5 (750)* · Neón 7 (1.400) · **Tenue 9 (2.250)** · *Estrellas 10 (2.750)* · Cristal 12 (3.900) · Retro 15 (6.000) · **Botón 16 (6.800)** · Contorno 18 (8.550) · *Aurora 20 (10.500)* · Degradé 22 (12.650) · Dorado 25 (16.250) · **Esmerilado 27 (18.900)** · Diamante 30 (23.250). Ninguno choca con los fondos (5, 10, 20); el hueco más corto es Tenue 9 → Estrellas 10 (500 bloques) y Retro 15 → Botón 16 (800). El orden del catálogo (y de la web) sigue el del nivel.

### Dónde implementarlo (cliente)

- `apps/client/src/cosmetics/palettes.ts`: `PaletteId` suma `'esmerilado' | 'tenue' | 'boton'` (`:25`); `Palette.style` suma `'frosted' | 'soft' | 'inset'` (`:27-33`); para `'soft'`, el borde **no necesita campo**: es el color original del motor (el de la Clásica). Entradas nuevas en `PALETTES` (`:37-79`) con los hex de arriba; para `'frosted'`, constantes `FROSTED_BASE = '#dde8ff'`, `FROSTED_TINT = 0.35`, `FROSTED_ALPHA = 0.70` y una función que devuelva el `tintado` de un tinte. Actualizar el comentario de cabecera (`:3-24`): la regla se mide sobre el color efectivo.
- `apps/client/src/components/Block.tsx`: hoy `backgroundColor` fijo (`:93`) y `boxShadow` en `styles.blk` (`:123`). Con `style`: **frosted** = respaldo opaco `#12121a`, encima `rgba(tintado, .70)` y el brillo, `borderWidth: 1` claro y `boxShadow` suave (**decidido: sin blur real, 2026-11-26**); **soft** = `backgroundColor` del relleno atenuado, `borderWidth: 5` y `borderColor` = el color del motor (`color`, la prop de `:17`; así una trampa que cayó en un color SAFE tiene el borde SAFE); **inset** = `boxShadow` con las dos sombras `inset` (en cadena con la exterior). `overflow: 'hidden'` y `borderRadius: 16` (`:116-124`) siguen. Con borde el contenido se achica por `border-box`: comprobar el número de las operaciones (`labelFontSize`, `:37-42`). El número, la barra de vida (`:137-143`) y la sombra de la trampa (`:131-136`) no cambian.
- `apps/client/src/cosmetics/catalog.ts`: tres ítems nuevos en el orden de nivel (Clásica, Alto contraste, Pastel, Neón, **Tenue**, Cristal, Retro, **Botón**, Contorno, Degradé, Dorado, **Esmerilado**, Diamante, Constancia): `{ kind: 'level', n: 9 | 16 | 27 }`. `catalog.test.ts:38-41` fallará hasta que existan en los dos lados.
- `apps/client/src/cosmetics/palettes.test.ts`: los `it.each(PALETTE_IDS)` (`:73-78`, `:102-131`) miden el hex crudo: Tenue y Botón **pasan** tal cual (el relleno/base es el color bajo el número), pero **Esmerilado fallaría** (los tintes crudos no son lo que se ve): hay que medir su **color efectivo** (`tintado` al 70 % sobre `C.bg` + el brillo del centro). Tests de `getPalette('esmerilado').style === 'frosted'`, etc. (análogo de `:152`).
- Vistas de la paleta que hoy pintan cuadrados lisos y quedarían sin el estilo: `CollectionScreen.tsx:158-172` (`Preview`), `CelebrationModal.tsx:82-90` (`PaletteView`), `PrizeCard.tsx:11-14`; un solo componente de muestra que lea `style`.
- Docs al aplicar: `docs/reglas-y-balance.md` (`:168-187`: tres premios nuevos y la regla medida sobre el color efectivo), `docs/plan-jugabilidad.md:330-349`, `docs/arquitectura.md:69` y `docs/historia-y-decisiones.md`.

### Qué más afecta

- **Rendimiento en Android.** *Tenue*: solo un borde, no suma nada. *Botón*: dos sombras interiores por bloque (`InsetBoxShadowDrawable`, desde Android 10); no medido, pero es el estilo que más depende del dibujo nativo; el fallback es un degradado. *Esmerilado*: un degradado, un borde y una sombra exterior grande (`0 8px 24px`) por bloque; si pesara en la práctica, bajarla a una sombra corta (`0 5px 0`, como las demás). Esmerilado no desenfoca, así que no suma ninguna pasada nativa (**decidido: sin blur real, 2026-11-26**). Nada medido aún en el emulador `Pixel_Mi_Device`: se medirá más adelante, sin alarma (el usuario dice que la versión actual va muy bien en celulares lentos). **Prueba en Android: ver CAMBIO-021.**
- **Selección guardada y respaldo.** Igual que CAMBIO-016: `tb_set1` (`settings.ts:17, 38`) guarda el id sin borrarlo; `resolveSelection` (`catalog.ts:283-291`) usa la Clásica sin avisar si la paleta no está desbloqueada. Un cliente viejo que reciba uno de los tres ids lo trata como Clásica (`isPaletteId`, `palettes.ts:85-92`).
- **Tarjeta de compartir:** `share.web.ts` y `ShareCardHost.native.tsx` no usan paletas (solo `Block`, `Fx`, `CollectionScreen`, `CelebrationModal` y `PrizeCard`), no cambian. Las partículas de `Fx.tsx:110-113` usan los colores de la paleta lisos (opcional).
- **Onboarding:** las demos (`onboarding/demos.tsx`) usan `Block` con la paleta activa y mostrarán el estilo.
- **Alto contraste (daltónicos):** el estilo va con la paleta; ninguna de las tres se pensó para daltónicos.

### Decisiones que el usuario debe confirmar

1. **Nombres:** Esmerilado (o Glassmorfismo), Tenue, Botón.
2. ~~¿Fusionar Esmerilado y Cristal o mantener las dos?~~ **CERRADA (2026-11-25): NO se fusionan; se mantienen las dos** (Cristal en el nivel 12, Esmerilado en el 27). Dato que queda para la implementación: Esmerilado tiene la menor distinción entre colores (ΔE 8,2) y es mucho más estable que Cristal sobre Aurora.
3. **Tenue:** ~~¿se acepta que se parezca a Pastel y a Contorno con relleno?~~ **CERRADA (2026-11-25): que se parezca a Pastel o a Contorno "no importa"** (ya no es una pregunta abierta). Sigue abierto: ¿se acepta que sus trampas queden todas en ~1,21 de contraste (algo más difíciles que el promedio de la Clásica)? Alternativa: más luminancia (≈ 0,40) en las posiciones 0, 1 y 6, que nunca llevan trampa. Borde: **5 px** (cerrado el 2026-11-25).
4. **Niveles** 9 · 16 · 27 (o 8 · 17 · 27 si se prefiere más aire respecto de Estrellas y Retro).
5. **Botón:** ¿en relieve (propuesto) o hundido? ¿Se acepta que en Android 9 o menor salga sin relieve, o se prefiere el fallback con degradado?
6. ~~Esmerilado en la app: ¿con desenfoque real o sin él?~~ **CERRADA (2026-11-26), decidido: sin blur real.** El usuario: "como está ahora" (alternativa A de CAMBIO-022: respaldo opaco, vidrio falso; en la app, sin grano).
7. **Los 9 colores de cada una** (a verlos en el juego).

### Qué NO cambia

`RULES_VERSION`, rankings, récords, las claves `tb_*` (incluida `tb_set1`), el motor (que sigue eligiendo el color por posición), la API, las demás paletas y la vista previa con ellas.

### Cómo verlo en esta carpeta

Sección "Premios", panel "Paletas". Con "Ahora", 8 paletas, como hoy. Con "Con cambios", **14**: las seis nuevas (Tenue, Cristal, Botón, Contorno, Degradé, Esmerilado) llevan la marca "nuevo", su nivel con la curva nueva y su muestra 3×3 dibujada con su estilo. Al hacer clic en una fila, el panel "Vista previa" (debajo de Paletas) dibuja los bloques con ese estilo; toca un bloque para destruirlo y cambia el fondo (Liso, Grilla, Estrellas, Aurora). Esmerilado se ve igual sobre cualquier fondo (**decidido: sin blur real, 2026-11-26**).

### Resultado de la prueba real (`palettes.test.ts`)

- **Cómo se hizo (2026-11-25):** el `palettes.test.ts` real del juego se ejecutó sobre una copia en `config_logros/herramientas/prueba-paletas/`, **sin alterar el juego** (`bash config_logros/herramientas/prueba-paletas/correr.sh`; informe: `RESULTADOS.md` de esa carpeta). **Solo se midió sobre fondo Liso** (Grilla, Aurora y Estrellas no se probaron).
- **Esmerilado: pasa con el color efectivo, margen más justo +0,043** (rango de contraste del rojo; el caso difícil +0,057). **Con el hex crudo fallaba solo la posición 7** (`#1cc7c2`, por centésimas: tono −0,18°, rojo −0,05, blanco −0,06); con el ajuste a `#19c4be` (ver arriba) pasa en crudo y en efectivo.
- **Tenue: pasa, margen más justo +0,045** (rango de contraste del rojo; caso difícil +0,055; blanco +0,90). Pasa también en crudo: el relleno es el color bajo el número.
- **Botón: pasa, margen más justo +0,034** (caso difícil de contraste; blanco +0,059, el amarillo). Pasa también en crudo: la base es el color bajo el número.

---

## CAMBIO-020 · Vista previa interactiva dentro del juego (pestaña Colección)

- **Estado:** propuesto (2026-11-25), pedido del usuario. La web de esta carpeta ya tiene ese panel ("Vista previa", `preview.js` y `preview.css`) como maqueta; **el juego no se tocó**. Depende de CAMBIO-006 (orden de las tarjetas) y de CAMBIO-017/018/019 (los estilos nuevos de bloque; sin ellos la vista previa solo mostraría paletas lisas).
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Qué:** el panel interactivo de la web (un campo de 3×3 bloques que se tocan y se destruyen, con la paleta, el fondo, el efecto y el sonido que se elijan) existe también **dentro del juego, en la pestaña Colección, al final de las tarjetas de premios, justo después de "Fondos del campo"**. **Orden final de la pantalla** (con CAMBIO-006 y CAMBIO-007; confirmado por el usuario el 2026-11-25): **Insignia → Experiencia → Logros → Paletas → Sonidos → Efectos → Fondos del campo → Vista previa.** La tarjeta **Insignia** ya existe y va primera: `TierCard` es lo primero que se dibuja (`CollectionScreen.tsx:426`; su `Section title="Insignia"`, `:98`), antes de `LevelCard` (`:427`, "Nivel" hoy, "Experiencia" con CAMBIO-007).
- **Por qué:** hoy cada premio se ve como un dibujito fijo (`CollectionScreen.tsx:158-192`, `Preview`) y el sonido solo suena al elegirlo (`sounds.preview`, `:395`); no se puede ver cómo queda un bloque real, con su efecto y su fondo, ni oírlo al tocar. Con estilos de bloque nuevos (cristal, degradé, esmerilado, relieve), un cuadradito de color ya no basta para decidir.

### Lo que se leyó en el juego (con archivo y línea)

- **Orden y tarjetas** (`CollectionScreen.tsx`): `TierCard` (`:426`), `LevelCard` (`:427`), luego `TYPE_ORDER.map(...)` (`:429-449`; `TYPE_ORDER` = paletas, sonidos, efectos, fondos, `catalog.ts:84`), `Section title="Logros"` (`:451-457`) y el pie "Lo que eliges se guarda…" (`:459`). La vista previa se agrega **entre `:449` y `:451` hoy** o, con CAMBIO-006 (Logros sube), **después del `TYPE_ORDER.map` y antes del pie (`:459`)**, con el mismo `Section` (`:61-70`, ancho máximo 480, `C.panel`).
- **Cómo se equipa un premio:** `pick` (`:390-396`) guarda el id en `tb_set1` con `updateSettings({ [SETTING_KEY[tipo]]: id })` y, si es un sonido, suena `sounds.preview(id)`. La fila (`ItemRow`, `:261-305`): `unlocked = isUnlocked(item, stats)`; si está bloqueada queda `disabled` (`:285`), con texto atenuado y el requisito más lo que falta (`${item.goal} · ${missingText(...)}`, p. ej. "te faltan N bloques", `:277-278`); si está en uso, muestra `En uso` y `✓` (`:279, :302`).
- **Dónde se guarda la selección:** `tb_set1` (`lib/settings.ts`), validada por `resolveSelection` (`catalog.ts:283-291`: lo bloqueado cae al valor por defecto). Hook: `useActiveCosmetics()` (`cosmetics/active.ts:60-63`); selectores baratos `useActivePalette`/`useActiveEffect`/`useActiveBackground` (`:70-72`). El catálogo sale de `CATALOG` (`catalog.ts`) y los colores de `getPalette` (`palettes.ts:90`).
- **Bloque real** (`components/Block.tsx`): ya acepta **`palette?`** ("Paleta a usar en vez de la elegida en la Colección (vistas previas)", `:19-20`); recibe `x, y, w, h, label, color, red, life, hitKey, gone, spawn`; anima aparición (`:53-58`), golpe (`:67-76`) y apagado; tiene `pointerEvents="none"` (no recibe toques). **Fondos:** `FieldBackground` acepta **`id`** ("con `id` dibuja ese (vistas previas)", `FieldBackground.tsx:13-14`) y `cell`; ya se usa en miniatura en `CollectionScreen.tsx:188`.
- **Efectos:** `Burst` (`Fx.tsx:108`) acepta **`effect`** ("lo fuerza (vistas previas…)", `:106-107`); se dispara con `useFxList().add({ kind: 'burst', x, y, color, effect })` (`:190, :201-231`) y se dibuja con `<FxLayer items={…} />` (`:233-252`; vive 750 ms, `:198`). Las demos del onboarding (`onboarding/demos.tsx:52-63`) ya combinan `Block` + `useFxList` + `FxLayer` en un campo chico: es el precedente.
- **Sonido:** `sounds.play(nombre, arg, packId?)` (`game/sounds.ts:115`) acepta **`packId`** ("para escucharlo en la Colección", `:112`) y además vibra (`BUZZ`, `:93-104`, vía `fx.buzz`). Todo pasa por `fx.beep`/`fx.buzz` (`platform/fx.web.ts:64-65, 111, 139-140`; `fx.native.ts`), que **respetan los ajustes de sonido y vibración** (`getSettings().sound` / `.haptics`) y nunca lanzan (`try/catch`).
- **Modo silencio de iPhone/iPad:** `silentTipOnce()` (`components/silentTip.ts`, llamado al empezar la 1.ª partida, `GameScreen.tsx:554`) muestra una vez "¿No escuchas el sonido? Revisa que tu iPhone o iPad no esté en modo silencio." La web crea el contexto de audio solo dentro de un gesto (`fx.web.ts:44-75`, `onGesture`) y el juego respeta el silencio (categoría `ambient`, `fx.web.ts:105-108`; decisión del usuario del 19 nov 2026). Tocar un bloque de la vista previa **es un gesto**, así que el sonido funciona; conviene llamar `silentTipOnce()` en el primer toque (solo actúa en iOS y solo una vez) para quien entra a la Colección sin haber jugado.

### Qué se reutiliza tal cual (para que se vea y suene igual que en la partida)

`Block`, `FxLayer` + `useFxList` (con `Burst`), `FieldBackground` y `sounds.play`. No se copia dibujo ni síntesis (la web de esta carpeta sí los copia porque es una maqueta aparte; el juego no debe tener dos versiones). Cuando lleguen los estilos de CAMBIO-017/018/019, la vista previa los muestra sin más, porque están en el mismo `Block`. Regla de la raíz: **web y app deben verse y jugarse igual**; con el mismo componente se cumple por construcción, pero hay que revisarlo en las dos (en Esmerilado la diferencia prevista entre plataformas es el grano, que la app no dibuja; CAMBIO-019, **decidido: sin blur real, 2026-11-26**).

### Qué hay que parametrizar (hoy solo usan lo equipado)

1. `Block`: ya tiene `palette`; el estilo sale de la paleta (`style`), no hace falta otra prop.
2. `FieldBackground`: ya tiene `id`. 3. `Burst`/`FxSpec`: ya tiene `effect`. 4. `sounds.play`: ya tiene `packId`.
5. Lo único nuevo es un componente, p. ej. `PreviewPanel` en `components/` (UI con estado local), que reciba `{ palette, background, effect, sound }` por props y arme el campo con 9 bloques.

### Comportamiento propuesto

- **Un componente de interfaz, sin motor.** Estado local de 9 bloques (`label`, toques que faltan, `color` de las posiciones 0–8, `life` fijo). **No usa `packages/engine`, ni estadísticas, ni historial, ni reloj de partida.** Tocar un bloque (un `Pressable` transparente encima de cada uno, porque `Block` tiene `pointerEvents="none"`): baja su contador (en operaciones, cuenta hasta su resultado); suena `sounds.play('hit', n, sonido)`; `hitKey` sube para la animación de golpe. Al llegar a 0: `sounds.play('kill', 0, sonido)`, un `Burst` con el efecto elegido, el bloque desaparece y **reaparece** a los ~0,8 s con otro número (para jugar sin parar). Mezcla números y operaciones ("2+3", "8÷2") para ver el ancho 1,7:1 de las operaciones, y **un bloque trampa** (texto rojo) para ver cómo se ve en esa paleta (no hace daño: no hay vidas ni reloj).
- **Qué muestra:** lo que el jugador **tiene equipado** (`useActiveCosmetics()`) y **se actualiza al instante** cuando equipa otro premio en las tarjetas de arriba (lee la misma selección; no hay botón).
- **Premios bloqueados (DECISIÓN CERRADA por el usuario, 2026-11-25):** un premio bloqueado **no se puede probar** en la vista previa; en ella solo se prueba lo que el jugador **tiene desbloqueado**. Diseño simple: el panel muestra **lo equipado** (`useActiveCosmetics()`), y como equipar ya exige tenerlo desbloqueado (`ItemRow` deja `disabled` lo bloqueado, `:285`, y `resolveSelection` lo ignora, `catalog.ts:283-291`), no hace falta estado de "probando", etiquetas ni botón de "volver a lo mío". Tocar una tarjeta bloqueada sigue sin hacer nada, como hoy.
- **Sonido y vibración:** cada toque suena con el paquete elegido; la vibración y el silencio los gobiernan los mismos ajustes que la partida (`fx`), así que con sonido apagado en el Perfil el panel queda mudo.

### Accesibilidad

- Cada bloque es un `Pressable` con `accessibilityRole="button"` y `accessibilityLabel` como "Bloque, faltan 3 toques" u "Operación 2 más 3, resultado 5, faltan 5 toques" (trampa: "Bloque trampa; aquí no hace daño"); al destruirse, una región viva con "Bloque destruido".
- Ayuda en español bajo el campo: "Toca un bloque. Un número muestra los toques que faltan; en una operación, toca tantas veces como su resultado. Así se ve y suena lo que llevas puesto." El título "Vista previa" lleva `accessibilityRole="header"` (ya lo hace `Section`, `:64`).
- Es solo demostración: no cuenta para nada y no compite con el desplazamiento de la Colección (un `Pressable` responde al toque, no al arrastre).

### Rendimiento

- **9 bloques + un fondo estático + partículas de a una**, casi siempre quietos (solo se animan al tocarlos o al reaparecer): mucho menos exigente que la partida. `FieldBackground` es estático y memorizado (`FieldBackground.tsx:18`).
- **Esmerilado equipado no cuesta más que las demás paletas con degradado:** son capas sobre un respaldo opaco (CAMBIO-019, **decidido: sin blur real, 2026-11-26**).
- Los temporizadores de reaparición y los efectos se limpian al salir de la pantalla (el hook de efectos ya lo hace: `Fx.tsx:206-212`; los de reaparición, a hacer igual) y el panel no corre nada si la pestaña no está a la vista (`useIsFocused()`, que la pantalla ya importa, `:1`).

### Pruebas

- **Sin dibujar (vitest):** la lógica del panel como función pura, p. ej. `previewStep(estado, toque)` (baja el contador, avisa cuándo se destruye, da el siguiente número al reaparecer); y que una paleta desconocida caiga en la Clásica (`getPalette`). `resolveSelection` ya está cubierto por `catalog.test.ts` (lo bloqueado se ignora aunque el panel lo muestre).
- **Con dibujo:** el repo no tiene pruebas de componentes de React Native; se verifica a mano en la web (Playwright con viewport de celular) y en el emulador Android (`Pixel_Mi_Device`): tocar hasta destruir, reaparición, cada fondo, cada efecto, cada paquete de sonido con sonido encendido y apagado, y las paletas nuevas cuando existan.

### Qué más afecta

- **Docs al aplicar:** `docs/arquitectura.md` (componentes de la Colección) y `docs/historia-y-decisiones.md` (por qué la vista previa usa los mismos componentes que la partida y qué se decidió sobre premios bloqueados). No toca `docs/reglas-y-balance.md`.
- **Punto de novedad de la pestaña** (`lib/collectionScore.ts`, `lib/collectionNews.ts`), tarjeta de compartir, onboarding y perfil: no cambian.
- **La web de esta carpeta** ya tiene el panel (bajo Paletas; en el celular, fijo arriba); su lugar en el juego sería al final de los premios. La web no se movió: lleva una línea de ayuda que lo dice.

### Decisiones que el usuario debe confirmar

**Cerradas por el usuario (2026-11-25):** (a) la vista previa va al final de los premios, después de "Fondos del campo"; (b) **los premios bloqueados no se pueden probar**: solo se prueba lo desbloqueado.

**Siguen abiertas:**
1. **Trampa en la vista previa:** ¿mostrar un bloque trampa (recomendado, para ver la trampa roja en cada paleta) o solo bloques normales?
2. ~~Desenfoque de Esmerilado en la vista previa~~ **CERRADA: decidido: sin blur real, 2026-11-26** (la vista previa usa el mismo bloque que la partida).

**Prueba en Android: ver CAMBIO-021.** Con el APK de prueba (todo desbloqueado) la vista previa sí puede mostrar todos los premios, porque ahí el equipar no tiene candados; en el APK real, solo lo desbloqueado.

### Qué NO cambia

`RULES_VERSION`, rankings, récords, historial, estadísticas, las claves `tb_*` (incluida `tb_set1`), el motor (`packages/engine`), la API y las reglas. El panel no guarda nada.

### Cómo verlo en esta carpeta

Sección "Premios": panel "Vista previa" (bajo Paletas). Elige una paleta, un sonido, un efecto o un fondo con un clic en su fila y toca los bloques. Bajo el panel, una línea de ayuda dice dónde irá en el juego y que allí solo se podrán probar los premios desbloqueados (en esta web se puede elegir todo: es un banco de análisis).

---

## CAMBIO-021 · Probar las paletas y la vista previa en Android con un APK de prueba, antes del APK final

- **Estado:** propuesto (2026-11-25), pedido del usuario. **Es solo un plan para después de implementar CAMBIO-016 a 020; hoy no se toca nada del juego.**
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Aplicado el modo de prueba (compilación `.prueba` y desbloqueo); el resultado de la prueba del APK se anota en `../docs/pendientes.md`.
- **Qué:** una vez implementados los cambios de paletas (016 a 019) y la vista previa (020), generar un **APK de prueba** para ver cómo se ven **todos los colores y estilos nuevos en Android** (emulador `Pixel_Mi_Device` y teléfono real), con **todo desbloqueado** (sin candados), solo para mirar. Cuando todo se vea bien, se genera el **APK definitivo**. Quedan **dos APK: uno de prueba y uno real.**
- **Por qué:** la web no basta para dar por buenos los estilos. Ya pasó con el menú: en la web se veía bien y en el APK dejaba una "sombra rara" (el desenfoque nativo de Android suma un tinte gris); se resolvió probándolo en el emulador y con el aviso del usuario (`docs/historia-y-decisiones.md:327-328`: el velo de Android usa el color del fondo). Puede repetirse con **Esmerilado** (capas translúcidas sobre un respaldo opaco; **decidido: sin blur real, 2026-11-26**), **Botón** (sombras interiores `inset`, que exigen Android 10 o mayor: `InsetBoxShadowDrawable.kt:30`, CAMBIO-019), **Cristal**, **Degradé**, **Tenue** (borde de 5 px) y **Contorno**. Y el build que se reparte (release, con el JS empaquetado) puede fallar de formas que no se ven al desarrollar: el primer build del APK 0.3.0 se cerraba al abrir por un problema de resolución de módulos del bundle (`docs/historia-y-decisiones.md:336-338`). Por eso el APK de prueba debe ser un build **release** (con el JS dentro), no solo el cliente de desarrollo.

### Cómo se compila hoy (leído en los docs, con ruta y línea)

- **Emulador y app de desarrollo** (`docs/desarrollo.md:47-61`): requisitos ya instalados (Android Studio, JDK 21, emulador `Pixel_Mi_Device`, `:49`); `pnpm exec expo run:android --no-bundler --device emulator-5554` compila e instala la app de desarrollo (~10 min la primera vez; genera `android/` con `expo prebuild`, `:52-55`); Metro con `EXPO_PUBLIC_AUTH_DEV_FAKE=1 pnpm exec expo start --dev-client` y `adb reverse tcp:3000 …`/`tcp:8081 …` (`:56-59`); y `adb shell am start … exp+touched-block://…` para abrirla (`:60`). Con esto los cambios de JS se ven al instante (*fast refresh*, `:63`). Los docs **no dicen cómo arrancar el emulador desde la terminal** (se supone Android Studio; no lo verifiqué).
- **APK release firmado** (`docs/despliegue.md:311-318`): `pnpm exec expo prebuild -p android`, y en `android/`: `EXPO_PUBLIC_API_URL=https://api.touchedblock.app NODE_ENV=production ./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64` → `app/build/outputs/apk/release/app-release.apk` (`:9`). La firma sale de `~/.touched-block/release.keystore` y `keystore.properties` (`:298`); **sin esas claves el release sale firmado con la clave debug**, solo para probar, y Gradle lo avisa (`:298`). Hay que subir `versionCode` en cada APK que se reparta (`:321`).
- **Rutas largas de Windows** (`docs/historia-y-decisiones.md:240-242`; `docs/desarrollo.md:67`): el C++ se compila en `~/.tbcxx/` por el plugin `plugins/withShortCxxPath.js`; no hay que hacer nada, solo saber que se puede borrar esa carpeta para una recompilación limpia.
- **El patrón de variables solo de prueba ya existe:** `EXPO_PUBLIC_AUTH_DEV_FAKE` (`apps/client/src/config.ts:19-20`: `authDevFake: process.env.EXPO_PUBLIC_AUTH_DEV_FAKE === '1'`; documentada en `.env.example:18`; el comando del APK real **no** la lleva, `docs/despliegue.md:311`, y el workflow de la web solo define `EXPO_PUBLIC_API_URL`, el client id de Google y el de Apple, `.github/workflows/deploy-web.yml:72-74`). Expo incrusta en el bundle solo las `EXPO_PUBLIC_*` que se leen con `process.env.EXPO_PUBLIC_X` literal (`config.ts:2-3`).

### Cómo sería el "modo prueba" (propuesta más simple)

1. **Una bandera de build** `EXPO_PUBLIC_UNLOCK_ALL=1`, leída igual que la otra en `config.ts` (`unlockAll: process.env.EXPO_PUBLIC_UNLOCK_ALL === '1'`).
2. **Un solo punto de uso:** `isUnlocked` (`apps/client/src/cosmetics/catalog.ts:204-206`, hoy `return meets(item.req, s)`) devuelve `true` si `config.unlockAll`. De ahí cuelgan las filas de la Colección (`ItemRow`, `CollectionScreen.tsx:276`), `resolveSelection` (`catalog.ts:283-291`, que decide lo que de verdad se usa en el bloque) y la vista previa de CAMBIO-020, así que equipar y ver cada paleta, sonido, efecto y fondo funciona sin tocar nada más. Efecto secundario a revisar: `unlockedIds`/`newlyUnlocked` (`catalog.ts:209-216`) podrían disparar avisos de "¡Desbloqueaste…!" al abrir la app; en el modo prueba conviene silenciarlos o ignorarlos.
3. **Etiqueta visible "MODO PRUEBA"** en la Colección cuando `config.unlockAll` (para que nadie confunda este APK con el real).
4. **Constancia y Corazones** solo se listan con cuentas (`CollectionScreen.tsx:307-311`, `features.accounts`): si se quieren ver, compilar también con `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_GOOGLE_CLIENT_ID`; si no, el APK queda en modo invitado y la Colección se abre desde el Perfil (`:374`).
5. **Compilación del APK de prueba** (release con el JS dentro): igual que `docs/despliegue.md:311-318` pero **sin el `versionCode` del APK repartido ni su firma real**: `EXPO_PUBLIC_UNLOCK_ALL=1 NODE_ENV=production ./gradlew app:assembleRelease …`, con la clave debug (sin las `TB_UPLOAD_*`). Para iterar rápido en el emulador, alternativa: `EXPO_PUBLIC_UNLOCK_ALL=1 pnpm exec expo start --dev-client` (`docs/desarrollo.md:58`).
6. **Que no llegue nunca a producción:** (a) la variable solo se escribe en la línea de comandos del APK de prueba, nunca en `deploy-web.yml` ni en el comando de `despliegue.md:311`; (b) etiqueta "MODO PRUEBA" visible; (c) el APK de prueba **no se reparte** ni se sube a ningún lado; (d) sugerencia para el momento de implementar: una prueba o un chequeo del build de producción que falle si la bandera está activa (no lo diseñé ni lo verifiqué). Aviso: un APK firmado con la clave debug **no se puede instalar encima** del real (distinta firma): en el teléfono de prueba hay que desinstalar el real primero (se pierden los datos locales de ese teléfono) o usar un identificador distinto (no está previsto hoy: `app.json` tiene `app.touchedblock`, `:12`).

### Qué revisar en el emulador y el teléfono (lista corta)

1. **Cada paleta nueva** (Tenue, Cristal, Botón, Contorno, Degradé, Esmerilado) **sobre los 4 fondos** (Liso, Grilla, Estrellas, Aurora).
2. **Esmerilado (vidrio falso; decidido: sin blur real, 2026-11-26):** que se vea como en la web, sin sombras raras ni bordes cortados o más claros, con las capas recortadas por el borde redondeado y bien al animarse el bloque.
3. **Sombras interiores de Botón** (relieve visible; en Android 9 o menor no hay `inset`).
4. **Borde de Tenue de 5 px:** que se vea grueso sin comerse el color ni el número (bloque de 66 px y operaciones).
5. **La trampa roja se distingue en todas las paletas** (los números salen de la regla de no ventaja, pero hay que verlo en pantalla).
6. **Vista previa interactiva** (CAMBIO-020): sonido, efectos, reaparición, y que con todo desbloqueado equipar cada premio funcione.
7. De paso, el rendimiento a ojo con Esmerilado (sin alarma: se medirá más adelante).

### Qué NO cambia

Nada del juego hoy: es un plan para después de implementar. **No sube `RULES_VERSION`**, no toca rankings, récords ni las claves `tb_*`; el modo prueba no guarda nada distinto (las selecciones van a `tb_set1` como siempre, así que en el teléfono de prueba conviene no mezclarlas con las de un jugador real).

### Decisión (mi recomendación, a confirmar por el usuario)

**¿APK solo de la pantalla de Colección o el juego completo con modo prueba?** Recomiendo **el juego completo con la bandera `EXPO_PUBLIC_UNLOCK_ALL`** (un solo cambio en `isUnlocked`): para juzgar las paletas hay que verlas **jugando** (trampa roja, 4 fondos, efectos de destrucción, bloques en movimiento) y no solo en la tarjeta, y un APK solo de Colección exigiría otra pantalla de entrada y duplicaría rutas. Contra: el build de prueba incluye todo el juego (no es un riesgo: nunca se reparte). Alternativa si se prefiere algo más chico: una ruta oculta que abra solo la Colección con la bandera, pero no la recomiendo.

### Cómo verlo en esta carpeta

No hay nada que ver en la web: es un plan. La web de esta carpeta ya muestra todos los estilos con todo seleccionable.

---

## CAMBIO-022 · 11 fondos del campo nuevos (de 4 a 15)

- **Estado:** propuesto (2026-11-25), pedido del usuario: "los fondos de campo: quiero 11 más para tener un total de 15". Maquetado en la web de esta carpeta con el interruptor en "Con cambios" (marcados "nuevo"); **el juego no se tocó**. Prueba en Android: ver CAMBIO-021.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Los requisitos son los de CAMBIO-025/026.
- **Reemplazado por CAMBIO-025:** los niveles de los 15 fondos y el orden por nivel (columnas "Nivel" y "Desde", decisión 2): ahora se ganan por logros y Bosque nocturno por invitar a un 3.er amigo; los dibujos no cambian.
- **Ampliado por CAMBIO-026:** 5 fondos más (con "Con cambios" son 20).
- **Qué:** a Liso (inicio), Grilla (nivel 5), Estrellas (10) y Aurora (20) se suman **11 fondos nuevos**, repartidos entre los niveles 2 y 40, todos **de color pero oscuros** (repintados más vivos el 2026-11-26, ver decisión 1), ocho estáticos y tres con una animación lenta. En "Fondos del campo" la lista pasa a estar **ordenada por nivel** (con "Ahora" siguen los 4 de hoy). El campo de la "Vista previa" (CAMBIO-020) dibuja el fondo elegido.
- **Por qué:** pedido del usuario; más premios por nivel a lo largo de toda la progresión (hoy el último fondo es el nivel 20 y entre el 10 y el 20 no hay ninguno).

### Los 11 fondos

Nivel por jugador (la curva de CAMBIO-004, `25·n·(n+1)`; entre paréntesis la de hoy, `25·n·(n−1)`). No se repite ningún nivel que ya use un fondo (5, 10, 20) ni una paleta (3, 7, 9, 12, 15, 16, 18, 22, 25, 27, 30). Los más vistosos, más arriba.

| id | Nombre | Frase de la fila | Color base | Tipo | Nivel | Desde (con CAMBIO-004) |
|---|---|---|---|---|---|---|
| `puntos` | Puntos | Puntos violetas y celestes sobre azul índigo | `#141436` (`#1a1742` → `#11142f`) | estático | 2 | 150 bloques (50) |
| `rayas` | Rayas | Rayas diagonales violetas, del morado al azul | `#1b1445` (`#26164f` → `#0d1c3f`) | estático | 4 | 500 (300) |
| `hexagonos` | Hexágonos | Panal de líneas celestes sobre azul | `#0b1f46` (`#0c2550` → `#0a1634`) | estático | 6 | 1.050 (750) |
| `circuito` | Circuito | Pistas de placa electrónica sobre verde azulado | `#042723` (`#07382c` → `#031c20`) | estático | 8 | 1.800 (1.400) |
| `atardecer` | Atardecer | Del azul índigo al ámbar, con el sol tras los montes | `#43205a` (`#171a4a` → `#4a2a48` → `#53321a` → `#3d2410`) | estático | 11 | 3.300 (2.750) |
| `oceano` | Océano | Agua azul con rayos de luz y burbujas | `#073055` (`#09385f` → `#041c38`) | estático | 14 | 5.250 (4.550) |
| `bosque` | Bosque nocturno | Pinos verdes bajo la luna | `#0b3739` (`#0b2740` → `#0b3a28` → `#082a1a`) | estático | 17 | 7.650 (6.800) |
| `lluvia` | Lluvia | Lluvia azul acero que cae (animado) | `#152a47` (`#1c3050` → `#0d1c32`) | **animado** (1 capa) | 21 | 11.550 (10.500) |
| `nieve` | Nieve | Copos que bajan sobre lomas nevadas (animado) | `#172f54` (`#12244a` → `#1e3a5e`) | **animado** (2 capas) | 26 | 17.550 (16.250) |
| `nebulosa` | Nebulosa | Nubes de gas violetas, turquesas y magentas | `#1c0f42` (`#150c36` → `#100a2e`) | estático | 32 | 26.400 (24.800) |
| `luciernagas` | Luciérnagas | Luces que laten sobre el pasto (animado) | `#0a2e27` (`#08202e` → `#0c3520` → `#0a2c17`) | **animado** (2 grupos) | 40 | 41.000 (39.000) |

- **"Color base"** es un color dominante del campo (colores del 2026-11-26). Entre paréntesis, otros tramos del degradé. Ya no condicionan el color de los bloques (ver decisión 1).
- Cada fila de la tabla de Premios lleva el requisito "Llega al nivel N · desde X bloques" **sin "Hoy:"** (no existen hoy); los 4 fondos de siempre conservan su "Hoy: …" tachado (los mueve CAMBIO-004).
- **La miniatura de la fila** es el mismo dibujo a media escala (en Lluvia, Nieve y Luciérnagas, un cuadro quieto con las gotas, copos o luces más juntos). Ver decisión 3.

### Cómo se haría en React Native (todo con lo ya instalado)

Hay en `apps/client/package.json`: `react-native` 0.88.1, `react-native-svg` 15.16, `react-native-reanimated` 4.7.1 y `expo-blur`; **no hay `expo-linear-gradient` y no hace falta**: `FieldBackground.tsx` ya usa `backgroundImage: 'radial-gradient(…)'` para Aurora (RN ≥ 0.80). Receta común (un `View` absoluto con `pointerEvents="none"`, como los de hoy, y todo `memo`):

- **Escenas con degradados:** un solo `View` con `backgroundImage` (varias capas `linear-gradient` / `radial-gradient` con porcentajes, igual que Aurora). Los detalles puntuales (burbujas, estrellitas, luciérnagas) van en un `<Svg>` con `Circle`, no como degradados de px (más seguro entre plataformas).
- **Mosaicos:** un `<Svg>` con `<Defs><Pattern patternUnits="userSpaceOnUse" …>` y un `<Rect fill="url(#p)">`. Los trazos de la web (`extras-fondos.css`, variables `--t-*`) son SVG: sirven tal cual como contenido del `Pattern`.
- **Animados:** Reanimated, **un solo valor compartido por capa** (`useSharedValue` + `withRepeat(withTiming(…, { easing: Easing.linear }), -1)`) y un `useAnimatedStyle` con una sola propiedad (`translateY` u `opacity`); la capa es un `View` más alto que el campo con un `Pattern` dentro, que se desplaza **exactamente un mosaico** por vuelta (sin saltos). Con `renderToHardwareTextureAndroid` (y `shouldRasterizeIOS`) la capa se dibuja una vez y solo se mueve la textura. Si el sistema pide "reducir movimiento" (`useReducedMotion()` de Reanimated) la capa queda quieta.

| Fondo | En RN | Nodos |
|---|---|---|
| Puntos | `View` con `linear` + `Svg` con 2 `Pattern`: 66×66 (`Circle` r 3 violeta al 55 %) y 22×22 (r 1,9 celeste al 40 %) | 1 View + 1 Svg |
| Rayas | `View` con `linear` a 160° + `Svg` + `Pattern` 26×26 girado 45° con un `Rect` de 11 px `#a078ff` al 13 % | 1 View + 1 Svg |
| Hexágonos | `View` (`radial` azul arriba al 22 % + `linear`) + `Svg` + `Pattern` 44,8×78,4 (`viewBox` 28×49) con el `Path` del panal, `#66b8ff` al 20 % | 1 View + 1 Svg |
| Circuito | `View` con `linear` + `Svg` + `Pattern` 96×96 (`viewBox` 80×80) con 1 `Path` (pistas `#3dffc0` al 26 %) y 5 `Circle` (pastillas al 24 %, borde 45 %) | 1 View + 1 Svg |
| Atardecer | `View` con `linear` de 7 paradas + `Svg` pegado abajo: sol (`Circle` r 17 al 60 % con halo `RadialGradient` hasta 90 px) y `Pattern` 200×50 de montes (`#3a1638`, `#1d0b24`) | 1 View + 1 Svg |
| Océano | `View` con `backgroundImage` (rayos `linear` a 105° al 5 – 6,5 %, `radial` arriba al 10 % y abajo turquesa al 14 %, `linear` de 4 paradas) + `Svg` con 6 `Circle` de borde (burbujas) | 1 View + 1 Svg |
| Bosque nocturno | `View` con `linear` + `Svg`: luna (`Circle` r 8 con halo) y 2 `Pattern` pegados abajo: pinos lejanos 90×60 (`#145036`) y cercanos 120×70 (`#03130b`) | 1 View + 1 Svg |
| **Lluvia** | `View` con `backgroundImage` + **1 `Animated.View`** (alto + 150) con `Svg`/`Pattern` 100×150 de 4 rayitas (`#a9d4ff` al 42 %); `translateY` 0 → 150 en 1,4 s, lineal | 1 View + 1 animado |
| **Nieve** | `View` con `linear` + `Svg` pegado abajo (`Pattern` 200×34 de dos lomas `#2f4e77` y `#3d5f8c` con cresta clara de 1 px) + **2 `Animated.View`** con `Pattern` 160×200 (11 s) y 110×140 (17 s) | 1 View + 1 Svg + 2 animados |
| Nebulosa | `View` con `backgroundImage` (3 `radial`: violeta al 40 %, turquesa al 26 %, magenta al 24 %, + `linear`) + `Svg` con 12 `Circle` (estrellitas) | 1 View + 1 Svg |
| **Luciérnagas** | `View` (`radial` verde abajo + `linear`) + `Svg` con `Pattern` 80×36 de pasto (`#02140a`) + **2 `Animated.View`**, cada uno con un `Svg` de 5 `Circle` y su `RadialGradient` de halo; `opacity` 0,05 ↔ 1 y `translate` (0,0) ↔ (10,−14), con 6 y 8 s y desfase | 1 View + 1 Svg + 2 animados |

Los valores exactos (paradas y posiciones) están en `extras-fondos.css`.

Todos los nodos son pocos (máx. 4 por fondo); como máximo **3 fondos animados** (Lluvia, Nieve, Luciérnagas) y ninguno recalcula nada mientras se juega.

### Dónde implementarlo

1. `apps/client/src/cosmetics/catalog.ts`: 11 ítems `item('puntos', 'background', 'Puntos', { kind: 'level', n: 2 })` … (ids y niveles de la tabla). El orden de `CATALOG` define el de la tarjeta (CAMBIO-006): ordenar los fondos por nivel.
2. `apps/client/src/components/FieldBackground.tsx`: una rama por fondo (`if (bg === 'puntos') return <Dots />` …), cada una un componente chico memorizado. Actualizar el comentario de la cabecera (hoy dice "`liso`, `grilla`, `estrellas` o `aurora`" y "es estático (sin animación por cuadro)": con Lluvia, Nieve y Luciérnagas ya no es del todo cierto).
3. Tarjeta de la Colección (`CollectionScreen.tsx`): la miniatura de la fila usa hoy `FieldBackground` en chico (`:188`); ver decisión 3.
4. Vista previa de CAMBIO-020: no necesita nada especial (usa `FieldBackground id=…`).
5. Tests: `catalog.test.ts` (ids y niveles de los fondos nuevos; que un fondo nuevo bloqueado caiga en `liso`); `palettes.test.ts`: en Cristal, Contorno y Esmerilado medir el color efectivo sobre el respaldo `#12121a`.
6. Documentación del juego: anotar el motivo en `docs/historia-y-decisiones.md` (no son reglas, así que `docs/reglas-y-balance.md` no cambia).
7. **`apps/client/src/components/Block.tsx` (decisión 1, alternativa A):** en `glass`, `outline` y `frosted`, el `backgroundColor` del bloque es **opaco**. Dos formas equivalentes: (a) `backgroundColor: '#12121a'` (el respaldo) y encima, en `backgroundImage`, el brillo **sobre** un degradado plano con el relleno (`linear-gradient(relleno, relleno)`); o (b), más simple, `backgroundColor` = el relleno **ya mezclado** con `#12121a` (color opaco precalculado) y solo el brillo en `backgroundImage`. Contorno no lleva brillo. Bordes, sombras y número no cambian. **Esmerilado no lleva `BlurView` ni `BlurTargetView` (decidido: sin blur real, 2026-11-26).** El respaldo va dentro del bloque, así que escala y se apaga con él.

### Prueba de paletas sobre cada fondo (resultado)

**Resultado vigente (2026-11-26, con el respaldo opaco y los colores nuevos):** las **14 paletas pasan las 7 comprobaciones** y el resultado ya no depende del fondo (Cristal, Contorno y Esmerilado quedan con los mismos márgenes que sobre Liso: contraste del rojo en rango +0,030 / +0,023 / +0,043). Medida propia, no regla del juego (336 ventanas por fondo contra las 14 × 9 casillas, sin contar bordes ni sombra): ninguna ventana "roja" en ningún fondo; el rojo `#ff2a2a` queda lejos de todos (ΔE2000 mínimo 28,8, en el sol del atardecer); solo **13 ventanas** tienen alguna casilla con ΔE < 10, todas en puntos claros (Nieve 9, las lomas y copos; Atardecer 2, el sol; Océano 1; Bosque 1, la luna). Detalle en `herramientas/prueba-fondos/RESULTADOS-FONDOS.md`. **Lo que sigue en esta sección es el análisis del 2026-11-25 (fondos casi negros, sin respaldo): queda como historial y ya no describe la web.**

**Hallazgo importante (cambia lo que se pidió medir):** la regla de no ventaja (`palettes.test.ts`) compara la trampa roja `#ff2a2a` y el texto blanco contra el **color del bloque**, no contra el fondo del campo. Con paletas **opacas** (las 8 de hoy más Tenue, Degradé y Botón) el fondo no entra: sus 11 casos pasan sobre cualquier fondo. Solo **Cristal (50 %), Contorno (55 %) y Esmerilado (70 % + brillo)** dejan pasar lo que hay detrás, así que su color efectivo —el que mide la regla— **sí depende del fondo**. Se recalculó ese color efectivo para cada color de cada fondo con las funciones reales del juego (`herramientas/prueba-fondos/`, que reutiliza `reglas.ts` de `prueba-paletas`; no toca el juego ni esa carpeta).

- **La ventana es angosta.** Incluso con el Liso de hoy los márgenes son de solo +0,023 a +0,030 de contraste. Un barrido de 4.275 colores de fondo alrededor de `#12121a` muestra que las tres translúcidas pasan a la vez solo cuando el fondo es **muy oscuro y de luminancia parecida a `#12121a`** (luminancia relativa 0,004 – 0,008; el Liso da 0,0064), de cualquier tono: sí se pueden teñir (azul, verde, morado, ciruela), pero casi negros.
- **Primer diseño: fallaban 21 de 36 combinaciones** (fondo × paleta translúcida). Los azules del océano (`#0a3552`), los morados de la nebulosa y el atardecer (`#35213a`), los verdes del bosque y de las luciérnagas eran demasiado claros o de tono lejano. **Se oscurecieron y neutralizaron los colores base hasta que pasan**; los acentos (luna, luciérnagas, burbujas, copos) quedaron como detalles chicos de baja opacidad. Ajustes (antes → después): circuito `#0b1819` → `#091314`; atardecer `#12142e / #21183f / #35213a` → `#0c0f1d / #0e0f1e / #161018`; océano `#0a1830 / #0b2542 / #0a3552` → `#08111e / #07111c / #06141c`; bosque `#0a1520 / #0c1f22 / #0d2418` → `#09121c / #071315 / #07140d`; lluvia `#111a25` → `#0c121a`; nieve `#132030` → `#0b121b`; nebulosa `#0c0a1c` + luces moradas al 20–30 % → `#0f0f1c` + luces casi neutras al 50–60 %; luciérnagas `#0c1a12` → `#09150f`; rayas `#12121a` → `#0f0f16` (el dibujo suma luz; se baja la base para que el **promedio** quede en la banda).
- **Resultado final sobre los colores base: 36 de 36 combinaciones pasan todas las reglas** (12 fondos incl. Liso × Cristal, Contorno, Esmerilado). Margen más justo (contraste del rojo en rango; el umbral es 0): Cristal +0,018 (luciérnagas), Contorno +0,023 (Liso, el de hoy), Esmerilado +0,024 (océano); caso difícil de tono: mínimo +0,47° (Esmerilado en océano).

| Fondo | Cristal | Contorno | Esmerilado | Muestreo real (ventanas que fallan de 80: C / Co / E) |
|---|---|---|---|---|
| Puntos, Rayas, Hexágonos, Circuito | pasa | pasa | pasa | 0 / 0 / 0 |
| Atardecer, Océano, Lluvia, Nieve | pasa | pasa | pasa | 0 / 0 / 0 |
| Bosque nocturno | pasa | pasa | pasa | 2 / 2 / 1 (la luna) |
| Nebulosa | pasa | pasa | pasa | 4 / 0 / 0 (las estrellitas) |
| Luciérnagas | pasa | pasa | pasa | 3 / 4 / 0 (las luces) |

- **Muestreo real:** además del color base se midió lo realmente dibujado (patrones, brillos y un cuadro de la animación) con una captura de la web: 80 ventanas de 30 × 30 px por fondo, con las mismas reglas. **Hay 5 fondos × paleta con algunas ventanas que no pasan (menos del 5 %)**, y son siempre un detalle puntual: la luna del bosque, las estrellitas de la nebulosa y las luces de las luciérnagas. Un bloque translúcido justo encima de una de ellas cambia unas décimas de contraste; no se puede resolver sin apagar el detalle. Ver decisión 1.
- **Lo que NO se midió:** una captura es un cuadro; Lluvia, Nieve y Luciérnagas se mueven. (Esmerilado no desenfoca: decidido: sin blur real, 2026-11-26.)

### Regla `REDDISH`

`REDDISH` (`['#e5484d', '#f76b15', '#d6409f']`, `packages/engine/src/constants.ts:96`) habla del **color del bloque** (`COLORS`): si ese color es rojizo, la trampa roja usa uno de `SAFE`. El motor **no lee el fondo del campo**, así que ningún fondo activa esa regla ni puede cambiarla. Además, ninguno tiene zonas rojas (medido el 2026-11-26): dominan verdes, azules y violetas; el único cálido es el pie del Atardecer, que pasa de un malva apagado a un ámbar oscuro sin franja roja.

### Rendimiento

- Los fondos de hoy son estáticos (`FieldBackground.tsx:9-17`). Con CAMBIO-022 **tres** serían animados; como la partida ya tiene bloques, efectos y reloj, es lo que hay que vigilar. Se **medirá más adelante, sin alarma** (el usuario dice que la versión actual va muy bien en celulares lentos), en el emulador `Pixel_Mi_Device` y en un Android modesto real, con el APK de prueba de CAMBIO-021 (todo desbloqueado).
- Qué cuidar: una sola propiedad animada por capa (`translateY` / `opacity`, sin `backgroundPosition` ni `left/top`); capas con textura de hardware; **nada de `blur`** ni sombras grandes en los fondos; `memo` y sin props que cambien durante la partida; pausar la animación cuando la partida termina o la app pasa a segundo plano; respetar `useReducedMotion()`. Los estáticos no tienen costo por cuadro. Si algún día pesara, el respaldo es dibujar esos tres sin animación (la web ya los muestra quietos con "reducir movimiento").
- Hexágonos y Circuito usan un `Pattern` SVG sobre toda la pantalla: se rasteriza una vez; si en algún Android se viera lento, la alternativa es una imagen PNG pequeña repetida.

### Decisiones que el usuario debe confirmar

1. **Cómo tratar Cristal, Contorno y Esmerilado sobre fondos. Cerrada: alternativa A aprobada por el usuario (2026-11-26).** Las tres se dibujan sobre un **respaldo opaco `#12121a`** (sobre Liso se ven como antes; su color **no depende del fondo**) y los 11 fondos nuevos se repintaron más vivos. Hecho en la web; para el juego, ver "Dónde implementarlo", punto 7. Lo que se pierde: ver el fondo a través del bloque. **Esmerilado: cerrado (2026-11-26), decidido: sin blur real** (el usuario: "como está ahora"; lo había pedido con desenfoque en CAMBIO-019). Lo que implica: con un respaldo opaco no queda nada que desenfocar, así que se quitó el `backdrop-filter` y quedan la capa lechosa, el brillo, el borde, la luz superior, la sombra y el grano (sobre Liso, mismos colores; sigue distinto de Cristal, pero es "vidrio falso"). Se midió la salida intermedia (respaldo semitransparente + desenfoque, aproximado con ventanas de 14 px de los 15 fondos, 5.040 en total): sin respaldo fallan la regla 3.703 ventanas; al 80 %, 61; al 85 %, 4; **al 90 %, ninguna**, pero entonces del fondo solo llega cerca del 3 % al color final (0,10 × 0,30), prácticamente invisible. No hay un punto que cumpla la regla y deje ver el vidrio, así que queda sin desenfoque y **no** se hace una excepción a la regla de no ventaja. Nota: la muestra 3×3 de la fila (`coleccion.css`, `.vpPaleta.esmerilado i`) conserva un `backdrop-filter` de 4 px que solo toca el panel; se dejó para no cambiar su aspecto y no se lleva al juego.
2. **Niveles.** La propuesta es la de la tabla (2, 4, 6, 8, 11, 14, 17, 21, 26, 32, 40). El 40 equivale a 41.000 bloques con CAMBIO-004: Luciérnagas sería el premio más lejano. ¿Se quiere otra escala (más pegada, o hasta el 30)?
3. **Miniatura de la fila.** En la web es el dibujo a media escala. En el juego la miniatura usa `FieldBackground`; con los colores nuevos se reconoce, pero los mosaicos grandes se ven recortados a 44 px. ¿Añadir una prop `thumb` que los achique, o aceptar la miniatura tal cual?
4. **¿Tres animados es demasiado?** Alternativa: Lluvia y Nieve estáticos (un cuadro congelado) y solo Luciérnagas animado, o ninguno.

### Qué más afecta

- **CAMBIO-004** (curva de nivel): los "desde X bloques" salen de ella; si cambia, cambian.
- **CAMBIO-006** (orden de la Colección): la fila de fondos pasa de 4 a 15 tarjetas; es la sección más larga. Con la vista previa (CAMBIO-020) al final queda lejos de los fondos: considerar fijarla arriba como ya hace la web en el celular.
- **CAMBIO-020** (vista previa): dibuja el fondo elegido; con todo desbloqueado (APK de prueba) se pueden probar los 15.
- `FieldBackground.tsx`: la cabecera dice "estático"; actualizar.
- **Selección guardada:** `tb_set1` guarda `background`. `resolveSelection` ya cae en `liso` si el id no existe o no está desbloqueado (`catalog.ts:283-291`), así que (a) quien tenga hoy Grilla/Estrellas/Aurora **no pierde nada** (ids iguales); (b) quien elija un fondo nuevo y luego baje de nivel (CAMBIO-004 sube los umbrales) vuelve a Liso solo; (c) una versión vieja de la app que lea un id nuevo desconocido dibuja Liso (`FieldBackground` devuelve `null`).
- La recta "Bloques destruidos y nivel" de la web (`script.js`: `PREMIOS_NIVEL`, hoy Grilla 5, Estrellas 10, Aurora 20, y `NIVEL_MAX = 25`) **no se actualizó** con los fondos nuevos; si se quiere que los marque, es un cambio aparte.

### Qué NO cambia

`RULES_VERSION`, rankings, récords, historial, estadísticas, las claves `tb_*` (incluida `tb_set1`: solo guarda otro id), el motor (`packages/engine`), la API y las reglas del juego. Los ids de los fondos actuales no cambian. No hay nada que migrar.

### Cómo verlo en esta carpeta

Sección "Premios", panel **Fondos del campo**: con "Ahora" salen los 4 de hoy; con "Con cambios", 15 ordenados por nivel (los 11 nuevos marcados "nuevo", con "Llega al nivel N · desde X bloques" y su frase). Clic en una fila y el campo de **Vista previa** dibuja ese fondo; prueba con una paleta clara (Pastel), una oscura (Neón) y Esmerilado para ver que los bloques destacan. Lluvia, Nieve y Luciérnagas se mueven y se detienen con "reducir movimiento" del sistema. El dibujo está en `extras-fondos.css` (el campo usa la clase `fx-<id>`; la miniatura, `.vpFondo.<id>`); los datos, en `FONDOS` de `coleccion.js`. La prueba de paletas: `bash config_logros/herramientas/prueba-fondos/correr.sh` (resultado en `herramientas/prueba-fondos/RESULTADOS-FONDOS.md`).

**Prueba en Android: ver CAMBIO-021** (el APK de prueba con todo desbloqueado permite ver los 15 fondos y su rendimiento).

---

## CAMBIO-023 · 6 efectos al destruir nuevos (de 4 a 10): Burbujas, Emojis, Ondas, Monedas, Rayos y Fuegos artificiales

- **Estado:** propuesto (2026-11-25), pedido del usuario: "los efectos al destruir: quiero 6 más, para tener un total de 10; añade uno que sean emojis, burbujas". Maquetado en la web de esta carpeta con el interruptor en "Con cambios" (marcados "nuevo", con su requisito) y en la **Vista previa** (al destruir un bloque con el efecto elegido se ve el efecto). Con "Ahora" siguen los 4 de hoy. **El juego no se tocó.** Prueba en Android: ver CAMBIO-021.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Los requisitos son los de CAMBIO-025/026.
- **Reemplazado por CAMBIO-025:** los requisitos y su orden (columnas "Requisito" y "En el juego", decisión 2) y los de Chispas y Confeti: se ganan por logros (Corazones no cambia); el dibujo de los efectos no cambia.
- **Ampliado por CAMBIO-026:** 2 efectos más (con "Con cambios" son 12).
- **Qué:** a Clásico (✹, siempre), Chispas (✦), Confeti (▰) y Corazones (♥) se suman **seis efectos**: los dos que pidió el usuario (**Emojis** y **Burbujas**) y cuatro a criterio (**Ondas, Monedas, Rayos, Fuegos artificiales**), elegidos para que se distingan por el movimiento y no solo por la forma: unos suben (Burbujas), otros caen con gravedad (Monedas), uno es un abanico con rebote (Emojis), uno no tiene partículas que vuelen sino anillos (Ondas), uno es instantáneo y parpadea (Rayos) y uno tiene dos tiempos (Fuegos). Se desbloquean por motivos distintos (partidas, nivel, reto diario, racha) y de fácil a difícil.
- **Por qué:** pedido del usuario; más premios a lo largo de la progresión (hoy el último efecto se gana con una racha de 25 o invitando a un amigo y no hay nada que perseguir a largo plazo).

### Los 6 efectos

| id | Nombre | Glifo (fila) | Piezas (nodos) | Duración (con retraso) | Requisito | En el juego (`catalog.ts`) |
|---|---|---|---|---|---|---|
| `burbujas` | Burbujas | ○ `#8fd8ff` | 6 burbujas × 2 nodos (círculo + reflejo) = **12** | 520–760 ms + 0–100 de retraso (≤ 860) | Termina 10 partidas | `{ kind: 'runs', n: 10 }` |
| `emojis` | Emojis | 😎 `#ffd24a` | 6 emojis = **6** | 550–750 ms | Llega al nivel 13 (4.550 bloques con CAMBIO-004; hoy 3.900) | `{ kind: 'level', n: 13 }` |
| `ondas` | Ondas | ◉ `#5ad0c0` | 3 anillos + 6 gotas = **9** | anillos 520 ms (nacen cada 90 ms), gotas 450–600 (≤ 700) | Juega el reto diario 14 días seguidos | `{ kind: 'dailyStreak', n: 14 }` + `requires: 'daily'` |
| `monedas` | Monedas | $ `#ffc933` | 6 monedas = **6** | 600–760 ms + 0–80 de retraso (≤ 840) | Termina 150 partidas | `{ kind: 'runs', n: 150 }` |
| `rayos` | Rayos | ↯ `#e8f6ff` | 5 rayos × 2 trazos + 1 destello = **11** | 420 ms (destello 180) | Haz una racha de 100 | `{ kind: 'streak', n: 100 }` |
| `fuegos` | Fuegos artificiales | ❋ `#ff9f43` | 1 estela + 10 chispas + 1 fogonazo = **12** | estela 290 ms, chispas 560 ms desde los 290 (≤ 850) | Llega al nivel 35 (31.500 bloques; hoy 29.750) | `{ kind: 'level', n: 35 }` |

- Para comparar: **Clásico, Chispas, Confeti y Corazones usan 14 piezas** y duran ≤ 700 ms. Ningún efecto nuevo pasa de 12 nodos ni de 860 ms.
- **Requisitos:** solo estadísticas que el juego ya tiene (`runs`, `streak`, `level`, `dailyStreak`; no hace falta tocar `CatalogStats` ni `Requirement`). Los niveles 13 y 35 **no repiten** los de ningún fondo (2, 4, 5, 6, 8, 10, 11, 14, 17, 20, 21, 26, 32, 40) ni paleta (3, 7, 9, 12, 15, 16, 18, 22, 25, 27, 30). Las cifras (10 partidas, 150 partidas, racha de 100, 14 días) son umbrales que ya usan los logros "Partidas jugadas" (10, 50, **150**…), "Máximo combo" (…, **100**…) y "Días seguidos de reto diario" (…, **14**…), para que no aparezcan números nuevos. En la web de esta carpeta, partidas, racha y reto diario van como `req: { tipo: 'texto' }` con la frase exacta que genera `goalOf` (los tipos `siempre | nivel | insignia | texto` no cubren esos tres); solo los de nivel usan `tipo: 'nivel'` (se muestran sin "Hoy", como los fondos nuevos).
- **Orden de dificultad:** Burbujas (10 partidas) < Emojis (nivel 13) < Ondas (14 días de reto, hay que volver 2 semanas seguidas) < Monedas (150 partidas) < Rayos (racha de 100, la más difícil de una sola partida) < Fuegos artificiales (nivel 35, el más vistoso va al final).
- **Color:** Burbujas, Ondas, Rayos y Fuegos usan el **color del bloque** (traducido a la paleta elegida, como Clásico y Corazones) combinado con blanco, para leerse en cualquier fondo; **Monedas** es dorado fijo (su identidad) y **Emojis** lleva el color propio de cada emoji (el color del bloque no cuenta).

### Cómo se dibuja cada uno en React Native (Views / Text / Reanimated; nada nuevo en `package.json`)

Receta común (igual que `Particle` de `Fx.tsx`): cada pieza es un `Animated.View` (o `Animated.Text`) con `pointerEvents="none"`, **un solo valor compartido** `p` (`withDelay(delay, withTiming(1, { duration, easing: Easing.linear }))`) y **un `useAnimatedStyle`** con `opacity` y `transform` (`translateX`, `translateY`, `rotate`, `scale`; solo propiedades que no tocan el layout). Cada efecto es una función `f(p)` pura (`p` lineal de 0 a 1) que devuelve `{ x, y, r, s, sx, o }`. **La web de esta carpeta evalúa exactamente esas mismas fórmulas** (`FX_NUEVOS` en `preview.js`) y las muestrea en 21 fotogramas para `element.animate`; el worklet del juego las evalúa por fotograma. Con `ease(p) = 1 − (1 − p)²` y `tramo(p, a, b)` = rampa 0→1 entre a y b.

| Efecto | Pieza en RN | Fórmula (resumen) |
|---|---|---|
| Burbujas | `View` redondo de 14–26 px, `borderWidth` 1,5, borde `rgba(255,255,255,.75)`, relleno color del bloque al 25 % (`#rrggbb40`) + hijo `View` blanco de ~22 % (reflejo arriba a la izquierda) | `x = x0 + amp·sen(2π·freq·p + fase)` (amp 4–9 px), `y = −rise·ease(p)` (rise 70–125), escala 0,5→1 en el 15 % inicial y, al 78 %, **revienta**: escala 1→1,35 y `o` 1→0 |
| Emojis | `Animated.Text` (el emoji) de 20–26 px, sin `View` extra, 6 de un grupo de 8 (sin repetir) | sale en abanico: `x,y = (cos a, sen a)·d·ease(p)` con d 35–85 y sube 14 px; escala 0,4 → 1,2 (p=.25) → 1 (.5) → 0,85; giro ±25° · ease; `o` = 1 hasta .6 y luego baja |
| Ondas | 3 `View` de 96 px con `borderWidth` 4 y `borderRadius` 999 (color del bloque, blanco, color del bloque) + 6 `View` de 6 px | anillo: **solo escala** 0,2→1 (el borde crece con ella; no se anima el tamaño para no recalcular layout), `o` = 0,95·(1−p), retraso 0/90/180 ms; gotas: radiales con 22 px de gravedad |
| Monedas | `View` de 18 px, relleno `#ffc933`, borde 2 px `#c98a00`, `borderRadius` 9 | parábola `y = −A·p + (A+E)·p²` (A 260–320, E 50–90: sube ~60 px y cae), `x = dx·p` (±60), **giro sobre el eje** con `scaleX = máx(0,12, \|cos(2π·vueltas·p + fase)\|)`, `o` baja desde .7 |
| Rayos | `View` de 4 px de alto y 22–30 px (trazo A, blanco) + 16–24 px (trazo B, color del bloque), con `left/top` fijos y `rotate` fijo; destello: `View` blanco redondo de 24 px | zigzag de 2 trazos por rayo (el B gira 35–60° respecto al A); deriva de 10 px hacia fuera; **un solo parpadeo** de `o`: 1 (0–.18), .3 (.18–.34), 1 (.34–.58), luego baja; destello `s` 0,3→1,2 y `o = (1−p)²` |
| Fuegos artificiales | estela: `View` 3×12 `#fff3b0`; chispas: 10 `View` redondos de 7 px (1 de cada 3 blancas, el resto del color del bloque) con `top` 46 px más arriba; fogonazo: `View` blanco de 16 px | estela sube 46 px en 290 ms; las chispas esperan 290 ms (`withDelay`) y salen en **dos anillos** (radio 52–68 y 30–42) con 18 px de gravedad, `o` hasta .75 y luego baja; las piezas con retraso nacen con `o = 0` (si no, se verían quietas durante la espera) |

- **`count` se ignora** en los nuevos: cada uno tiene su número de piezas (`CelebrationModal.EffectView` pasa `count={14}`; con estos efectos no cambia nada).
- **Las fórmulas deberían vivir en un módulo puro** (p. ej. `lib/fxShapes.ts`, sin Reanimated) para poder probarlas con vitest sin dibujar: `o ∈ [0, 1]`, `o(0) = 0` en las piezas con retraso, valores finitos en `p = 0, .5, 1`, número de piezas por efecto.

### Qué hay que tocar al aplicarlo

1. `apps/client/src/cosmetics/catalog.ts`: 6 `item(…, 'effect', …)` con los requisitos de la tabla (los 4 tipos ya existen en `Requirement`/`goalOf`/`meets`/`missingText`); `requires: 'daily'` en Ondas. Pruebas en `catalog.test.ts` (límites: 9/10 partidas, racha 99/100, etc.).
2. `apps/client/src/components/Fx.tsx`: ampliar `BurstEffect` con los 6 ids y dibujar los nuevos con sus propios componentes en `Burst` (el `ParticleSpec` actual solo sabe de un rectángulo o un glifo con una trayectoria recta; los nuevos necesitan `delay`, vaivén, eje de giro y piezas con hijos). El `makeSpecs` de los 4 actuales **no se toca** (el `default` de `makeSpecs` ya devuelve el Clásico para un id desconocido). **`LIFETIME.burst` es 750 ms**: hay que dejarlo por efecto (≥ 950 ms para Burbujas, Monedas y Fuegos; 850 para Emojis; 800 Ondas; 500 Rayos) o los últimos fotogramas se cortan.
3. `apps/client/src/screens/CollectionScreen.tsx`: `EffectIcon` dibuja un icono fijo por efecto (los de hoy son 5 `View`/`Text`); hacen falta 6 iconos nuevos (en esta web son glifos de texto: ○ ◉ $ ↯ ❋ y el emoji 😎; el juego puede dibujar los suyos). **Ese archivo tiene hoy cambios ajenos sin confirmar en el árbol de trabajo: coordinarlo antes de tocarlo.**
4. Vista previa de CAMBIO-020 y tarjeta de premio (`CelebrationModal.EffectView`): usan `Burst` con `effect={id}`, así que **no necesitan cambios** más que los de `Fx.tsx`.
5. Esta carpeta: ya hecho (`EFECTOS` y `efectosVisibles()` en `coleccion.js`, `FX_NUEVOS` y `estallidoNuevo()` en `preview.js`, clases `.vpBurbuja`… en `preview.css`).
6. Docs al aplicar: `docs/historia-y-decisiones.md` (por qué estos 6 y estos requisitos; el asunto de los emojis) y `docs/arquitectura.md` (efectos). No toca `docs/reglas-y-balance.md`.

### Emojis entre plataformas (Android, iOS y web)

- **Lista (8; el efecto lanza 6 distintos por estallido):** 🎉 (U+1F389), ⭐ (U+2B50), 🔥 (U+1F525), 💥 (U+1F4A5), 😎 (U+1F60E), 😍 (U+1F60D), 💯 (U+1F4AF), ✨ (U+2728). Todos son de **Unicode 5.1 / 6.0** (Emoji 1.0): los dibuja Android desde la 4.4 e iOS desde la 6, es decir, cualquier equipo con Android 8+ o iOS reciente. **Ninguno es de Unicode 14 o posterior** ni lleva secuencias (ZWJ, tonos de piel, banderas), que son lo que falla en equipos viejos. Los dos que no son de la zona de caritas (⭐, ✨) tienen presentación de emoji por defecto, así que no necesitan el selector U+FE0F (a diferencia de ♥, que en `heart.ts` ya necesitó U+FE0E).
- **En RN se dibujan con `Text`** y **cada sistema los pinta con su propio diseño**: Noto Color Emoji en Android, Apple Color Emoji en iOS, y en la web lo que tenga el navegador (aquí, Segoe UI Emoji de Windows; en Chrome de Android, Noto). **No se ven iguales en las tres** (formas, colores y brillo cambian) y **no se pueden teñir** con el color del bloque ni de la paleta. Esto rompe un poco el "web y app deben verse igual" de la raíz, pero es inherente a un efecto de emojis; la alternativa de dibujarlos como imagen (PNG/SVG propio) los haría idénticos pero añade 8 recursos y deja de ser "emoji".
- **Detalles de `Text`:** `allowFontScaling={false}` (si no, el tamaño de letra del sistema agranda el emoji), `lineHeight` ≈ 1,15 × `fontSize` y ancho de ~1,3 × `fontSize` con `textAlign: 'center'` (los emojis se recortan por arriba en Android si el alto de línea es justo), `selectable={false}`. En la web, `font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif` (en `preview.css`, `.vpEmoji`). **No verificado en Android ni iOS** (solo se miró en Windows); se revisa en la prueba de CAMBIO-021. La primera vez que se dibuja un emoji, Android lo rasteriza (puede notarse un tirón); si pasa, se "calienta" dibujando los 8 una vez fuera de pantalla al abrir la partida.

### Accesibilidad y "reducir movimiento"

- **Web de esta carpeta** (`prefers-reduced-motion`, probado con `emulateMedia`): menos nodos (Burbujas 12→6, Emojis 6→3, Ondas 9→4, Monedas 6→3, Rayos 11→5, Fuegos 12→5), duración ×0,7 (máx. 531 ms), distancias a la mitad y **sin giro, sin vaivén, sin voltear las monedas y sin parpadeo de los rayos** (solo se desvanecen). Fuegos pierde la estela y el fogonazo.
- **Parpadeo (fotosensibilidad):** Rayos tiene **un solo apagado** (encendido–apagado–encendido en ~0,25 s) sobre una zona chica del campo, bajo el límite de 3 destellos por segundo; el fogonazo de Fuegos es un punto de 16 px. Si se prefiere cero riesgo, quitar el parpadeo (el efecto sigue siendo reconocible por el zigzag).
- **En la app** hoy `Burst` **no** consulta "reducir movimiento" (ni los 4 actuales). Se propone que los 6 nuevos sí, con `useReducedMotion()` de Reanimated (ya se usa en `Onboarding.tsx`, `StageTrack.tsx`, `CelebrationModal.tsx`, `PrizeCard.tsx` y `Notice.tsx`) y las mismas reglas de arriba. Decisión 3.
- Son decorativos: sin `accessibilityLabel`, fuera del árbol de accesibilidad (`pointerEvents="none"`, `importantForAccessibility="no-hide-descendants"` en el contenedor si hace falta). Ninguno tapa el campo más de ~0,85 s ni desplaza bloques.

### Rendimiento (se medirá más adelante, sin alarma)

El usuario dice que la versión actual va muy bien en celulares lentos; estos efectos están dentro del presupuesto de los de hoy (≤ 12 nodos frente a 14, ≤ 0,86 s frente a 0,75 s, un `useAnimatedStyle` por pieza y solo `transform`/`opacity`). Lo que conviene cuidar al implementarlo y mirar en el APK de prueba:

- **Opacidad sobre una vista con hijos** (la burbuja: círculo + reflejo; en Android obliga a una capa fuera de pantalla). Solución: animar la opacidad de las dos piezas por separado, o dibujar el reflejo como `borderTopColor`/`borderLeftColor` más claros del propio círculo (1 nodo en vez de 2).
- **Anillos de Ondas:** se anima solo la escala de un `View` de 96 px con borde; no animar `width`/`height`/`borderWidth` (recalcularía el layout por fotograma).
- **Sin sombras ni desenfoque** en ninguna pieza (las sombras de `View` en Android son costosas y aquí la web no las usa).
- **Combos:** con varios bloques destruidos a la vez conviven varios estallidos (hasta ~3 × 12 nodos); `LIFETIME` por efecto desmonta cada estallido apenas termina. Los temporizadores del `useFxList` ya se limpian al salir.
- **Emojis:** primer dibujado más caro (ver arriba); medir en un equipo lento.
- Las piezas con retraso (`withDelay`) ya existen montadas desde el principio con `opacity: 0`; no se montan después.

### Qué pasa con la selección guardada de quien no tenga el efecto

Nada nuevo: la selección vive en `tb_set1` (`effect`) y `resolveSelection` (`catalog.ts`) solo respeta un premio que **exista y esté desbloqueado**; si no, se usa Clásico, **sin borrar lo guardado** (cuando lo gane, vuelve a aplicarse). Un jugador de una versión vieja que reciba un id desconocido por sincronización ve Clásico (`findItem` no lo encuentra y `makeSpecs` cae en su `default`). Un jugador veterano (p. ej. con 150 partidas o nivel 35) tendrá varios efectos nuevos desbloqueados de golpe al actualizar: **conviene revisar cómo se comportan las celebraciones y los avisos de "¡Desbloqueaste…!"** (`newlyUnlocked`, `game/celebrations.ts`, `endPrize.ts`; tienen pruebas con ids de efectos); no lo verifiqué.

### Qué NO cambia

`RULES_VERSION`, rankings, récords, historial, estadísticas, las claves `tb_*` (incluida `tb_set1`), el motor (`packages/engine`), la API y las reglas. Ningún efecto da ventaja ni cambia cuándo o cómo se destruye un bloque; el estallido solo se dibuja. Clásico, Chispas, Confeti y Corazones no cambian (en la web siguen dibujándose con el código de siempre: 14 piezas).

### Relación con otros cambios

- **CAMBIO-020 (Vista previa):** el panel dibuja el efecto elegido al destruir un bloque; con "Con cambios" aparecen los 10 en la lista de efectos y todos se pueden probar en esta web. En el juego solo se podrán probar los desbloqueados.
- **CAMBIO-021 (APK de prueba con todo desbloqueado):** es donde hay que mirar los emojis en Android, el rendimiento de los efectos más cargados (Burbujas, Fuegos) y que ninguno se corte contra el borde del campo. **Prueba en Android: ver CAMBIO-021.** Con `EXPO_PUBLIC_UNLOCK_ALL=1` los 6 quedan desbloqueados (`isUnlocked`); Ondas pide además la función de reto diario y Corazones, cuenta (como hoy).
- **CAMBIO-004 (curva de niveles):** los "desde N bloques" de los dos efectos por nivel usan la curva nueva (25·n·(n+1)); con la de hoy serían 3.900 y 29.750.

### Decisiones que el usuario debe confirmar

1. **Los 4 efectos "a criterio"** (Ondas, Monedas, Rayos, Fuegos artificiales): ¿se quedan o se cambia alguno? Alternativas ya pensadas: píxeles 8-bit, pétalos, humo, estrellas fugaces, hojas, copos.
2. **Requisitos y orden** (10 partidas · nivel 13 · 14 días de reto · 150 partidas · racha de 100 · nivel 35): ¿bien de fácil a difícil? Ondas exige el reto diario (como Constancia), así que depende de que el reto exista.
3. **"Reducir movimiento" en la app** para los 6 nuevos (y, de paso, los 4 de hoy, que hoy no lo respetan).
4. **Emojis:** ¿se aceptan los de cada sistema (distintos entre Android, iOS y web) o se prefieren imágenes propias? ¿La lista de 8 es la que quieres?
5. **Fuegos artificiales** sube 46 px desde el bloque: en la fila de arriba del campo las chispas pueden quedar **cortadas por el borde**. ¿Se acepta, o se hace que la altura de la estela dependa del lugar del bloque? **Cerrada: el usuario los dio por perfectos como están (2026-11-26).**
6. **Parpadeo de Rayos:** ¿se deja un apagado (más "eléctrico") o se quita?

### Cómo verlo en esta carpeta

Sección "Premios", interruptor en **Con cambios**: "Efectos al destruir" pasa de 4 a 10 filas (los 6 nuevos con "nuevo", su requisito y una frase). Clic en una fila para elegirla y toca un bloque del panel "Vista previa" hasta destruirlo: aparece el efecto. Con **Ahora** quedan los 4 de siempre, idénticos. Para el movimiento reducido, activar "reducir movimiento" en el sistema o en las herramientas del navegador.

---

## CAMBIO-024 · 6 sonidos nuevos (de 3 a 9): Electrónico, Futurista, Piano, Guitarra eléctrica, Palitos y Viento

- **Estado:** propuesto (2026-11-24), pedido del usuario: "los sonidos, quiero más… añade un sonido electrónico; ¿de instrumentos puedes añadir? piano, guitarra eléctrica, unos palitos que se chocan, unos instrumentos de viento… añade el sonido electrónico, y uno futurista". Maquetado en la web de esta carpeta con el interruptor en "Con cambios" (marcados "nuevo", con su requisito y una frase) y en la **Vista previa** (al tocar un bloque suena el sonido elegido; al destruirlo, el de destruir). Con "Ahora" siguen los 3 de hoy, idénticos (verificado: Marimba sigue creando los mismos 14 osciladores). **El juego no se tocó.**
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Híbrido en web y app; requisitos de CAMBIO-025; los otros 7 sonidos son derivados y están por definir (B12).
- **Reemplazado por CAMBIO-025:** los requisitos y su orden por dificultad (columnas "Requisito" y "En el juego", decisiones 3 y 6) y el de Marimba: un sonido por insignia, de Papel (Marimba) a Diamante (Futurista). La forma de implementarlos quedó decidida más abajo ("Decisión cerrada: método híbrido").
- **Qué:** a 8 bits (siempre), Suave (1.ª partida) y Marimba (insignia Plata) se suman **seis sonidos**, cada uno con `hit(n)` (toque; la altura sube con los toques dados, tope 12), `kill()` (destruir) y `combo(b)` (subida por combo: 2 a 5 notas según los segundos de premio), igual que los paquetes de hoy.
- **Por qué:** pedido del usuario; más premios a lo largo de la progresión y un tipo de premio que se oye (y se nota al jugar).
- **Honestidad sobre lo que se puede producir:** son **sintetizadores que imitan al instrumento**, no grabaciones. Con osciladores, filtros y ruido se logra un timbre **reconocible** (tipo "piano", "guitarra distorsionada", "flauta"), no uno que se confunda con el instrumento real. Si el usuario quiere realismo, la vía es usar **muestras grabadas** (bancos con licencia libre o grabarlas): queda **fuera de este cambio** (ver "Alternativa" más abajo). Nadie escuchó estos sonidos durante el trabajo: todo lo de abajo son **mediciones** del audio renderizado, no impresiones de oído. **Hay que escucharlos** (en el navegador, y sobre todo en el emulador y en un teléfono real: CAMBIO-021).

### Los 6 sonidos

| id | Nombre | Técnica de síntesis | Requisito (de fácil a difícil) | En el juego (`catalog.ts`) |
|---|---|---|---|---|
| `palitos` | Palitos | Claves de madera: seno agudo (1,6–2,8 kHz según los toques) de caída muy rápida (~10 ms) + un 2.º modo no armónico (×2,76) + chasquido de ruido pasa-banda de 12 ms. **Dos palitos casi a la vez** (9 ms de diferencia, el 2.º un 7 % más agudo). Destruir: tres golpes seguidos (2,3 → 2,9 → 3,3 kHz) | Termina 5 partidas | `{ kind: 'runs', n: 5 }` |
| `electronico` | Electrónico | "Pluck" de sintetizador: dos sierras desafinadas ±8 centésimas + seno una octava abajo (muy bajo) → pasa-bajos resonante (Q 6) cuya frecuencia cae de ~9·f a 1,6·f en 140 ms. Escala la menor pentatónica. Destruir: arpegio la–mi–la que abre el filtro | Termina 25 partidas | `{ kind: 'runs', n: 25 }` |
| `viento` | Viento | Flauta: seno con 3 armónicos suaves (`PeriodicWave`), soplo de ruido pasa-banda que se asienta tras el ataque, vibrato de 5,6 Hz que entra despacio y un "scoop" de afinación de 40 ms. Sol mayor pentatónica, registro de flauta (392–1976 Hz). Destruir: dos notas largas que suben (sol–re) | Haz una racha de 50 | `{ kind: 'streak', n: 50 }` |
| `piano` | Piano | Dos cuerdas desafinadas ±3 centésimas con espectro de 10 armónicos que decae (`PeriodicWave`), pasa-bajos que se cierra (los agudos se apagan antes, como en un piano), caída en dos tramos y golpe de martillo (ruido de 15 ms). Do mayor pentatónica (la de la Marimba). Destruir: acorde do-mi-sol-do rasgueado en 105 ms | Juega el reto diario 21 días seguidos | `{ kind: 'dailyStreak', n: 21 }` + `requires: 'daily'` |
| `guitarra` | Guitarra eléctrica | **Karplus-Strong** (cuerda pulsada, con pérdidas) → ganancia + saturación suave (`WaveShaper` 2×) → pasa-altos 110 Hz y pasa-bajos de "altavoz" (1,9 kHz con la palma, 3,4 kHz abierta). Toque = nota con la palma (*palm mute*, ≤ 0,18 s); destruir = **acorde de potencia** (sol–re–sol) rasgueado 14 ms entre cuerdas; combo = notas con la palma que suben | Insignia Oro ("Llega a la etapa final") | `{ kind: 'tier', index: tierIdx('oro') }` |
| `futurista` | Futurista | FM: portadora seno + modulador de razón 1,41 (no armónica = timbre metálico) con índice que se apaga, **chirrido de afinación hacia arriba** de 30 ms, seno una octava arriba que brilla y **eco** (dos repeticiones al 26 % y 16 %). Escala por tonos enteros. Destruir: barrido de 330 a 1480 Hz en 220 ms con un soplo de ruido que sube y dos ecos | Llega al nivel 28 (20.300 bloques con CAMBIO-004; hoy 18.900) | `{ kind: 'level', n: 28 }` |

- **Orden de dificultad y motivos variados:** Palitos (5 partidas) < Electrónico (25 partidas) < Viento (racha de 50 en una partida) < Piano (21 días seguidos de reto, hay que volver 3 semanas) < Guitarra (insignia Oro) < Futurista (nivel 28, el más raro y vistoso al final).
- **Requisitos:** solo estadísticas que el juego ya tiene (`runs`, `streak`, `dailyStreak`, insignia, nivel): **no hace falta tocar `CatalogStats` ni `Requirement`** (`goalOf` ya genera las frases). El nivel 28 **no repite** los de ningún fondo (2, 4, 5, 6, 8, 10, 11, 14, 17, 20, 21, 26, 32, 40), paleta (3, 7, 9, 12, 15, 16, 18, 22, 25, 27, 30) ni efecto (13, 35). Los umbrales 5, 25, 50 y 21 no coinciden con otros usos de la misma estadística (efectos: 10 y 150 partidas, racha 25 y 100, reto 7 y 14 días). Piano pide la función de reto diario (como Constancia y Ondas): si el reto no existe, no se puede ganar.
- **Qué suena en cada uno al jugar:** `hit(n)` sube de altura con los toques dados (tope 12), igual que los de hoy; Palitos y Guitarra y Piano usan la misma idea de "escala" que la Marimba, Electrónico la menor pentatónica, Viento sol mayor pentatónica, Futurista tonos enteros.

### Mediciones (sin oídos: `OfflineAudioContext` renderizado y analizado en el navegador; `herramientas/prueba-sonidos/`)

Referencia: los 3 paquetes de hoy, copiados de `sounds.ts` con el `beep` de `fx.web.ts`. Pico en escala 0–1; RMS en dBFS sobre la parte activa (> 1 % del pico); duración activa en ms; `combo` con 3 notas (b = 1).

| Paquete | Pico (toque / destruir / combo) | RMS dBFS (toque / destruir / combo) | Duración ms (toque / destruir / combo) | Inicio (1 % del pico) | Centroide del toque (Hz) | Caída de 20 dB (ms) | Afinación (|desvío| máx.) |
|---|---|---|---|---|---|---|---|
| 8 bits (hoy) | 0,048 / 0,086 / 0,058 | −37,2 / −35,3 / −38,9 | 52 / 102 / 325 | 0 ms | 3.996 | 26 | — |
| Suave (hoy) | 0,058 / 0,069 / 0,050 | −37,1 / −36,3 / −38,5 | 58 / 156 / 354 | 0 ms | 540 | 30 | — |
| Marimba (hoy) | 0,087 / 0,113 / 0,079 | −35,3 / −32,8 / −35,3 | 107 / 203 / 355 | 0 ms | 749 | 52 | — |
| **Palitos** | 0,078 / 0,091 / 0,081 | −35,4 / −35,7 / −38,0 | 66 / 248 / 267 | 0,0 ms | 3.154 | 34 | 0,3 cent. (pico espectral) |
| **Electrónico** | 0,069 / 0,073 / 0,055 | −39,0 / −39,4 / −39,1 | 113 / 343 / 338 | 0,2 ms | 2.024 | 66 | 12,7 cent. |
| **Viento** | 0,027 / 0,048 / 0,030 | −37,1 / −36,1 / −36,6 | 166 / 460 / 390 | 0,2 ms | 1.241 | 124 | 1,5 cent. |
| **Piano** | 0,062 / 0,089 / 0,068 | −36,8 / −37,0 / −35,1 | 181 / 502 / 383 | 0,1 ms | 1.303 | 110 | 1,1 cent. |
| **Guitarra eléctrica** | 0,042 / 0,101 / 0,045 | −36,6 / −34,0 / −36,5 | 142 / 449 / 380 | 2,9 ms | 1.564 | 98 | 7,6 cent. |
| **Futurista** | 0,055 / 0,060 / 0,059 | −36,3 / −37,4 / −35,4 | 159 / 345 / 399 | 0,1 ms | 1.084 | 68 | 16,3 cent. (portadora; es FM, sin altura única) |

- **Sonoridad igualada:** los 6 nuevos quedan entre −39,4 y −33,4 dBFS de RMS frente a −38,9 y −32,8 de los de hoy (±3 dB de la media de hoy, −36,3 dBFS). El volumen de cada paquete es una sola constante `nivel` en `PAQUETES` (`sonidos.js`), para ajustarla de oído. **Todos son bajos en términos absolutos**, como los de hoy (picos de 0,03 a 0,11): es el nivel del juego, no un error.
- **Sin recorte:** pico máximo medido de un solo evento 0,113 (la Marimba de hoy); de los nuevos, 0,101. Aun **machacando 40 toques seguidos cada 30 ms + destruir + combo encima**, el pico es ≤ 0,115. Además el bus tiene un limitador suave (lineal hasta 0,6, tope ≈ 0,88).
- **Duraciones:** toque ≤ 181 ms (límite pedido ~250), destruir ≤ 502 ms (límite ~600).
- **Sin chasquidos:** la primera y la última muestra de cada evento son exactamente 0; DC ≤ 3,2·10⁻⁵ en los nuevos (6·10⁻⁵ en los de hoy); el salto máximo entre muestras en los primeros 2 ms es 0 (ataque en rampa de 0,5–20 ms) y en los últimos 2 ms ≤ 0,5 % del pico (1,4 % en 8 bits). Los de hoy tienen un ataque duro (el `beep` del juego no lleva rampa de entrada; la maqueta de la Vista previa ya le añade 4 ms), así que aquí los nuevos son más limpios.
- **Silencio inicial:** los nuevos empiezan ≤ 3 ms después del instante programado (más 5 ms de colchón de programación que añade `tocar()`; se puede dejar en 0).
- **Afinación:** autocorrelación y pico espectral (FFT de 16.384 puntos) frente a la nota pedida con `hit(n)`, n = 1, 3, 5, 7, 9, 12. Piano, Viento y Palitos dentro de ±2 centésimas; Guitarra ±8; Electrónico ±13 (resolución de la FFT ≈ 6 cent. en 784 Hz); Futurista ±16 (en FM la "altura" es la de la portadora y el timbre metálico la desdibuja). La Guitarra salía +27 centésimas sobre la nota pedida con la primera versión de la cuerda (error de media muestra en la línea de retardo de Karplus-Strong); se corrigió y ya no.
- **Que suenan distintos entre sí:** el centroide solo no basta (Futurista 1.084, Viento 1.241, Piano 1.303, Guitarra 1.564, Electrónico 2.024, Palitos 3.154 Hz), así que se mira también el tiempo: caída de 20 dB de 34 ms (Palitos) a 124 ms (Viento); ataque hasta el pico de la envolvente del toque de 1 ms (Palitos) a 13–15 ms (Viento); y la "tonalidad" (autocorrelación 0,93–1,0 en los de altura; los Palitos y el Futurista son los menos periódicos). Piano y Viento son los más parecidos en centroide y en caída (110 y 124 ms), pero el Piano tiene ataque de martillo (3 ms) y decae; el Viento llega al pico en 13–15 ms, sostiene y lleva soplo y vibrato. **Es una comprobación numérica, no de oído.**
- **Muestras para escuchar aparte:** `config_logros/sonidos_muestras/<id>.wav` (WAV de 16 bits, mono, 44,1 kHz, **2,9 s y 255.824 bytes cada uno** → 9 archivos, ≈ 2,2 MB). Cada uno es: toque (n = 2) · toque (n = 6) · toque (n = 10) · destruir · combo (3 notas). Están `electronico`, `futurista`, `piano`, `guitarra`, `palitos`, `viento` y, para comparar, `8bits`, `suave` y `marimba` (los de hoy). **Todos llevan la misma ganancia de ×8 (+18 dB)** para poder oírlos en un escritorio sin subir el volumen (con eso el pico máximo de los archivos es 0,91); el nivel relativo entre ellos es el del juego.

### Cómo suena el juego hoy (evidencia) y cómo se implementarían los nuevos

**No hay archivos de audio ni muestras generadas en JS: todo sonido del juego, en web y en Android/iOS, es un grafo de Web Audio en tiempo real.** Una búsqueda de `.wav/.mp3/.ogg/.m4a/.aac` en `apps/client` (sin `node_modules`) no da nada, y no están `expo-audio` ni `expo-av`.

- **Web:** `apps/client/src/platform/fx.web.ts:108-136` — `fx.beep(f, d, type, v)` es el **único** primitivo de audio: un `OscillatorNode` (`createOscillator`, línea 121) → `GainNode` con `setValueAtTime(v, t)` y `exponentialRampToValueAtTime(0.0001, t + d)` (líneas 128-130) → `destination`. El `AudioContext` solo nace dentro de un gesto (`onGesture`, líneas 63-85; eventos en 87-106) y en iOS se desbloquea con un búfer de 1 muestra en silencio (líneas 52-57, `createBuffer` línea 54: el único búfer del archivo). iOS Safari: `navigator.audioSession.type = 'ambient'` (líneas 101-105).
- **Nativo (Android e iOS):** `apps/client/src/platform/fx.native.ts:3` importa `AudioContext, AudioManager` de **`react-native-audio-api`** (`apps/client/package.json:39`, `^1.0.0`; resuelto a 1.0.0 en `pnpm-lock.yaml:3884`; plugin en `apps/client/app.json:98`). Es **la misma Web Audio API en C++**: el `beep` nativo (líneas 73-92) es el mismo grafo (oscilador → ganancia con rampa exponencial → `destination`) y "suena igual" (comentario de las líneas 7-8). iOS: categoría `ambient` + `mixWithOthers` (líneas 18-21: respeta el modo silencio y no corta la música); el contexto se suspende en segundo plano (líneas 26-32); la vibración va aparte (`expo-haptics`/`Vibration`, líneas 45-70).
- **Los paquetes:** `apps/client/src/game/sounds.ts` — el comentario de las líneas 5-7 lo dice ("todos se generan con WebAudio (`fx.beep`), sin archivos de audio"); `bits8` (31-44, cuadrada/triangular/sierra), `suave` (48-62, senos), `marimba` (70-87, seno + armónico ×4 muy corto sobre `SCALE`, línea 65); registro `SOUND_PACKS` (89) y tipo `SoundPackId` (19); `play()` (115) y `preview()` (123-131: toque, toque, destruir, combo; es lo que suena al elegir un sonido en la Colección). Vibración igual en todos (`BUZZ`, 93-104). Catálogo: `catalog.ts:146-148`. Cada paquete define 10 sonidos (`SoundName`, línea 18).
- **Verificado en la librería instalada** (`node_modules/.pnpm/…/react-native-audio-api/src/core/BaseAudioContext.ts:108-215`): existen `createOscillator`, `createGain`, `createBiquadFilter`, `createWaveShaper` (con `oversample`), `createBufferSource`, `createBuffer` (con `getChannelData`/`copyToChannel`), `createPeriodicWave`, `createDelay`, `createConvolver`, `createStereoPanner`, y `AudioParam` con `setTargetAtTime`, `cancelScheduledValues`, `exponentialRampToValueAtTime`, etc. **No existe `createDynamicsCompressor`** (por eso el limitador es un `WaveShaper`). `sonidos.js` usa **solo** `Oscillator` (+ `PeriodicWave`), `Gain`, `BiquadFilter`, `WaveShaper`, `BufferSource` y `createBuffer`: todos están en la librería nativa.
- **Conclusión de implementación: tiempo real, sin WAV ni archivos.** Los 6 se pueden implementar **con el mismo esquema** que hoy (un grafo de Web Audio por nota, en web y nativo, mismo código). `fx.beep` **no alcanza** (solo oscilador + ganancia): hace falta un módulo nuevo (p. ej. `platform/synth.ts`, o ampliar `Fx` en `fx.types.ts`) que reciba el `AudioContext` de `fx.web.ts`/`fx.native.ts` (hoy privado: `context()`/`ac`) y programe las notas con el reloj del contexto. `sonidos.js` de esta carpeta es esa lógica, sin dependencias de la página: se portaría casi línea por línea a TypeScript. Solo la **Guitarra** genera un búfer en JS (Karplus-Strong, perezosamente por nota); no es un WAV: es un `AudioBuffer` en memoria.
- **Por qué no pre-renderizar WAV:** no hace falta (el tiempo real cubre todo), y obligaría a empaquetar assets y a una librería de reproducción de archivos que hoy no está. Si el rendimiento en teléfonos lentos lo pidiera, la alternativa es pre-renderizar con un `OfflineAudioContext` **al arrancar** (RNAA tiene `OfflineAudioContext.ts`) y reproducir `AudioBuffer`s.

### Decisión cerrada (2026-11-26): método híbrido

**Decidido por el usuario:** los **6 sonidos nuevos se generan una vez con código** (al elegir el sonido o al empezar la partida), **se guardan en memoria (`AudioBuffer`) y se reutilizan**. **Sin archivos de audio.** Los 3 de hoy siguen en vivo (`fx.beep`). Esto reemplaza, solo para los 6 nuevos, la "Conclusión de implementación: tiempo real" de arriba y el "Por qué no pre-renderizar WAV" (sigue sin haber WAV).

**Verificado en la librería nativa instalada** (`apps/client/node_modules/react-native-audio-api`, `package.json:3` = 1.0.0):

| Pieza | Dónde |
|---|---|
| `createBuffer` (y `getChannelData` / `copyToChannel`) | `src/core/BaseAudioContext.ts:187-193`; `src/core/AudioBuffer.ts:40` y `:87` |
| `createBufferSource` | `src/core/BaseAudioContext.ts:140-148` |
| `OfflineAudioContext` y `startRendering()` | `src/core/OfflineAudioContext.ts:14` y `:102-117`; exportado en `src/api.ts:26` |
| Lado nativo | `common/cpp/audioapi/AudioAPIModuleInstaller.h:38-49` (instala `createOfflineAudioContext`); `common/cpp/audioapi/core/OfflineAudioContext.cpp:155` (`startRendering`) y `:96-105` (renderiza en un hilo propio) |

**Vía recomendada: renderizar con `OfflineAudioContext`** (no escribir el `Float32Array` a mano). `sonidos.js` ya acepta un `OfflineAudioContext` (así se midió en `herramientas/prueba-sonidos/`), así que se reutilizan las mismas voces; generar las muestras a mano obligaría a reimplementar filtros, saturación y ondas periódicas, y habría dos síntesis que mantener iguales. Forma:

1. Por cada evento del paquete elegido: `new OfflineAudioContext(1, ceil((duración + 0,005) · sr), sr)` con `sr` = el `sampleRate` del contexto real; programar las notas desde `t0 = 0`, `startRendering()` y guardar el `AudioBuffer`.
2. Eventos con las voces de hoy: `hit` n = 0…12 (13), `kill` (1) y `combo` con premio 1, 2 y 3 o más (3, 4 y 5 notas) = **17 búferes por paquete**, más los otros 7 sonidos cuando se diseñen.
3. Al sonar: `createBufferSource()` → un bus **permanente** (ganancia → limitador `WaveShaper`) → `destination`, con el mismo tope de 12 voces. Renderizar **sin** el limitador (que queda en vivo), para no aplicarlo dos veces ni perderlo al sumarse varias notas.
4. Cuándo: al elegir el sonido (antes de la muestra de la Colección) y, para el equipado, al abrir o empezar la partida. Si un búfer aún no está listo, sonar ese evento en vivo con la misma voz (sin silencio). Un solo paquete en memoria: al cambiar de sonido se sueltan los anteriores.
5. La Guitarra genera sus cuerdas Karplus-Strong en JS (en el hilo de la interfaz): conviene que esa generación quede dentro del paso 1, nunca en el primer toque.

**Memoria** (calculada con las duraciones de `sonidos.js`; `Float32`, mono, 4 bytes por muestra; sin los 7 sonidos que faltan):

| Paquete | Segundos | 44,1 kHz | 48 kHz |
|---|---|---|---|
| Palitos | 2,6 | 0,46 MB | 0,50 MB |
| Electrónico | 3,8 | 0,68 MB | 0,74 MB |
| Viento | 4,3 | 0,75 MB | 0,82 MB |
| Futurista | 4,3 | 0,75 MB | 0,82 MB |
| Guitarra eléctrica | 4,4 | 0,77 MB | 0,84 MB |
| Piano | 5,2 | 0,92 MB | 1,00 MB |

O sea, **≈ 0,5 – 1 MB por paquete** (los 6 a la vez serían 4,3 – 4,7 MB). Los ≈ 1 MB de cuerdas de la Guitarra de la tabla de abajo pasan a ser intermedios y se pueden soltar al terminar de renderizar.

**No probado:** nada de esto se ejecutó en un teléfono ni en el emulador (solo se leyó la librería): falta medir cuánto tarda renderizar en un Android modesto, que el render nativo suene igual que el del navegador (`PeriodicWave`, `WaveShaper` con `oversample`, filtros) y la latencia al tocar rápido. Diferencia conocida frente al vivo: cada evento queda con el mismo tramo de ruido en cada repetición. **La web de esta carpeta no cambia:** sigue sintetizando en vivo (`sonidos.js` no se tocó).

### Costo estimado (medido en el navegador de escritorio; en teléfono hay que medirlo)

| Concepto | Estimación |
|---|---|
| **APK / bundle** | ≈ 0 de assets. El código de `sonidos.js` son ~21 KB de JS sin minificar (≈ 7 KB comprimido). Ningún archivo de audio. |
| **Memoria** | Ruido compartido de 0,4 s mono: ≈ 70 KB. Guitarra (Karplus-Strong): 16 búferes (13 toques con palma de 0,3 s + 3 de acorde abierto de 0,75 s) ≈ **1,06 MB** a 44,1 kHz (≈ 1,15 MB a 48 kHz), generados al usarlos. El resto (`PeriodicWave`, curvas) < 50 KB. Con pre-render WAV de todo sería ≈ 2,3 MB por 6 paquetes (13 toques × 0,25 s + destruir + combo cada uno, 16 bits). |
| **Arranque** | Nada se genera hasta usar un sonido nuevo (ruido y ondas: < 1 ms). La Guitarra tarda ≈ 18 ms en generar los 13 toques y ≈ 10 ms los 3 acordes **en un PC**; un teléfono con Hermes puede tardar 5–10 veces más: conviene **pre-generarlos al elegir el sonido** o al abrir la partida (no en el primer toque). |
| **Nodos por evento** (instrumentado con contadores sobre `BaseAudioContext`) | Toque: Guitarra 6, Piano 7, Viento 7, Electrónico 8, Palitos 14 (el doble golpe), Futurista 14 (con eco); **hoy: 2**. Último toque (toque + destruir): 21 a 49 nodos frente a 4 hoy. Cada nodo vive < 0,6 s y se libera solo. Polifonía limitada a 12 notas (`MAX_VOCES`: la más vieja se apaga con 12 ms de caída). Es más grafo que hoy: **hay que medirlo en un teléfono lento** (los efectos de CAMBIO-023 se pensaron para ir bien en celulares lentos; esto es lo único de CAMBIO-024 que podría pesar). Plan B si pesa: Piano con 1 cuerda en vez de 2, Palitos sin el 2.º palito, `oversample = 'none'` en la guitarra. |

### Alternativa: muestras grabadas

Si el usuario quiere que suenen **como los instrumentos reales**, la síntesis no lo da: haría falta grabar o conseguir muestras con licencia libre (p. ej. bancos CC0 de piano, guitarra, claves y flauta), recortar ~15 sonidos por instrumento (13 alturas + destruir + combo) y empaquetarlas (como OGG/M4A: ≈ 5–10 KB por muestra, < 1 MB en total; como WAV, ≈ 2,3 MB). En el juego se reproducirían con `react-native-audio-api` (`decodeAudioData`, `BaseAudioContext.ts:91`) o añadiendo `expo-audio`, y en web con `decodeAudioData`. **Queda fuera de este cambio**; si se elige, Electrónico y Futurista (que son sintéticos de verdad) y los Palitos (que suenan bien sintetizados) podrían quedarse como están y las muestras reservarse para Piano, Guitarra y Viento.

### Qué tan reconocibles creo que son (sin haberlos oído)

Me baso en que cada uno usa la receta clásica de su instrumento y en que las mediciones salen como cabría esperar de él (altura correcta, caída y brillo propios), **no en haberlos escuchado**:

- **Palitos:** probablemente el más convincente (un "tic" de madera de ~60 ms con 2 componentes y chasquido; el doble golpe da el "choque").
- **Electrónico y Futurista:** son sonidos de sintetizador por naturaleza, así que cumplen lo que son (un pluck de sierras filtradas; una campana FM con chirrido y eco). Lo "futurista" es subjetivo.
- **Guitarra eléctrica:** Karplus-Strong + saturación es la receta estándar de una guitarra distorsionada; el toque con palma y el acorde de potencia deberían leerse como guitarra eléctrica, algo "de videojuego".
- **Piano y Viento:** los menos seguros. El Piano es aditivo con martillo (puede recordar más a un piano eléctrico o a una caja de música); el Viento (flauta con soplo y vibrato) puede sonar a flauta/silbato sintético. En notas muy cortas (≤ 0,18 s), como los toques, el vibrato casi no se aprecia.

### Qué hay que tocar al aplicarlo (en el juego, no se hizo)

1. `apps/client/src/cosmetics/catalog.ts`: 6 `item(…, 'sound', …)` con los requisitos de la tabla (los 4 tipos de requisito ya existen; Piano con `requires: 'daily'`). Pruebas en `catalog.test.ts` (límites: 4/5 partidas, 24/25, racha 49/50, etc.).
2. **Nuevo módulo de síntesis** (`platform/synth.ts` o similar) con las 6 voces y los 6 paquetes, portando `sonidos.js` a TypeScript, y una forma de pedirle el `AudioContext` a `fx.web.ts`/`fx.native.ts` (hoy privado). Mantener `fx.beep` como está para los 3 paquetes de hoy.
3. `apps/client/src/game/sounds.ts`: `SoundPackId` y `SOUND_PACKS` con los 6; `preview()` ya sirve (toque, toque, destruir, combo). Importante: cada paquete debe definir también los **otros 7 sonidos** (`start`, `trap`, `heal`, `expire`, `miss`, `end`, `milestone`), que **esta maqueta no define** (solo `hit`, `kill`, `combo`). Propuesta: sacarlos de las mismas voces con notas (start = nota fija; heal/milestone = arpegio ascendente; end = notas descendentes; trap/miss/expire = notas graves o disonantes, con timbre de "error"). Ojo con `trap` y `miss`: no deben sonar a recompensa en ningún paquete.
4. `apps/client/src/screens/CollectionScreen.tsx`: las filas de sonidos ya muestran un ícono ♪ genérico y llaman a `sounds.preview`; no necesitan cambios más que la lista. **Ese archivo tiene hoy cambios ajenos sin confirmar en el árbol de trabajo: coordinarlo antes de tocarlo.**
5. Vista previa de CAMBIO-020: usa `sounds.play(…, packId)`, así que **no necesita cambios** salvo los de `sounds.ts`.
6. Esta carpeta: ya hecho (`SONIDOS` con `nuevo`, `sonidosVisibles()` y `PIE_SONIDOS` en `coleccion.js`; `sonidos.js` nuevo, cargado en `index.html` antes de `preview.js`; enchufe a `PAQUETES` en `preview.js`; medición en `herramientas/prueba-sonidos/`).
7. Docs al aplicar: `docs/historia-y-decisiones.md` (por qué estos 6, la decisión de síntesis frente a muestras y los requisitos) y `docs/arquitectura.md` (módulo de síntesis). No toca `docs/reglas-y-balance.md`.

### Cuidados al implementarlo

- **Volumen:** los nuevos quedan al nivel de los de hoy (±3 dB RMS), pero el volumen real depende del dispositivo: ajustar cada `nivel` de oído en el emulador y en un teléfono (con altavoz y con auriculares). El **limitador suave** del bus evita recortes al acumularse notas; no hay compresor (RNAA no lo tiene).
- **Modo silencio de iOS:** no cambia: la categoría `ambient` ya respeta el silencio (`fx.native.ts:18-21`, `fx.web.ts:101-105`); los nuevos paquetes salen por el mismo contexto. Probarlo en un iPhone cuando haya.
- **Vibración:** no cambia (`BUZZ` es igual en todos los paquetes). Ojo: la háptica de golpe (`impactAsync` Light) y un sonido de palitos o de guitarra con la palma se sienten "pegados"; verificarlo en el teléfono.
- **Latencia en Android:** no medida. El AudioContext nativo se crea con `new AudioContext()` (`fx.native.ts:22`, sin `latencyHint`) y la latencia total depende del equipo. Los nuevos se **programan en el reloj del contexto** (5 ms de adelanto) en vez de con `setTimeout` como los arpegios de hoy (`sounds.ts:26-28`), lo que mejora el ritmo del combo. Un toque con palma de 0,18 s y una nota de Viento con ataque de 14 ms **pueden sentirse más lentos** que el pitido de 8 bits aunque el ataque medido sea corto: escucharlo con el dedo en el teléfono.
- **Costo de CPU:** más nodos por toque (arriba). Medir con tocar rápido (el jugador llega a varios toques por segundo) en un teléfono de gama baja.
- **Selección guardada de quien no tenga el sonido:** nada nuevo: la selección vive en `tb_set1` (`soundPack`) y `resolveSelection` (`catalog.ts:283-291`) solo respeta un premio que **exista y esté desbloqueado**; si no, usa 8 bits **sin borrar lo guardado** (cuando lo gane, vuelve a aplicarse). Un id desconocido (versión vieja de la app con datos sincronizados) cae en `8bits` (`packOf`, `sounds.ts:106-108`).

### Qué NO cambia

`RULES_VERSION`, rankings, récords, historial, estadísticas, las claves `tb_*` (incluida `tb_set1`), el motor (`packages/engine`), la API y las reglas. Ningún sonido da ventaja ni cambia cuándo o cómo se destruye un bloque. 8 bits, Suave y Marimba no cambian (en la web siguen sonando con el código de siempre: el mismo número de osciladores). No se reinicia nada.

### Relación con otros cambios

- **CAMBIO-020 (Vista previa):** con "Con cambios" aparecen los 9 sonidos en la lista y todos se pueden probar; al tocar un bloque suena el elegido, y al destruirlo, su `kill`. En el juego solo se podrán probar los desbloqueados.
- **CAMBIO-021 (APK de prueba con todo desbloqueado):** aquí es **clave**: el sonido hay que **escucharlo en el emulador y en un teléfono real**, no se puede dar por bueno con las mediciones. Con `EXPO_PUBLIC_UNLOCK_ALL=1` los 6 quedan desbloqueados (Piano pide además la función de reto diario). Qué mirar en el APK: que suenen los 6 y se parezcan a lo medido, el volumen frente a los 3 de hoy, que no haya retraso ni cortes al tocar rápido, el costo de CPU/batería, el primer toque de la Guitarra (generación del búfer) y el comportamiento al volver de segundo plano. **Prueba en Android: ver CAMBIO-021.**
- **CAMBIO-004 (curva de niveles):** el "desde 20.300 bloques" de Futurista usa la curva nueva (25·n·(n+1)); con la de hoy serían 18.900.

### Decisiones que el usuario debe confirmar

1. **Los 6 sonidos:** ¿se quedan o se cambia alguno? (Alternativas pensadas: órgano, xilófono/vibráfono, arpa, bajo, batería/redoblante, campanillas, "voz" de 8 bits.)
2. **Sintetizador o muestras grabadas** para Piano, Guitarra y Viento. Aquí se hizo la versión sintética (sin archivos); si se quiere realismo, hay que conseguir o grabar muestras (ver "Alternativa").
3. **Requisitos y orden:** 5 partidas · 25 partidas · racha de 50 · reto diario 21 días · insignia Oro · nivel 28. Piano depende de que exista el reto diario.
4. **Los otros 7 sonidos de cada paquete** (`start`, `trap`, `heal`, `expire`, `miss`, `end`, `milestone`): hay que definirlos con el mismo timbre; la maqueta solo hace toque, destruir y combo.
5. **Volumen:** ¿se dejan al nivel de los de hoy (bajos) o se quiere que los nuevos suenen algo más fuerte? Es una constante por paquete.
6. **Guitarra con la insignia Oro:** ¿o mejor un nivel o una racha? (Hoy ningún otro premio de sonido pide una insignia por encima de Plata.)
7. **Dónde va el código nuevo:** ¿un módulo `synth` aparte (propuesto) o ampliar `fx`?

### Cómo verlo en esta carpeta

Sección "Premios", interruptor en **Con cambios**: "Sonidos" pasa de 3 a 9 filas (los 6 nuevos con "nuevo", su requisito y una frase, y un pie explicativo). **Clic en una fila** para elegirla: suena una muestra corta (toque, toque, destruir, combo); luego **toca bloques** del panel "Vista previa": cada toque suena (más agudo cuanto más toques) y el último, el de destruir. Con **Ahora** quedan los 3 de siempre, idénticos. Para escucharlos aparte: `config_logros/sonidos_muestras/*.wav`. Para repetir la medición: servir `config_logros` por HTTP, abrir `herramientas/prueba-sonidos/medir.html` y ejecutar `await TBMedir.correr(false)` en la consola (resultados guardados en `herramientas/prueba-sonidos/resultados.json`). En el navegador el contexto de audio nace en el primer clic (política de autoplay de los navegadores).

---

## CAMBIO-025 · Nueva forma de entregar los premios

- **Estado:** propuesto (2026-11-26). Las reglas de entrega son **decisión del usuario** (2026-11-26); el reparto de los 21 efectos y fondos entre los escalones de logro es **mi propuesta, por confirmar**. Maquetado en la web de esta carpeta (interruptor "Con cambios"); **el juego no se tocó**.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Incluye el reset A como código (script manual **sin ejecutar**) y las celebraciones desde la cuenta; el reparto vigente es el de CAMBIO-026.
- **Actualización (2026-11-26):** decisiones del usuario más abajo (**reset aprobado, alcance A: todo**; la paleta "Constancia" pasa a llamarse **"Amistad"**; celebraciones aprobadas; los premios del porcentaje se quedan; CAMBIO-001 se aplicará). **Ampliado por CAMBIO-026:** los 7 escalones vacíos ya tienen premio.
- **Qué:**
  1. Los **6 sonidos nuevos** se generan una vez con código y se reutilizan desde memoria (detalle en CAMBIO-024).
  2. La paleta **Constancia** pasa a ganarse **invitando a un 2.º amigo** (hoy: reto diario 7 días seguidos). **Corazones** se queda (1.er amigo).
  3. El fondo **Bosque nocturno** se gana **invitando a un 3.er amigo**.
  4. **Un sonido por insignia**, desde Marimba: Papel → Diamante (escalón 1 de cada una). 8 bits y Suave no cambian. El orden de la lista de `coleccion.js` ya era Marimba, Palitos, Electrónico, Viento, Piano, Guitarra, Futurista: no se reordenó.
  5. **Efectos y fondos se ganan por los logros**, salvo Clásico y Liso (inicio), Corazones y Bosque nocturno (invitar). **Dejan de ganarse por nivel**; las paletas siguen por nivel (CAMBIO-016).
- **Depende de:** CAMBIO-001 y 005 (insignia Papel a los 20 s), 009 y 010 (logro "Partidas jugadas" y siete materiales), 022, 023 y 024 (los premios nuevos). CAMBIO-003 define el texto de Diamante (2 s).

### Premio → requisito

| Premio | Tipo | Requisito propuesto | Hoy |
|---|---|---|---|
| 8 bits | sonido | Desde el inicio | igual |
| Suave | sonido | Termina tu primera partida | igual |
| Marimba | sonido | Insignia Papel (llega al 4) | Insignia Plata |
| Palitos | sonido | Insignia Cartón (llega al 6) | no existe |
| Electrónico | sonido | Insignia Madera (llega al 8) | no existe |
| Viento | sonido | Insignia Bronce (sumas y restas) | no existe |
| Piano | sonido | Insignia Plata (multiplicaciones y divisiones) | no existe |
| Guitarra eléctrica | sonido | Insignia Oro (etapa final) | no existe |
| Futurista | sonido | Insignia Diamante (bloques de 2 s) | no existe |
| Clásico | efecto | Desde el inicio | igual |
| Chispas | efecto | Partidas jugadas · Papel (10) | Insignia Madera III (llega al 8) |
| Emojis | efecto | Días seguidos de reto · Papel (3) | no existe |
| Confeti | efecto | Máximo combo · Cartón (racha de 25) | Racha de 25 |
| Burbujas | efecto | Mejor resultado en reto · Cartón (25 %) | no existe |
| Ondas | efecto | Días seguidos de reto · Madera (14) | no existe |
| Rayos | efecto | Máximo combo · Bronce (100) | no existe |
| Monedas | efecto | Partidas jugadas · Bronce (500) | no existe |
| Fuegos artificiales | efecto | Mejor resultado en reto · Diamante (99 %) | no existe |
| Corazones | efecto | Invita a 1 amigo (cuenta) | igual |
| Liso | fondo | Desde el inicio | igual |
| Grilla | fondo | Máximo combo · Papel (10) | Nivel 5 |
| Rayas | fondo | Mejor resultado en reto · Papel (participar) | no existe |
| Estrellas | fondo | Partidas jugadas · Cartón (50) | Nivel 10 |
| Puntos | fondo | Días seguidos de reto · Cartón (7) | no existe |
| Circuito | fondo | Máximo combo · Madera (50) | no existe |
| Aurora | fondo | Partidas jugadas · Madera (150) | Nivel 20 |
| Hexágonos | fondo | Mejor resultado en reto · Madera (50 %) | no existe |
| Atardecer | fondo | Días seguidos de reto · Bronce (30) | no existe |
| Océano | fondo | Máximo combo · Plata (200) | no existe |
| Lluvia | fondo | Mejor resultado en reto · Plata (90 %) | no existe |
| Nebulosa | fondo | Máximo combo · Oro (300) | no existe |
| Nieve | fondo | Partidas jugadas · Oro (3.000) | no existe |
| Luciérnagas | fondo | Días seguidos de reto · Oro (200) | no existe |
| Bosque nocturno | fondo | Invita a un 3.er amigo (cuenta) | no existe |
| Constancia | paleta | Invita a un 2.º amigo (cuenta) | Reto diario 7 días seguidos |

### Reparto por logro (21 premios en 28 escalones)

**Reemplazado/ampliado por CAMBIO-026:** la distribución vigente es la de CAMBIO-026 (28 premios en 28 escalones); esta tabla queda como la propuesta anterior.

(E = efecto, F = fondo; entre paréntesis, el umbral de CAMBIO-010.)

| Logro | Papel | Cartón | Madera | Bronce | Plata | Oro | Diamante | Premios |
|---|---|---|---|---|---|---|---|---|
| Máximo combo | Grilla F (10) | Confeti E (25) | Circuito F (50) | Rayos E (100) | Océano F (200) | Nebulosa F (300) | — (500) | 6 |
| Partidas jugadas | Chispas E (10) | Estrellas F (50) | Aurora F (150) | Monedas E (500) | — (1.500) | Nieve F (3.000) | — (6.000) | 5 |
| Días seguidos de reto | Emojis E (3) | Puntos F (7) | Ondas E (14) | Atardecer F (30) | — (100) | Luciérnagas F (200) | — (365) | 5 |
| Mejor resultado en un reto (%) | Rayas F (0) | Burbujas E (25) | Hexágonos F (50) | — (75) | Lluvia F (90) | — (95) | Fuegos E (99) | 5 |

**Sin premio (7):** Máximo combo Diamante; Partidas Plata y Diamante; Días de reto Plata y Diamante; Mejor resultado Bronce y Oro. **Reemplazado/ampliado por CAMBIO-026:** los 7 tienen premio.

**Criterio:** cada Papel da algo y los clásicos quedan de Papel a Madera, en el logro que menos le quita a quien ya los tiene; lo vistoso (Nebulosa, Nieve, Luciérnagas, Fuegos) va en Oro y Diamante, y los Diamante casi inalcanzables quedan vacíos para no esconder un premio donde nadie llega. (**Reemplazado/ampliado por CAMBIO-026** en lo de los vacíos.)

**Ojo con la dificultad (leído del código, sin datos de jugadores):**
- **Mejor resultado en un reto diario:** un día con **menos de 10 jugadores** vale 0 (`apps/api/src/daily/daily.service.ts:30` y `:329-333`). Si los días no llegan a 10, **Burbujas, Hexágonos, Lluvia y Fuegos no se pueden ganar** (Rayas sí: basta participar). Con 10 jugadores, 90 % y 99 % exigen quedar 1.º (`betterThanPct`, `:65-67`); 50 %, entre los 5 primeros; 25 %, entre los 7 primeros. Antes de aplicar, mirar cuántos juegan cada día. **Cerrada (2026-11-26): se quedan como están** (ver "Decisiones del usuario").
- **Máximo combo 300** puede ser inalcanzable en la práctica (duda ya anotada en CAMBIO-010): Nebulosa depende de eso.
- **Nieve** (3.000 partidas) y **Luciérnagas** (200 días seguidos, con el perdón de 1 por cada 7) son metas de muchos meses.
- 10 de los 21 premios dependen del reto diario (sin la API quedan ocultos). Con CAMBIO-026 son 14 de 28.

### ¿Se puede calcular todo con lo que ya existe?

**Sí, sin tocar la API ni la base de datos**, con un solo campo que falta en las estadísticas del catálogo.

| Dato | Para | De dónde sale hoy |
|---|---|---|
| `bestStreak` | Máximo combo | `CatalogStats` (`apps/client/src/cosmetics/catalog.ts:17`); solo partidas normales (`lib/stats.ts:138`) |
| `runs` | Partidas jugadas (**sí: partidas jugadas = `runs`**, de cualquier modo) | `catalog.ts:19-20`; con sesión, `totalRuns` (`cosmetics/active.ts:21`; API `stats.service.ts:80`). Es el **máximo** entre dispositivo y cuenta, no la suma (`lib/stats.ts:163-172`) |
| `dailyStreakBest` | Días seguidos de reto | `catalog.ts:25-26`, `active.ts:25` |
| `bestDailyPct` | Mejor resultado en un reto | **No está en `CatalogStats`**: existe en `Me.stats.bestDailyPct` (`api/types.ts:19`) y en `DailyLocal.bestPct` (`lib/daily.ts:233`). Hay que agregarlo |
| `invitedCount` | Corazones, Constancia, Bosque | `catalog.ts:23-24`, `active.ts:24` |
| `bestTicks` | Sonidos por insignia | `catalog.ts:15-16` y `tierIndexOfStats` (`:173-175`) |
| `totalKilled` + `bonusXp` | Paletas por nivel | `catalog.ts:195-196` |

**Cuidado:** en dispositivos anteriores a `tb_stats1`, `runs` se reconstruyó desde el historial, que guarda como máximo 30 partidas (`lib/stats.ts:27-47`): un invitado veterano puede figurar con menos partidas de las que jugó.

### Dónde implementarlo (cliente; líneas leídas el 2026-11-26)

1. **Motor** `packages/engine/src/achievements.ts` (`:6`, `:23`, `:26-31`, `:43`): primero CAMBIO-009 y 010 (id `partidas`, siete materiales).
2. **`cosmetics/catalog.ts`**: `CatalogStats` (`:14-37`) suma `bestDailyPct`; `Requirement` (`:39-52`) suma `{ kind: 'achievement', id, level }`; `goalOf` (`:111-128`) arma el texto con `achievementById` / `achievementGoal` (nada de umbrales a mano); `meets` (`:185-202`) usa `achievementLevel(id, valor) >= level`; `missingText` (`:235-268`) según la estadística; `CATALOG` (`:135-159`) con los requisitos de la tabla y el orden nuevo. `requires: 'daily'` en los de los dos logros del reto; **`'accounts'` en Constancia** (hoy `'daily'`, `:144`) y Bosque. `achievementValues` hoy vive en `game/celebrations.ts:74-76`, que importa el catálogo: moverlo a un módulo puro para no crear un ciclo.
3. **`cosmetics/active.ts:20-27`** (`catalogStatsFor`) y **`game/endPrize.ts:45-57`** (`endStats`) + `screens/GameScreen.tsx:437-439` y `:474-479`: pasar el porcentaje. Regla de hoy: con sesión el de la cuenta, de invitado el del dispositivo (`screens/CollectionScreen.tsx:329-330`, `components/CelebrationHost.tsx:33`). Con esa regla, un invitado **pierde sus premios de porcentaje al iniciar sesión** hasta que el servidor calcule el suyo (decisión 4).
4. **`screens/CollectionScreen.tsx`**: `ItemRow` (`:261-305`) dibuja el icono hexagonal del logro (CAMBIO-011) donde hoy dibuja la insignia (`:294`); "necesitas una cuenta" ya sale (`:277`); `listed` (`:307-311`) ya oculta lo que no existe; `achievementValue` (`:321-332`). Opcional: "Premio: …" en la tarjeta de Logros (`:334-366`, `:451-457`), como en la tabla de esta web.
5. **Celebraciones** (`game/celebrations.ts`): `reasonText` (`:236-253`) suma el caso de logro; `OUTSIDE_KINDS` (`:139`) debe incluirlo; `runCelebrations` (`:112-127`) mostraría dos ventanas por un mismo escalón (el logro y su premio): decidir si se juntan. `ownedKeys` (`:205-216`) y `lib/collectionScore.ts:10-12` (el punto de novedad) cambian de cuenta.
   - **Dos huecos vistos al leer (no ejecutados):** (a) `CelebrationHost.tsx:37` arma la foto local con `me = null`, así que `invitedCount` siempre es 0 ahí: **los premios por invitar (hoy Corazones) no se celebrarían**, solo se registran (`celebrationQueue.ts:165-177`); (b) con sesión, `bestDailyPct` llega del servidor y se registra sin celebrar: **los premios de porcentaje no se anunciarían a quien tiene cuenta**. **Decidido (2026-11-26): se arreglan los dos** (ver "Celebraciones por invitar y por porcentaje").
6. **Sonidos por insignia:** el tipo `tier` ya existe; solo cambian los índices. **Requiere el arreglo de CAMBIO-001** (`tierIndexForTicks` y `catalog.ts:173-175` deben dar "sin insignia" bajo 20 s); si no, Marimba se ganaría con cualquier partida, igual que Suave. **Dependencia cerrada (2026-11-26):** CAMBIO-001 se aplicará.
7. **Pruebas:** `cosmetics/catalog.test.ts` (`:74-89`, `:130-146`, `:164-180`), `game/celebrations.test.ts` (`:119-127`), `game/endPrize.test.ts` (premios por insignia y por nivel). Docs: `docs/reglas-y-balance.md` (tabla de premios), `docs/plan-jugabilidad.md`, `docs/arquitectura.md` y el motivo en `docs/historia-y-decisiones.md`.

### Invitados sin cuenta

- **Invitar exige cuenta** (de quien invita y de quien responde "¿Quién te invitó?", una sola vez: `apps/api/src/social/social.service.ts:16-39`): un invitado ve Corazones, Constancia y Bosque bloqueados con "necesitas una cuenta". Sin API ni cuentas se ocultan.
- Tres amigos = los tres premios de invitar, y coincide con el tope de corazones (5 + 3 = 8).
- El conteo se calcula (`users.service.ts:97`): si un invitado **borra su cuenta** (`:170`), baja, y quien lo invitó perdería el premio.
- Los **logros del reto** funcionan también sin cuenta (datos del dispositivo), pero dependen de que el reto exista; el porcentaje de un invitado es el "habrías quedado".

### No quitar lo ya ganado (análisis previo al reset)

**Actualización (2026-11-26):** el usuario respondió con un **reset aprobado** (ver "Decisiones del usuario"). Lo que sigue sirve para elegir el alcance.

Hoy nada se guarda como "ganado": todo se recalcula (`catalog.ts:4-6`). Al publicar, quien no cumpla el requisito nuevo **deja de tener** el premio.

| Premio | Hoy → propuesto | ¿Quién lo perdería? (sin datos reales) |
|---|---|---|
| **Constancia** | 7 días de reto → 2 invitados | **El riesgo principal:** todos los que la tienen y no invitaron a 2 (incluidos todos los invitados sin cuenta) |
| **Aurora** | nivel 20 (9.500 bloques) → 150 partidas | Quien tiene los bloques con menos de 150 partidas (más de 63 por partida de promedio): verosímil |
| **Estrellas** | nivel 10 (2.250) → 50 partidas | Quien los tiene con menos de 50 partidas (más de 45 de promedio): verosímil |
| Chispas | insignia a los 100 s → 10 partidas | Quien llegó a 100 s con menos de 10 partidas: pocos |
| Grilla | nivel 5 (500) → combo 10 | Casi nadie (500 bloques sin 10 seguidos en una partida normal) |
| Confeti | racha 25 → combo 25 | Nadie (misma cifra) |
| Marimba | Plata (275 s) → Papel (20 s) | Nadie: quien tiene Plata ya pasó los 20 s. La ganan muchos más |
| Corazones | sin cambio | Nadie |
| Paletas por insignia | → nivel | Ver CAMBIO-016 |

- **Selección guardada:** `tb_set1` no se borra; `resolveSelection` (`catalog.ts:283-291`, usado en `active.ts:36-46`) usa el valor por defecto (Clásica, 8 bits, Clásico, Liso) **sin avisar**, y el premio vuelve solo si se recupera. Como su clave `item:<tipo>:<id>` ya está en `tb_cele1`, al recuperarlo no se celebraría de nuevo.
- **Opciones (ninguna definitiva):** (A) aceptar la pérdida; (B) para los premios que ya existen, "requisito nuevo **o** el de hoy" (nadie pierde, sin guardar nada, pero la vía vieja queda abierta también para jugadores nuevos); (C) guardar una vez, al actualizar, lo ya desbloqueado (clave nueva; no viaja entre dispositivos sin cambiar la API y rompe el "nada se guarda como ganado"); (D) mover Estrellas, Aurora o Constancia a metas más bajas (reduce el problema, no lo elimina). Antes de elegir, contar en la base cuántas cuentas perderían cada uno.

### Qué NO cambia

El motor de juego y sus reglas (los cambios de `achievements.ts` son los de CAMBIO-008 a 010), el replay, la API, la base de datos, `RULES_VERSION`, rankings, récords, historial y las claves `tb_*` (`tb_best5`, `tb_hist5`, `tb_stats1`, `tb_set1`, `tb_cele1`). Ningún premio da ventaja. Dibujos, sonidos y colores de los premios tampoco cambian. (El **reset aprobado** es aparte: lo que borre depende del alcance, ver abajo.)

### Frases de cambios anteriores que quedan obsoletas

Además de las marcadas "Reemplazado por CAMBIO-025" (016, 022, 023 y 024): los efectos sobre los fondos por nivel de CAMBIO-004 (incluida su alternativa 4 / 9 / 19), "Ningún premio del catálogo depende de este logro" de CAMBIO-009 y 010, y las menciones a Chispas con la insignia Madera (CAMBIO-005).

### Decisiones del usuario (2026-11-26)

1. **Premios del porcentaje del reto: se quedan donde están. CERRADA.** El usuario: "ya tenemos base de jugadores y tendremos más, no te preocupes". La regla de menos de 10 jugadores no cambia y ningún premio se mueve (con CAMBIO-026 se suman Topografía en Bronce, 75 %, y Vitral en Oro, 95 %: con 10 jugadores exigen quedar entre los 3 primeros y 1.º).
2. **Lo ya ganado: reset aprobado por el usuario (alcance por confirmar).** El usuario: "Haremos un reset; ahora solo tenemos testers, hartos pero testers que saben de este cambio." Reemplaza las opciones A–D de "No quitar lo ya ganado" como respuesta de fondo. Es la aprobación que pide el `CLAUDE.md` de la raíz para un reinicio, pero **no dice qué se borra**: antes de ejecutar nada hay que confirmar el alcance.
3. **Celebraciones: agregarlas. CERRADA.** El usuario: "agrégalo". Los premios por invitar (Corazones, Constancia, Bosque nocturno) y los del porcentaje del reto (con cuenta) deben mostrar la ventana de celebración.
4. **Marimba / CAMBIO-001: CERRADA.** El usuario: "ese cambio irá". CAMBIO-001 se aplicará, así que Marimba exige de verdad la insignia Papel (20 s).

### Reset: qué se borra con cada alcance posible

Leído del código el 2026-11-26, solo lectura (no se ejecutó nada ni se miró la base). Los alcances A, B y C son ejemplos para elegir; **ninguno está decidido**.

- **A, todo:** las cuentas se conservan; partidas, rankings, estadísticas, nivel, logros e invitaciones vuelven a cero.
- **B, solo lo que da premios:** estadísticas de cuenta y de dispositivo y reto diario (y, si se quiere, invitaciones); rankings y récord se quedan.
- **C, subir `RULES_VERSION`** (y pasar a `tb_best6`/`tb_hist6`): el procedimiento de la raíz y de `docs/desarrollo.md:96-101`. **Verificado: no reinicia nivel, logros, insignias, racha, porcentaje ni invitaciones**, así que casi todos los premios se quedan.

| Dato (dónde) | Qué premios o cosas dependen | A | B | C |
|---|---|---|---|---|
| Rankings y récord de cuenta: `BestScore` por `rulesVersion` (`apps/api/prisma/schema.prisma:254-275`; `leaderboards.service.ts:28`; `best-scores.service.ts:26`; `users.service.ts:197-206`) | Ningún premio | se borra | se queda | reinicia (lo viejo queda guardado, sin mostrarse) |
| Partidas del servidor: `Run` (`runs.service.ts:355`) | Historial; intentos del reto (`daily.service.ts:139-141`) | se borra | se queda | el historial deja de mostrar las viejas |
| Desafíos (`challenges.service.ts:43-44`, `:74`) | Ningún premio | se borra | se queda | los de la versión anterior dejan de servir |
| `UserStats`: `bestTicks`, `bestStreak`, `totalKilled`, `totalRuns`, `bonusXp`, `bestDailyPct` (`schema.prisma:233-252`; `stats.service.ts:68-84`) | Insignia y sonidos, paletas por nivel, logros de combo, partidas y porcentaje | a cero | a cero | **se queda** |
| Reto diario: `DailyEntry` (`schema.prisma:163-185`; racha en `stats.service.ts:136-143`) | Logro y premios de días seguidos | se borra | se borra | **se queda** |
| Invitaciones: `User.invitedById` (`users.service.ts:97-98`; `social.service.ts:16-45`) | Corazones, Constancia, Bosque y los corazones extra | a cero (y podrán volver a responder "¿Quién te invitó?") | a elegir; borrarlas quita vidas extra | **se queda** |
| Misiones: `MissionReward` (`schema.prisma:289-303`; `missions.service.ts:55-73`) | Evita cobrar dos veces; su XP ya está en `bonusXp` | se borra | se queda | se queda |
| Cuentas, sesiones, seguidos y bloqueos | Acceso | se quedan | se quedan | se quedan |
| `tb_best5`, `tb_hist5` (`lib/historyKeys.ts:6-7`) | Récord e historial del dispositivo | claves nuevas | se quedan (ver trampa 3) | claves nuevas |
| `tb_stats1` (`lib/stats.ts:6-10`; no depende de la versión) | Premios del dispositivo | clave nueva | clave nueva | **se queda** |
| `tb_daily1` (`lib/daily.ts:25`, `:232-233`) | Racha y porcentaje de invitado | clave nueva | clave nueva | se queda |
| `tb_cele1`, `tb_cele1p` (`game/celebrationQueue.ts:18-19`) | Celebraciones ya vistas | clave nueva | clave nueva | se queda |
| `tb_set1` (selección), `tb_me1` (copia de la cuenta, `api/session.ts:9-10`), `tb_miss1` (`lib/missions.ts:15`) | Comodidad y copias | `tb_set1` puede quedarse; las copias, limpiarlas | igual | se quedan |
| **Premios después** | | nadie conserva ninguno ganado | nadie, salvo los de invitar si no se borran | **se conservan** (solo se reinician rankings, récord e historial) |

**Trampas a resolver si se elige A o B** (todas leídas, ninguna probada):

1. El servidor vuelve a calcular `bestDailyPct` desde `DailyEntry` de los últimos 7 días (`daily.service.ts:319-335`, llamado en `:270`): si no se borra `DailyEntry`, el porcentaje revive.
2. El cliente usa el **máximo** entre dispositivo y cuenta (`lib/stats.ts:163-172`, `cosmetics/active.ts:20-27`): hay que reiniciar los dos lados.
3. Si falta `tb_stats1`, se reconstruye desde el historial y el récord (`lib/stats.ts:27-73`): renombrar solo esa clave **revive** datos. En B (que conserva `tb_best5`) hay que quitar esa reconstrucción.
4. En B desaparece la insignia que acompaña al récord en los rankings (sale de `bestTicks`).
5. Toda clave `tb_*` nueva se suma a `CLAVES` de la web vieja (`deploy/gh-pages-redirect/index.html:58-63` y `404.html`) y a `REGLAS` del script (`apps/client/public/index.html:129-226`), con sus pruebas (`lib/mudanza.test.ts`).
6. Los APK instalados conservan sus datos locales y siguen mostrando sus premios; sin subir `RULES_VERSION`, sus partidas siguen entrando y vuelven a sumar. Si se sube, el servidor las rechaza (`runs/run-verification.ts:95`; el cliente avisa en `game/rankedRun.ts:117`).
7. No vi ninguna herramienta de reinicio en la API (los borrados de `apps/api/src` son limpiezas, moderación y borrar cuenta): A o B se harían con una migración o SQL, **con respaldo previo**.

**Frases de cambios anteriores:** varios dicen "no sube `RULES_VERSION` ni toca rankings, récords o claves `tb_*`". Siguen siendo ciertas para cada cambio por sí solo (ninguno lo exige) y no se reescriben; **si el reset usa `RULES_VERSION` o claves nuevas, quedan superadas** por esta decisión (vale también para "Qué NO cambia" de esta entrada y de CAMBIO-026).

### Celebraciones por invitar y por porcentaje (decidido; dónde implementarlo)

Líneas leídas el 2026-11-26; nada ejecutado.

- **Hoy:** la ventana la muestra `components/CelebrationHost.tsx`, montado solo en `screens/GameScreen.tsx:934`. Al terminar una partida se ofrece `runCelebrations` (`GameScreen.tsx:487`; `game/celebrations.ts:112-127`), que no incluye invitados ni porcentaje. Lo de fuera de la partida sale de `outsideCelebrations` (`celebrations.ts:139` y `:155-164`) vía `observeCelebrations` (`celebrationQueue.ts:165-177`), que solo celebra datos del dispositivo en los 2 min tras una partida (`:143`) y **registra en silencio** lo de la cuenta (`:175`). Además la foto local se arma sin cuenta (`CelebrationHost.tsx:37`): invitados siempre 0.
- **Propuesta:** en `observeCelebrations`, antes de `:175`, con sesión, ofrecer (`offerCelebrations`, `:124-133`) lo que el jugador tiene y **no está en `tb_cele1`** de estos grupos: premios por invitar y el logro "Mejor resultado en un reto" con sus premios. Comparar con lo guardado, no con la foto anterior, hace que salga aunque ocurriera con la app cerrada. La primera siembra (`:170`) sigue en silencio. Efecto a aceptar: al entrar con la cuenta en un dispositivo ya sembrado se celebrarían una vez los ya ganados en otro.
- **Que llegue a tiempo:** `useMeRefresh` (`api/hooks.ts:20-23`) solo se usa en la Colección (`CollectionScreen.tsx:380`) y el Perfil (`ProfileScreen.tsx:700`); llamarlo también al volver al inicio del juego.
- **Textos:** `reasonText` (`celebrations.ts:236-253`) suma el caso de logro (punto 5 de "Dónde implementarlo"). **Pruebas:** `game/celebrations.test.ts:119-142` y `game/celebrationQueue.test.ts`.

### Decisión abierta

- **Alcance del reset: CERRADO (2026-11-27): opción A, todo.** Las cuentas se conservan; partidas, rankings, récords, historial, estadísticas, nivel, logros, insignias, reto diario, misiones, desafíos e invitaciones vuelven a cero (en el servidor y en los dispositivos). Las trampas de abajo deben quedar resueltas al implementarlo. **Borrar datos de producción exige una confirmación expresa en el momento de desplegar.**
- **Nombre de la paleta "Constancia": CERRADO (2026-11-27): pasa a llamarse "Amistad"** (ya no premia volver cada día, premia invitar). Cambia solo el nombre visible; el id interno `constancia` se mantiene para no perder la selección guardada ni las claves de celebración.

Cerradas el 2026-11-26: qué pasa con lo ya ganado (reset), premios del porcentaje y celebrar los premios por invitar y por porcentaje.

**Sin respuesta del usuario (no se dan por cerradas; la propuesta sigue tal cual):** confirmar el reparto 4 × 7 (con CAMBIO-026); porcentaje al pasar de invitado a cuenta (¿el de la cuenta, como hoy, o el mayor?); si logro y premio salen en una sola ventana; revisar con datos si alguien llega a combo 300.

### Cómo verlo en esta carpeta

Interruptor en **Con cambios**: los paneles Sonidos, Efectos, Fondos y Paletas muestran el requisito nuevo (con la insignia o la medalla hexagonal del logro en miniatura) y el de hoy tachado; efectos y fondos van ordenados de Papel a Diamante, con los de invitar al final. La tabla **Logros** muestra "Premio: …" bajo cada escalón que entrega algo. La recta de bloques marca los niveles de las paletas (hasta el 30). Datos en `coleccion.js` (`reqNuevo`, tipos `logro` e `invitados`; los textos salen de `LOGROS`). La vista previa sigue permitiendo elegir todo. Con **Ahora** la página queda como antes.

---

## CAMBIO-026 · 5 fondos y 2 efectos más: los 28 escalones de logro con premio

- **Estado:** propuesto (2026-11-26). Pedido del usuario: crear 2 efectos al destruir y 5 fondos y repartirlos entre los 7 escalones sin premio. Los dibujos y el reparto son **mi propuesta**. Maquetado en la web de esta carpeta; **el juego no se tocó**.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**. Reparto por confirmar (B16).
- **Qué:** con "Con cambios" hay **20 fondos** (antes 15) y **12 efectos** (antes 10); "Ahora" sigue en 4 y 4. Amplía CAMBIO-022, 023 y 025.

### Los premios nuevos

| id | Nombre | Descripción | Cómo en React Native (solo lo ya instalado) | Escalón que lo entrega |
|---|---|---|---|---|
| `topografia` (fondo) | Topografía | Curvas de nivel doradas sobre verde oliva | `View` con degradado y un `Svg` con `Pattern` de 200×200 (un mismo trazo cerrado repetido y escalado). Estático. No verifiqué `vectorEffect` en `react-native-svg`: si no sirve, calcular los trazos ya escalados | Mejor resultado en un reto · Bronce (75 %) |
| `ciudad` (fondo) | Ciudad nocturna | Rascacielos con ventanas encendidas | `View` con degradado y un `Svg` con dos `Pattern` (lejos 200×150, cerca 240×112) y círculos de estrellas. Estático | Partidas jugadas · Plata (1.500) |
| `cristales` (fondo) | Cristales | Cuarzos turquesas y violetas | `View` con degradados y un `Svg` (`Pattern` de prismas 220×130, un grupo en el techo 120×76 y destellos). Estático | Días seguidos de reto · Plata (100) |
| `vitral` (fondo) | Vitral | Vidrios de colores con uniones de plomo | `View` base, `Svg` con `Pattern` (dibujo de 150 con `Use`, a 196 px) y un `View` con degradados encima. Estático | Mejor resultado en un reto · Oro (95 %) |
| `galaxia` (fondo) | Galaxia | Galaxia espiral que gira muy lento (**animado**) | `View` con degradado y **un** `Animated.View` con un `Svg` (trazos, `strokeDasharray`, `RadialGradient`); un valor compartido, 90 s por vuelta, quieta con `useReducedMotion` | Partidas jugadas · Diamante (6.000) |
| `pixeles` (efecto) | Píxeles | El bloque se rompe en píxeles que saltan a pasos, como en 8 bits | 12 `Animated.View` cuadrados de 13 px (4×3, 3 tonos del color del bloque); 640 ms en 8 pasos de tiempo, posición en rejilla de 4 px, gravedad, se apagan de golpe. Movimiento reducido: 6, 450 ms, desvanecido suave | Máximo combo · Diamante (500) |
| `fugaces` (efecto) | Estrellas fugaces | Estrellas con estela que cruzan el bloque en diagonal | 5 estrellas (estela `View` de 48–70×5 con `linear-gradient` + `Text` ★ U+2605 de 19–25 px) y un destello: 11 nodos; dirección 148°, 115–155 px, escalonadas ~55 ms, 400–520 ms (total ≤ 760 ms). Movimiento reducido: 2 estrellas (4 nodos), sin destello ni giro, la mitad del recorrido | Días seguidos de reto · Diamante (365) |

Sin librerías nuevas (`react-native-svg` 15.16, `react-native-reanimated` 4.7.1 y `backgroundImage` ya se usan). Con Galaxia son **4** los fondos animados (Lluvia, Nieve, Luciérnagas, Galaxia).

### Distribución completa (reemplaza la tabla de reparto de CAMBIO-025)

(E = efecto, F = fondo; entre paréntesis, el umbral; en **negrita**, lo nuevo.)

| Logro | Papel | Cartón | Madera | Bronce | Plata | Oro | Diamante |
|---|---|---|---|---|---|---|---|
| Máximo combo | Grilla F (10) | Confeti E (25) | Circuito F (50) | Rayos E (100) | Océano F (200) | Nebulosa F (300) | **Píxeles E** (500) |
| Partidas jugadas | Chispas E (10) | Estrellas F (50) | Aurora F (150) | Monedas E (500) | **Ciudad nocturna F** (1.500) | Nieve F (3.000) | **Galaxia F** (6.000) |
| Días seguidos de reto | Emojis E (3) | Puntos F (7) | Ondas E (14) | Atardecer F (30) | **Cristales F** (100) | Luciérnagas F (200) | **Estrellas fugaces E** (365) |
| Mejor resultado en un reto (%) | Rayas F (0) | Burbujas E (25) | Hexágonos F (50) | **Topografía F** (75) | Lluvia F (90) | **Vitral F** (95) | Fuegos E (99) |

**Criterio:** los 2 efectos van a los dos Diamante de hazaña más dura (500 de combo y 365 días), lo más vistoso a los otros huecos altos (Galaxia, animada, en Diamante; Vitral en Oro; Ciudad y Cristales en Plata) y lo más calmado (Topografía) al Bronce. Son 28 premios en 28 escalones (10 efectos y 18 fondos), cada uno una vez. **14 dependen del reto diario** (antes 10 de 21). CAMBIO-025 prefería dejar vacíos los Diamante casi inalcanzables; el usuario pidió llenarlos.

### Legibilidad (medida en la web, con la herramienta de CAMBIO-022)

14 de 14 paletas pasan las reglas sobre los 20 fondos (`herramientas/prueba-fondos/RESULTADOS-FONDOS.md`). Ninguna de las 336 ventanas muestreadas por fondo se confunde con la trampa roja `#ff2a2a`. Ventanas parecidas a algún color de bloque (ΔE < 10): 0 en Topografía, Ciudad, Cristales y Vitral; **11 de 336 en Galaxia** (la franja de los brazos, mínima ΔE 3,0), después de atenuarla. Con Contorno y Cristal el contraste del borde contra el fondo baja en puntos sueltos; las tres paletas translúcidas van sobre respaldo opaco. Es una captura (Galaxia gira) y no se midió en el APK.

### Dónde implementarlo (nada aplicado)

1. `cosmetics/catalog.ts`: los 7 premios con el requisito de logro de CAMBIO-025 (`{ kind: 'achievement', id, level }`).
2. `components/FieldBackground.tsx`: los 5 fondos.
3. `components/Fx.tsx`: ids `pixeles` y `fugaces` en `BurstEffect`; la vida de la partícula hoy es fija (750 ms para `burst`) y debe poder ser por efecto (Estrellas fugaces llega a 760 ms).
4. `screens/CollectionScreen.tsx`: sus miniaturas e iconos de efecto.
5. Pruebas del catálogo y de las celebraciones; `docs/reglas-y-balance.md` (premios), `docs/arquitectura.md` y el motivo en `docs/historia-y-decisiones.md`. Revisar en web y APK (CAMBIO-021).

### Qué más afecta

Peso de la web (dibujos SVG en línea, sin imágenes), batería con un fondo animado más (Galaxia, una sola capa) y el contador de la Colección (más premios). Los de Diamante pueden no verse nunca en la práctica (500 de combo, 365 días seguidos, 6.000 partidas).

### Qué NO cambia

Motor, reglas, replay, API, base de datos, `RULES_VERSION`, rankings, récords, historial y claves `tb_*` (el reset de CAMBIO-025 es una decisión aparte). Ningún premio da ventaja. Los 15 fondos y 10 efectos anteriores no cambian de dibujo ni de escalón.

### Cómo verlo en esta carpeta

Interruptor en **Con cambios**: los 7 aparecen con "nuevo" en Efectos y Fondos y como "Premio: …" en la tabla **Logros** (28 de 28). Clic en la fila y tocar bloques en "Vista previa". Datos en `coleccion.js`; fondos en `extras-fondos.css`; efectos en `preview.js` (`FX_NUEVOS`: `pixeles`, `fugaces`) y `preview.css`.

---

## CAMBIO-027 · Tarjetas de premios de la Colección más cortas, con desplazamiento propio

- **Estado:** pedido por el usuario y aplicado el 2026-11-27, mirando el emulador.
- **Estado en el juego (2026-11-27):** aplicado en la rama `feat/premios-y-logros`, **sin desplegar**.
- **Pedido (textual):** "las cards que contienen las paletas de colores, los fondos, efectos y sonidos, están muy grandes, puesto que hay muchos, hagamos la card más chica y que sean visibles unos 4 items y dentro de la card haya un scroll para ver el resto de premios de cada card, para que no quede tan larga esa pantalla".
- **Qué:** las tarjetas Paletas, Sonidos, Efectos al destruir y Fondos del campo muestran 4 filas y la mitad de la 5.ª; el resto se desplaza dentro de la tarjeta, con barra visible (en Android una propia: la nativa salía oscura sobre el fondo y no se veía). Al llegar a un extremo se desplaza la pantalla. Insignia, Experiencia, Logros, Vista previa y la galería de prueba no cambian.
- **Dónde:** `screens/CollectionScreen.tsx` (`PrizeList`) y `lib/prizeList.ts` (alto con las filas medidas, tope del 60 % de la pantalla; test en `lib/prizeList.test.ts`).
- **Qué NO cambia:** premios, requisitos, orden, equipar, motor, API ni claves locales. La web de esta carpeta no se actualizó.
