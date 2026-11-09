# Touched Block — resumen del proyecto y decisiones de diseño

Documento de traspaso para continuar el desarrollo. Contiene qué es el juego, las reglas actuales con sus valores exactos, las decisiones tomadas (y por qué), lo que está pendiente, y dónde está el código (sección 6).

- Idioma del juego y del usuario: **español**.
- Plataforma: **web pensada para celular** (GitHub Pages), con cuentas y rankings. Después, si le va bien, app Android/iOS con el mismo código (Expo).
- Nombre: **Touched Block** (antes "Rompe el bloque"; el nombre queda en inglés aunque el resto del texto sea en español).
- Reglas actuales: **v2 del motor** (`RULES_VERSION = 2`), que corresponde a la decisión v7 de la sección 3.

---

## 1. En qué consiste el juego

Aparecen bloques en distintas partes de la pantalla. Cada uno muestra un **número** o una **operación** ("2+3", "4−2", "2×3", "8÷2"). Hay que **tocar cada bloque tantas veces como su resultado** para destruirlo (un 6 = 6 toques; "2+3" = 5 toques). Aparecen varios a la vez y cada uno desaparece solo después de unos segundos si no se completó.

Es un juego de **supervivencia contra el reloj**: el tiempo baja constantemente, destruir bloques lo recupera, dejar escapar bloques lo castiga fuerte, y hay vidas que se pierden tocando donde no hay bloque. Hay **trampas**: bloques con el texto rojo y restas cuyo resultado no es positivo. Romper bloques seguidos sin errores da **combos** con segundos extra. La dificultad **sube siempre**, así que toda partida termina.

El objetivo es **destruir la mayor cantidad de bloques posible** (el récord es la cantidad de bloques destruidos).

---

## 2. Reglas actuales (valores exactos)

Todas las constantes están en `packages/engine/src/constants.ts`.

| Regla | Valor actual |
|---|---|
| Tiempo inicial | **10 s** (`START_TIME`) |
| Vidas | **5** de base, **+1 por cada amigo invitado, máximo 8** (`BASE_LIVES`, `MAX_LIVES_CAP`) |
| Vida de cada bloque | **3 a 5 s, aleatorio**, independiente del número; en la etapa final, fija: **4 → 3 → 2 → 1 s** |
| Completar un bloque | **suma** su resultado en segundos (un 6 → +6 s; "5×5" → +25 s) |
| Bloque que escapa sin completarse | **resta su resultado original ×3** si es número, **×4** si es suma/resta, **×5** si es multiplicación/división |
| Tocar fuera de un bloque | **−1 vida** (también si se toca donde había un bloque que ya desapareció) |
| Tocar una trampa (un toque basta) | **−30 s** inmediatos (`BOMB_PENALTY`) |
| Trampa que desaparece sola | sin castigo |
| Combos (destruidos seguidos sin errores) | 3 → **+1 s**, 5 → **+2 s**, 10 → **+3 s**, 15 → **+4 s**, 20 → **+5 s**; luego el ciclo se repite (23 → +1 s…) |
| Corte del combo | **cualquier error**: bloque escapado, trampa tocada o toque fuera. Los premios ya ganados se conservan (cortar en 18 = ya ganaste los de 3, 5, 10 y 15) |
| Fin de partida | tiempo ≤ 0, **o** vidas = 0 |
| Récord local | `localStorage` `tb_best2`; historial `tb_hist2` (últimas 30, se muestran 10) |

Detalles importantes:

- El castigo por bloque escapado usa el **resultado original** del bloque (`b.total`), aunque el jugador ya le haya hecho algunos toques. Pedido explícito del usuario.
- El tiempo **puede superar** el inicial (no hay tope).
- Un bloque escapado **no** quita vidas; solo tiempo. Las vidas se pierden **únicamente** por toques fuera de bloque.
- Los bloques con operación **mantienen la operación escrita** mientras se tocan (hay que llevar la cuenta mentalmente). Los números muestran cuántos toques faltan.

### Progresión de la dificultad (segundos jugados)

| Desde | Qué aparece |
|---|---|
| 0 s | Números del 1 al 3; el máximo sube 1 cada **20 s** hasta **10** (a los 140 s) |
| 140 s | **Sumas y restas** (bloques rectangulares), empezando por "1+1"; el operando máximo sube 1 cada **15 s** hasta "10+10" (a los 275 s) |
| 275 s | **Multiplicaciones y divisiones**: "1×2"…"5×5" (25 toques) y divisiones **exactas** con **÷** ("9÷3", "8÷2"); el factor máximo sube 1 cada 15 s hasta 5 (a los 320 s) |
| 350 s | **Etapa final**: la vida de los bloques pasa a **4 s**, y baja 1 s cada **30 s** hasta **1 s** |

