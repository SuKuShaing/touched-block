# Reglas y balance

Qué es el juego, las reglas actuales con sus valores exactos y la historia de cada cambio de reglas (con su porqué). Si cambias una regla o una constante, actualiza este documento en el mismo cambio. Para el resto del proyecto (arquitectura, despliegue, decisiones técnicas) ver [`README.md`](README.md) de esta carpeta.

- Idioma del juego y del usuario: **español**.
- Plataforma: **web pensada para celular** (GitHub Pages), con cuentas y rankings. Después, si le va bien, app Android/iOS con el mismo código (Expo).
- Nombre: **Touched Block** (antes "Rompe el bloque"; el nombre queda en inglés aunque el resto del texto sea en español).
- Reglas actuales: **v5 del motor** (`RULES_VERSION = 5`), que corresponde a la decisión v8 de la sección 3.

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
| Bloque que escapa sin completarse | **resta su resultado original × el multiplicador de la etapa**, sea cual sea el tipo de bloque: **×5** en la etapa de números, **×6** desde que aparecen las sumas y restas (140 s), **×7** desde que aparecen las multiplicaciones y divisiones (275 s) (`missMultAt`) |
| Tocar fuera de un bloque | **−1 vida** (también si se toca donde había un bloque que ya desapareció) |
| Tocar una trampa (un toque basta) | **−30 s** inmediatos (`BOMB_PENALTY`) |
| Trampa que desaparece sola | sin castigo |
| Combos (destruidos seguidos sin errores) | 3 → **+1 s**, 5 → **+2 s**, 10 → **+3 s**, 15 → **+4 s**, 20 → **+5 s**; luego el ciclo se repite (23 → +1 s…) |
| Corte del combo | **cualquier error**: bloque escapado, trampa tocada o toque fuera. Los premios ya ganados se conservan (cortar en 18 = ya ganaste los de 3, 5, 10 y 15) |
| Corazón de recuperación | Al llegar la racha a **25, 50, 75…** (`HEART_COMBO`), **si falta alguna vida**, aparece un bloque rosado con ♥ que dura **2 s** (`HEART_LIFE`). Un toque → **+1 vida** (sin pasar del máximo); no suma tiempo ni toca la racha. Si se escapa: sin castigo, sin cortar la racha. No cuenta para el máximo de bloques simultáneos |
| Fin de partida | tiempo ≤ 0, **o** vidas = 0 |
| Récord local | `localStorage` `tb_best5`; historial `tb_hist5` (últimas 30, se muestran 10) |

Detalles importantes:

- El multiplicador depende de la **etapa en el momento en que el bloque se escapa**, no del tipo: un "4" que se escapa a los 300 s resta 4×7 = 28 s. Ejemplos extremos: "10+10" escapado en la etapa de sumas = −120 s; "5×5" = −175 s.
- El castigo por bloque escapado usa el **resultado original** del bloque (`b.total`), aunque el jugador ya le haya hecho algunos toques. Pedido explícito del usuario.
- El tiempo **puede superar** el inicial (no hay tope).
- Un bloque escapado **no** quita vidas; solo tiempo. Las vidas se pierden **únicamente** por toques fuera de bloque.
- Los bloques con operación **mantienen la operación escrita** mientras se tocan (hay que llevar la cuenta mentalmente). Los números muestran cuántos toques faltan.

### Progresión de la dificultad (segundos jugados)

| Desde | Qué aparece |
|---|---|
| 0 s | Números del 1 al 3 (escapar resta ×5); el máximo sube 1 cada **20 s** hasta **10** (a los 140 s) |
| 140 s | **Sumas y restas** (bloques rectangulares), empezando por "1+1"; escapar pasa a restar ×6; el operando máximo sube 1 cada **15 s** hasta "10+10" (a los 275 s) |
| 275 s | **Multiplicaciones y divisiones** (escapar pasa a restar ×7): "1×2"…"5×5" (25 toques) y divisiones **exactas** con **÷** ("9÷3", "8÷2"); el factor máximo sube 1 cada 15 s hasta 5 (a los 320 s) |
| 350 s | **Etapa final**: la vida de los bloques pasa a **4 s**, y baja 1 s cada **30 s** hasta **1 s** |

