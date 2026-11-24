### Corrida efectivo

Aserciones oficiales: 123 pasan, 4 fallan, de 127.

"cada paleta se ve distinta de las demás": passed

| paleta | 9 colores #rrggbb distintos | tono SAFE en rango Clásica ±5° | caso más difícil de tono | media de tono | contraste rojo en rango Clásica | caso más difícil de contraste | texto blanco ≥ Clásica | ΔE mín (informativo) |
|---|---|---|---|---|---|---|---|---|
| cristal | pasa (0.000) | pasa (4.268) | pasa (7.726) | pasa (16.194) | pasa (0.030) | pasa (0.070) | pasa (2.276) | 8.4 (3-7) |
| contorno | **FALLA** (-8.000) | pasa (58.061) | **FALLA** (-69.534) | pasa (19.463) | **FALLA** (-3.253) | **FALLA** (-3.727) | pasa (16.470) | 0.0 (0-1) |
| contorno55 | pasa (0.000) | pasa (2.939) | pasa (4.583) | pasa (18.449) | pasa (0.023) | pasa (0.077) | pasa (2.248) | 14.5 (5-8) |
| degrade | pasa (0.000) | pasa (7.452) | pasa (5.548) | pasa (12.782) | pasa (0.082) | pasa (0.018) | pasa (0.263) | 17.0 (5-8) |
| degrade-arriba | pasa (0.000) | pasa (7.280) | pasa (5.720) | pasa (12.712) | pasa (0.011) | pasa (0.089) | pasa (0.188) | 16.9 (5-8) |
| degrade-abajo | pasa (0.000) | pasa (7.280) | pasa (5.720) | pasa (12.859) | pasa (0.026) | pasa (0.074) | pasa (0.444) | 16.8 (5-8) |
| tenue | pasa (0.000) | pasa (4.796) | pasa (7.609) | pasa (19.893) | pasa (0.045) | pasa (0.055) | pasa (0.901) | 6.7 (5-8) |
| boton | pasa (0.000) | pasa (7.729) | pasa (5.271) | pasa (15.278) | pasa (0.046) | pasa (0.034) | pasa (0.059) | 19.7 (5-8) |
| esmerilado | pasa (0.000) | pasa (5.391) | pasa (7.609) | pasa (15.376) | pasa (0.043) | pasa (0.057) | pasa (0.347) | 8.2 (4-5) |

Paletas de hoy (clasica, contraste, pastel, neon, retro, dorado, diamante, constancia): todas las aserciones pasan.
Coherencia medidas vs vitest: OK (0 discrepancias).

#### Fallas

- contorno · 9 colores #rrggbb distintos: medido 1.000 vs umbral 9 distintos; margen -8.000 ()
- contorno · caso más difícil de tono: medido 120.0 vs umbral mínimo ≤ 50.47°; margen -69.534 (pos 2 #12121a)
- contorno · contraste rojo en rango Clásica: medido 4.983 vs umbral [1.156, 1.730]; margen -3.253 (pos 2 #12121a)
- contorno · caso más difícil de contraste: medido 4.983 vs umbral mínimo ≤ 1.256; margen -3.727 (pos 2 #12121a)
