# Cambios por hacer (config_logros)

Lista de cambios **propuestos** (001 a 015) a logros, niveles, insignias, retos y premios. **Ninguno está aplicado en el juego.** No se toca el juego hasta que el usuario diga "aplica el cambio X" (ver `CLAUDE.md` de esta carpeta).

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

- **Estado:** propuesto (2026-11-20)
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
- **Qué:** en la pestaña **Colección** del juego, el cuadro (sección) **"Logros"** pasa a mostrarse **justo debajo de "Nivel" y antes de "Paletas"**. Hoy está al final de la pantalla, después de Paletas, Sonidos, Efectos al destruir y Fondos del campo.
- **Orden hoy (arriba → abajo):** Insignia · Nivel · Paletas · Sonidos · Efectos al destruir · Fondos del campo · Logros.
- **Orden propuesto:** Insignia · Nivel · **Logros** · Paletas · Sonidos · Efectos al destruir · Fondos del campo.
- **Por qué:** pedido del usuario (lo marcó sobre una captura de la Colección en el celular, con una línea entre la tarjeta de Nivel y la de Paletas). Insignia, Nivel y Logros son **progreso del jugador**; Paletas, Sonidos, Efectos y Fondos son **premios para elegir**. Agruparlos así deja el progreso junto arriba, sin tener que bajar toda la lista de premios para llegar a los logros.
- **Dónde (solo el cliente; es un cambio de orden, no de lógica):**
  - `apps/client/src/screens/CollectionScreen.tsx`, el render (~líneas 426-460): hoy va `<TierCard>`, `<LevelCard>`, luego el `TYPE_ORDER.map(...)` con las secciones de premios y, al final, `<Section title="Logros">` con las `AchievementRow`. Mover el bloque `<Section title="Logros">…</Section>` para que quede entre `<LevelCard stats={stats} />` y el `TYPE_ORDER.map(...)`. Opcional: extraerlo a un componente (`AchievementsCard`) como ya son `TierCard` y `LevelCard`.
  - Nada más depende del orden: el punto de novedad de la pestaña (`lib/collectionScore.ts`, `lib/collectionNews.ts`) cuenta cosas, no secciones; la API y el motor no se tocan. Revisar que no haya un test o una captura que asuma el orden.
- **Efecto en los jugadores:** solo visual. Quien baja por la Colección ve los logros antes que los premios. No se reinicia ni se recalcula nada (no toca `RULES_VERSION`, rankings, récords ni claves `tb_*`).
- **En esta carpeta:** la web (`index.html`) hoy muestra "Premios" y después "Logros" (un panel por cada tipo de premio). Para reflejar este cambio con el interruptor Ahora / Con cambios habría que mover la sección de Logros entre "Bloques destruidos y nivel" y "Premios" cuando esté en "Con cambios". **Todavía no está hecho**: el usuario solo pidió anotarlo.

---

## CAMBIO-007 · El "Nivel" pasa a llamarse "Experiencia"

- **Estado:** propuesto (2026-11-20).
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

- **Estado:** propuesto (2026-11-20). Los diseños los hace el subagente de diseño contra este encargo; lo que entregue se anota abajo, en "Diseños entregados".
- **Qué:** hoy un logro se dibuja con **la misma medalla redonda que las insignias** (`TierBadge` con `tier: material.toLowerCase()`, `step: 1` y una estrella): un logro "Plata" se ve como la insignia Plata. En su lugar, **cada logro tiene un icono propio**, que no es una medalla, y ese icono se dibuja en **los siete materiales** (Papel, Cartón, Madera, Bronce, Plata, Oro, Diamante; ver CAMBIO-010). El icono dice **qué logro es**; el material dice **hasta dónde llegó** el jugador.
- **Por qué:** pruebas con usuarios. La insignia se gana por la **partida más larga**; los logros se ganan por **otras estadísticas**, pero se dibujan igual (mismo disco, mismos materiales, mismos colores), y los jugadores los confunden: no entienden que son dos progresos distintos.
- **Los cuatro iconos (decisión del usuario, 2026-11-20):**

  | Logro (id interno) | Icono | Archivo |
  |---|---|---|
  | Máximo combo (`racha`) | **Rayo** | `racha-<material>.svg` |
  | Partidas jugadas (`partidas`) | **Botón de play ▶** | `partidas-<material>.svg` |
  | Días seguidos de reto diario (`diasReto`) | **Calendario con llama** | `diasReto-<material>.svg` |
  | Mejor resultado en un reto diario (`mejorReto`) | **Copa** | `mejorReto-<material>.svg` |

  `<material>` = `papel`, `carton`, `madera`, `bronce`, `plata`, `oro`, `diamante`. Cada icono se entrega en **los siete materiales** (28 archivos) más su **estado vacío** (`<id>-vacio.svg`, 4 archivos). Carpeta: `config_logros/logros_iconos/`.
