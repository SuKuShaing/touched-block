# Prueba real de las 6 paletas nuevas (regla de no ventaja)

Fecha: 2026-11-24. Se ejecutó `apps/client/src/cosmetics/palettes.test.ts` del juego, sin tocar el juego, sobre las 8 paletas de hoy más las 6 propuestas. Los hex salen de `config_logros/coleccion.js` (sha1 `9f80849139f0d499aea774709c921a732bd5460d` al momento de la prueba), leídos por script, no copiados a mano.

- Node v24.22.0 · vitest 5.1.0 (el del cliente) · Windows 11.

## Cómo reproducir

Desde cualquier carpeta (regenera todo y deja `resumen-base.md` y `resumen-efectivo.md`):

```
bash config_logros/herramientas/prueba-paletas/correr.sh
```

Pasos sueltos (desde `config_logros/herramientas/prueba-paletas/`):

```
node generar-candidatas.mjs          # lee coleccion.js -> candidatas.json (corrida a y b)
node preparar-test.mjs               # copia el palettes.test.ts REAL con solo 2 cambios -> palettes.candidatas.test.ts
TB_VARIANTE=base     ../../../apps/client/node_modules/.bin/vitest run --root . --config ./vitest.config.mts palettes.candidatas.test.ts
TB_VARIANTE=efectivo ../../../apps/client/node_modules/.bin/vitest run --root . --config ./vitest.config.mts palettes.candidatas.test.ts
../../../apps/client/node_modules/.bin/vitest run --root . --config ./vitest.config.mts medir.spec.ts ajustes.spec.ts   # valores, márgenes, ajustes (usar TB_VARIANTE=base|efectivo en medir.spec.ts)
```

Qué hace cada pieza:

- `preparar-test.mjs`: lee el test real y cambia solo el import (apunta a `@/cosmetics/palettes`, el archivo real) y de dónde salen `PALETTES`/`PALETTE_IDS` (`candidatas.ts`: las 8 reales + las candidatas). Ninguna aserción ni umbral se toca. Falla con un error si el import del test real cambia.
- `vitest.config.mts`: mismos alias que `apps/client/vitest.config.mts`, más un alias para que `vitest` se resuelva desde esta carpeta. Las funciones (`hue`, `hueDistance`, `luminance`, `contrastRatio`), el motor (`COLORS`, `SAFE`) y `C.trapNumber` son los del juego.
- `reglas.ts` + `medir.spec.ts`: repiten cada regla con las funciones reales y dan valor, umbral y margen. `resumen.mjs` comprueba que cada pasa/falla de `reglas.ts` coincide con la aserción oficial de vitest: 0 discrepancias en las dos corridas.
- `ajustes.spec.ts`: busca el ajuste mínimo de cada falla con esas mismas reglas.

## Línea base

Comando exacto:

```
pnpm --filter @tb/client exec vitest run src/cosmetics/palettes.test.ts
```

Resultado: 1 archivo, **64 tests pasan, 0 fallan** (vitest v5.1.0). En las corridas con las candidatas, las 8 paletas de hoy siguen pasando todas sus aserciones.

## Qué corrida pesa más (a o b)

- **(a) hex crudos:** los 9 `colores` tal cual. Es lo que vería el test del juego tal como está si el catálogo guardara solo los hex.
- **(b) color efectivo:** el color que queda bajo el número, según cambios.md. Cristal: color al 50 % sobre `#12121a`. Esmerilado: capa `mezcla(#dde8ff, tinte, 35 %)` al 70 % sobre el fondo, más el brillo central de 0,117. Contorno: relleno 0 (como se dibuja hoy en la web) y la variante al 55 %. Degradé: base y los dos extremos (+3,5 % blanco / negro). Tenue: el relleno (el borde de la Clásica no queda bajo el número). Botón: el color base (las sombras interiores quedan fuera del número). Las fórmulas se verificaron contra los efectivos que lista cambios.md: Cristal, Contorno 55 % y Esmerilado coinciden en los 9 hex.

**Pesa (b).** Hoy `Block.tsx` solo pinta `backgroundColor = paletteColor(color, pal)` y `palettes.ts` no tiene campo de estilo: ninguna de las 6 existe en el juego, así que (a) es hipotético. Cuando existan los estilos, el texto rojo (`#ff2a2a`) y el blanco quedarán sobre el color efectivo, y la regla de no ventaja existe para medir eso. cambios.md (CAMBIO-017) ya dice que el test debe medir el efectivo. Por lo tanto: si se implementa tal cual, el `palettes.test.ts` del juego hay que adaptarlo (medir el efectivo cuando el estilo no es sólido); con el test sin adaptar, Cristal, Contorno y Esmerilado fallarían por el hex y no por un problema real.

