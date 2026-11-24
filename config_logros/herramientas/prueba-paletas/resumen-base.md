### Corrida base

Aserciones oficiales: 97 pasan, 9 fallan, de 106.

"cada paleta se ve distinta de las demás": passed

| paleta | 9 colores #rrggbb distintos | tono SAFE en rango Clásica ±5° | caso más difícil de tono | media de tono | contraste rojo en rango Clásica | caso más difícil de contraste | texto blanco ≥ Clásica | ΔE mín (informativo) |
|---|---|---|---|---|---|---|---|---|
| cristal | pasa (0.000) | pasa (6.456) | pasa (6.544) | pasa (17.557) | **FALLA** (-1.030) | **FALLA** (-0.446) | **FALLA** (-0.806) | 15.3 (5-8) |
| contorno | pasa (0.000) | pasa (5.026) | pasa (4.348) | pasa (19.142) | **FALLA** (-0.611) | **FALLA** (-0.265) | **FALLA** (-0.564) | 24.4 (5-8) |
| degrade | pasa (0.000) | pasa (7.452) | pasa (5.548) | pasa (12.782) | pasa (0.082) | pasa (0.018) | pasa (0.263) | 17.0 (5-8) |
| tenue | pasa (0.000) | pasa (4.796) | pasa (7.609) | pasa (19.893) | pasa (0.045) | pasa (0.055) | pasa (0.901) | 6.7 (5-8) |
| boton | pasa (0.000) | pasa (7.729) | pasa (5.271) | pasa (15.278) | pasa (0.046) | pasa (0.034) | pasa (0.059) | 19.7 (5-8) |
| esmerilado | pasa (0.000) | **FALLA** (-0.184) | pasa (7.904) | pasa (19.119) | **FALLA** (-0.050) | pasa (0.076) | **FALLA** (-0.060) | 25.4 (0-1) |

Paletas de hoy (clasica, contraste, pastel, neon, retro, dorado, diamante, constancia): todas las aserciones pasan.
Coherencia medidas vs vitest: OK (0 discrepancias).

#### Fallas

- cristal · contraste rojo en rango Clásica: medido 2.760 vs umbral [1.156, 1.730]; margen -1.030 (pos 3 #94f0c2)
- cristal · caso más difícil de contraste: medido 1.702 vs umbral mínimo ≤ 1.256; margen -0.446 (pos 8 #c79bff)
- cristal · texto blanco ≥ Clásica: medido 1.355 vs umbral ≥ 2.161; margen -0.806 (pos 3 #94f0c2)
- contorno · contraste rojo en rango Clásica: medido 2.341 vs umbral [1.156, 1.730]; margen -0.611 (pos 2 #ffc400)
- contorno · caso más difícil de contraste: medido 1.521 vs umbral mínimo ≤ 1.256; margen -0.265 (pos 8 #d484ff)
- contorno · texto blanco ≥ Clásica: medido 1.597 vs umbral ≥ 2.161; margen -0.564 (pos 2 #ffc400)
- esmerilado · tono SAFE en rango Clásica ±5°: medido 178.2 vs umbral [37.47, 178.06]°; margen -0.184 (pos 7 #1cc7c2)
- esmerilado · contraste rojo en rango Clásica: medido 1.780 vs umbral [1.156, 1.730]; margen -0.050 (pos 7 #1cc7c2)
- esmerilado · texto blanco ≥ Clásica: medido 2.100 vs umbral ≥ 2.161; margen -0.060 (pos 7 #1cc7c2)
