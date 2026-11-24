# Contorno "puro" con rojo de trampa y número propios: ¿se puede?

Fecha: 2026-11-24. Análisis para conversar; no se aplicó nada (ni al juego, ni a `coleccion.js`, ni a `cambios.md`).

## Respuesta corta

**No, tal como está planteado.** Con relleno 0, ningún rojo de trampa, ni ningún color de ningún tipo, hace pasar todas las aserciones de `palettes.test.ts`, y cambiar el blanco del número no ayuda ni es necesario.

- **Contraste:** sí se puede arreglar. Un rojo muy oscuro (por ejemplo `#4d101a`, contraste 1,246) cumple las dos reglas de contraste. La familia `#7a1f2a`–`#a02030` que propuso el usuario **no entra**: da 1,83–2,43, fuera del rango 1,156–1,730.
- **Tono:** no se puede arreglar con ningún color. Con relleno 0 las seis posiciones SAFE quedan sobre el mismo color (el fondo), y las reglas de tono se contradicen entre sí. En el barrido de 636.056 colores RGB, ninguno pasa las tres reglas de tono a la vez.
- **"9 colores distintos":** no depende del rojo ni del blanco. Es un efecto de medir el color efectivo (fondo en las 9 posiciones). Medida sobre los 9 hex de borde del catálogo, pasa.

Todo lo anterior se ejecutó. Detalle en las secciones siguientes.

---

## 1. Qué mide cada aserción que falla

Archivo: `apps/client/src/cosmetics/palettes.test.ts`. Cada regla se aplica a una paleta de 9 colores y a las 6 posiciones SAFE (2, 3, 4, 5, 7, 8; las únicas donde el motor pone trampa roja).

| `it` (línea) | Qué compara | Umbral | Contorno puro (rojo `#ff2a2a`) |
|---|---|---|---|
| `el caso más difícil de tono es tan difícil como en la Clásica` (:110-112) | la **menor** distancia de tono HSL entre el texto rojo y el color bajo el número, en las 6 posiciones SAFE | ≤ 42,47 + 8 = **50,47°** | 120,0° (el fondo `#12121a` tiene tono 240°); sobran 69,5° |
| `el rojo de la trampa contrasta como en la Clásica` (:118-123) | contraste WCAG entre el texto rojo y el color bajo el número, en cada SAFE | **1,156–1,730** | 4,983 (sobran 3,25) |
| `el caso más difícil de contraste es tan difícil como en la Clásica` (:125-127) | el **menor** de esos contrastes | ≤ 1,156 + 0,1 = **1,256** | 4,983 (sobran 3,73) |
| `%s tiene 9 colores #rrggbb distintos` (:73-78) | que la paleta tenga 9 colores distintos | 9 distintos | 1 distinto (las 9 posiciones efectivas son `#12121a`) |

- **No se compara contra el fondo del campo.** Se compara contra "el color del bloque bajo el número" que entrega la paleta (`PALETTES[id].colors[i]`). En Contorno puro ese color es, de hecho, el fondo `#12121a`, porque no hay relleno. Por eso mi medición usa el color efectivo, como pide `config_logros/CLAUDE.md`.
- **De dónde salen los umbrales.** Se calculan en el propio test con la Clásica: `CLASSIC_RED` = contraste de `#ff2a2a` con los 6 SAFE de la Clásica (mín. 1,156, máx. 1,730); `CLASSIC_HUE` = 42,5 a 173,1°. Las tolerancias son constantes locales: `HUE_RANGE_TOL = 5` (:35), `HARDEST_HUE_TOL = 8` (:37), `HUE_MEAN_TOL = 20` (:39), `HARDEST_RED_TOL = 0.1` (:41).
- **El blanco.** La regla 6 (`el texto blanco se lee igual o mejor`, :129-131) compara el blanco del número (`C.text` = `#ffffff`, `theme.ts:18`) contra los 9 colores y exige ≥ 2,161, el mínimo de la Clásica. Es solo una **cota inferior de legibilidad** del número: no existe ninguna regla "el blanco no debe destacar demasiado". Sobre el fondo oscuro el blanco da 18,6, así que pasa de sobra. Ninguna aserción compara el rojo con el blanco.
- **Por qué existen** (intención de diseño):
  - `docs/plan-jugabilidad.md:50`: "Ningún premio da ventaja… ninguna paleta puede hacer más visibles las trampas rojas".
  - `docs/reglas-y-balance.md:187`: "ninguna paleta delata más las trampas, y ninguna (por ejemplo, la de un premio) las esconde más".
  - `docs/historia-y-decisiones.md:180`: el tono se agregó porque con solo luminancia Diamante y Alto contraste quitaban el caso difícil y Dorado hacía todas las trampas difíciles.
  - `CLAUDE.md` de la raíz: "las trampas deben ser sutiles".
  - La trampa roja se distingue solo por el color del texto (`reglas-y-balance.md:67`).

