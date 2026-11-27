# Fondos nuevos y paletas (CAMBIO-022 y 026)

Generado por `correr.sh` (`bash config_logros/herramientas/prueba-fondos/correr.sh`; no toca el juego ni `prueba-paletas`, solo importa su `reglas.ts`).

## 1. Reglas de no ventaja (trampa roja #ff2a2a y texto blanco)

Se miden contra el color del bloque. Cristal, Contorno y Esmerilado se dibujan sobre un respaldo opaco `#12121a`, así que **ningún color de bloque depende del fondo**: el resultado vale para los 20 fondos. Margen = lo que sobra (negativo = lo que falta).

| paleta | tono rango | tono difícil | tono media | rojo rango | rojo difícil | blanco | 9 distintos |
|---|---|---|---|---|---|---|---|
| clasica | pasa +5,000 | pasa +8,000 | pasa +20,0 | pasa +0,000 | pasa +0,100 | pasa +0,000 | pasa |
| contraste | pasa +2,324 | pasa +10,7 | pasa +14,1 | pasa +0,031 | pasa +0,069 | pasa +0,171 | pasa |
| pastel | pasa +0,107 | pasa +10,2 | pasa +19,9 | pasa +0,045 | pasa +0,055 | pasa +0,425 | pasa |
| neon | pasa +0,918 | pasa +4,014 | pasa +19,7 | pasa +0,030 | pasa +0,026 | pasa +0,038 | pasa |
| tenue | pasa +4,796 | pasa +7,609 | pasa +19,9 | pasa +0,045 | pasa +0,055 | pasa +0,901 | pasa |
| cristal | pasa +4,268 | pasa +7,726 | pasa +16,2 | pasa +0,030 | pasa +0,070 | pasa +2,276 | pasa |
| retro | pasa +5,955 | pasa +7,045 | pasa +6,287 | pasa +0,039 | pasa +0,052 | pasa +0,462 | pasa |
| boton | pasa +7,729 | pasa +5,271 | pasa +15,3 | pasa +0,046 | pasa +0,034 | pasa +0,059 | pasa |
| contorno | pasa +2,939 | pasa +4,583 | pasa +18,4 | pasa +0,023 | pasa +0,077 | pasa +2,248 | pasa |
| degrade | pasa +7,452 | pasa +5,548 | pasa +12,8 | pasa +0,082 | pasa +0,018 | pasa +0,263 | pasa |
| dorado | pasa +6,026 | pasa +6,974 | pasa +5,026 | pasa +0,051 | pasa +0,049 | pasa +0,215 | pasa |
| esmerilado | pasa +5,391 | pasa +7,609 | pasa +15,0 | pasa +0,043 | pasa +0,057 | pasa +0,356 | pasa |
| diamante | pasa +2,534 | pasa +10,5 | pasa +19,5 | pasa +0,019 | pasa +0,061 | pasa +0,669 | pasa |
| constancia | pasa +1,127 | pasa +5,120 | pasa +19,8 | pasa +0,048 | pasa +0,052 | pasa +0,107 | pasa |

**14 de 14 paletas pasan todas las reglas.**

## 2. Los bloques contra cada fondo

Esto **no es una regla del juego**: es una medida propia para comprobar que los bloques se recortan. Para cada fondo se compara cada una de las 14 × 9 casillas (color de relleno, sin contar bordes ni sombra) con lo dibujado (336 ventanas de 14 × 14 px de una captura del campo sin bloques, `muestras.json`; las animaciones quedan en un cuadro) y se anota el caso más justo. ΔE = diferencia de color CIEDE2000 (0 = iguales; sobre unas 10 se ven claramente distintos). Contraste = WCAG (1 = misma claridad).