- **Otras decisiones del usuario:** (1) **estado vacío: sí**: mientras el jugador no tiene ni el primer material se ve la **silueta apagada del icono** (como `EmptyMedal` hoy con la insignia), no un disco vacío. (2) **Un solo generador** para todo (`config_logros/herramientas/gen-logros.js`): una forma por logro y siete "pieles" de material. (3) **Cada icono es libre**: no comparten marco ni base. (4) **Los textos cambian también** (ver abajo).
- **Reglas de diseño (el subagente diseña contra esto):**
  - **No debe parecer una insignia.** Nada de disco ni placa redonda detrás, nada de aro, nada de la estrella de las medallas de logro actuales. **La silueta del objeto es el icono** (rayo, calendario, copa, botón de play). Un botón de play no puede ser un círculo con un triángulo: usar un **triángulo redondeado con grosor** o un botón de **esquinas redondeadas** (un círculo se confunde con una medalla).
  - **El mismo lenguaje de luz y volumen de las insignias** (ver `ESTILO_INSIGNIAS.md` y `herramientas/`): luz arriba a la izquierda, degradado claro → medio → oscuro, canto oscuro de 0,7, brillo, **sombra dura** negra al 42 % corrida hacia abajo. `viewBox="0 0 100 100"`, sin `transform` ni `filter` (solo `clipPath`), sin imágenes ni fuentes externas.
  - **Los siete materiales deben leerse como la misma escala que las insignias**, con los **mismos colores base**: Papel, Cartón y Madera como en `insignias_nuevas/` (CAMBIO-005); Bronce, Plata, Oro y Diamante como en `insignias/` (`TIER_LOOK` de `apps/client/src/cosmetics/tiers.ts`). Cada objeto está "hecho de" ese material (un rayo de papel recortado, de cartón corrugado, de madera, de bronce…). Cuidado con la **copa de papel o cartón**: no debe parecer un vaso desechable; debe ser una **copa de trofeo** (asas, pie y base) hecha de papel plegado o cartón.
  - **Legibilidad a 38 px** (tamaño de la fila de la Colección) y a **74 px** (celebración): son los **únicos tamaños que usa el juego** para un logro (`BADGE_PX.md` = 38 y `BADGE_PX.lg` = 74). Papel y Cartón deben distinguirse entre sí a 38 px, y también Plata de Diamante. Un solo SVG por combinación (no hay versión `-small`: no se usa por debajo de 30 px).
  - **Calendario con llama:** que la llama se lea como llama en los siete materiales (puede conservar un tinte cálido) y que el calendario lleve el material.
  - **Estado vacío:** misma silueta, en gris oscuro apagado (como la tarjeta "Sin insignia" de la web y `EmptyMedal` en `CollectionScreen.tsx`), sin material.
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
- **Cómo verlo en esta carpeta:** con el interruptor en "Con cambios", la tabla de Logros muestra **el icono de cada logro en cada material** (en lugar de las medallas del encabezado) y su silueta vacía al lado del nombre. **Al hacer clic en cualquier icono se abre un modal con toda la familia** (los siete materiales y el estado vacío, a 74 y a 38 px) y con el texto de la celebración, antes y después. Debajo hay además una sección **"Logros en el celular"**: la tarjeta "Logros" de la Colección tal como la dibuja el celular, con un jugador de ejemplo editable; sigue el interruptor (con "Ahora" se ve la de hoy y con "Con cambios" la nueva, una sola a la vez).
- **Diseños entregados:** los 32 SVG están en `config_logros/logros_iconos/` (`<id>-<material>.svg`, 120 px, `viewBox` 100). Los genera `config_logros/herramientas/gen-logros.js`, que los reproduce idénticos. La guía de estilo es `config_logros/ESTILO_LOGROS.md`.
  - **Iconos:**
    - **Rayo** (`racha`): rayo de siete puntas con las esquinas apenas redondeadas y grosor de 4,5.
    - **Play** (`partidas`): triángulo con las esquinas muy redondeadas (radio 10) y grosor de 5. No es un círculo.
    - **Calendario con llama** (`diasReto`): hoja (tono claro del material), cabecera (tono oscuro) y dos anillas. La llama de encima conserva siempre su tinte cálido (`#ffc23a` → `#ff7a1a` → `#d93a12`, corazón amarillo).
    - **Copa de trofeo** (`mejorReto`): copa con boca oscura, dos asas, pie, nudo y base de dos escalones. En papel y cartón se lee como trofeo, no como vaso.
    - Ninguno tiene disco, aro ni la estrella de las medallas.
  - **Materiales** (mismas bases que las insignias; la tabla completa está en `ESTILO_LOGROS.md`):
    - **Papel**: crema `#fdf6e6` → `#ecdcbb` → `#b9a37b`, con renglones azules, margen rojo y un pliegue en diagonal. Lo hice más cálido que el blanco de la insignia para no confundirlo con Plata.
    - **Cartón**: kraft `#ecd3a4` → `#c39a62` → `#7a5630`, con canaletas, fibras y una banda rayada por dentro del borde (el corrugado).
    - **Madera**: `#e2b77c` → `#b07f4a` → `#6e4824`, con piezas oscuras de nogal, veta, nudo y remaches de latón.
    - **Bronce, Plata y Oro**: las bandas de color de `medal.ts`, con reflejos en diagonal. Plata lleva 1 destello y Oro 2.
    - **Diamante**: `#e6faff` → `#2390d2`, tallado en facetas con mesa en rombo y 3 destellos.
  - **Estado vacío:** la misma silueta en `#1f1f2d` con borde punteado `#4a4a66`, sin sombra ni color.
  - **Verificado** a 74 y 38 px, y a 22 px como margen, sobre `#12121a` y junto a las siete insignias. A 38 px se distinguen los cuatro objetos y los siete materiales: Papel (crema con renglones) contra Cartón (kraft), y Plata (gris) contra Diamante (azul).
  - **Límites a 22 px:**
    - Cartón y Madera se distinguen casi solo porque Madera es más oscura (la veta y los remaches ya no se ven).
    - El estado vacío casi desaparece sobre el fondo.
    - Los renglones del Papel y el tallado del Diamante se pierden.
    - No hace falta arreglarlos: el juego no muestra logros a 22 px.
  - **Decisiones abiertas para el usuario:**
    1. Si la llama debe tomar el color del material, sobre todo en Plata y Diamante. Hoy es siempre cálida, que se lee mejor.
    2. Si el estado vacío debe ser más visible a 38 px (un gris más claro).
    3. Si la copa de Papel debería llevar más pliegues para verse "de papel plegado". Hoy tiene uno en diagonal por pieza.
    4. Si se quiere una base o marco común. El encargo pidió iconos libres, así que no la hay.