- Al aparecer un tipo nuevo, los anteriores siguen apareciendo: con sumas/restas, 50 % números y 50 % sumas/restas; con multiplicaciones, 40 % números, 35 % sumas/restas y 25 % multiplicaciones/divisiones. Dentro de sumas/restas, 40 % son restas; dentro de multiplicaciones/divisiones, 40 % son divisiones.
- Bloques simultáneos: `min(3 + floor(tiempoJugado/30), 6)`. Pausa entre generaciones: `0.5 + rand*0.6 − min(tiempoJugado/120, 1)*0.25` s.
- Tamaño: alto entre 66 y 92 px, proporcional al campo (`min(ancho, alto)/4.2`); los bloques con operación miden 1,7 veces el alto de ancho.
- Posición: aleatoria, sin solaparse (hasta 40 intentos; si no cabe, no genera).
- Con la etapa final, un bot que toca 10 veces por segundo y nunca se equivoca pierde a los ~9 minutos. Antes (v6) nunca perdía.

### Trampas

- **Trampa roja**: se ve igual que un bloque normal (número u operación), pero con el **texto rojo** (`#ff2a2a`). Si su color de fondo es rojizo (rojo, naranjo o rosado), usa un color de la paleta `SAFE`.
- **Resultado no positivo**: una resta que da **0 o negativo** ("3−3", "3−4") es trampa y se ve normal. La lógica: habría que tocarla 0 veces, o un número negativo de veces, que en la práctica es dejarla pasar. Regla que se le explica al jugador: **"Solo toca números o resultados positivos"** (tiene su propia slide en el tutorial).
- Las trampas aparecen solo después de **8 s**; las rojas con **16 %** de probabilidad por bloque (`BOMB_CHANCE`). Nunca hay **más de 2 trampas a la vez**, sumando ambos tipos.

### Interfaz

- Cabecera: **Destruidos** · **Tiempo** (m:ss) · **Vidas** (corazones, de 5 a 8). Barra de tiempo relativa al máximo alcanzado; roja con ≤ 5 s.
- Indicador de racha durante el juego y texto flotante ("+Ns") sobre cada bloque destruido.
- **Franja de avisos** (plan de jugabilidad, fase 1): una franja fija y fina bajo la barra de tiempo, **fuera del campo** (no tapa bloques ni recibe toques), con una línea que se llena hacia el próximo hito y su ícono ("5", "+ −", "× ÷", "4 s"). Ahí aparecen todos los avisos de la partida, **uno a la vez** y por importancia: récord > amigo superado > hito ("¡Sumas y restas! Escapar ahora resta ×6", con el castigo tomado de las constantes) > combo ("+1s · ¡Combo ×3!") > racha cortada ("Racha de N · +X s"). Si coinciden, el menos importante se descarta. Por la franja, el campo de la partida normal es unos 22 px más bajo que antes.
- Pantalla de fin: título ("¡Nuevo récord!", "¡Sin vidas!", "¡Se acabó el tiempo!"), destruidos, escapados y mejor racha; **camino de etapas** (todos los hitos con el mismo ancho, marcadores "Hoy" y "Tu mejor", y la frase "¡Llegaste a las sumas y restas!" o "Te faltaron 28 s para las sumas y restas"); **"Jugar de nuevo"** visible sin desplazarse; tarjeta de premio si subió de insignia o desbloqueó algo (con "Probar ahora"); "Te faltaron N bloques para tu récord" y, con sesión, "Estás a N bloques de @x esta semana"; después ranking, Compartir, Retar a un amigo e Invitar, y al final récord e historial. En plena partida, avisos "¡Nuevo récord!" y "Superaste a @x" (amigos de la semana que todavía no habías superado).
- **Inicio**: logo, texto, "Jugar" como botón principal y **como máximo una tarjeta** (desde la 2.ª visita: el reto de hoy con las misiones debajo, o la de instalar la web); ícono de sonido arriba a la izquierda. La web es **instalable** (manifest, sin service worker); la tarjeta de instalar se puede descartar para siempre y también está en el Perfil.
- **Perfil → En este dispositivo**: interruptores de Sonido y Vibración (`tb_set1`), fila de la Colección con la insignia y el nivel, e instalar.
- **Tutorial (onboarding)**: slides animadas con los mismos componentes del juego, una por regla: tocar, tiempo, escapes, vidas, trampas rojas, operaciones, restas ≤ 0, solo positivos, corazón de recuperación, combos (+ invitar y ranking si hay cuentas). Sus textos toman los números de las constantes del motor. Son dos: el **básico** (tocar, tiempo, escapes, vidas, trampas rojas, combos) se abre solo en la **1.ª visita** del dispositivo, y el **avanzado** (operaciones, restas ≤ 0, solo positivos, corazón de recuperación) en la **3.ª**; en la 2.ª se va directo a jugar. "Ver tutorial de nuevo" en el **Perfil** repite el básico o, si ya vio los dos, ambos seguidos (básico y luego avanzado).
- Pestañas Jugar / Rankings / Perfil (solo con cuentas activadas). Rankings "General | Reto de hoy"; el general con Tú / País / Mundial / Amigos y filtros Semana / Mes / Año / Histórico (períodos en UTC), con la insignia junto a cada nombre.