- Al aparecer un tipo nuevo, los anteriores siguen apareciendo: con sumas/restas, 50 % números y 50 % sumas/restas; con multiplicaciones, 40 % números, 35 % sumas/restas y 25 % multiplicaciones/divisiones. Dentro de sumas/restas, 40 % son restas; dentro de multiplicaciones/divisiones, 40 % son divisiones.
- Bloques simultáneos: `min(3 + floor(tiempoJugado/30), 6)`. Pausa entre generaciones: `0.5 + rand*0.6 − min(tiempoJugado/120, 1)*0.25` s.
- Tamaño: alto entre 66 y 92 px, proporcional al campo (`min(ancho, alto)/4.2`); los bloques con operación miden 1,7 veces el alto de ancho.
- Posición: aleatoria, sin solaparse (hasta 40 intentos; si no cabe, no genera).
- Con la etapa final, un bot que toca 10 veces por segundo y nunca se equivoca pierde a los ~9 minutos. Antes (v6) nunca perdía.

### Trampas

- **Trampa roja**: se ve igual que un bloque normal (número u operación), pero con el **texto rojo** (`#ff2a2a`). Si su color de fondo es rojizo (rojo, naranjo o rosado), usa un color de la paleta `SAFE`.
- **Resultado no positivo**: una resta que da **0 o negativo** ("3−3", "3−4") es trampa y se ve normal. Regla que se le explica al jugador: **"Solo toca números o resultados positivos"**.
- Las trampas aparecen solo después de **8 s**; las rojas con **16 %** de probabilidad por bloque (`BOMB_CHANCE`). Nunca hay **más de 2 trampas a la vez**, sumando ambos tipos.

### Interfaz

- Cabecera: **Destruidos** · **Tiempo** (m:ss) · **Vidas** (corazones, de 5 a 8). Barra de tiempo relativa al máximo alcanzado; roja con ≤ 5 s.
- Indicador de racha durante el juego, texto flotante con cada premio de combo y un aviso breve al cortarse la racha.
- Pantalla de fin: título ("¡Nuevo récord!", "¡Sin vidas!", "¡Se acabó el tiempo!"), destruidos, escapados, mejor racha, posición en el ranking (si hay cuenta), Compartir e Invitar amigos.
- **Tutorial (onboarding)**: slides animadas con los mismos componentes del juego, una por regla. Aparece solo la **primera vez en cada dispositivo** (`tb_onb1`); se repite desde el botón "Ver tutorial de nuevo" del **Perfil**.
- Pestañas Jugar / Rankings / Perfil (solo con cuentas activadas). Rankings Tú / País / Mundial / Amigos con filtros Semana / Mes / Año / Histórico (períodos en UTC).

### Cuentas, rankings e invitaciones

- Se puede jugar **como invitado** sin cuenta. Al terminar se ofrece iniciar sesión con Google para dejar el puntaje en el ranking (la partida recién jugada se reclama); si no, queda solo en el historial local.
- Login con **Google** en la web; Apple se agregará con la app iOS.
- **Nombre de usuario** único y editable (es lo que se ve en los rankings). País tomado de la región del navegador, editable una vez cada 30 días (el primer cambio es libre).
- **"¿Quién te invitó?"** en el perfil (solo por nombre de usuario, una sola vez, no uno mismo): quien invitó gana **+1 corazón** (máx. 8) y ambos quedan siguiéndose. Se puede seguir a otros por nombre de usuario para la pestaña Amigos.
- Cada partida con ranking pide su semilla al servidor; al terminar, el servidor **repite la partida** con los toques registrados y solo la acepta si da el mismo resultado (además de límites de velocidad de toques y de tiempo real).

---

## 3. Decisiones de diseño (historial cronológico)