---

## CAMBIO-012 · Ver en grande y compartir insignias, logros y premios ganados

- **Estado:** propuesto (2026-11-20). Solo está anotado: todavía no se maquetó en la web de esta carpeta.
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
- **Qué:** se agrega al pool de misiones del día una misión nueva, **"Sigue a un jugador hoy"**: tipo nuevo "Seguir a un jugador" (`follow`), meta 1, premio **+20 bloques extra** para el nivel (como las misiones más fáciles). Se cumple al **empezar a seguir a alguien ese día**. **Solo se puede cumplir con cuenta** (un invitado no puede seguir a nadie), **pero se sortea y se ve igual para todos**: `missionsFor(fecha)` es idéntico para cualquiera. A un **invitado** se le muestra **bloqueada**, con el texto exacto **"Crea tu cuenta para desbloquearla"**, y al tocarla lo lleva a crear la cuenta (decisión del usuario, 2026-11-23; ver "Consecuencias de mostrarla bloqueada a invitados"). El pool pasa de 13 a 14 misiones (21 con CAMBIO-015); siguen saliendo 3 por día. En la web, la sección "Misiones" cambia el contador "Misiones posibles" de 13 (Ahora) a 21 (Con cambios) y muestra la fila nueva con borde celeste, la marca "nuevo" y un selector "Ver como: con cuenta | invitado" que solo cambia esa fila.
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
  1. **Fecha de inicio** `MISSIONS_POOL_FROM = '2026-12-07'` en `missions.ts` (nombre propuesto; en la web, `MISIONES_INICIO_POOL`). Antes de esa fecha, `missionsFor` usa **exactamente el pool de hoy (13 entradas, mismo orden, mismo algoritmo)**: ningún día pasado ni de hoy cambia. Desde esa fecha usa el pool completo (21 con CAMBIO-015). `MISSION_POOL` tiene todas (las nuevas al final) y `missionsFor` filtra las nuevas si la fecha es anterior. Comparar con `dayIndex`, aritmética entera, como el resto del motor.
  2. **Qué fecha (cerrada):** **lunes 2026-12-07**, el mismo día que arranca el ciclo de retos de CAMBIO-013. Ese día el listado pasa de 13 a 21 misiones (CAMBIO-014 y CAMBIO-015 entran juntos). La fecha debe quedar al menos 2 días después de publicar, porque el servidor acepta fechas de UTC−12 a UTC+14 (`apps/api/src/common/dates.ts`, `isWithinDateWindow`). Si no se alcanza a publicar antes, **no se mueve hacia atrás**: se elige el **siguiente lunes para retos y misiones a la vez** (`DAILY_CYCLE_FROM` y `MISSIONS_POOL_FROM` cambian juntas).
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
    - **Invitado con APK viejo:** calcula el trío con su pool de 13 (`guestMissions`, `lib/missions.ts:104-106`), sin pedirle nada al servidor. Desde el 7 dic ve **otro trío** que el de un cliente nuevo para el mismo día: en la simulación de 730 días desde el 2026-12-07, **el trío de 21 es distinto al de 13 todos los días (0 de 730 coinciden)**. Es **solo cosmético**: cada dispositivo es coherente consigo mismo, los ids no cambian, los premios son locales (`tb_miss1`) y nada se valida contra el servidor. Lo único que se pierde es que "las mismas para todos" deja de ser cierto para quien no actualizó, y no ve la misión de seguir ni las 7 nuevas.
    - **No hace falta forzar la actualización.** Basta la fecha de inicio. (Opinión mía: es un efecto conocido y no justifica bloquear a nadie.)
  - **4d. Cuántos días ve un invitado la misión bloqueada.** Con el pool de 21 y el algoritmo exacto (FNV-1a + mulberry32), en 730 días desde el 2026-12-07 **`sigue` aparece en el trío en 122 días (16,7 %, algo más de 1 de cada 6)**; en los primeros 90 días, en 14. Máximo 3 días seguidos con ella. **Esos días el invitado tiene 2 de 3 misiones jugables** (las otras dos son de los demás tipos y siempre se pueden cumplir sin cuenta). Los otros 608 días no ve nada bloqueado. (Cuenta mía con una copia del algoritmo; no se corrió contra el motor real.)
  - **4e. Riesgo de UX: que parezca una trampa para forzar el registro.** Mitigación más simple: (1) **un solo texto honesto**, sin urgencia ni amenaza ("Crea tu cuenta para desbloquearla", sin "pierdes tu premio"); (2) **es solo 1 de 3** y nunca bloquea las otras dos (ver 4d); (3) **premio chico (+20)**, así que no hay sensación de perder algo importante; (4) que **no genere ningún aviso negativo**: la pantalla final solo lista las recién cumplidas (`newlyCompleted`, `lib/missions.ts:111-115`), así que una misión que no se cumple no aparece; (5) no mostrar ventanas emergentes: solo el toque en la fila. Con eso es una invitación, no una puerta cerrada. Opinión mía; no hay datos de retención que lo respalden.