## 2. Dónde se define hoy el rojo y el número

- Rojo de la trampa: `apps/client/src/theme.ts:16` (`trapNumber: '#ff2a2a'`). Se aplica en `Block.tsx:131-136` (estilo `trap`: color más una sombra de texto), activado con `red && !gone` en `Block.tsx:106`. También lo usa el texto del tutorial en `onboarding/Onboarding.tsx:345`. `GameScreen.tsx:827` pasa `red={b.red}`.
- Color del número: `theme.ts:18` (`text: '#ffffff'`), aplicado en el estilo `num` (`Block.tsx:127`) a **todos** los bloques.
- Relleno: `Block.tsx:93` (`backgroundColor: paletteColor(color, pal)`). `paletteColor` (`palettes.ts:94-99`) solo traduce por posición. La interfaz `Palette` (`palettes.ts:27-33`) tiene `id`, `colors` y `shine`. **No hay ningún mecanismo por paleta ni por fondo para el rojo o el número.**
- `REDDISH`/`SAFE` (`packages/engine/src/constants.ts:95-97`, `game.ts:327`) es del **motor** y actúa sobre el color del bloque. Si una trampa roja cae sobre un color rojizo (posiciones 0, 1 y 6), le cambia el color a uno de SAFE. No cambia el rojo del texto ni depende de la paleta o del fondo del campo.
- Lugar natural para un rojo o número propios de una paleta: el `Block` ya recibe `pal` (`Block.tsx:51`) y lee `getPalette(pal)` para `shine`. Un campo nuevo en `Palette` (por ejemplo `trapColor?`) aplicado en el estilo de `Block.tsx:106` sería el punto. Habría que tocar también el tutorial (`Onboarding.tsx:345`) si debe coincidir, y las demos de onboarding que usan `Block`. En el motor no hace falta nada, porque el motor no conoce colores de texto.

## 3. Experimento (en `config_logros/herramientas/prueba-paletas/`)

Se ejecutó la misma prueba copiada: `contorno-trampa.test.ts`, generado con `preparar-test-trampa.mjs` a partir del test real. El único cambio es que el rojo y el número pueden ser por paleta. Las referencias de la Clásica se calculan con `#ff2a2a` y `#ffffff` reales y ningún umbral se relajó. El control "Contorno 55 %" con `#ff2a2a` pasa 6/6 y el de la Clásica también, así que el montaje es sano. La coherencia con `reglas.ts` (valores y márgenes) se verificó candidato por candidato.

Se probaron 15 candidatos sobre el color efectivo `#12121a`.

Convenciones de la tabla: "cont" = contraste con el fondo; "ΔE" = CIE76 contra el fondo, contra el rojo `#ff4d6d` y contra el naranja `#ff8a1f` de Contorno, y contra el borde más cercano. Fallan siempre "9 distintos" (artefacto) y "tono difícil" (margen −60 a −70).

| Candidato (rojo / número) | cont | Reglas de contraste | ΔE fondo | ΔE rojo / naranja Contorno | Otras fallas |
|---|---|---|---|---|---|
| `#ff2a2a` / blanco (hoy) | 4,98 | fallan (−3,25 / −3,73) | 107 | 33,2 / 42,8 | |
| `#7a1f2a` / blanco | 1,83 | rango −0,09, difícil −0,57 | 49 | 43,5 / 67,5 | |
| `#8a2030` / blanco | 2,07 | −0,34 / −0,81 | 55 | 37,3 / 64,8 | |
| `#a02030` / blanco | 2,43 | −0,70 / −1,18 | 65 | 29,5 / 58,2 | |
| `#6e1a24` / blanco | 1,63 | rango pasa; difícil −0,37 | 45 | 47,6 / 70,1 | |
| `#5a1520` / blanco | 1,39 | rango pasa; difícil −0,13 | 37 | 55,5 / 77,0 | |
| **`#4d101a`** / blanco | **1,246** | **pasan** (difícil +0,010) | **32,7** | 60,3 / 80,5 | solo tono |
| **`#4a0f18`** / blanco | **1,218** | **pasan** (difícil +0,038) | 31,9 | 61,4 / 81,0 | solo tono |
| `#ff6b6b`, `#ff9a9a`, `#ffb3b3` (claros) / blanco | 6,7 – 11,0 | fallan (−5,0 a −9,7) | 80–87 | 14,8–47,0 / 44,8–60,4 | |
| `#4d101a` / gris `#d0d0d0` | 1,246 | pasan | 32,7 | 60,3 / 80,5 | solo tono |
| `#4d101a` / gris `#a0a0a0` | 1,246 | pasan | 32,7 | 60,3 / 80,5 | solo tono |
| `#8a2030` / gris `#d0d0d0` | 2,07 | fallan | 54,9 | 37,3 / 64,8 | |
| `#5a1520` / gris `#808080` | 1,39 | difícil −0,13 | 36,9 | 55,5 / 77,0 | |