1. **HTML + CSS + JS en un solo archivo**, sin librerías, para publicarlo como artefacto y jugarlo desde el celular. Pedido original: bloque con número, tocar N veces para destruirlo, aparece otro.
2. **Bug de la v1**: la pantalla de inicio nunca se mostraba (faltaba la clase `on` en el overlay). Corregido.
3. **v2**: bloques pequeños en distintas partes de la pantalla, varios a la vez, con límite de tiempo por bloque y un temporizador global (2 minutos).
4. **v3**: 5 vidas (se pierde una al tocar fuera); tiempo inicial 30 s y cada bloque completado suma su número; vida de bloques 4–7 s.
5. **v4**: vida de bloques 3–5 s; bloque escapado resta su valor; aparecen bloques trampa (bomba 💣, −30 s).
6. **v5**: tiempo inicial 10 s; la bomba era "demasiado evidente" → bloque negro con marco rojo.
7. **v6**: aun así era evidente → la trampa usa los mismos colores que los normales y solo cambia el número a rojo. Castigo por bloque escapado ×5.
8. **v7 (actual, motor v2)**: se pasa a web con cuentas, rankings e invitaciones (Expo + NestJS), con motor determinista compartido. Al revisar la validación de partidas se vio que, pasados ~90 s, la dificultad se estancaba y un jugador perfecto (o un bot) nunca perdía. El usuario decidió:
   - Los números llegan hasta 10; luego aparecen **sumas y restas** hasta "10+10", y luego **multiplicaciones** hasta "5×5" y **divisiones exactas** con el símbolo **÷** (no "/", que parece fracción).
   - Las restas con resultado **0 o negativo** son trampa; también puede haber trampas rojas de cualquier tipo.
   - Los bloques con operación **mantienen la operación** al tocarlos.
   - Si el jugador supera todo eso, la vida de los bloques baja a **4, 3, 2 y 1 s**.
   - **Combos** por bloques seguidos (3/5/10/15/20 → +1…+5 s, en ciclo); cualquier error corta la racha, pero se conservan los premios ya ganados.
   - Castigo por escapar: **×3** números (antes ×5), **×4** sumas/restas, **×5** multiplicaciones/divisiones.
   - Vidas: **+1 corazón por amigo invitado**, hasta 8.

Criterios que el usuario ha mostrado: quiere un juego **difícil y tenso**, que castigue el descuido; las trampas deben ser **sutiles**; prefiere ir ajustando números a mano a medida que juega.

---

## 4. Estructura técnica

- Monorepo pnpm: `packages/engine` (reglas), `apps/client` (Expo Router, web primero), `apps/api` (NestJS + Prisma + PostgreSQL), `legacy/` (juego original v6, solo referencia).
- **Motor determinista**: PRNG mulberry32 con semilla, paso fijo de 1/60 s, coordenadas del campo fijadas al inicio. API: `createGame`, `step`, `tap`, `drainEvents`, `replay`. El cliente registra cada toque como `[tick, x, y]`; la API repite la partida para validar el puntaje.
- Bloque: `id, kind ('num'|'add'|'sub'|'mul'|'div'), a, b, label, value, total, left, trap, red, life, max, x, y, w, h, color`. Estado: `lives, timeLeft, played, barMax, killed, missed, streak, bestStreak, comboEarned, blocks, over, endReason`.
- Cada partida y cada récord guardan `RULES_VERSION`: si cambian las reglas, los rankings parten de cero sin borrar nada.

---

## 5. Pendientes, riesgos e ideas (sugerencias, no decisiones)

**Riesgos conocidos**

- **Balance sin probar con personas**: la progresión (140 s / 275 s / 350 s), las proporciones de cada tipo y los castigos se eligieron como punto de partida; el usuario los ajustará jugando. Cambiar el balance después de abrir los rankings obliga a subir `RULES_VERSION` (reinicia los rankings).
- **Bots**: el servidor verifica que la partida sea real, pero no puede distinguir un script que toca bien de una persona. La etapa final hace que todos pierdan, lo que limita el daño; si aparecen puntajes sospechosos, agregar heurísticas (precisión y ritmo inhumanos).
- La web pesa unos 2 MB de JS (≈600 KB comprimido) por React Native Web; se puede optimizar más adelante.
- Las claves locales cambiaron (`rb_best*` → `tb_best1` → `tb_best2`) cada vez que cambiaron las reglas; los récords antiguos no se arrastran.

**Ideas posibles**

- Pausa, y botón para silenciar sonido/vibración.
- App Android/iOS (login nativo de Google y Apple, compartir nativo, sonidos con `expo-audio`, EAS Build).
- Dominio propio (necesario para Sign in with Apple en la web y para cookies de sesión del mismo sitio).
- Más tipos de bloque (tiempo extra, congelar, escudo).

---

## 6. Código fuente

- `packages/engine/src/constants.ts`: todas las constantes de balance y progresión.
- `packages/engine/src/game.ts`: reglas (generación, toques, escapes, trampas, combos).
- `packages/engine/src/replay.ts`: repetición de partidas para validar puntajes.
- `apps/client/`: la web (juego, onboarding, rankings, perfil).
- `apps/api/`: el backend; contrato en `apps/api/API.md`.
- `legacy/`: el juego original (v6) en HTML/CSS/JS.