- **Pendiente para más adelante: misión "Invita a alguien".** Por decisión del usuario se pospone, no se descarta, y **no está maquetada**. Motivos: hoy la invitación es **declarativa** (cualquiera escribe un nombre en "¿Quién te invitó?" y se cuenta al instante, sin que el invitado juegue ni nada más), **no hay protección contra cuentas falsas**, y ya da un corazón extra **permanente** (`livesFor`, tope 8; `social.service.ts:12-14, 43-44`), o sea que una misión repetible encima premiaría doblemente un acto fácil de falsear. Antes habría que **exigir que el invitado juegue algo** (por ejemplo, una partida válida terminada) para que la invitación cuente como premiable, y recién ahí mirar una misión.
- **Cómo verlo en esta carpeta:** sección "Misiones". Con el interruptor en "Ahora" el contador "Misiones posibles" dice 13 y no aparece la nueva. En "Con cambios" dice 21 (en celeste: 14 de CAMBIO-014 más las 7 de CAMBIO-015), y después de las 13 de hoy aparece "Sigue a un jugador hoy" con borde celeste, la marca "nuevo", "Seguir a un jugador · meta 1" y "+20". Sobre esa fila hay un selector **"Ver como: con cuenta | invitado"** (solo afecta esa fila): con cuenta se ve normal y con la nota de cómo se cumple; como invitado se ve atenuada, con un candado y el texto "Crea tu cuenta para desbloquearla" en celeste. Tras esa fila siguen las 7 de CAMBIO-015. Una línea bajo el título dice que desde el lunes 7 dic 2026 salen del pool completo y antes del de 13.