Hechos:

1. **Rojos claros: imposibles.** La franja que cumple las dos reglas de contraste a la vez es 1,156–1,256, es decir luminancia relativa 0,0152–0,0208. Solo un rojo muy oscuro cabe. Con solo la regla de rango (≤ 1,73) el tope es luminancia 0,047. Un rojo claro da contraste ≥ 6,7.
2. **Familia del usuario (`#7a1f2a`–`#a02030`): no entra** en la franja, por 0,09 a 0,70 en el rango y 0,57 a 1,18 en la regla difícil.
3. **Tono, sin salida.** Con relleno 0 las 6 distancias de tono son iguales (d). La regla 2 pide d ≤ 50,47° (distancia mínima) y la regla 3 pide d en 119,46 ± 20°, o sea ≥ 99,46°. **Son incompatibles para cualquier color.** El barrido de todo el cubo RGB (paso 3, 636.056 colores) dio **0** colores que pasen las reglas de tono. Lo más cerca que un rojo puede estar del tono del fondo (240°) es 95° (tono 335°), 45° por encima del tope de la regla 2. Para cumplir la regla 2, el texto tendría que ser de tono entre 190° y 290° (cian, azul o violeta), no rojo. Un rojo distinto por posición tampoco lo resuelve: cada posición necesitaría un tono azulado.
4. **El blanco no interviene.** Ninguna aserción depende de que el número deje de ser blanco; probando gris claro (`#d0d0d0`), gris medio (`#a0a0a0`) y gris oscuro (`#808080`) los resultados son idénticos a los de blanco. Solo la regla 6 pone un piso (2,161): los tres grises dan 12,1 / 7,1 / 4,7 contra el fondo y pasan.
5. Las reglas de contraste sí se pueden satisfacer con `#4d101a` o `#4a0f18`, con margen de solo 0,010 y 0,038 en la regla difícil. Con `#4d101a`, la única aserción que sigue fallando (además de 9 distintos) es **tono difícil**, que no depende del rojo.

**¿Sigue siendo "rojo" y distinguible?** (medición, no prueba con personas):

- `#4d101a` es un vino muy oscuro (HSL 350°, 66 %, 18 %). Mi opinión, sin verificar con personas, es que sobre `#12121a` se leería como marrón rojizo y no como el rojo vivo de hoy.
- Distancia de color (CIE76) del rojo `#4d101a` a los 9 bordes de Contorno: 60,3 al rojo `#ff4d6d`, 80,5 al naranja `#ff8a1f` y mayores a los demás. No se confunde con ellos. Contra el fondo: 32,7 (hoy 106,7). Contra el número blanco: 89,8 (hoy 103,1).
- Simulación de protanopía (matriz de Machado, `simulacion-protan.mjs`): `#4d101a` contra el fondo da ΔE 10,8 (con `#ff2a2a` sobre el fondo, 57,0). De los tres casos de la Clásica que simulé (amarillo, verde y azul), el peor es el verde: 22,0. Es una simulación, no una medición con personas.

## 4. Consecuencias de diseño

**Hechos (medidos o leídos del código):**

- Con `#4d101a`, la trampa queda a ΔE 32,7 del fondo. El caso más difícil de la Clásica (rojo sobre amarillo) tiene ΔE 67,9, y los demás de la Clásica van de 110 a 135 (contra las otras paletas medidas: Cristal 78–112, Contorno 55 % 72–123). Por contraste de luminancia queda en el rango de la Clásica (1,16–1,25 es su zona difícil), pero por diferencia de color global es de lejos la combinación más apagada que probé.
- El texto de la trampa pasaría a contraste 1,25 contra el fondo, muy por debajo de 3:1 (el mínimo habitual de WCAG para texto grande). La Clásica también tiene ese contraste bajo en su caso difícil, pero compensa con la diferencia de tono contra el relleno. En Contorno puro esa compensación no existe.
- Todos los bloques de Contorno compartirían el mismo color de número. Hoy `C.text` es global (`Block.tsx:127`): cambiar el número solo en esa paleta significa que Contorno tendría un color de número distinto del de las otras 13, y habría que cambiarlo también en el tutorial.
- Cambiar el rojo en una sola paleta rompe la premisa de `palettes.test.ts`: hoy mide **un solo** `TRAP_RED` y un solo `WHITE` para todas. Habría que parametrizarlos por paleta (como hice en el test copiado) y decidir cómo se definen las referencias.
- Contorno no es "Alto contraste": son paletas distintas y exclusivas, así que un jugador con Contorno no tiene a la vez la paleta de daltónicos. Pero un rojo tan oscuro en Contorno es el peor caso para protanopía (simulación arriba).

