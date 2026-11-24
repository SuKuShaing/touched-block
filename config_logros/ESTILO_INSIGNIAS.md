# Estilo de las insignias (para diseñar más)

Guía para quien (persona, Claude o un subagente) haga insignias nuevas o rediseñe las que hay. Resume el lenguaje visual de `medalSvg()` (`apps/client/src/cosmetics/medal.ts`), que dibuja las siete insignias del juego, y cómo se hicieron los diseños propuestos en `cambios.md` → CAMBIO-005 (Papel, Cartón y Madera).

## Dónde está cada cosa

- `insignias/`: los SVG de **hoy** (los que genera el juego con `medalSvg()`). No se editan: son la versión "Ahora" de la web.
- `insignias_nuevas/`: los diseños **propuestos** (`madera-1` Papel, `madera-2` Cartón, `madera-3` Madera). Misma nomenclatura que `insignias/`: `<tier>-<step>.svg` y `<tier>-<step>-small.svg`. La web los usa con el interruptor "Con cambios" (propiedad `arte: true` en `CAMBIOS` de `script.js`).
- `herramientas/`: los generadores. Se corren desde cualquier carpeta y escriben en `insignias_nuevas/`:
  - `node config_logros/herramientas/gen-papel-carton.js` → Papel y Cartón.
  - `node config_logros/herramientas/gen-madera.js` → Madera (la estrella remachada dentro del bloque).
  - Si se agrega un diseño, copiar uno de estos scripts y reutilizar sus funciones (`panel()`, `starPts()`, `crescent()`, degradados `HL`, `PANEL_HL`, `NAIL`).
- `cambios.md` → CAMBIO-005: qué hay que tocar en el juego al aplicar los diseños (`medal.ts`, `progress.ts`, `tiers.ts`, tests, textos).

## Reglas de estilo (lo que tienen en común las siete)

- **Lienzo** `viewBox="0 0 100 100"`; `width`/`height` 120 en la versión normal y 28 en la `-small`.
- **Luz arriba a la izquierda**: degradados en diagonal claro → medio → oscuro en el canto, borde interior hundido (degradado invertido), aro de brillo (`hl`) y una medialuna de brillo en la cara.
- **Sombra dura** negra al 42 % corrida hacia abajo (`max(2, R · 0.07)`) y **contorno oscuro** de 0,7.
- **Bloque central** (el cuadrado redondeado del juego, `panel()`): sombra al 40 %, trazo de brillo `panelHl`, barrita blanca (solo en la versión grande) y, encima, el **glifo** (estrella, numeral…) con sombra al 45 %.
- Sin `transform` ni `filter` (solo `clipPath`): así se pueden portar tal cual a `SvgNode` / react-native-svg en la app.
- Sin imágenes ni fuentes externas: todo vectorial; los textos se convierten en trazos.
- **Versión `-small`** (se usa bajo 30 px): sin texturas finas (veta, renglones, pliegues, fibras), sin `panelHl` ni barrita, aro de brillo más grueso (1,8), bloque más grande (≈ 1,12×) y glifo/remaches más grandes.
- Tamaños en que se muestran: 11, 22, 38, 74 y 170 px. Una insignia nueva debe distinguirse de sus vecinas **a 22 px**.
- La progresión de materiales debe leerse sola: Papel < Cartón < Madera < Bronce < Plata < Oro < Diamante.

## Cómo verificar un diseño

Mirarlo a 170, 74, 38 y 22 px (y las `-small` a 22 y 11 px) junto a Bronce, Plata, Oro y Diamante. Playwright no abre `file://`: servir la carpeta con un `node` mínimo (p. ej. puerto 5176) o cargar el SVG con `page.setContent`. Guardar las capturas dentro del proyecto (`.playwright-mcp/`, ignorada por git).

## Decisiones abiertas de CAMBIO-005

Ver `cambios.md`: nombres (Papel / Cartón / Madera), si Papel y Cartón conservan los numerales "I" y "II" en vez de la estrella, color del bloque de Papel y cómo se dibuja el material "Madera" de los logros.
