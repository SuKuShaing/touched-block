# Rompe el bloque — resumen del proyecto y decisiones de diseño

Documento de traspaso para continuar el desarrollo en el computador. Contiene qué es el juego, las reglas actuales con sus valores exactos, las decisiones tomadas (y por qué), lo que está pendiente, y dónde está el código fuente (sección 6).

- Idioma del juego y del usuario: **español**.
- Plataforma objetivo: **celular (táctil)**, jugado dentro de un artefacto de Claude (página HTML autocontenida).
- Estado: prototipo jugable, **no probado en un celular real por Claude** (solo se revisó el código). El usuario sí lo ha jugado y fue iterando.
- Versión publicada: artefacto "Rompe el bloque" (versión 6 de 6). El usuario es el dueño y es privado; el código fuente está en el repositorio (`index.html`, `style.css`, `game.js`).

---

## 1. En qué consiste el juego

Aparecen bloques cuadrados pequeños en distintas partes de la pantalla, cada uno con un número. Hay que **tocar cada bloque tantas veces como indica su número** para destruirlo (un 6 = 6 toques). Aparecen varios a la vez y cada uno desaparece solo después de unos segundos si no se completó.

Es un juego de **supervivencia contra el reloj**: el tiempo baja constantemente, destruir bloques lo recupera, dejar escapar bloques lo castiga fuerte, y hay vidas que se pierden tocando donde no hay bloque. Hay además **bloques trampa** camuflados que penalizan si se tocan.

El objetivo es **destruir la mayor cantidad de bloques posible** (el récord es la cantidad de bloques destruidos).

---

## 2. Reglas actuales (valores exactos)

Todas las constantes están al inicio del script (`START_TIME`, `MAX_LIVES`, `LIFE_MIN`, `LIFE_MAX`, `BOMB_PENALTY`, `BOMB_CHANCE`, `MISS_MULT`).

| Regla | Valor actual |
|---|---|
| Tiempo inicial | **10 s** |
| Vidas | **5** (corazones arriba a la derecha) |
| Tiempo de vida de cada bloque en pantalla | **3 a 5 s, aleatorio uniforme**, independiente del número |
| Completar un bloque | **suma** a su número en segundos (un 6 → +6 s) |
| Bloque que desaparece sin completarse | **resta su número × 5** (`MISS_MULT = 5`). Un 3 → −15 s, un 5 → −25 s |
| Tocar fuera de un bloque | **−1 vida** (también si se toca donde había un bloque que ya desapareció) |
| Tocar un bloque trampa (una sola vez basta) | **−30 s** inmediatos (`BOMB_PENALTY = 30`) |
| Bloque trampa que desaparece solo | sin castigo |
| Fin de partida | tiempo ≤ 0, **o** vidas = 0 |
| Récord | mayor cantidad de bloques destruidos (se guarda en `localStorage`, clave `rb_best3`) |

Detalles importantes:

- El castigo por bloque escapado usa el **número original** del bloque (`b.total`), aunque el jugador ya le haya hecho algunos toques. Pedido explícito del usuario: "si era de 6 y le hice dos clics y desapareció, que me reste los 6 [×5]".
- El tiempo **puede superar** el inicial (no hay tope), porque cada bloque suma segundos.
- Un bloque escapado **no** quita vidas; solo quita tiempo. Las vidas se pierden **únicamente** por toques fuera de bloque. (El mensaje del usuario sobre esto quedó cortado a la mitad; se interpretó así y el usuario no lo corrigió.)

### Bloque trampa (camuflado)