### Cuentas, rankings e invitaciones

- Se puede jugar **como invitado** sin cuenta. Al terminar se ofrece iniciar sesión con Google para dejar el puntaje en el ranking (la partida recién jugada se reclama); si no, queda solo en el historial local.
- Login con **Google** en la web; Apple se agregará con la app iOS.
- **Nombre de usuario** único y editable (es lo que se ve en los rankings). País tomado de la región del navegador, editable una vez cada 30 días (el primer cambio es libre).
- **"¿Quién te invitó?"** en el perfil (solo por nombre de usuario, una sola vez, no uno mismo): quien invitó gana **+1 corazón** (máx. 8) y ambos quedan siguiéndose. Se puede seguir a otros por nombre de usuario para la pestaña Amigos.
- Cada partida con ranking pide su semilla al servidor; al terminar, el servidor **repite la partida** con los toques registrados y solo la acepta si da el mismo resultado (además de límites de velocidad de toques y de tiempo real).

### Progreso, retos y metas (plan de jugabilidad)

Lo agrega el [plan de jugabilidad](plan-jugabilidad.md). **No cambia las reglas de una partida normal**: `RULES_VERSION` sigue en 5 y las claves `tb_best5`/`tb_hist5` no cambian. Todo vive en el motor (funciones puras, sin `Date` ni `Math.random`) para que el cliente y el servidor den lo mismo. Lo marcado *provisorio* lo confirmó el usuario tal cual el 12 nov 2026; se vuelve a medir con jugadores reales.

**Prueba dorada** (`packages/engine/test/golden.test.ts` + `golden.json`): 20 semillas fijas × 2 campos (360×540 y 412×732) jugadas por un bot determinista de habilidad variable (partidas de unos 9 s a 470 s, varias pasan de 140 s, 275 s y 350 s). Compara destruidos, escapados, mejor racha, ticks, motivo del fin y una huella (FNV-1a) de todos los bloques generados (tick, id, texto, posición, tamaño, color, vida, trampa roja, corazón), y exige que `replay()` dé lo mismo. Los valores salieron del motor v5 **antes** de agregar los modificadores. Si falla, el cambio alteró las partidas normales: no se regenera salvo un cambio de reglas aprobado por el usuario (`GOLDEN_WRITE=1`, ver el comentario del archivo).

#### Hitos e insignias (`progress.ts`)

| Segundo | Hito | Insignia (*provisorio*, D1) |
|---|---|---|
| — | Terminar una partida | Madera I |
| 20, 40, 60, 80, 100, 120 | Aparece el 4, 5, 6, 7, 8, 9 | 40 s = Madera II, 100 s = Madera III |
| 140 (`ADD_START`) | Aparece el 10 y las sumas y restas | Bronce |
| 275 (`MUL_START`) | Multiplicaciones y divisiones | Plata |
| 350, 380, 410, 440 | Etapa final: bloques de 4, 3, 2 y 1 s | 350 s = Oro, 440 s = Diamante |

- `milestoneIndexAt(played)` usa las mismas curvas del motor, así que el aviso coincide con el tick exacto en que cambia la partida. En una partida con modificador hay que pasarle `difficultyTime(s)`.
- `tierForTicks(ticks)` compara enteros (`ticks >= at × 60`). La insignia sale de la mejor partida **normal** (las de reto y con modificador no cuentan).