---

## CAMBIO-015 · 7 misiones más (de 14 a 21 posibles)

- **Estado:** propuesto (2026-11-23), pedido del usuario. Solo está anotado y maquetado en la web de esta carpeta (interruptor "Con cambios"); el juego no se tocó. Va junto a **CAMBIO-014**: 13 de hoy + "Sigue a un jugador hoy" + estas 7 = **21 misiones posibles**.
- **Qué:** se agregan 7 misiones al pool, solo con datos que `DayAgg` ya tiene (`runs`, `killed`, `bestStreak`, `maxTicks`; `packages/engine/src/missions.ts:99-110`). **No hay tipos nuevos, ni campos nuevos en `DayAgg`, ni cambios en la API o en el cliente**: son filas nuevas de `MISSION_POOL` y `missionProgress` ya las sabe calcular. Siguen saliendo 3 por día, de tipos distintos.

| Misión | Tipo | Meta | Premio | Por qué esta meta |
|---|---|---|---|---|
| Racha de 20 | Racha en una partida | 20 | +40 | Está entre "Racha de 15" (+30) y "Racha de 25" (+50). Un combo completo es de 20 (`COMBO_CYCLE`, `constants.ts:63`) y el logro "Mejor racha" empieza en 10 y 25 (`achievements.ts:27`). |
| Racha de 40 | Racha en una partida | 40 | +60 | Entre el nivel 2 (25) y el 3 (50) del logro de racha: difícil pero posible; un solo error la reinicia. Pasa el corazón de recuperación en la racha 25 (`HEART_COMBO`, `constants.ts:75`). |
| Llega al 9 | Llegar a una etapa | 120 s | +40 | El hito del 9 cae en 120 s (`(9 − 3) × NUM_STEP`, `progress.ts:43`): el hueco entre "Llega al 8" (100 s, +30) y "Llega a las sumas y restas" (140 s, +50). |
| Llega a los bloques de 4 s | Llegar a una etapa | 350 s | +80 | Es la etapa final (`LIFE_STAGE_START` = 350, `constants.ts:31`), la meta de la insignia Oro (`progress.ts:121`). Es la más difícil que pide una misión (6 min sin quedarse sin tiempo ni vidas) y supera a "Llega a las multiplicaciones y divisiones" (275 s, +60). |
| Destruye 90 bloques hoy | Bloques en el día | 90 | +40 | Entre "Destruye 60" (+30) y "Destruye 120" (+50). |
| Destruye 250 bloques hoy | Bloques en el día | 250 | +60 | Sigue la escalera (120 → +50). Con la cadencia de aparición (`spawnCooldown`, `constants.ts:119`: 0.8 s en promedio al empezar y ~0.55 s desde los 120 s) una partida de 350 s genera como tope teórico unos 600 bloques (cuenta mía; los que se destruyen de verdad son menos, por el límite de bloques simultáneos y los toques que pide cada uno), así que 250 se logra en una buena partida o en 2 o 3 normales. |
| Juega 8 partidas hoy | Partidas en el día | 8 | +40 | Entre "Juega 5" (+30) y lo que ya sería insistir demasiado; cuentan las del reto también (`runs` suma todas). |

  La escalera de premios sigue siendo +20 / +30 / +50 / +60, más **+40** (ya existía en "Juega el reto del día") y **+80** solo para la etapa final. **No medí cuántos bloques o partidas hace un jugador real por día:** las metas de 250 bloques y 8 partidas son estimaciones; conviene mirar el historial real (`k`, partidas por día) antes de aplicar.