- Se ve **igual que un bloque normal**: mismos colores, sin marco, con número. **La única diferencia es que su número es rojo** (`#ff2a2a`, con una sombra de texto sutil) en vez de blanco.
- Los colores de bloque normales dependen del número (paleta de 9 colores indexada por `n-1`). Si el número de la trampa es 1, 2 o 7 (colores rojo, naranjo y rosado, donde un número rojo no se vería), la trampa usa un color aleatorio de una paleta "segura" (`SAFE`: amarillo, verde, azul, morado, turquesa, violeta).
- Aparece solo después de **8 s de juego**, con **16 %** de probabilidad por cada bloque que se genera (`BOMB_CHANCE`), y **máximo 2 trampas a la vez**.
- Tiene número y barra de tiempo como los demás, pero el número es decorativo: **cualquier toque** la activa.

### Generación de bloques

- Número de cada bloque: aleatorio entre 1 y `maxNum`, con `maxNum = min(3 + floor(tiempoJugado/20), 9)` (parte en máx. 3 y sube hasta 9).
- Cantidad máxima simultánea: `min(3 + floor(tiempoJugado/30), 6)`.
- Pausa entre generaciones: `0.5 + rand*0.6 − min(tiempoJugado/120, 1)*0.25` segundos.
- Tamaño del bloque: entre 66 y 92 px, proporcional al área de juego (`min(ancho, alto)/4.2`).
- Posición: aleatoria dentro del área de juego, sin solaparse con otros (hasta 40 intentos; si no cabe, no genera).
- Cada bloque muestra una **barra blanca inferior** que se acorta con su tiempo restante.

### Interfaz

- Cabecera: **Destruidos** (izquierda) · **Tiempo** (centro, grande, formato m:ss) · **Vidas** (derecha, corazones).
- Barra de tiempo bajo la cabecera: ancho relativo al máximo de tiempo alcanzado en la partida (`barMax`). Se pone roja con ≤ 5 s (el reloj también).
- Pantalla de inicio / fin (overlay): reglas, récord, botón "Jugar" / "Jugar de nuevo". Al terminar muestra bloques destruidos y bloques escapados.
- Feedback: sonidos con WebAudio, vibración con `navigator.vibrate`, partículas al destruir, texto flotante (+Ns / −Ns), sacudida y destello rojo al perder vida o activar trampa, "✕" donde se tocó mal. Todo con `try/catch` porque puede no funcionar en el visor.

---

## 3. Decisiones de diseño (historial cronológico)

1. **HTML + CSS + JS en un solo archivo**, sin librerías, para publicarlo como artefacto y jugarlo desde el celular. Pedido original del usuario: bloque con número, tocar N veces para destruirlo, aparece otro.
2. **Bug de la v1**: la pantalla de inicio nunca se mostraba (faltaba la clase `on` en el overlay), así que el juego no arrancaba y solo se veía un "?". Corregido: el overlay arranca visible.
3. **v2 — rediseño pedido por el usuario**: bloques pequeños en distintas partes de la pantalla, varios a la vez, que aparecen y desaparecen, con límite de tiempo por bloque y un temporizador global (inicialmente 2 minutos).
4. **v3 — vidas y tiempo dinámico**:
   - 5 vidas; se pierde una al tocar fuera de un bloque.
   - Tiempo inicial 30 s (en vez de 2 min), y cada bloque completado suma su número en segundos.
   - Vida de bloques 4–7 s (porque el usuario sintió que desaparecían demasiado rápido).
5. **v4**:
   - Vida de bloques **3–5 s** (el usuario lo ajustó).
   - Bloque escapado resta su valor en segundos.
   - Aparecen **bloques trampa**: primero con bomba 💣 que quita 30 s.
6. **v5**:
   - Tiempo inicial **10 s**.
   - La bomba era "demasiado evidente" → pasó a ser un bloque negro con marco rojo y número rojizo claro.
7. **v6 (actual)**:
   - Aun así era muy evidente → la trampa ahora usa **los mismos colores que los normales, sin marco**, y solo cambia el color del número a rojo.
   - Castigo por bloque escapado **multiplicado ×5**.