#### Modificadores de partida (`GameConfig.mods`, *provisorios*)

| Modificador | Efecto |
|---|---|
| `startAt` (entero 0–600) | La dificultad parte como si ya se hubieran jugado N segundos. `difficultyTime(s) = s.played + startAt` reemplaza a `s.played` en **todas** las curvas: números, sumas, multiplicaciones, vida de la etapa final, bloques simultáneos, pausa entre bloques, multiplicador de castigo y el inicio de las trampas (8 s). `s.played` sigue siendo el tiempo real |
| `only` (`num` / `add` / `mul`) | Solo esa familia. Si la curva todavía no la habilita, parte en su valor inicial ("1+1"; factores hasta 2) y después sigue la curva. `num` nunca genera operaciones |
| `lives` (entero 1–8) | Reemplaza a `maxLives` (también es el tope del corazón de recuperación) |
| `noRed` | Sin trampas rojas; las restas con resultado ≤ 0 siguen siendo trampa |

- Sin `mods` (ausente, `null`, `{}` o valores neutros) la partida es idéntica bit a bit: `x + 0 === x` y `noRed` falso consume los mismos números aleatorios. Lo garantiza la prueba dorada, que pasa sin regenerarse.
- `createGame` (y por lo tanto `replay`) lanza un error con valores fuera de rango o claves desconocidas (`validateMods`), para que el servidor nunca repita una partida ignorando un modificador.

#### Reto diario (`daily.ts`)

- Fecha local del jugador `AAAA-MM-DD` (D7), años 2000–2100; aritmética de calendario entera. Número del reto: días desde `DAILY_EPOCH` = **2026-11-12**, que es el **#1** (*provisorio*).
- **5 vidas** (`DAILY_LIVES = BASE_LIVES`), **3 intentos con cuenta y 1 como invitado** (D8).
- Calendario de modificadores por día de la semana (*provisorio*, `DAILY_CALENDAR` / `dailyModsFor`):

| Lunes | Martes | Miércoles | Jueves | Viernes | Sábado | Domingo |
|---|---|---|---|---|---|---|
| Partida normal | Directo a las sumas (`startAt` 140) | Solo 3 vidas (`lives` 3) | Solo multiplicaciones y divisiones (`only` mul + `startAt` 275) | Sin trampas rojas (`noRed`) | Directo a las multiplicaciones (`startAt` 275) | Partida normal |

- **Racha de días con perdón** (*provisorio*, `dailyStreak`): cada día jugado suma 1. Un hueco de **exactamente un día** no corta la racha si desde que empezó (o desde el último perdón) se jugaron al menos **7 días** (`DAILY_STREAK_GRACE_EVERY`); el día del hueco no suma y la cuenta para el siguiente perdón vuelve a cero. Dos días seguidos sin jugar siempre cortan. La racha vigente sigue viva si el último día jugado es hoy o ayer (o anteayer, si el hueco de ayer sería perdonable).

#### Retos: campo común, reto a un amigo y reto diario (API y cliente)

- **Las partidas de reto no cuentan para el ranking general, el récord, la mejor duración ni la mejor racha** (D6: repetir una semilla conocida permite practicarla). Sí suman bloques y partidas al total. Tampoco entran al historial ni al récord local.
- **Campo común** (D4): en los retos todos juegan el mismo campo. El servidor toma el **percentil 5** del ancho y del alto de los campos reales de las partidas válidas de los últimos 30 días (límites *provisorios*: ancho 320–430, alto 440–800; con menos de 200 partidas, 360 × 540). El cliente lo dibuja centrado con una sola escala; los toques fuera del rectángulo se ignoran (no cuestan vida). El modo normal sigue usando la pantalla completa (D5).
- **Reto a un amigo**: el campo se fija al crearlo (el menor por dimensión entre el del creador y el común), 5 vidas, enlace `?reto=CÓDIGO` válido 30 días. Con cuenta cuenta el primer intento válido de cada jugador.
- **Reto diario**: misma semilla (`HMAC-SHA256(DAILY_SECRET, fecha)`) y campo para todos ese día (el campo común vigente al crearse la primera partida de la fecha), 5 vidas salvo el modificador del día. El intento se gasta al **empezar**. El día cambia a la medianoche de cada jugador (D7); el servidor acepta la fecha D solo si alguna zona horaria real está en D. Un invitado tiene 1 intento (lo lleva el dispositivo) y al iniciar sesión su partida pasa a ser el primer intento de la cuenta, solo si la cuenta aún no jugó ese día. Con menos de 10 jugadores se muestra la posición ("Vas 2.º de 4") en vez del porcentaje.

