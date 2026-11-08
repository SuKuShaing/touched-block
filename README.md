# Touched Block

Juego táctil para celular, en español: aparecen bloques con un número y hay que tocar cada uno tantas veces como indica ese número antes de que desaparezca. Es de supervivencia contra el reloj, con vidas y bloques trampa camuflados.

**Jugar:** https://sukushaing.github.io/touched-block/

## Cómo se juega

- Toca cada bloque tantas veces como diga su número (un 6 = 6 toques) para destruirlo.
- El tiempo baja sin parar. Cada bloque que completas **suma** su número en segundos.
- Si un bloque desaparece sin completarlo, **resta** su número × 5 en segundos (un 3 que se escapa = −15 s), aunque ya le hayas dado algunos toques.
- Tocar fuera de un bloque (también donde había uno que ya desapareció) quita una vida.
- Hay **bloques trampa**: se ven igual que los normales, pero su número es rojo. Un solo toque quita 30 s. Si los dejas desaparecer, no pasa nada.
- La partida termina cuando se acaba el tiempo o las vidas. El récord es la mayor cantidad de bloques destruidos.

### Valores actuales

| Regla | Valor |
|---|---|
| Tiempo inicial | 10 s |
| Vidas | 5 |
| Vida de cada bloque | 3 a 5 s, al azar (no depende del número) |
| Bloque completado | + su número en segundos |
| Bloque escapado | − su número × 5 segundos |
| Toque fuera de un bloque | −1 vida |
| Toque a una trampa | −30 s |
| Trampas | desde los 8 s de juego, 16 % de probabilidad por bloque, máx. 2 a la vez |

La dificultad sube con el tiempo jugado: los números van de 1–3 hasta 1–9, y los bloques simultáneos de 3 hasta 6.

## Ejecutar localmente

No hay build ni dependencias. Basta con abrir `index.html` en el navegador.

Para probar el táctil en el computador, usa la emulación de dispositivo móvil de las DevTools del navegador.

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura: marcador, barra de tiempo, campo de juego y pantalla de inicio/fin |
| `style.css` | Todos los estilos |
| `game.js` | Toda la lógica, en JavaScript clásico sin librerías |
| `favicon.svg` | Ícono de la pestaña |
| `rompe-el-bloque.md` | Documento de diseño: reglas detalladas, historial de decisiones, riesgos e ideas pendientes |

Las constantes de balance están al inicio de `game.js` (`START_TIME`, `MAX_LIVES`, `LIFE_MIN`, `LIFE_MAX`, `BOMB_PENALTY`, `BOMB_CHANCE`, `MISS_MULT`). Si las cambias, actualiza también las tablas de `rompe-el-bloque.md` y el texto de la pantalla de inicio en `index.html`.

El récord se guarda en `localStorage` del navegador (clave `tb_best1`). El sonido usa WebAudio y la vibración `navigator.vibrate`; si no están disponibles, el juego sigue funcionando sin ellos.

## Despliegue

Cada push a `main` publica el sitio en GitHub Pages mediante `.github/workflows/deploy-pages.yml`. El workflow copia `index.html`, `style.css`, `game.js` y `favicon.svg`; si agregas archivos nuevos, súmalos al paso "Preparar sitio".

## Autores

- José Pinilla
- Sebastián Sanhueza
- Claude (Anthropic)