- **Por qué:** pedido del usuario: más variedad, para que las mismas misiones no se repitan tan seguido, y metas más altas para quien ya llega lejos (hoy la más difícil es la de 275 s).
- **Dónde implementarlo:**
  - `packages/engine/src/missions.ts`: 7 entradas al **final** de `MISSION_POOL` (después de `sigue` de CAMBIO-014; no cambiar el orden ni los ids existentes): `racha20`, `racha40`, `llega9` (`reach('llega9', milestone('num', 9), 40)`), `llegaFinal` (`reach('llegaFinal', milestone('life', LIFE_STAGE_FIRST), 80)`: el nombre del hito sale de `MILESTONES` y el título queda "Llega a los bloques de 4 s"), `destruye90`, `destruye250` y `juega8`. Usar las constantes del motor, no números sueltos, para las metas de tiempo.
  - `packages/engine/test/missions.test.ts`: `:25` exige premios de 20 a 60, así que **hay que subir ese tope a 80** (o dejar "bloques de 4 s" en +60); `:22` (al menos 10) y `:68` ("con el tiempo aparecen todas" en 730 días) siguen valiendo (la de menos frecuencia, "Racha de 40", sale ~1 de cada 7 días). Agregar los casos de las nuevas en el avance.
  - Nada en la API ni en el cliente (`MissionList.tsx`, `lib/missions.ts`): no enumeran misiones. El título más largo sigue siendo "Llega a las multiplicaciones y divisiones".
  - Docs al aplicar: `docs/reglas-y-balance.md` (tabla de misiones, líneas ~144-150) y `docs/historia-y-decisiones.md`.
- **Efecto en el sorteo de `missionsFor` (se resuelve junto con CAMBIO-014, fecha cerrada: lunes 2026-12-07, `MISSIONS_POOL_FROM`):** al cambiar el tamaño del pool cambia el trío de casi todos los días, igual que se explicó en CAMBIO-014 ("Qué pasa con `missionsFor`…"). Con el pool de 21 simulé los 730 días desde el 12 nov 2026: **ningún día (0 %) queda igual que hoy**. Por eso la **fecha de inicio** (`MISSIONS_POOL_FROM` en CAMBIO-014) debe cubrir las dos cosas: **una sola fecha** a partir de la cual rige el pool de 21 y antes de la cual rige el de 13 de hoy. No se repite aquí la recomendación: ver CAMBIO-014, sección "Recomendación" (la fecha quedó cerrada: lunes 2026-12-07, junto con los retos de CAMBIO-013).
- **Cambia la frecuencia de cada misión (cuenta mía, 730 días simulados):**

| Misión o tipo | Hoy (13) | Con 21 |
|---|---|---|
| Algún "Llegar a una etapa" | 80 % de los días | 77 % |
| Algún "Bloques en el día" | 70 % | 72 % |
| Alguna racha | 67 % | 68 % |
| Alguna "Partidas en el día" | 54 % | 50 % |
| "Juega el reto del día" | **30 %** | **15 %** |
| "Sigue a un jugador hoy" | — | 17 % |

  El sorteo elige entre **entradas**, no entre tipos, así que los tipos con más entradas salen más. Efecto a notar: **"Juega el reto del día" se ve la mitad de los días** (de 30 % a 15 %). Si se quiere que el reto siga empujándose, habría que pesarlo (queda como decisión abajo).
- **Decisiones que el usuario debe confirmar:**
  1. **Premio de "Llega a los bloques de 4 s":** +80 propuesto (obliga a subir el tope de la prueba, de 60 a 80); alternativa +60 sin tocar la prueba.
  2. **"Juega el reto del día" a la mitad de frecuencia:** aceptarlo, o pesar el sorteo para que no baje (por ejemplo, que el reto no compita como una entrada más). Cambiar el algoritmo de sorteo es más delicado que agregar entradas.
  3. **Metas de 250 bloques y 8 partidas:** estimaciones, pendientes de contrastar con datos reales.
- **Qué NO cambia:** `DayAgg`, `missionProgress`, la API (solo aparecen ids nuevos), el cliente, las 13 misiones de hoy (ids, metas, premios), las misiones por día (3), los rankings, los récords, las claves `tb_*` y `RULES_VERSION`.
- **Cómo verlo en esta carpeta:** sección "Misiones". Con el interruptor en "Ahora": contador 13. En "Con cambios": contador 21 (en celeste) y, al final de la lista, 8 filas con borde celeste y la marca "nuevo": la de seguir a un jugador (con su nota de "solo con cuenta") y las 7 de este cambio.