#### Misiones del día (`missions.ts`, *provisorias*)

Tres por día, de **tipos distintos**, elegidas de forma determinista a partir de la fecha (FNV-1a + mulberry32). Solo usan datos que el servidor verifica. Premio: bloques extra para el nivel.

| Tipo | Misiones (premio) |
|---|---|
| Racha en una partida | 10 (20), 15 (30), 25 (50) |
| Llegar a un hito en una partida | al 5 (20), al 8 (30), a las sumas y restas (50), a las multiplicaciones y divisiones (60) |
| Bloques destruidos hoy | 30 (20), 60 (30), 120 (50) |
| Partidas jugadas hoy | 3 (20), 5 (30) |
| Jugar el reto del día | (40) |

El avance (`missionProgress`) se calcula con el resumen del día (`DayAgg`) y se acota a la meta; "llegar" compara ticks enteros.

#### Logros de cinco niveles (`achievements.ts`, *provisorios*)

| Logro | Madera | Bronce | Plata | Oro | Diamante |
|---|---|---|---|---|---|
| Mejor racha | 10 | 25 | 50 | 100 | 200 |
| Bloques destruidos en total | 100 | 500 | 2.000 | 10.000 | 50.000 |
| Días seguidos de reto diario | 3 | 7 | 14 | 30 | 100 |
| Mejor resultado en un reto diario | Participar | Mejor que el 50 % | 75 % | 90 % | 99 % |

#### Premios, nivel y Colección (cliente, *provisorios*)

- **Nivel** (`lib/level.ts`): según bloques destruidos en total + bloques extra de misiones. El nivel n pide `25 · n · (n − 1)` (nivel 2 = 50, 5 = 500, 10 = 2.250, 20 = 9.500).
- **Catálogo** (`cosmetics/catalog.ts`): nada se "entrega" ni se guarda; lo desbloqueado se recalcula desde las estadísticas. Con sesión se usa el máximo entre las del dispositivo y las de la cuenta.

| Premio | Tipo | Se desbloquea con |
|---|---|---|
| Clásica, Alto contraste (daltónicos, D9) | Paleta | Siempre |
| 8 bits | Sonido | Siempre (el de siempre) |
| Clásico | Efecto | Siempre |
| Liso | Fondo | Siempre |
| Suave | Sonido | Terminar 1 partida |
| Pastel | Paleta | Madera II |
| Chispas | Efecto | Madera III |
| Confeti | Efecto | Racha de 25 |
| Neón | Paleta | Bronce |
| Retro | Paleta | Plata |
| Marimba | Sonido | Plata |
| Dorado | Paleta (y marco en el ranking) | Oro |
| Diamante | Paleta con brillo (y marco) | Diamante |
| Grilla, Estrellas, Aurora | Fondo del campo | Nivel 5, 10, 20 |
| Corazones | Efecto | Invitar a 1 amigo |
| Constancia | Paleta | 7 días seguidos de reto diario |

- **Regla de no ventaja de las paletas** (test `cosmetics/palettes.test.ts`): el motor sigue asignando sus colores y el cliente los traduce por posición en `COLORS`. Las trampas rojas (`#ff2a2a`) solo caen en las posiciones `SAFE` (2, 3, 4, 5, 7, 8), así que en ellas cada paleta debe quedar dentro del rango de la Clásica en **contraste de luminancia** y en **distancia de tono** al rojo (±5°), su caso más difícil debe ser tan difícil como el de la Clásica (tono mínimo ≤ el de la Clásica + 8°; contraste mínimo ≤ el de la Clásica + 0,1) y la distancia de tono media debe estar cerca de la de la Clásica (±20°). El texto blanco debe leerse igual o mejor. Así ninguna paleta delata más las trampas, y ninguna (por ejemplo, la de un premio) las esconde más.
- **Sonidos** (`game/sounds.ts`): paquetes de parámetros (onda, notas, duración, volumen), sin archivos de audio. `8bits` tiene exactamente los valores de siempre (lo comprueba un test).

