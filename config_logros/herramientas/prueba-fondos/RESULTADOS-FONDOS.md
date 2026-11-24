# Paletas sobre los fondos nuevos (CAMBIO-022)

Generado por `correr.sh` (`bash config_logros/herramientas/prueba-fondos/correr.sh`; no toca el juego ni `prueba-paletas`, solo importa su `reglas.ts`). Margen = lo que sobra (negativo = lo que falta). Para cada fondo se toma el peor caso entre sus colores de prueba (`prueba` de `FONDOS` en `coleccion.js`: el color principal y los extremos del degradé).

Otras piezas: `barrido.spec.ts` (qué fondos dejan pasar a las tres translúcidas, escribe `barrido.json`), `ajustar.spec.ts` + `deseados.json` (cuánto oscurecer un color para que pase, escribe `ajustes.json`) y, para el muestreo del final, `muestrear.mjs` (lee una captura PNG de los campos sin bloques y un JSON con sus celdas) + `muestras.spec.ts`.

## Opacas (control: no dependen del fondo)

Las 11 paletas opacas (clasica, contraste, pastel, neon, tenue, retro, boton, degrade, dorado, diamante, constancia) pasan todas las reglas. Su color es el mismo sobre cualquier fondo.

## Translúcidas sobre cada fondo

| fondo | colores de prueba | paleta | tono rango | tono difícil | tono media | rojo rango | rojo difícil | blanco | 9 distintos |
|---|---|---|---|---|---|---|---|---|---|
| liso | #12121a | cristal | pasa +4,268 | pasa +7,726 | pasa +16,2 | pasa +0,030 | pasa +0,070 | pasa +2,276 | pasa  |
| liso | #12121a | contorno | pasa +2,939 | pasa +4,583 | pasa +18,4 | pasa +0,023 | pasa +0,077 | pasa +2,248 | pasa  |
| liso | #12121a | esmerilado | pasa +5,391 | pasa +7,609 | pasa +15,0 | pasa +0,043 | pasa +0,057 | pasa +0,356 | pasa  |
| puntos | #12121a | cristal | pasa +4,268 | pasa +7,726 | pasa +16,2 | pasa +0,030 | pasa +0,070 | pasa +2,276 | pasa  |
| puntos | #12121a | contorno | pasa +2,939 | pasa +4,583 | pasa +18,4 | pasa +0,023 | pasa +0,077 | pasa +2,248 | pasa  |
| puntos | #12121a | esmerilado | pasa +5,391 | pasa +7,609 | pasa +15,0 | pasa +0,043 | pasa +0,057 | pasa +0,356 | pasa  |
| rayas | #0f0f16 | cristal | pasa +4,268 | pasa +6,904 | pasa +16,5 | pasa +0,027 | pasa +0,052 | pasa +2,343 | pasa  |
| rayas | #0f0f16 | contorno | pasa +3,427 | pasa +4,480 | pasa +18,3 | pasa +0,039 | pasa +0,061 | pasa +2,310 | pasa  |
| rayas | #0f0f16 | esmerilado | pasa +7,534 | pasa +5,466 | pasa +15,2 | pasa +0,031 | pasa +0,069 | pasa +0,386 | pasa  |
| hexagonos | #0b101a | cristal | pasa +2,979 | pasa +6,118 | pasa +14,2 | pasa +0,037 | pasa +0,049 | pasa +2,351 | pasa  |
| hexagonos | #0b101a | contorno | pasa +2,381 | pasa +4,000 | pasa +17,2 | pasa +0,049 | pasa +0,051 | pasa +2,344 | pasa  |
| hexagonos | #0b101a | esmerilado | pasa +6,169 | pasa +6,021 | pasa +13,8 | pasa +0,026 | pasa +0,074 | pasa +0,389 | pasa  |
| circuito | #091314 | cristal | pasa +6,633 | pasa +3,142 | pasa +14,1 | pasa +0,029 | pasa +0,071 | pasa +2,271 | pasa  |
| circuito | #091314 | contorno | pasa +4,624 | pasa +2,910 | pasa +17,0 | pasa +0,042 | pasa +0,058 | pasa +2,319 | pasa  |
| circuito | #091314 | esmerilado | pasa +7,292 | pasa +3,323 | pasa +12,6 | pasa +0,033 | pasa +0,067 | pasa +0,375 | pasa  |
| atardecer | #0e0f1e #0c0f1d #14101a #161018 | cristal | pasa +0,095 | pasa +7,230 | pasa +14,2 | pasa +0,030 | pasa +0,052 | pasa +2,312 | pasa  |
| atardecer | #0e0f1e #0c0f1d #14101a #161018 | contorno | pasa +1,901 | pasa +4,451 | pasa +17,2 | pasa +0,025 | pasa +0,056 | pasa +2,256 | pasa  |
| atardecer | #0e0f1e #0c0f1d #14101a #161018 | esmerilado | pasa +3,914 | pasa +6,620 | pasa +14,5 | pasa +0,031 | pasa +0,064 | pasa +0,374 | pasa  |
| oceano | #07111c #08111e #06141c | cristal | pasa +0,964 | pasa +3,193 | pasa +11,8 | pasa +0,027 | pasa +0,060 | pasa +2,271 | pasa  |
| oceano | #07111c #08111e #06141c | contorno | pasa +2,280 | pasa +2,466 | pasa +15,4 | pasa +0,034 | pasa +0,042 | pasa +2,290 | pasa  |
| oceano | #07111c #08111e #06141c | esmerilado | pasa +5,754 | pasa +0,466 | pasa +11,6 | pasa +0,024 | pasa +0,065 | pasa +0,373 | pasa  |
| bosque | #071315 #09121c #07140d | cristal | pasa +2,823 | pasa +1,973 | pasa +12,9 | pasa +0,030 | pasa +0,062 | pasa +2,276 | pasa  |
| bosque | #071315 #09121c #07140d | contorno | pasa +2,313 | pasa +1,853 | pasa +16,3 | pasa +0,035 | pasa +0,054 | pasa +2,293 | pasa  |
| bosque | #071315 #09121c #07140d | esmerilado | pasa +5,120 | pasa +0,811 | pasa +11,8 | pasa +0,029 | pasa +0,062 | pasa +0,368 | pasa  |
| lluvia | #0c121a #0b1119 #0d131c | cristal | pasa +2,979 | pasa +5,248 | pasa +14,2 | pasa +0,021 | pasa +0,063 | pasa +2,239 | pasa  |
| lluvia | #0c121a #0b1119 #0d131c | contorno | pasa +2,823 | pasa +3,899 | pasa +17,0 | pasa +0,032 | pasa +0,051 | pasa +2,282 | pasa  |
| lluvia | #0c121a #0b1119 #0d131c | esmerilado | pasa +6,380 | pasa +6,021 | pasa +13,8 | pasa +0,026 | pasa +0,059 | pasa +0,363 | pasa  |
| nieve | #0b121b #0a111a #0c131c | cristal | pasa +2,900 | pasa +5,248 | pasa +13,5 | pasa +0,023 | pasa +0,061 | pasa +2,247 | pasa  |
| nieve | #0b121b #0a111a #0c131c | contorno | pasa +2,786 | pasa +3,548 | pasa +16,9 | pasa +0,032 | pasa +0,051 | pasa +2,282 | pasa  |
| nieve | #0b121b #0a111a #0c131c | esmerilado | pasa +6,380 | pasa +6,021 | pasa +13,5 | pasa +0,026 | pasa +0,059 | pasa +0,363 | pasa  |
| nebulosa | #0f0f1c #140e1c #0d0e1b #0f0c1c | cristal | pasa +0,166 | pasa +7,609 | pasa +14,8 | pasa +0,020 | pasa +0,028 | pasa +2,330 | pasa  |
| nebulosa | #0f0f1c #140e1c #0d0e1b #0f0c1c | contorno | pasa +1,504 | pasa +4,794 | pasa +17,7 | pasa +0,039 | pasa +0,037 | pasa +2,308 | pasa  |
| nebulosa | #0f0f1c #140e1c #0d0e1b #0f0c1c | esmerilado | pasa +3,249 | pasa +6,021 | pasa +14,8 | pasa +0,030 | pasa +0,062 | pasa +0,381 | pasa  |
| luciernagas | #09150f #091310 | cristal | pasa +8,537 | pasa +1,973 | pasa +14,2 | pasa +0,018 | pasa +0,069 | pasa +2,230 | pasa  |
| luciernagas | #09150f #091310 | contorno | pasa +5,561 | pasa +2,291 | pasa +17,0 | pasa +0,030 | pasa +0,058 | pasa +2,276 | pasa  |
| luciernagas | #09150f #091310 | esmerilado | pasa +5,120 | pasa +0,811 | pasa +11,8 | pasa +0,032 | pasa +0,058 | pasa +0,355 | pasa  |