Criterios que el usuario ha mostrado: quiere un juego **difícil y tenso**, que castigue el descuido; las trampas deben ser **sutiles**; prefiere ir ajustando números a mano a medida que juega.

---

## 4. Estructura técnica

- Tres archivos: `index.html` (estructura), `style.css` (estilos) y `game.js` (lógica en una IIFE), JavaScript clásico (`var`, sin módulos).
- Bucle de juego con `requestAnimationFrame`; `dt` limitado a 0.1 s para que cambiar de pestaña no "salte" el tiempo.
- Entrada con `pointerdown` (más rápido y multitáctil que `click`). Los bloques llaman a `stopPropagation()`; un listener en el campo detecta toques fuera de bloque (`missTap`). Un bloque en estado `.gone` tiene `pointer-events:none`, por eso tocar donde estaba cuenta como fallo.
- Estado principal: `blocks[]` (cada bloque: `el, sp, tb, n, left, total, bomb, life, max, x, y, size, dead`), `killed`, `missed`, `lives`, `timeLeft`, `played`, `barMax`, `playing`.
- Funciones clave: `spawn`, `hit`, `explodeBomb`, `expire`, `missTap`, `loop`, `end`, `start`, `burst`, `floatText`.
- Nota de nomenclatura: internamente la trampa se llama `bomb` / `explodeBomb` (herencia de cuando era una bomba 💣), pero ya no es una bomba visualmente.

### Restricciones del entorno de artefactos (si se vuelve a publicar ahí)

- Debe ser un solo documento HTML que empiece con `<!DOCTYPE html>`: hay que volver a incrustar `style.css` en un `<style>` y `game.js` en un `<script>`.
- Sin `alert/confirm/prompt`, sin descargas, sin `fetch` a otros hosts; imágenes solo `data:` o SVG inline.
- `localStorage` puede no existir o lanzar error: ya está envuelto en `try/catch`.
- Audio y vibración solo desde gestos del usuario y pueden ser ignorados: ya están envueltos en `try/catch`.

---

## 5. Pendientes, riesgos e ideas (sugerencias, no decisiones)

**Riesgos conocidos**

- **Dificultad muy alta, sin balancear.** Con 10 s iniciales, ×5 de castigo, 3–5 s de vida y números de hasta 9 toques, dejar escapar un solo bloque de 2 o más puede terminar la partida. Ya se le ofreció al usuario bajar el multiplicador o subir el tiempo inicial; no lo ha pedido.
- Bloques con números altos (7–9) en 3–5 s son casi imposibles en celular; podría convenir que la vida del bloque dependa un poco del número (el usuario pidió explícitamente que **no** dependa, así que consultarlo antes).
- No se ha probado en un celular real desde el lado de Claude (rendimiento de animaciones, tamaños de bloque, audio, vibración).
- La clave de récord cambió entre versiones (`rb_best`, `rb_best2`, `rb_best3`) porque las reglas cambiaban; los récords antiguos no se arrastran.

**Ideas posibles**

- Pausa, y botón para silenciar sonido/vibración.
- Modos de dificultad (el usuario ajusta mucho las constantes: exponerlas en un objeto `CONFIG` o en una pantalla de ajustes).
- Pruebas automáticas (por ejemplo Playwright con emulación táctil) para reglas de tiempo/vidas/trampas.
- Empaquetar como PWA instalable (la separación en `index.html` / `style.css` / `game.js` ya está hecha).
- Más tipos de bloque (por ejemplo bloque de tiempo extra, congelar, escudo), y marcador de racha/combo.
- Renombrar internamente `bomb` → `trap`.

---

## 6. Código fuente

El código ya no se copia aquí: vive en el repositorio, separado en tres archivos.

- `index.html`: estructura (marcador, barra, campo de juego, pantalla de inicio/fin).
- `style.css`: todos los estilos.
- `game.js`: toda la lógica (IIFE con constantes de balance al inicio).

Abrir `index.html` en el navegador para jugar.