---

## 3. Decisiones de diseño (historial cronológico)

1. **HTML + CSS + JS en un solo archivo**, sin librerías, para publicarlo como artefacto y jugarlo desde el celular. Pedido original: bloque con número, tocar N veces para destruirlo, aparece otro.
2. **Bug de la v1**: la pantalla de inicio nunca se mostraba (faltaba la clase `on` en el overlay). Corregido.
3. **v2**: bloques pequeños en distintas partes de la pantalla, varios a la vez, con límite de tiempo por bloque y un temporizador global (2 minutos).
4. **v3**: 5 vidas (se pierde una al tocar fuera); tiempo inicial 30 s y cada bloque completado suma su número; vida de bloques 4–7 s.
5. **v4**: vida de bloques 3–5 s; bloque escapado resta su valor; aparecen bloques trampa (bomba 💣, −30 s).
6. **v5**: tiempo inicial 10 s; la bomba era "demasiado evidente" → bloque negro con marco rojo.
7. **v6**: aun así era evidente → la trampa usa los mismos colores que los normales y solo cambia el número a rojo. Castigo por bloque escapado ×5.
8. **v7 (motor v2)**: se pasa a web con cuentas, rankings e invitaciones (Expo + NestJS), con motor determinista compartido. Al revisar la validación de partidas se vio que, pasados ~90 s, la dificultad se estancaba y un jugador perfecto (o un bot) nunca perdía. El usuario decidió:
   - Los números llegan hasta 10; luego aparecen **sumas y restas** hasta "10+10", y luego **multiplicaciones** hasta "5×5" y **divisiones exactas** con el símbolo **÷** (no "/", que parece fracción).
   - Las restas con resultado **0 o negativo** son trampa; también puede haber trampas rojas de cualquier tipo.
   - Los bloques con operación **mantienen la operación** al tocarlos.
   - Si el jugador supera todo eso, la vida de los bloques baja a **4, 3, 2 y 1 s**.
   - **Combos** por bloques seguidos (3/5/10/15/20 → +1…+5 s, en ciclo); cualquier error corta la racha, pero se conservan los premios ya ganados.
   - Castigo por escapar: **×3** números (antes ×5), **×4** sumas/restas, **×5** multiplicaciones/divisiones.
   - Vidas: **+1 corazón por amigo invitado**, hasta 8.
9. **v8 (actual, motor v3, 9 nov 2026)**: el usuario seguía pensando en el ×5 de la v6 (la web publicada entonces) y pidió que el castigo **dependa de la etapa y no del tipo de bloque**: ×5 mientras solo hay números, **×6** desde que llegan las sumas y restas y **×7** desde que llegan las multiplicaciones y divisiones, para **cualquier** bloque que se escape. Se reemplazó el ×3/×4/×5 por tipo de la v7 (se interpretó que la etapa de números queda en ×5, el valor que él daba por vigente). También pidió una slide propia que explique por qué una resta ≤ 0 es trampa. Como la v2 ya estaba publicada, se subió `RULES_VERSION` a 3 y las claves locales a `tb_best3`/`tb_hist3`.
10. **v9 (motor v4, 10 nov 2026)**: el usuario pidió una forma de **recuperar vidas**. Decidido con él: cada racha múltiplo de 25, si falta algún corazón, aparece un bloque con ♥ de 1 s; un toque devuelve una vida; si se escapa, no pasa nada. No afecta la racha y no ocupa cupo de bloques simultáneos. Se subió `RULES_VERSION` a 4 y las claves locales a `tb_best4`/`tb_hist4`.
11. **v10 (motor v5, 11 nov 2026)**: el corazón de recuperación dura **2 s** en vez de 1 s (1 s era demasiado corto, pedido del usuario). Se subió `RULES_VERSION` a 5 y las claves locales a `tb_best5`/`tb_hist5`.