## Resultados corrida (b) (la relevante): 123 pasan, 4 fallan de 127

Cada celda es pasa/falla (margen = lo que sobra; negativo = lo que falta). Umbrales (Clásica): tono SAFE 37,47–178,06°; caso difícil de tono ≤ 50,47°; media 119,46 ± 20°; contraste del rojo 1,156–1,730; caso difícil ≤ 1,256; blanco ≥ 2,161.

| paleta (efectiva) | tono en rango | tono difícil | media tono | rojo en rango | rojo difícil | blanco | 9 distintos |
|---|---|---|---|---|---|---|---|
| cristal (50 %) | pasa +4,268 | pasa +7,726 | pasa +16,19 | pasa **+0,030** | pasa +0,070 | pasa +2,276 | pasa |
| contorno (relleno 0) | pasa | **FALLA −69,53** | pasa | **FALLA −3,253** | **FALLA −3,727** | pasa | **FALLA (1 de 9)** |
| contorno (relleno 55 %) | pasa +2,939 | pasa +4,583 | pasa +18,45 | pasa +0,023 | pasa +0,077 | pasa +2,248 | pasa |
| degradé base | pasa +7,452 | pasa +5,548 | pasa +12,78 | pasa +0,082 | pasa +0,018 | pasa +0,263 | pasa |
| degradé arriba | pasa +7,280 | pasa +5,720 | pasa +12,71 | pasa **+0,011** | pasa +0,089 | pasa +0,188 | pasa |
| degradé abajo | pasa +7,280 | pasa +5,720 | pasa +12,86 | pasa +0,026 | pasa +0,074 | pasa +0,444 | pasa |
| tenue | pasa +4,796 | pasa +7,609 | pasa +19,89 | pasa +0,045 | pasa +0,055 | pasa +0,901 | pasa |
| botón | pasa +7,729 | pasa +5,271 | pasa +15,28 | pasa +0,046 | pasa +0,034 | pasa +0,059 | pasa |
| esmerilado | pasa +5,391 | pasa +7,609 | pasa +15,38 | pasa +0,043 | pasa +0,057 | pasa +0,347 | pasa |

"Cada paleta se ve distinta de las demás": pasa. Los márgenes de los dos extremos del degradé y del 55 % de Contorno coinciden con cambios.md.

Fallas de (b): solo **Contorno con relleno 0**, que es el caso que cambios.md ya describe: bajo el número queda el fondo `#12121a` en las 9 posiciones.

- Posición 2 (`#12121a` efectivo; hex `#ffc400`): contraste del rojo 4,983 vs rango 1,156–1,730 (sobra 3,253) y vs el tope del caso difícil 1,256 (sobra 3,727). Distancia de tono al rojo 120,0° vs mínimo del caso difícil ≤ 50,47° (faltan 69,5°).
- Los 9 colores efectivos son iguales (1 distinto de 9).
- Ajuste: no se mueve ningún color; lo que cambia es la opacidad del relleno. Con los 9 hex `colores` tal cual y relleno de 0,53 a 0,55, las seis reglas y la de los 9 distintos pasan (también 0,85, que es casi un relleno sólido). Con 0,52 falla "caso más difícil de contraste"; con 0,56 falla "contraste rojo en rango"; con 0,50 y 0,60 falla el rango. **El 55 % recomendado en cambios.md está en el borde de una ventana de solo 0,03.** No se aplicó a nada; es la decisión 1 de CAMBIO-017.

Margenes más justos de todas las paletas en (b): degradé arriba +0,011 (azul `#2b78db`, pos 4), Contorno 55 % +0,023, degradé abajo +0,026, Cristal +0,030, botón +0,034 (caso difícil), esmerilado +0,043.

## Resultados corrida (a), hex crudos: 97 pasan, 9 fallan de 106

