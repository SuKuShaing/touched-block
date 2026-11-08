# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

"Rompe el bloque": juego táctil para celular, en español. Aparecen bloques con un número; hay que tocar cada uno tantas veces como indica su número antes de que desaparezca. Supervivencia contra el reloj, con vidas y bloques trampa camuflados.

`rompe-el-bloque.md` es el documento de traspaso: reglas con sus valores exactos, historial de decisiones (v1–v6) con sus motivos, riesgos e ideas pendientes. Léelo antes de cambiar reglas o balance. Si cambias reglas o constantes en `game.js`, actualiza también las tablas de reglas de ese documento. (Ya no guarda copia del código; su sección 6 solo apunta a los archivos.)

## Comandos

No hay build, dependencias, linter ni tests.

- Jugar/probar localmente: abrir `index.html` en el navegador (para probar el táctil, usar emulación móvil de DevTools o Playwright con `hasTouch`).
- Despliegue: cada push a `main` publica en GitHub Pages (`.github/workflows/deploy-pages.yml`). El paso "Preparar sitio" copia explícitamente `index.html`, `style.css` y `game.js` a `_site/`; si agregas archivos nuevos (assets, más scripts), añádelos a ese `cp`.

## Arquitectura

Tres archivos, sin librerías:

- `index.html`: solo estructura (marcador, `#bar`, `#field`, pantalla `#over`). Enlaza `style.css` en el `<head>` y carga `game.js` al final del `<body>` (el script asume que el DOM ya existe; si lo mueves al `<head>`, usa `defer`).
- `style.css`: todos los estilos.
- `game.js`: toda la lógica, una IIFE en JavaScript clásico (`var`, sin módulos).

Se evitan `fetch` externos, `alert` e imágenes que no sean `data:`/SVG inline para poder volver a publicarlo como artefacto de Claude; para eso hay que reincrustar el CSS y el JS en un solo HTML.

- **Constantes de balance** al inicio de `game.js`: `START_TIME`, `MAX_LIVES`, `LIFE_MIN`, `LIFE_MAX`, `BOMB_PENALTY`, `BOMB_CHANCE`, `MISS_MULT`. Otras curvas de dificultad están en línea dentro de `spawn()` (`maxNum`) y `loop()` (`maxConc`, `spawnCd`).
- **Bucle**: `requestAnimationFrame` en `loop()`, con `dt` limitado a 0.1 s. Ahí baja el tiempo, se generan bloques y se expiran (`expire`).
- **Entrada**: `pointerdown`. Cada bloque llama `stopPropagation()` y luego `hit(b)`; el listener del `#field` (`missTap`) toma todo lo demás como toque fallido (−1 vida). Los bloques en estado `.gone` tienen `pointer-events:none`, así que tocar donde había uno cuenta como fallo — es intencional.
- **Estado**: arreglo `blocks[]` (objetos con `el, sp, tb, n, left, total, bomb, life, max, x, y, size, dead`) más globales `killed, missed, lives, timeLeft, played, barMax, playing`. El castigo por bloque escapado usa `b.total` (número original), no `b.left` — pedido explícito del usuario.
- **Trampas**: internamente se llaman `bomb` / `explodeBomb` por herencia, aunque visualmente ya no son bombas: se ven como un bloque normal con el número rojo (`.blk.bomb`). Si el color del número coincidiría con el fondo (n = 1, 2, 7), se usa la paleta `SAFE`.
- **Récord**: `localStorage`, clave `rb_best3`. Se ha cambiado la clave cuando cambian las reglas para no comparar récords incompatibles.
- Audio (WebAudio), vibración y `localStorage` van siempre envueltos en `try/catch` porque pueden no estar disponibles; mantener ese patrón.

## Preferencias del usuario

- Quiere un juego difícil y tenso; las trampas deben ser sutiles. Ajusta los números a mano mientras juega.
- La vida de un bloque **no** debe depender de su número (decisión explícita); consultar antes de cambiarlo.
- Todo texto visible del juego va en español.

## Inconsistencia conocida

El texto de la pantalla de inicio (`#os`) dice "Empiezas con 30 segundos", pero `START_TIME=10`. Si se cambian constantes, revisar que ese texto coincida.