**36 de 36 combinaciones pasan todas las reglas.**

## Margen más justo de cada regla por paleta (entre todos los fondos)

| paleta | regla | margen | fondo |
|---|---|---|---|
| cristal | contraste rojo en rango Clásica | +0,018 | luciernagas (#09150f) |
| cristal | caso más difícil de contraste | +0,028 | nebulosa (#0f0c1c) |
| cristal | caso más difícil de tono | +1,973 | bosque (#07140d) |
| cristal | texto blanco ≥ Clásica | +2,230 | luciernagas (#09150f) |
| contorno | contraste rojo en rango Clásica | +0,023 | liso (#12121a) |
| contorno | caso más difícil de contraste | +0,037 | nebulosa (#0f0c1c) |
| contorno | caso más difícil de tono | +1,853 | bosque (#07140d) |
| contorno | texto blanco ≥ Clásica | +2,248 | liso (#12121a) |
| esmerilado | contraste rojo en rango Clásica | +0,024 | oceano (#07111c) |
| esmerilado | caso más difícil de contraste | +0,057 | liso (#12121a) |
| esmerilado | caso más difícil de tono | +0,466 | oceano (#06141c) |
| esmerilado | texto blanco ≥ Clásica | +0,355 | luciernagas (#09150f) |

## Colores realmente dibujados (muestreo de una captura)

Se toman 80 ventanas de 30 × 30 px por fondo (patrones, brillos y un cuadro de la animación incluidos) y se mide Cristal / Contorno / Esmerilado sobre el promedio de cada ventana. Cada celda es `ventanas que fallan / 80`.

| fondo | cristal | contorno | esmerilado |
|---|---|---|---|
| puntos | 0 / 80 | 0 / 80 | 0 / 80 |
| rayas | 0 / 80 | 0 / 80 | 0 / 80 |
| hexagonos | 0 / 80 | 0 / 80 | 0 / 80 |
| circuito | 0 / 80 | 0 / 80 | 0 / 80 |
| atardecer | 0 / 80 | 0 / 80 | 0 / 80 |
| oceano | 0 / 80 | 0 / 80 | 0 / 80 |
| bosque | 2 / 80 | 2 / 80 | 1 / 80 |
| lluvia | 0 / 80 | 0 / 80 | 0 / 80 |
| nieve | 0 / 80 | 0 / 80 | 0 / 80 |
| nebulosa | 4 / 80 | 0 / 80 | 0 / 80 |
| luciernagas | 3 / 80 | 4 / 80 | 0 / 80 |