| paleta (hex) | falla | medido vs umbral (margen) · dónde |
|---|---|---|
| cristal | rojo en rango | 2,760 vs 1,156–1,730 (−1,030) · pos 3 `#94f0c2` |
| cristal | rojo difícil | mínimo 1,702 vs ≤ 1,256 (−0,446) · pos 8 `#c79bff` |
| cristal | blanco | 1,355 vs ≥ 2,161 (−0,806) · pos 3 `#94f0c2` |
| contorno | rojo en rango | 2,341 vs 1,156–1,730 (−0,611) · pos 2 `#ffc400` |
| contorno | rojo difícil | mínimo 1,521 vs ≤ 1,256 (−0,265) · pos 8 `#d484ff` |
| contorno | blanco | 1,597 vs ≥ 2,161 (−0,564) · pos 2 `#ffc400` |
| esmerilado | tono en rango | 178,246° vs ≤ 178,06° (−0,184) · pos 7 `#1cc7c2` |
| esmerilado | rojo en rango | 1,780 vs ≤ 1,730 (−0,050) · pos 7 `#1cc7c2` |
| esmerilado | blanco | 2,100 vs ≥ 2,161 (−0,060) · pos 7 `#1cc7c2` |

Degradé, Tenue y Botón pasan las 7 reglas también con el hex crudo (márgenes en la tabla de arriba, que en estos tres es la misma porque el color bajo el número es el base).

Ajustes mínimos en (a):

- **Esmerilado:** un solo color. Pos 7 `#1cc7c2` pasa a **`#19c4be`** (ΔE 1,2): con él pasan todas las reglas en crudo, y también las del color efectivo (el efectivo de la pos 7 pasa de `#82aab6` a `#81aab4`). Solo hace falta si la prueba se queda en hex crudo; en (b) Esmerilado ya pasa sin cambio.
- **Cristal y Contorno:** no hay un ajuste mínimo. Los hex son tintes claros pensados para mezclarse con el fondo, y con el hex crudo violan las reglas de contraste en varias posiciones SAFE a la vez (luminancia fuera de la franja que admite la prueba). Para que pasen en crudo habría que reemplazar los hex por los efectivos (los colores apagados), es decir, no se vería la paleta propuesta. La salida es medir el efectivo (corrida b).

## Informativo (no es regla del juego)

ΔE mínimo (CIELAB) entre los 9 colores: crudos 24,4 (contorno), 25,4 (esmerilado), 19,7 (botón), 17,0 (degradé), 15,3 (cristal), 6,7 (tenue). Efectivos: Esmerilado 8,2 (coincide con cambios.md), Cristal 8,4, Contorno 55 % 14,5, Tenue 6,7 (entre sus rellenos; el borde de la Clásica los separa, ver cambios.md). La Clásica da 11,7 según cambios.md; el juego no prueba esto.

## Limitaciones

- Los 4 umbrales de tolerancia (`HUE_RANGE_TOL`=5, `HARDEST_HUE_TOL`=8, `HUE_MEAN_TOL`=20, `HARDEST_RED_TOL`=0,1) están duplicados en `reglas.ts` porque en el test real son constantes locales sin exportar. El pasa/falla oficial sale de vitest sobre el test real, y se comprobó que ambos coinciden en las dos corridas (0 discrepancias); `reglas.ts` solo aporta valores y márgenes.
- La corrida (b) toma el color efectivo de la fórmula de cambios.md, no de una pantalla: Esmerilado usa el brillo central 0,117 (aproximación del degradé diagonal), sin blur ni grano; Cristal ignora el degradado blanco superior (vale ~0 al centro).
- Solo sobre el fondo **Liso** (`#12121a`). Las paletas translúcidas (Cristal, Contorno con relleno, Esmerilado) heredan el fondo; Grilla, Aurora y Estrellas no se probaron (cambios.md los estima aparte, sin medir en el juego).
- Se mide solo el color bajo el número. No se probó la legibilidad real del texto rojo con sombra ni la distinción de posiciones 0, 1 y 6 (nunca llevan trampa roja), ni la regla del motor `REDDISH`/`SAFE`, que depende de la posición y no del color pintado.
- Las 14 paletas se evalúan con los mismos umbrales de la Clásica; no se probó el estilo en el componente `Block.tsx`, que todavía no lo soporta.
- Si `coleccion.js` cambia, hay que volver a correr `correr.sh`.

## Archivos

`correr.sh`, `generar-candidatas.mjs`, `preparar-test.mjs`, `candidatas.ts`, `vitest.config.mts`, `reglas.ts`, `medir.spec.ts`, `ajustes.spec.ts`, `resumen.mjs`; salidas: `candidatas.json`, `palettes.candidatas.test.ts` (generado), `vitest-base.json`, `vitest-efectivo.json`, `medidas-*.json`, `ajustes.json`, `resumen-*.md`.