Criterios que el usuario ha mostrado: quiere un juego **difícil y tenso**, que castigue el descuido; las trampas deben ser **sutiles**; prefiere ir ajustando números a mano a medida que juega.

---

## 4. Estructura técnica

- Monorepo pnpm: `packages/engine` (reglas), `apps/client` (Expo Router, web primero), `apps/api` (NestJS + Prisma + PostgreSQL), `legacy/` (juego original v6, solo referencia).
- **Motor determinista**: PRNG mulberry32 con semilla, paso fijo de 1/60 s, coordenadas del campo fijadas al inicio. API: `createGame`, `step`, `tap`, `drainEvents`, `replay` (y `difficultyTime`, `validateMods` para los modificadores). El cliente registra cada toque como `[tick, x, y]`; la API repite la partida para validar el puntaje. La misma semilla con el mismo campo (y los mismos modificadores) genera exactamente los mismos bloques en cualquier dispositivo; con otro campo, no (por eso los retos usan un campo común).
- Bloque: `id, kind ('num'|'add'|'sub'|'mul'|'div'), a, b, label, value, total, left, trap, red, heart, life, max, x, y, w, h, color`. Estado: `lives, timeLeft, played, barMax, killed, missed, streak, bestStreak, comboEarned, blocks, over, endReason`.
- Cada partida y cada récord guardan `RULES_VERSION`: si cambian las reglas, los rankings parten de cero sin borrar nada.

---

## 5. Pendientes, riesgos e ideas (sugerencias, no decisiones)

**Riesgos conocidos**

- **Balance sin probar con personas**: la progresión (140 s / 275 s / 350 s), las proporciones de cada tipo y los castigos se eligieron como punto de partida; el usuario los ajustará jugando. Cambiar el balance después de abrir los rankings obliga a subir `RULES_VERSION` (reinicia los rankings). **Regla del usuario (11 nov 2026): no romper los registros de la gente** (ya hay jugadores y habrá app móvil); solo un cambio muy grande que lo amerite, con su aprobación, justifica un reinicio.
- **Bots**: el servidor verifica que la partida sea real, pero no puede distinguir un script que toca bien de una persona. La etapa final hace que todos pierdan, lo que limita el daño; si aparecen puntajes sospechosos, agregar heurísticas (precisión y ritmo inhumanos).
- **Castigos muy altos al final**: con ×6/×7, un solo escape de una operación grande (−120 s / −175 s) casi decide la partida. Es lo pedido, pero conviene revisarlo jugando.
- **Al empezar las restas casi todas son trampa**: con operandos 1–2, "1−1", "1−2" y "2−2" dan ≤ 0; entre 140 y 200 s cerca del 30 % de las operaciones son trampa. Opción si se siente injusto: que las restas partan después que las sumas.
- **Calendario del reto diario sin probar** (*provisorio*): "Directo a las sumas" y "Directo a las multiplicaciones" parten con 10 s, hasta 6 bloques a la vez, trampas desde el primer segundo y castigo ×6/×7, así que pueden ser muy cortos. "Solo multiplicaciones y divisiones" era `only: 'mul'` sin `startAt` (275 s de "2×2" antes de que subieran los factores: fácil y largo); el 12 nov 2026 el usuario eligió combinarlo con `startAt: MUL_START`. Valores provisorios confirmados por el usuario el 12 nov 2026 para publicar; se ajustan con lo que pase.
- La web pesa unos 2 MB de JS (≈600 KB comprimido) por React Native Web; se puede optimizar más adelante.
- Las claves locales cambiaron (`rb_best*` → `tb_best1` → `tb_best2` → `tb_best3` → `tb_best4` → `tb_best5`) cada vez que cambiaron las reglas; los récords antiguos no se arrastran.

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
- `packages/engine/src/progress.ts`, `daily.ts`, `missions.ts`, `achievements.ts`: hitos e insignias, reto diario, misiones y logros (funciones puras; no cambian las reglas).
- `packages/engine/test/golden.test.ts` + `golden.json`: prueba dorada de las partidas normales.
- `apps/client/`: la web (juego, onboarding, rankings, perfil).
- `apps/api/`: el backend; contrato en [`api.md`](api.md).
- `legacy/`: el juego original (v6) en HTML/CSS/JS.