| fondo | ΔE mínimo | casilla y color de fondo | contraste mínimo | casilla y color de fondo | ventanas con ΔE < 10 | ventanas rojas |
|---|---|---|---|---|---|---|
| liso | 29,0 | cristal pos 5 #5d5d8d sobre #12121a | 2,49 | contorno pos 0 #943248 sobre #12121a | 0 / 336 | 0 / 336 |
| grilla | 28,5 | cristal pos 5 #5d5d8d sobre #14141c | 2,45 | contorno pos 0 #943248 sobre #14141c | 0 / 336 | 0 / 336 |
| estrellas | 27,7 | cristal pos 5 #5d5d8d sobre #17171f | 2,38 | contorno pos 0 #943248 sobre #17171f | 0 / 336 | 0 / 336 |
| aurora | 18,9 | cristal pos 5 #5d5d8d sobre #212b45 | 1,74 | contorno pos 0 #943248 sobre #1d3536 | 0 / 336 | 0 / 336 |
| puntos | 19,2 | cristal pos 8 #6d578d sobre #282152 | 1,96 | contorno pos 0 #943248 sobre #282152 | 0 / 336 | 0 / 336 |
| rayas | 17,7 | retro pos 5 #6c4fa8 sobre #2f2060 | 1,88 | contorno pos 0 #943248 sobre #2f2060 | 0 / 336 | 0 / 336 |
| hexagonos | 11,5 | diamante pos 4 #1658ca sobre #1b427d | 1,32 | contorno pos 0 #943248 sobre #1b427d | 0 / 336 | 0 / 336 |
| circuito | 17,5 | cristal pos 7 #417b75 sobre #0d4c3b | 1,33 | contorno pos 0 #943248 sobre #0d4c3b | 0 / 336 | 0 / 336 |
| atardecer | 5,1 | contorno pos 1 #94541d sobre #855825 | 1,00 | cristal pos 5 #5d5d8d sobre #855825 | 2 / 336 | 0 / 336 |
| oceano | 9,2 | contorno pos 4 #286998 sobre #174f75 | 1,16 | contorno pos 0 #943248 sobre #174f75 | 1 / 336 | 0 / 336 |
| bosque | 6,7 | cristal pos 4 #4c6f8d sobre #486474 | 1,01 | retro pos 5 #6c4fa8 sobre #486474 | 1 / 336 | 0 / 336 |
| lluvia | 11,8 | cristal pos 5 #5d5d8d sobre #304669 | 1,27 | contorno pos 0 #943248 sobre #304669 | 0 / 336 | 0 / 336 |
| nieve | 5,4 | cristal pos 4 #4c6f8d sobre #43648f | 1,00 | constancia pos 8 #5a4fd0 sobre #43648f | 9 / 336 | 0 / 336 |
| nebulosa | 13,5 | retro pos 5 #6c4fa8 sobre #442381 | 1,56 | contorno pos 0 #943248 sobre #442381 | 0 / 336 | 0 / 336 |
| luciernagas | 15,3 | contorno pos 3 #168759 sobre #3b602e | 1,02 | contorno pos 6 #942b6f sobre #3b602e | 0 / 336 | 0 / 336 |
| topografia | 23,1 | cristal pos 2 #897440 sobre #3c3a1b | 1,54 | contorno pos 0 #943248 sobre #3b3b1a | 0 / 336 | 0 / 336 |
| ciudad | 13,9 | retro pos 5 #6c4fa8 sobre #392b74 | 1,59 | contorno pos 0 #943248 sobre #392b74 | 0 / 336 | 0 / 336 |
| cristales | 11,3 | retro pos 5 #6c4fa8 sobre #3e3483 | 1,01 | contorno pos 0 #943248 sobre #165c6d | 0 / 336 | 0 / 336 |
| vitral | 12,0 | cristal pos 5 #5d5d8d sobre #2c446e | 1,30 | contorno pos 0 #943248 sobre #2c446e | 0 / 336 | 0 / 336 |
| galaxia | 3,0 | contorno pos 5 #655d98 sobre #635599 | 1,00 | diamante pos 4 #1658ca sobre #635599 | 11 / 336 | 0 / 336 |

"Ventanas con ΔE < 10" = trozos del fondo donde al menos una de las 126 casillas queda por debajo de 10. "Ventana roja" = tono a 15° o menos del rojo puro, saturación ≥ 0,35 y luminosidad ≥ 0,12.

## 3. El rojo de las trampas contra cada fondo

El número rojo siempre va **sobre el bloque**, nunca sobre el fondo; esto solo comprueba que ningún fondo sea parecido a ese rojo.

| fondo | ΔE mínimo con #ff2a2a | color de fondo | contraste mínimo | color de fondo |
|---|---|---|---|---|
| liso | 50,2 | #12121a | 4,98 | #12121a |
| grilla | 49,9 | #14141c | 4,90 | #14141c |
| estrellas | 49,3 | #17171f | 4,76 | #17171f |
| aurora | 48,0 | #212533 | 3,48 | #1d3536 |
| puntos | 49,8 | #282152 | 3,93 | #282152 |
| rayas | 49,7 | #2f2060 | 3,75 | #2f2060 |
| hexagonos | 49,9 | #1b427d | 2,65 | #1b427d |
| circuito | 54,9 | #031d20 | 2,66 | #0d4c3b |
| atardecer | 28,8 | #855825 | 1,64 | #855825 |
| oceano | 51,5 | #174f75 | 2,33 | #174f75 |
| bosque | 46,3 | #486474 | 1,68 | #486474 |
| lluvia | 47,3 | #304669 | 2,55 | #304669 |
| nieve | 45,8 | #43648f | 1,62 | #43648f |
| nebulosa | 48,4 | #442381 | 3,11 | #442381 |
| luciernagas | 53,1 | #102c2e | 1,94 | #3b602e |
| topografia | 46,7 | #3c3a1b | 3,08 | #3b3b1a |
| ciudad | 48,4 | #392b74 | 3,17 | #392b74 |
| cristales | 47,7 | #3e3483 | 2,02 | #165c6d |
| vitral | 40,5 | #504220 | 2,60 | #2c446e |
| galaxia | 41,7 | #635599 | 1,71 | #635599 |

## 4. Regla REDDISH

`REDDISH` (#e5484d, #f76b15, #d6409f) es una lista de **colores de bloque** del motor: si al bloque le toca uno de ellos, una trampa roja usa la paleta `SAFE`. El motor no conoce el fondo del campo, así que ningún fondo la activa ni la desactiva.

## Cómo repetir el muestreo

Las secciones 2 y 3 usan `muestras.json`. Si cambia el dibujo de un fondo: captura a escala 1 los campos que cambiaron, sin bloques ni rótulos (unos 230 × 560 px cada uno), anota sus celdas (`[{ "id", "x", "y", "w", "h" }]`), corre `node muestrear.mjs <captura.png> <celdas.json>` y luego `correr.sh`.

Control de la fórmula ΔE: negro–blanco 100,0, color consigo mismo 0,0, rojo–verde puros 86,6.