**Opinión (mía):**

- La trampa en Contorno quedaría **más difícil de ver que en cualquier otra paleta**, no igual, aunque el número del contraste diga lo contrario. La regla de contraste de luminancia es una vara parcial; en las otras paletas la trampa se esconde por color de relleno cercano, y aquí se esconde por oscuridad. Eso contradice el espíritu de "ninguna paleta las esconde más".
- Un número rojo oscuro casi no se lee. Cambia el juego: no solo hace sutil la trampa, sino que vuelve ilegible el número de ese bloque. Como el jugador debe **no tocar** esos bloques, saber que es trampa pasaría de "número rojo" a "número que casi no veo". Es una decisión de balance del usuario (el CLAUDE.md dice que las trampas deben ser sutiles y que él las ajusta a mano), pero no es equivalente a lo que hace la Clásica.
- Cambiar el blanco del número en Contorno no resuelve nada de la prueba y le quita al jugador la lectura consistente (blanco = bloque normal) que tiene en todas las paletas. Gris más oscuro, además, hace menos legible todo el campo.
- Hacer pasar la prueba con Contorno puro obliga a tocar **las reglas** (eximir las reglas de tono para el estilo `outline`), no solo los colores. Eso es una decisión de reglas del usuario.
- Balance: no toca el motor ni las semillas (el motor no conoce el color del texto), pero sí cambia la dificultad percibida de las trampas solo para quien use Contorno, y es un premio de nivel 18. Es el tipo de cambio que el usuario querría probar a mano.

## 5. Comparación con la alternativa A (relleno 55 %) y recomendación

| | A: relleno 55 % | B: puro + rojo `#4d101a` |
|---|---|---|
| Aserciones del test real | **todas pasan** (control `ctl-contorno55`, 6/6) | fallan tono difícil y 9 distintos |
| Reglas / test a cambiar | ninguna | eximir tono, parametrizar rojo y número por paleta |
| Código del juego | campo `fill` en `Block.tsx` | campo de rojo y número por paleta en `Block.tsx` y en el tutorial |
| Trampa en esa paleta | igual de visible que en la Clásica (ΔE 72–123) | mucho más difícil (ΔE 32,7; protanopía 10,8) |
| "Solo borde" | casi: borde 3 px y relleno tenue | sí |
| Margen | ventana de opacidad estrecha: pasa en 0,53–0,55 y en 0,85; falla en 0,52 y 0,56 (la regla difícil y la del rango) | la regla difícil de contraste pasa por 0,010 |

**Recomendación:** A. Mantener el relleno tenue y el 55 % (cuidando que quede dentro de 0,53–0,55) es el único camino que cumple las reglas tal como están, sin tocar tutorial ni test. B obliga a excepciones de regla, cambia la legibilidad de la trampa para esos jugadores y deja el margen en milésimas. Si el usuario quiere de verdad el borde sin nada de relleno, la decisión que hay que tomar es de **reglas** (qué significa "no da ventaja" cuando no hay relleno), no de color; yo lo desaconsejaría.

## Limitaciones

- ΔE es CIE76 (más simple que CIEDE2000) y está pensado para comparar; no es una medida de legibilidad.
- "Reconocible como rojo" es una opinión; no se probó con personas ni en pantalla (la web de esta carpeta no se usó).
- La simulación de protanopía es una aproximación con la matriz de Machado.
- Solo se probó sobre el fondo Liso y con las funciones y umbrales actuales.
- Los 4 umbrales de tolerancia están duplicados en `reglas.ts` (son constantes locales del test real); el pasa/falla oficial viene de vitest sobre el test generado.

## Archivos y cómo reproducir

Desde `config_logros/herramientas/prueba-paletas/`:

```
node preparar-test-trampa.mjs
../../../apps/client/node_modules/.bin/vitest run --root . --config ./vitest.config.mts contorno-trampa.test.ts      # prueba real con rojo/número por paleta
../../../apps/client/node_modules/.bin/vitest run --root . --config ./vitest.config.mts contorno-puro.spec.ts        # barrido y medidas -> contorno-puro.json
node simulacion-protan.mjs                                                                                            # -> simulacion-protan.txt
```

`candidatos-contorno.json` (candidatos), `candidatas-trampa.ts`, `preparar-test-trampa.mjs`, `contorno-puro.spec.ts`, `simulacion-protan.mjs`; salidas `vitest-trampa.json`, `contorno-puro.json`, `simulacion-protan.txt`. `reglas.ts` ahora acepta rojo y número como parámetros opcionales (las corridas anteriores no cambian).
