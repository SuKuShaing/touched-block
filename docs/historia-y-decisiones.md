# Historia y decisiones

Cronología del proyecto y el motivo de cada decisión técnica. Las decisiones de **reglas del juego** (v1–v8) están con más detalle en [`reglas-y-balance.md`](reglas-y-balance.md#3-decisiones-de-diseño-historial-cronológico).

Autores: José Pinilla y Sebastián Sanhueza (el usuario con quien se trabaja en Claude Code), con Claude.

---

## Etapa 1: el juego original (antes de nov 2026)

- Un solo `index.html` + `style.css` + `game.js`, sin librerías, publicado en GitHub Pages (`https://sukushaing.github.io/touched-block/`). Hoy vive en `legacy/` solo como referencia.
- Se llamaba "Rompe el bloque"; pasó a llamarse **Touched Block** (el nombre queda en inglés, todo lo demás en español).
- Las reglas evolucionaron de v1 a v6 jugando: más bloques a la vez, vidas, trampas cada vez más sutiles (bomba → bloque negro → solo el número en rojo) y castigo ×5 por bloque escapado.
- Récord e historial solo en `localStorage` (`tb_best1`, `tb_hist1`).

## Etapa 2: web con cuentas y rankings (9 nov 2026)

### Lo que pidió el usuario

- Rankings **Tú / País / Mundial / Amigos** con filtros **semanal / mensual / anual / histórico**.
- Login con Google (y Apple más adelante), con un **nombre de usuario** único y editable.
- **Compartir** el logro en redes e **invitar amigos**.
- Preguntó si NestJS + Expo eran la mejor opción.
- A mitad de la conversación aclaró: **primero web** (la gente que recibía el link de GitHub Pages pedía registrarse) y, si le va bien, app móvil con el mismo código. Mismo backend para web y móvil.

### Decisiones y su porqué

**Expo Router con web primero (react-native-web)**, en vez de seguir con JS a mano.
- Permite pasar a Android/iOS reutilizando casi todo (pantallas, juego, API, login). Solo cambian módulos puntuales (`*.native.ts`).
- Costo aceptado: la web pesa más (~2 MB de JS, ~600 KB comprimido) y los estilos se escriben con `StyleSheet`.
- El usuario lo eligió explícitamente sabiendo eso.

**El juego se dibuja con `View` + Reanimated, no con Skia.** Skia en la web carga ~3 MB de WASM; para bloques rectangulares con texto no hace falta.

**NestJS + PostgreSQL + Prisma.** NestJS fue preferencia del usuario. Postgres porque los rankings son consultas ordenadas con índices compuestos (período, país, puntaje). Prisma 7 usa `@prisma/adapter-pg` y `prisma.config.ts`.

**Motor determinista compartido (`packages/engine`) y validación por *replay*.**
- Problema: si el cliente envía su puntaje, cualquiera lo falsifica.
- Solución: el servidor entrega la semilla, el cliente registra cada toque como `[tick, x, y]` y el servidor **repite la partida** con el mismo motor. Solo acepta el puntaje si da exactamente lo mismo.
- Para que eso funcione, el motor no puede usar `Math.random`, `Date` ni funciones de `Math` que varíen entre motores JS (sin, cos, pow…). Usa PRNG mulberry32 y un paso fijo de 1/60 s. Los toques se redondean a 0,1 px.
- Consecuencia: **las reglas viven solo en el motor**. El cliente dibuja a partir de los eventos (`drainEvents`) y no decide nada.
- Además del replay: límites de toques por segundo, partida enviada antes de 2 h y duración compatible con el reloj real (+5 s). Detalle en [`api.md`](api.md).

**Modo invitado.** El usuario quería que se pudiera entrar y jugar al tiro.
- Cada partida pide igual una semilla al servidor (`POST /runs` sin sesión) y recibe un `claimToken`.
- Al terminar se ofrece iniciar sesión. Si lo hace dentro de 1 h, la partida se **reclama** y entra al ranking. Si sigue como invitado, queda solo en el historial local, con aviso.
- Si la API no responde, se juega con semilla local (no rankeable).
- Una partida reclamada usa 5 corazones, así que no da ventaja.

**Invitaciones con "¿Quién te invitó?"**, idea del usuario.
- Un link de invitación pierde la trazabilidad al pasar por la Play Store o la App Store. Por eso el invitado escribe en su perfil el **nombre de usuario** de quien lo invitó: solo por nombre de usuario, una sola vez y nunca uno mismo.
- Quien invitó gana **+1 corazón por invitado, hasta 8** (5 de base). Ambos quedan siguiéndose.
- Sin reglas antiabuso: el usuario dijo que el tope de 8 basta porque "la idea es que sea un juego casual".

**Seguir sin aceptación**, por nombre de usuario. Alimenta la pestaña Amigos.

**País** tomado de la región del navegador y editable una vez cada 30 días (el primer cambio es libre). Se guarda desnormalizado en los récords para que el ranking por país sea una sola consulta.

**Sesión con *tokens*, no cookies.**
- La API vive en otro dominio que `github.io`, y Safari bloquea las cookies entre sitios.
- El JWT de acceso (15 min) vive en memoria. El *refresh token* rotativo vive en `localStorage`, y la base solo guarda su hash sha256.
- Es aceptable para un juego. Con un dominio propio se podría pasar a cookies.

**Login solo con Google al principio** (Google Identity Services en la web). `POST /auth/apple` ya está hecho con `jose` + JWKS de Apple, pero no se usa hasta la app iOS: Apple en la web exige dominio propio.

**Seguir en `github.io`, sin dominio propio** (decisión del usuario).
- La web se exporta como SPA (`output: "single"`, `baseUrl: "/touched-block"`) y el workflow copia `index.html` a `404.html` para que las rutas funcionen en Pages.
- Las páginas legales son HTML estático en `apps/client/public/`, no rutas de Expo: así responden 200 y se leen sin JavaScript (las revisa Google).

**Rankings con la tabla `BestScore`.**
- Una fila por usuario, período y versión de reglas. Los períodos van en UTC: semana ISO `2026-W45`, mes `2026-11`, año `2026` y `all`.
- Desempate: más destruidos, luego menos escapados, luego quien lo logró antes.
- Su clave incluye `rulesVersion`: al cambiar las reglas, los rankings parten de cero solos, sin borrar datos.

**Datos del servidor con TanStack Query.**
- Las claves incluyen el id del usuario (o `guest`), así que al entrar o salir se vuelven a pedir.
- Después de jugar, seguir a alguien o cambiar de país se invalidan `lb`, `myRuns`, `me` y `profile`.
- En los rankings, `placeholderData: keepPreviousData`: al cambiar de filtro se ve la lista anterior atenuada en vez de un spinner.

**Onboarding** (pedido del usuario al revisar el plan).
- Una slide por característica, con una animación que muestra lo que dice el texto. Usa los mismos componentes del juego para que se vea idéntico.
- Aparece **solo la primera vez en cada dispositivo** (`tb_onb1`). Se repite **únicamente** desde el Perfil, no desde el inicio.
- **Cambio (10 nov 2026): dos tutoriales.** El usuario sintió que era mucha información de una vez. El **básico** (slides 1–5 y combos, + invitar/ranking con cuentas) explica la dinámica y se abre en la 1.ª visita; en la 2.ª se va directo a jugar; el **avanzado** (operaciones, restas ≤ 0, solo positivos) se abre en la 3.ª. Una visita nueva = volver tras 30 min sin actividad, contado también al volver a una pestaña que quedó abierta (`visibilitychange`); recargar no cuenta. Nunca se abre en medio de una partida.
- En el Perfil, "Ver tutorial de nuevo" muestra el básico; si ya vio los dos, muestra el **completo** (básico y después avanzado, `?nivel=completo`), pedido del usuario el 10 nov 2026.
- Los números del texto salen de las constantes del motor.
- Con movimiento reducido se muestra un cuadro fijo.

**Favicon en PNG.** El SVG no se ve en todos los navegadores (Safari/iOS), así que se generaron `favicon-32.png`, `favicon-192.png` y `apple-touch-icon.png` (180 px, fondo cuadrado).

### Balance: el motor v2 (decisión de reglas v7)

Al diseñar la validación se notó que, pasados ~90 s, la dificultad se estancaba: un bot perfecto **nunca perdía**. El usuario diseñó la progresión:
- Números hasta 10.
- Sumas y restas hasta "10+10", luego multiplicaciones hasta "5×5" y divisiones exactas con ÷.
- Las restas ≤ 0 son trampa.
- Combos de 3/5/10/15/20 bloques seguidos.
- Etapa final con bloques que duran 4 → 1 s.

Ahora un bot que toca 10 veces por segundo pierde a los ~8–9 min. Detalle en `reglas-y-balance.md`.

### Despliegue del backend

- El usuario tiene un **VPS con Dokploy**. Cada **tag de git** `vX.Y.Z` corre un workflow de GitHub Actions: tests, imagen Docker en GHCR y llamada a la API de Dokploy.
- Primero se planeó como una "Application" de Dokploy más una base de datos creada aparte.
- **Cambio (9 nov 2026):** el usuario quería que Dokploy "cree la base de datos y la deje conectada al backend". Se pasó a un servicio **Compose** (`deploy/docker-compose.yml`) con la API y Postgres juntos:
  - La base se crea sola la primera vez y la API aplica las migraciones al arrancar.
  - Las variables se pegan desde `deploy/.env` (ignorado por git) en la pestaña Environment.
  - La API usa `pull_policy: always`, para bajar la `:latest` recién publicada.
  - La base se llama `tb-db`, para no chocar en DNS con otros servicios `db` del VPS.
  - Sin puertos publicados.
- Detalle en [`despliegue.md`](despliegue.md).

### Primera prueba en producción (10 nov 2026)

- **Conexión en frío.** El cliente esperaba a lo más 1,5 s la semilla de `POST /runs` antes de empezar con una local. En frío (DNS + TLS + *preflight* de CORS) la primera llamada tardaba ~1,5 s, así que la primera partida quedaba "Sin conexión con el servidor"; con la conexión abierta tarda ~0,15 s. Se agregó `warmConnection()` (`GET /health` al abrir la web y al volver al inicio, como máximo una vez por minuto) y la espera máxima pasó a 3 s (`START_WAIT_MS`).
- **Borde blanco del botón de Google.** La página declara `color-scheme: dark` y el iframe de Google es claro; cuando no coinciden, el navegador pinta un fondo blanco opaco detrás del iframe. Se arregla con `color-scheme: light` en el contenedor del botón (`platform/auth.web.ts`).
- **Verificado de punta a punta en producción:** partida de invitado con semilla del servidor, 25 bloques validados por *replay* (`valid: true`, reclamable), rankings y login real con Google (el usuario ya aparece en el ranking mundial).

### Repositorio público

El usuario preguntó si el backend puede quedar *open source*. Sí:
- Los secretos nunca entran al repo (`.env` y `.env.*` ignorados, salvo los `.env.example`). Viven en Dokploy y en los *secrets* de GitHub.
- El login falso de desarrollo (`AUTH_DEV_FAKE`) se ignora con `NODE_ENV=production`.
- El Client ID de Google **no** es secreto: va dentro de la web.
- La base de datos nunca se expone a internet.

### Motor v3 (decisión de reglas v8, 9 nov 2026)

- El castigo por escape pasa a depender de la **etapa** y no del tipo de bloque: ×5 / ×6 / ×7.
- Se agregó una slide propia que explica por qué una resta ≤ 0 es trampa.
- Se subió `RULES_VERSION` a 3 y las claves locales a `tb_best3`/`tb_hist3`, porque la v2 ya estaba publicada.

### Motor v4: corazón de recuperación (decisión de reglas v9, 10 nov 2026)

- El usuario pidió una forma de ganar vidas. Se le preguntó y eligió: cada racha múltiplo de 25 (25, 50, 75…), solo si falta algún corazón; no afecta la racha (ni al tocarlo ni al perderlo); no ocupa cupo de bloques simultáneos.
- Dura 1 s (`HEART_LIFE`), un toque. Es un `Block` con `heart: true` (sin tipo nuevo), así el replay de la API lo maneja sin cambios. Eventos nuevos: `heal` y `heartGone`.
- Se subió `RULES_VERSION` a 4 y las claves locales a `tb_best4`/`tb_hist4`.

### Motor v5: el corazón dura 2 s (11 nov 2026)

- 1 s era demasiado corto; el usuario pidió 2 s (`HEART_LIFE`). Se subió `RULES_VERSION` a 5 y las claves locales a `tb_best5`/`tb_hist5`. El texto del tutorial toma el valor de la constante.

### Plan de jugabilidad y retención (12 nov 2026)

El usuario preguntó cómo hacer que la gente vuelva a jugar y comparta. De la conversación salió [`plan-jugabilidad.md`](plan-jugabilidad.md), con seis fases. Decisiones del usuario y su motivo:

- **La base de datos solo crece.** Se puede modificar, pero manteniendo o aumentando lo que hay; ninguna migración borra datos de jugadores.
- **Las partidas de invitado se siguen borrando a las 24 h** y no se agrega un identificador por dispositivo. Costo aceptado: solo se puede medir con detalle a las cuentas.
- **Insignias de madera, bronce, plata, oro y diamante** (idea del usuario), atadas a las etapas del juego y ajustables con datos reales. Se calculan a partir de la duración de la mejor partida; no se guardan.
- **El campo de los retos se ajusta a la pantalla más chica** (idea del usuario): los celulares ya envían su tamaño y el servidor determina el campo. Se implementa como el percentil 5 de los tamaños reales, no el mínimo, para que una ventana minúscula no achique el campo de todos. En el reto a un amigo el campo se fija al crearlo, porque quien lo crea juega antes de que se conozca la pantalla del otro.
- **Las partidas de reto no cuentan para el ranking general ni el récord**: una misma semilla se puede repetir y practicar.
- **El reto diario cambia a la medianoche de cada jugador** (en UTC, en Chile cambiaría a las 21:00), con 3 intentos con cuenta y 1 como invitado.
- **La paleta para daltónicos es gratis** y cumple la misma regla de contraste que las demás, para que ninguna paleta haga más visibles las trampas.
- **Respaldos de la base antes de publicar la fase 2**, que es cuando se empieza a guardar progreso de los jugadores.
- El modo normal no cambia: sigue usando la pantalla completa de cada celular.

### Implementación del plan de jugabilidad (12 nov 2026)

Se implementaron las fases 1 a 5 del [plan](plan-jugabilidad.md) en una sola sesión, con agentes en paralelo (motor, API, cliente) y revisiones independientes. Se publicaron el mismo día (API `v0.3.0` y web). Decisiones tomadas al implementar, con su motivo:

**Motor**
- **Prueba dorada antes de tocar nada**: 40 partidas de un bot (20 semillas × 2 campos) generadas con el motor v5 sin modificadores; después de agregar los modificadores sigue pasando sin regenerarse. Una revisión aparte compiló el `game.ts` anterior (de `git`) y confirmó que da los mismos 40 resultados.
- **Modificadores**: un solo reloj de dificultad, `difficultyTime(s) = s.played + startAt`, en todas las curvas; sin modificadores es `x + 0 === x`, así que no cambia nada. `validateMods` rechaza claves desconocidas para que el servidor nunca repita una partida ignorando un modificador que el cliente sí usó. `mods.lives` reemplaza a `maxLives` en la configuración (el tope del corazón también).
- **Misiones de tipos distintos** cada día (evita "Racha de 10" y "Racha de 25" juntas).
- **Racha de días**: una fecha posterior a "hoy" (por la zona horaria) mantiene viva la racha.

**API**
- **Todas las migraciones agregan** (4 del plan y 1 de índice); ninguna borra ni reescribe datos. El relleno de `UserStats` usa las partidas válidas de todas las versiones de reglas, como el SQL del plan.
- **Columnas extra** (aditivas): `Challenge.creatorRunId` y `ChallengeEntry.isCreator` (saber quién creó el reto aunque sea invitado), `MissionReward.reward`, y `DailyEntry.runId` opcional (si se borra la partida, queda el resultado).
- **Reto a un amigo**: cuenta el primer resultado **válido** de cada cuenta (las partidas abandonadas o rechazadas no bloquean). Si al reclamar la cuenta ya tenía un resultado en ese reto, queda el más antiguo.
- **Insignia** `null` solo sin partidas válidas; quien solo jugó retos queda en Madera I.
- **Porcentaje del reto diario**: con un solo jugador vale 0; para un invitado, el total lo incluye. Con menos de 10 jugadores en el día, el mejor porcentaje guardado para el logro es 0 (solo participación), para que un día casi vacío no regale el logro máximo.
- Las copias de resultados de invitados en `ChallengeEntry` se conservan (plan 3.3: las partidas de invitado se borran a las 24 h y el reto sigue mostrando el resultado). No tienen datos personales.

**Cliente**
- **Franja de avisos fuera del campo**: la regla "un aviso a la vez, nunca sobre un bloque" se cumple poniendo todos los avisos (hito, récord, amigo, combo, racha cortada) en una franja bajo la barra de tiempo, que no recibe toques. Costo: el campo de la partida normal es unos 22 px más bajo (el tamaño de bloque no cambia en celulares, porque depende del ancho).
- **Inicio**: "Jugar" queda primero y después la única tarjeta (reto de hoy con misiones, o instalar); ícono de sonido arriba a la izquierda, también en la pantalla final.
- **Avisos de amigos**: solo de los amigos que todavía no superaste esta semana, para no repetir lo mismo en cada partida. "Te faltaron N bloques para tu récord" usa lo necesario para superarlo (récord − destruidos + 1).
- **Web instalable sin service worker**; un script corto en `index.html` guarda `beforeinstallprompt` apenas llega, porque las pantallas se cargan por partes. Chrome la reconoce como instalable sin errores.
- **Regla de no ventaja de las paletas ampliada al tono**: la primera versión solo comparaba contraste de luminancia, pero el texto rojo de la trampa se distingue sobre todo por el tono. Con solo luminancia, Diamante y Alto contraste quitaban el caso difícil de la Clásica (ventaja) y Dorado dejaba todas las trampas difíciles (castigo injusto a un premio de Oro). Ahora el test exige el rango de tono de la Clásica, un caso tan difícil como el suyo y una media cercana; Dorado, Diamante y Alto contraste se rediseñaron.
- **Estadísticas locales**: antes de escribir `tb_stats1` se vuelve a leer (otra pestaña pudo guardar más) y, si está dañado, se reconstruye desde el historial en vez de partir en cero. Las claves del récord pasaron a `lib/historyKeys.ts` (sin cambiar su valor) para cortar un ciclo de imports.
- **Retos**: después de un reto, "Jugar de nuevo" empieza una partida normal (la revancha tiene su botón). El reto pendiente durante el tutorial se guarda en `tb_reto1` (2 h). El parámetro `reto` se borra de la URL al usarlo.
- **Reto diario**: el intento de invitado se cuenta por dispositivo, también los empezados con cuenta (cerrar sesión no da intentos nuevos). Después de un reto, el botón principal es "Otro intento (quedan N)" mientras queden. `?diario=1` en la primera visita abre el tutorial y después la tarjeta con sus reglas: el intento se gasta solo con "Empezar", para que un jugador nuevo no pierda su único intento sin querer. Las celdas de compartir cuentan la dificultad alcanzada (con `startAt`). "Ayer ganó…" se muestra una vez por dispositivo, también a quien no jugó ayer.
- **Correcciones de la revisión del cliente**:
  - Durante 450 ms después de terminar se ignoran los botones que empiezan otra partida ("Jugar de nuevo", "Probar ahora", "Retar a un amigo", "Revancha"), para que quien estaba tocando bloques no se salte la pantalla final sin querer (`game/endGuard.ts`).
  - Con sesión, la partida se suma también a las estadísticas de la cuenta al calcular qué se desbloqueó, y el camino de etapas usa como mejor previa el máximo entre el dispositivo y la cuenta (si no, en un dispositivo nuevo felicitaba por hitos ya alcanzados).
  - En los retos el camino no muestra "tu mejor" ni "¡Llegaste a…!", porque no cuentan para la insignia (D6). Con `startAt` usa la dificultad alcanzada; con `only` se omite, porque los hitos no se cumplen en esa partida.
  - "Retar a un amigo" aparece desde la 2.ª visita (desde el 12 nov 2026, también con la 3.ª partida: ver "Desbloqueo por partidas"), salvo que el jugador haya llegado por un enlace de reto (regla del jugador nuevo).
  - Un reto cuya respuesta no trae un campo válido no empieza (antes usaba el tamaño de la pantalla y el servidor la habría rechazado).
  - La misión "Juega el reto del día" premiada en el dispositivo y otra vez en la cuenta al reclamar no se suma dos veces: la Colección toma el máximo de ambos, no la suma.

### El mejor porcentaje del reto diario se guarda al cerrar el día (12 nov 2026)

- El logro "Mejor resultado en un reto diario" usa `UserStats.bestDailyPct`, que se queda con el mayor valor guardado. La primera versión lo guardaba al leer el resumen de "ayer" en `GET /daily`, pero ese día todavía se está jugando en otras zonas horarias (la ventana acepta fechas hasta un día después de la UTC): pidiendo `GET /daily` con la fecha de mañana se guardaba el porcentaje de hoy a media jornada, inflado para siempre. Pasaba también sin querer a quienes viven en UTC+10 a +14.
- Ahora se guarda solo cuando el día **cerró** (su fecha salió de la ventana, más 2 h para terminar partidas y 1 h para reclamarlas: con la ventana de abajo, el del 12 cierra el 13 a las 15:00 UTC), revisando al leer `GET /daily` los días jugados de la semana anterior. Costo aceptado: el logro aparece un día después, y un día que el jugador no revisa en la semana siguiente no cuenta. Como dice el plan (5.3), "al cerrar cada día".

### Reto diario: ventana de fechas, reclamos de invitado y limpieza (12 nov 2026)

Correcciones de la revisión de las fases 2 a 5, pedidas por el coordinador:

- **Ventana de fechas por zonas horarias reales.** El plan decía "a no más de un día de la fecha UTC", pero así, entre las 00:00 y las 10:00 UTC, el servidor entregaba la semilla de una fecha que todavía no empezaba en ningún lugar (en UTC+14 aún era el día anterior), y un invitado podía practicarla sin límite; además, una cuenta podía jugar ayer, hoy y mañana el mismo día real y sacar una racha de 3 días al instante. Ahora la fecha D se acepta solo si alguna zona real (UTC−12 a UTC+14) está en D: `D 00:00 UTC − 14 h ≤ ahora < (D+1) 00:00 UTC + 12 h`. D7 sigue igual: un jugador con el reloj bien puesto siempre está dentro. Vale para `POST /runs` diario, `GET /daily` y `GET /missions`; `GET /daily/leaderboard` acepta además las fechas pasadas (no las que todavía no empezaron). Riesgo que queda: quien finge estar en UTC+14 recibe la semilla hasta 14 h antes que UTC (inevitable con D7).
- **Reclamar una partida diaria de invitado.** Antes se podía reclamar mientras la cuenta tuviera menos de 3 intentos: jugando N partidas de invitado (misma semilla, sin límite en el servidor) se reclamaban las 3 mejores. Ahora el intento de invitado (1, D8) pasa a ser el **primero** de la cuenta: se reclama solo si la cuenta todavía no empezó el reto de esa fecha, así que hay como máximo una partida diaria reclamada por cuenta y fecha, y después quedan 2 intentos con la cuenta. Si no, `409 daily_attempts_exhausted`. Sigue siendo posible practicar como invitado (riesgo aceptado en el plan).
- **Intentos abandonados de una cuenta**: se borran a las 72 h (antes, nunca). Para entonces su fecha ya cerró, así que no se recupera ningún intento.
- **`GET /daily` trae `week`**: las fechas jugadas en los 7 días que terminan en `date`, para la tira de la semana de la pantalla final.
- **Índice en `Challenge.creatorRunId`** (migración `add_challenge_creator_run_index`, solo agrega el índice): al reclamar una partida de reto se buscaba el reto por ese campo recorriendo toda la tabla.
- **Riesgo conocido, sin cambio**: en `GET /missions` el cliente elige la fecha y la zona horaria, así que unas mismas partidas pueden contar para las misiones de hasta 3 fechas (más `bonusXp`). Solo afecta el nivel, que es cosmético; arreglarlo exige asignar cada partida a una sola fecha local al terminarla.

### Decisiones antes de publicar el plan (12 nov 2026)

- **Valores provisorios confirmados tal cual** por el usuario: umbrales de las insignias, catálogo de premios, nivel `25·n·(n−1)`, misiones y logros. Se vuelven a medir con jugadores reales (los umbrales se mueven sin migraciones).
- **Jueves del reto diario**: "solo multiplicaciones y divisiones" ahora también parte en su dificultad (`startAt: MUL_START`). Sin eso eran unos 275 s de "2×2", largo y fácil.
- **Respaldos en el mismo VPS** (D10), porque el usuario no quiere pagar otro servicio: `pg_dump` diario con una tarea programada de Dokploy, en `/var/backups/touched-block/`, guardando los 14 más recientes. El respaldo diario del proveedor del VPS se lleva esos archivos fuera del servidor; el `pg_dump` sirve para volver solo esta base a un momento exacto, como justo antes de una migración. Detalle en `despliegue.md`.
- **Cómo se cargó `DAILY_SECRET` en Dokploy**: la herramienta de Dokploy que usa Claude oculta el Environment, y guardarlo desde ahí reemplaza el bloque entero, con riesgo de pisar las contraseñas. Por eso un script local lo leyó por la API de Dokploy, comprobó que las otras variables eran idénticas a `deploy/.env`, agregó solo la línea nueva y verificó el resultado, sin mostrar ningún valor. El Compose exige la variable (`${DAILY_SECRET:?…}`), así que el primer despliegue del tag, que corrió antes de cargarla, falló sin tocar los contenedores que estaban en uso.
- **Pruebas que no hacen falta ahora**: instalar la web en un Android real no es necesario, porque la web es para afinar el juego con amigos; quienes la instalen lo harán cuando sea app. iOS/Safari lo prueba el usuario en un iPhone antiguo. El login real de Google ya se probó en la versión anterior y no cambió.

### Desbloqueo por partidas, con aviso (12 nov 2026)

- **Qué pasó**: el usuario probó la web publicada en su iPhone 11 (iOS 26.5): todo funcionaba, incluido el login con Google y la misma cuenta que usa en Android, pero en el iPhone no le aparecían el reto de hoy ni las misiones. Era la regla del jugador nuevo: se mostraban desde la 2.ª visita, y las visitas se cuentan **por dispositivo** (una visita nueva es volver después de 30 min sin actividad). Por mucho que jugara seguido, el iPhone seguía en la 1.ª.
- **Decisión del usuario**: que una cuenta que ya jugó los vea en cualquier dispositivo, y que un jugador nuevo sepa que **jugar desbloquea cosas** ("te falta jugar 2 partidas más…").
- **Cómo quedó** (`lib/daily.ts`: `dailyVisible`, `runsToUnlock`, `playedRuns`; `components/UnlockHint.tsx`): el reto del día, las misiones y "Retar a un amigo" se desbloquean en la **2.ª visita o con la 3.ª partida** (`DAILY_FROM_RUNS = 3`), lo que llegue primero. Las partidas que cuentan son las del dispositivo o las de la cuenta (`stats.totalRuns`), la mayor; así la misma cuenta en un celular nuevo los ve al tiro. La 1.ª partida sigue siendo solo para jugar: el aviso sale después de ella, en el inicio y en la pantalla final ("Te faltan 2 partidas para desbloquear el reto del día y las misiones", con ●○○). La partida que los desbloquea dice "¡Desbloqueaste el reto del día y las misiones!" y muestra ahí mismo la tarjeta del reto y las misiones, porque después de una partida el jugador sigue en la pantalla final y el inicio solo vuelve al recargar.
- Se mantuvo la 2.ª visita como otra vía (quien ya los veía no los pierde). La tarjeta de instalar y el tutorial avanzado siguen contando solo visitas, porque son cosas del dispositivo.
- Antes se pensó en reconocer una cuenta "que ya jugaba" por su fecha de creación; se descartó porque contar partidas resuelve ese caso y además le da al jugador nuevo una meta visible.
- **Una vez desbloqueados, quedan así en el dispositivo** (16 nov 2026, tras una revisión de código; decisión del usuario). Como las partidas de la cuenta solo cuentan con la sesión abierta, al cerrarla el reto, las misiones y "Retar a un amigo" volvían a bloquearse y reaparecía "Te faltan 2 partidas". Ahora el primer desbloqueo, por visita o por partidas, se guarda en la clave local `tb_unlock1` (`rememberUnlock` / `useUnlockRemembered` en `lib/daily.ts`), y `dailyVisible` lo respeta. Es una clave nueva y no reinicia ningún registro.
- En la misma revisión, la celebración "¡Desbloqueaste…!" pasó a calcularse **al terminar la partida** (`end.unlockedByRun`). Solo se muestra si seguía bloqueado al empezar y es esa partida la que llega a las 3, contando las de la cuenta. Antes podía aparecer por una visita nueva o por una sesión que cargaba con la pantalla final abierta. Si la partida que desbloquea es un reto del día, no se repite la tarjeta del reto, porque ya están su resultado y "Otro intento".

### App Android (16 nov 2026)

El usuario y varios amigos ya habían probado la web y pidió pasarla a **app móvil**, manteniendo la web y aprovechando la **vibración** del teléfono. Se probó en el emulador de Android (no hay Mac, así que iOS queda para después). Criterio de terminado: la app y la web en un navegador de tamaño celular se ven y se juegan casi igual en todas las pantallas.

Decisiones y su porqué:
- **Identificador `app.touchedblock`** (Android y, más adelante, iOS): es el dominio `touchedblock.app` que compró el usuario, escrito al revés. Queda fijo para siempre al publicar en Google Play.
- **Mismo código, Expo con CNG**: la carpeta `apps/client/android` se genera con `expo prebuild` y está en `.gitignore`. Todo lo nativo se configura en `app.json` y en los *config plugins* de `apps/client/plugins/`.
- **Sonido con `react-native-audio-api`**: implementa la Web Audio API, así que los pitidos son el mismo grafo de osciladores que en la web (`fx.web.ts`) y suenan igual, sin archivos de audio.
- **Vibración con `expo-haptics`**: los toques cortos usan los motores hápticos del teléfono (más nítidos que encender el motor N ms) y los largos (trampa, fin) siguen con `Vibration.vibrate(ms)`. El mapeo está comentado en `platform/fx.native.ts`.
- **Almacenamiento síncrono con `expo-sqlite/kv-store`**: la interfaz `Storage` es síncrona y se usa al cargar los módulos. Mismas claves que en la web, así que la lógica de récords no cambia.
- **Login con Google nativo** (`@react-native-google-signin/google-signin`) configurado con el **Client ID web** como `webClientId`. Así el idToken trae la misma audiencia que en la web y la API no cambia. Google exige además clientes OAuth de tipo Android en el mismo proyecto: se crearon dos, uno con la huella SHA-1 de la clave debug y otro con la de release.
- **Clave de firma release fuera del repo** (`~/.touched-block/`, el repo es público). Ver `despliegue.md`.
- **Compartir en Android**: la hoja del sistema no acepta imagen y texto juntos, así que se copia el texto con el enlace al portapapeles, se avisa con un toast y luego se comparte la imagen (la misma tarjeta de 1080×1080 que en la web, dibujada con `View` y capturada con `react-native-view-shot`).
- **Hermes no trae `Intl.DisplayNames`**: los nombres de países en español van en una tabla para nativo (`platform/locale.native.ts`).
- **Rutas largas de Windows**: con pnpm, las librerías nativas viven en rutas como `node_modules/.pnpm/<paquete>_<hash>/node_modules/<paquete>/android/...`, y el C++ de varias (screens, worklets, audio-api, gesture-handler) pasaba de 260 caracteres. El ninja del SDK no las abre ("build.ninja still dirty", "Filename longer than 260 characters"). No se activaron las rutas largas de Windows (es una configuración del sistema y el ninja 1.10 del SDK igual no las usa). Se resolvió en el proyecto:
  - `virtualStoreDirMaxLength: 30` en `pnpm-workspace.yaml`, que acorta los nombres de `.pnpm`;
  - `plugins/withShortCxxPath.js`, que compila el C++ en `~/.tbcxx/<hash>/<hash>` con `CMAKE_OBJECT_PATH_MAX=250`, y genera el codegen de google-signin en `android/build/gsi`;
  - `react-native.config.js`, que le indica al autolinking dónde quedó ese codegen.
- **APK instalable primero**: la Play Store queda para después (cuenta de desarrollador, EAS Submit).

Diferencias que aparecieron al comparar pantalla por pantalla (web a 412×915 contra el emulador) y cómo se igualaron:
- **Corazones**: en Android "♥" se dibuja como emoji a color, sin respetar el color del texto, y los corazones perdidos no se veían grises. En nativo se usa "♥" seguido del selector de texto U+FE0E (`components/heart.ts`).
- **Número grande del panel final**: Android lo recortaba por arriba (tamaño 40 dentro de una línea de 24). Ahora tiene espacio arriba solo en nativo.
- **Enlace del reto**: en Android un `Text` seleccionable ignora `numberOfLines`. En nativo ya no es seleccionable; para eso está "Copiar enlace".
- **Fila "instalar la app" del Perfil**: en la app no se muestra.
- **Toques durante la sacudida**: la web mide el campo en cada toque, sacudida incluida. En nativo el origen se mide al cambiar de tamaño, así que ahora se descuenta el desplazamiento actual de la sacudida (`offsetX` de `useFieldTaps`).
- Se verificó que una partida jugada en la app la **valida el servidor** (`valid: true`), tanto normal como de reto, y que los toques caen al píxel.
- **Misma tipografía en todos lados**: la web usaba la fuente de cada sistema (Segoe UI en Windows, San Francisco en iOS) y la app usa Roboto, así que los pesos y los saltos de línea se veían distintos. Ahora la web carga Roboto variable (`platform/webFont.web.ts`). Son dos woff2 en `src/assets/fonts`, con licencia SIL OFL: latín, de ~43 KB, y latín extendido, de ~29 KB, que solo se baja si hace falta. Se registran con `FontFace` porque Metro no empaqueta los `url()` de un CSS. La tarjeta para compartir de la web usa la misma fuente.
- **Roboto incluida en el APK** (16 nov 2026): al instalar la app en un Motorola Edge 60 Pro se vio que la fuente del sistema **no** es Roboto en todas las marcas (Motorola trae otra, más redonda), así que el texto no se veía como en la web. La app ahora lleva su propia Roboto variable (`src/assets/fonts/roboto-variable.ttf`, la Roboto 3.015 de Android, SIL OFL, ~2,3 MB, pesos 100–900), registrada como familia "Roboto" con el plugin `expo-font` (un `<font>` por peso 400–900 con `fontVariationSettings`). Para no tocar los ~30 archivos que usan `Text`, `metro.config.js` hace que el código de `src/` en Android importe `platform/rnText.android.tsx` en vez de `react-native`: reexporta todo igual, pero su `Text` y `TextInput` llevan `fontFamily: Roboto` (un `fontFamily` explícito sigue mandando). Los `Animated.Text` de Reanimated (bloque, reloj, racha) no pasan por ahí y usan `APP_FONT` de `components/appFont.ts` en su estilo. La web no cambia.
- **Ícono propio para celulares** (17 nov 2026): el ícono adaptable usaba el mismo dibujo de la web (un cuadrado azul con sombra sobre fondo `#12121a`). Cada launcher lo recorta con su forma (círculo en Pixel, squircle en Motorola) y a distinta distancia, así que el borde oscuro se veía cortado. Se pensó en achicar el cuadrado, pero seguiría siendo un cuadrado dentro de otra forma, con un marco oscuro de grosor desigual y un ícono más chico que los demás. Se eligió un fondo azul completo con el "3" y la barra de tiempo en blanco: la forma de botón la pone el sistema. El fondo tiene un degradado vertical suave (`#2aa6ff` → `#0091ff` → `#0074d6`) para que se lea como botón con volumen. El "3" y la barra se centraron midiendo la tinta del glifo; la primera versión tenía la barra corrida a la izquierda y el conjunto un poco bajo, y se notaba en el teléfono. Es solo para la app (Android e iOS): la fuente está en `apps/client/assets/icono/icon-movil.svg` y los PNG se exportan desde Chrome. Son `android-background.png` (el degradado), `android-foreground.png` (transparente, usado también como ícono monocromático) e `icon-movil.png` (opaco, para iOS y Android antiguo). La web (favicon, `icon-512`, `icon-maskable-512` y `apple-touch-icon`) sigue con el dibujo original, porque ahí se ve bien (pedido del usuario).
- **Revisión de código de la app** (17 nov 2026): una revisión adversarial de los dos commits de la app encontró 14 problemas, todos corregidos. Los no obvios:
  - `metro.config.js`: `appFont.ts` también recibe el `react-native` real. Si recibía el sustituto, el sustituto y `appFont.ts` se importaban entre sí y `Platform` podía quedar sin definir al cargar.
  - Firma de release:
    - Si faltan solo algunas claves `TB_UPLOAD_*` o el keystore no existe, el build **falla**. Antes quedaba firmado con la clave debug sin avisar.
    - Si no hay ninguna clave, sigue firmando con debug, pero lo avisa.
    - Una ruta relativa al keystore se toma desde `~/.touched-block`.
    - El bloque del plugin se reemplaza en cada `prebuild` en vez de saltarse si ya estaba.
  - La tarjeta de Android se guarda como `touched-block-<hash>.png`, se borran las viejas (quedan las 2 últimas) y no se comparte si la pantalla ya se cerró.
  - La web espera a que cargue Roboto (máximo 1,5 s) antes de dibujar la tarjeta.
  - "Borrar cuenta" también cierra la sesión de Google en el teléfono.
  - El botón de Google nativo se desactiva mientras hay un login en curso.
  - El país del navegador ya no toma por región un subtag de script o variante (p. ej. `es-419`, `zh-Hant`).
  - Lección de esa prueba: después de cambiar `metro.config.js` hay que reiniciar Metro con `--clear`. Un Metro viejo seguía sirviendo la resolución anterior y la app fallaba con "Cannot read property 'OS' of undefined".

### Dominio propio touchedblock.app, landing, plataforma, medallas y celebraciones (17 nov 2026)

El usuario compró `touchedblock.app` en Cloudflare y pidió: landing en la raíz, juego en `web.`, API en `api.`, que GitHub Pages redirija a los jugadores antiguos, una columna para separar móvil de PC, medallas rediseñadas y una celebración al ganar premios. Se hizo con subagentes en paralelo (landing, plataforma, medallas, dominio, celebración) y una revisión de código posterior.

**Hosting**
- Landing y juego en **Cloudflare Workers con activos estáticos** (`apps/landing/wrangler.jsonc`, `apps/client/wrangler.jsonc`): gratis, CDN, el dominio ya está en Cloudflare y los dominios propios (`custom_domain`) crean solos su DNS. El juego usa `not_found_handling: single-page-application`; la landing, `404-page`.
- La landing tiene un Worker mínimo (`src/worker.js`) solo para redirigir `www.` a la raíz con 301; corre antes que los activos (`run_worker_first`).
- La API sigue en Dokploy; `api.touchedblock.app` es un registro A **sin proxy** de Cloudflare (nube gris) para que Traefik obtenga el certificado de Let's Encrypt directo. El dominio viejo `vps23906.cubepath.net` **se mantiene**: el APK ya repartido apunta ahí.
- Token de Cloudflare con permisos mínimos (Workers Scripts/Routes, DNS y Email Routing de la zona) creado el 17 nov 2026, guardado fuera del repo en `~/.touched-block/cloudflare.env`.
- Correo público de contacto `contacto@touchedblock.app` con Email Routing de Cloudflare (reenvía al Gmail del usuario, que no se publica). Lo eligió el usuario.

**Mudanza sin perder datos (GitHub Pages → web.touchedblock.app)**
- Los datos locales viven en `localStorage` del origen `sukushaing.github.io` y otro dominio no puede leerlos. Por eso Pages no hace un 301 ciego: publica `deploy/gh-pages-redirect/` (index.html = 404.html), que lee **una lista exacta de claves del juego** (el origen lo comparten todos los proyectos del usuario), las empaqueta en el fragmento `#tbmigrar=` (el fragmento no llega a ningún servidor) y redirige conservando ruta y parámetros.
- El destino las importa con un script inline al principio del `<head>` de `apps/client/public/index.html`, antes del bundle: nunca pisa datos del sitio nuevo, el récord y las visitas quedan con el mayor, las marcas de tutoriales vistos en `1`, y limpia el fragmento con `history.replaceState`.
- La **sesión** solo se importa si el referrer es `https://sukushaing.github.io` y no hay otra abierta, para que un enlace fabricado no deje a alguien dentro de una cuenta ajena.
- Si se agrega o renombra una clave `tb_*`, hay que actualizar las dos listas.
- Los enlaces de retos siguen por parámetro (`?reto=`), aunque el modo SPA ya respondería 200 en cualquier ruta, para no romper los enlaces repartidos.

**Páginas legales en la landing**: `/privacidad/`, `/terminos/`, `/eliminar-cuenta/` (Google Play exige una URL pública para pedir el borrado) y `/soporte/`, escritas a partir de lo que de verdad hace el código (datos de Google, retención, borrado en cascada de `DELETE /me`, permisos de Android, sin anuncios ni analítica). Las direcciones viejas redirigen ahí.

**Plataforma de cada partida (`Run.platform`)**: `app_android | app_ios | web_mobile | web_desktop`, columna opcional `VarChar(16)` (no enum, para agregar valores sin migración; sin índice, solo se usa en consultas manuales). El cliente la envía; si no viene (APK viejo, web en caché), la API la deduce del `User-Agent`. Un valor desconocido se ignora y nunca hace fallar la partida. Las partidas antiguas quedan en `NULL`. Consulta de ejemplo en `docs/api.md`.

**Medallas en SVG**: con `View` no se lograban degradados, laureles ni facetas. Se agregó `react-native-svg` (solo lo importa el archivo `.native`; en la web la medalla es un `<img>` con el SVG como data URI, sin peso extra ni choques de ids). Un mismo árbol (`cosmetics/medal.ts`) alimenta la web, la app y las tarjetas para compartir. Obliga a regenerar el APK.

**Celebración de premios**: pedido explícito del usuario, aunque el plan decía "nada de ventanas que haya que cerrar" en la pantalla final. Se mitiga con 900 ms de espera tras el resultado, toques bloqueados los primeros 600 ms y una sola ventana con los premios en secuencia. Solo se celebra lo que gana una partida en este dispositivo; lo que llega de la cuenta o de otro dispositivo, y todo lo que un jugador ya tenía al publicar esto, se registra en silencio (`tb_cele1`; los pendientes por ver en `tb_cele1p`). La fanfarria se sintetiza con `fx.beep`, como los demás sonidos.

**APK 0.2.0 (18 nov 2026, `versionCode` 3)**: el primer build release con las medallas se cerraba al abrir con `TypeError: Cannot read property 'get' of undefined`. Según el mapa de fuentes del bundle Hermes, el error está en `const K = 1 / PixelRatio.get()`, a nivel de módulo, en `ShareCardHost.native.tsx`, que se evalúa cuando expo-router carga `_layout`. Esa línea ya existía en el APK 0.1.1, que funcionaba. Lo nuevo es que antes de ella ahora se carga `TierBadge` → `MedalImage.native` → `react-native-svg`. No se encontró un ciclo de requires en el bundle y la causa exacta quedó sin aislar. Se resolvió calculando la escala al dibujar (`px()` llama a `PixelRatio.get()`). **Regla**: en el código nativo, no llamar APIs de `react-native` que lean el dispositivo (`PixelRatio`, `Dimensions`) a nivel de módulo, y probar cada APK release en el emulador antes de repartirlo: el modo desarrollo no reproduce este fallo. Además, el emulador tenía la app de desarrollo, firmada con la clave debug, y Android no instala encima un APK firmado con otra clave: hubo que desinstalarla primero. Los teléfonos con el APK 0.1.1 (misma clave de release) se actualizan sin perder datos.

### Créditos en el pie (18 nov 2026)

Pedido del usuario: "Idea del juego: José Pinilla" y "Desarrollo del juego y la web: Sebastián Sanhueza" (enlace a `https://sanhueza.pro`, en otra pestaña). Van en el pie de las 6 páginas de la landing (bajo la descripción, clase `.credits` en `site.css`) y en el pie del Perfil del juego (`components/LegalLinks.tsx`, que ya tenía los enlaces legales; el enlace usa `openExternal` de `lib/legal`: otra pestaña en la web, navegador integrado en la app). Se muestran en dos líneas, una por persona, porque a ancho de celular una sola línea con " · " se cortaba en cualquier parte; en la landing el " · " queda en el HTML solo para lectores sin CSS.

### Sonido de la web: desbloqueo en cada gesto (18 nov 2026)

El usuario reportó que en la web no sonaban los toques ni la rotura de los bloques. `fx.web.ts` creaba el `AudioContext` en el primer pitido y solo hacía `resume()` dentro de cada pitido, pero los pitidos del juego salen del `pointerdown` del campo o del `requestAnimationFrame`, y la partida que se empieza al terminar el tutorial sale de un efecto (`useFocusEffect`), no de un toque. Los navegadores solo arrancan el audio dentro de un gesto que **activa** la página (`touchend`, `pointerup`, `click`, `mousedown`, `keydown`). Un `pointerdown`/`touchstart` de un dedo no cuenta, ni en Chrome ni en iOS Safari. Si el contexto nacía fuera de un gesto, o iOS lo dejaba `interrupted` al volver de segundo plano, se quedaba suspendido y el juego no sonaba. Decisiones:
- `fx.web.ts` escucha en `window` (en captura y pasivo) esos eventos que activan la página. Mientras el contexto no esté `running`, cada uno lo crea o lo reanuda y reproduce un búfer de 1 muestra en silencio, que es el desbloqueo que exige WebKit. Así el primer toque en cualquier parte (el tutorial, "Jugar", o el `touchend` del mismo toque a un bloque) deja el audio listo, y el pitido sigue saliendo al instante en el `pointerdown`, sin latencia extra.
- El volumen se fija con `setValueAtTime(v, currentTime)` antes de la rampa, igual que en `fx.native.ts`. Con solo `gain.value = v`, algunos motores (WebKit) calculan la rampa exponencial desde el tiempo 0 del contexto, y con la página abierta un rato el pitido sale casi mudo.
- `latencyHint: 'interactive'` y `navigator.audioSession.type = 'ambient'` donde exista (Safari 16.4+), igual que la categoría `ambient` de la app en iOS: respeta el interruptor de silencio y no corta la música del jugador. **Ojo**: con el iPhone en silencio, la web no suena. Es intencional y es lo mismo que hace la app.
- Se mantienen los osciladores, sin archivos de audio, porque no hay nada que precargar y la app usa el mismo grafo.
- La **landing** (`apps/landing/public/assets/blocks.js`) no tenía sonido. Ahora copia lo mismo en JS plano (desbloqueo en cada gesto, búfer mudo, `setValueAtTime`, `latencyHint`, `ambient`) con los tonos del paquete "8 bits": toque (sube con cada toque, también en el que rompe), rotura, trampa y combo. El escape solo suena si se tocó un bloque en los últimos 8 s, porque en la página los bloques se escapan solos mientras se lee. Antes del primer gesto no se crea ningún `AudioContext`.

### Edad mínima para tener cuenta: 13 años (14 en Chile sin autorización) (18 nov 2026)

- Jugar como **invitado** sigue siendo para todo público (no se piden ni guardan datos personales). Para **crear cuenta** hay que tener al menos **13 años**; en Chile, bajo **14** se necesita autorización de la madre, padre o tutor (Ley 21.719), o la edad mayor que exija la ley del país. Un tutor puede pedir por correo que se borre la cuenta de un menor.
- Motivo: el usuario quería 10+, pero la cuenta recoge nombre y correo. En EE. UU., COPPA exige consentimiento parental verificable bajo 13, y Google y Apple exigen 13+ para cuentas propias; por eso 13 y no menos.
- En la misma pasada se agregó a la política de privacidad (pedido por Apple, guía 5.1.1(i)) que los encargados (alojamiento, Cloudflare, Google y Apple como proveedores de inicio de sesión) deben proteger los datos igual o más que la política, y una frase explícita de «No te rastreamos» (sin rastreo entre apps ni sitios, sin publicidad ni analítica de terceros, sin venta de datos: por eso la app no pide el permiso de rastreo de iOS). Páginas: `apps/landing/public/privacidad/` y `terminos/`.

### Sign in with Apple para iOS y revocación al eliminar la cuenta (18 nov 2026)

Apple exige Sign in with Apple si la app ofrece otro login social (guía 4.8) y, si se crea cuenta con Apple, revocar su token con la API REST de Apple al eliminar la cuenta (guía 5.1.1(v)).
- **Solo en iOS.** El botón aparece cuando `AppleAuthentication.isAvailableAsync()` lo confirma (`auth.appleAvailable()`, ahora una función asíncrona). En Android y en la web no se exige y no se muestra; en la web haría falta además un Services ID y un dominio verificado. El componente está separado por plataforma (`AppleSignInButton.ios.tsx` / `AppleSignInButton.tsx`, que no dibuja nada) para que la web no cargue el módulo.
- **Botón oficial** (`AppleAuthenticationButton`, ya aprobado y traducido por el sistema), estilo **blanco** porque el fondo de la app es oscuro (guía de Apple), del mismo tamaño y forma de píldora que el de Google (280×40, radio 20) y **arriba** de él.
- Se piden nombre y correo. El correo puede ser de reenvío privado (`@privaterelay.appleid.com`) y se acepta igual. El nombre solo llega en el primer inicio de sesión: se manda como `fullName`.
- **Revocación**: el cliente manda el `authorizationCode` y la API lo canjea en `/auth/token` por el refresh token de Apple. El `client_secret` es un JWT ES256 firmado con `jose` (ya era dependencia), con vencimiento de 1 h (Apple acepta hasta 6 meses) y se reutiliza mientras le quede tiempo. El refresh token se guarda en `AuthIdentity.providerRefreshToken`, cifrado con AES-256-GCM y una clave derivada de `JWT_SECRET` con HKDF. Así no hace falta otro secreto, y una copia de la base sin las variables no sirve para revocar ni usar el token. Al eliminar la cuenta se revoca (`token_type_hint=refresh_token`) **antes** de borrar; si Apple falla, se registra y la cuenta se borra igual, porque al jugador no se le puede negar el borrado por un problema de Apple.
- El canje ocurre en el mismo `POST /auth/apple`, con un tiempo máximo de 8 s, y nunca hace fallar el login: sin las variables (`APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CLIENT_ID`) o si Apple rechaza el código, solo queda un aviso en el log.
- **Avisos servidor a servidor** (`POST /auth/apple/notifications`): `consent-revoked` y `account-delete` borran la cuenta (sin volver a revocar). Se hizo porque era poco código: el JWT se verifica con el mismo JWKS de Apple que el login.
- Google en iOS: se pasa `iosClientId` (cliente OAuth iOS) además de `webClientId`, así que la audiencia del `idToken` sigue siendo el cliente web y `GOOGLE_CLIENT_IDS` no cambia.
- Junto al login (`LegalConsent`) se agregó la confirmación de edad para crear cuenta: 13+, o en Chile, con menos de 14, con autorización de la madre, padre o tutor (ver "Edad mínima para tener cuenta", arriba).

### Sign in with Apple también en la web (18 nov 2026)

Pedido del usuario: Android → solo Google; iOS → Apple y Google; **web → Apple y Google**, para que quien juega en el iPhone y en el computador use la misma cuenta (el `sub` de Apple es el mismo en todo el grupo del App ID principal).
- **Sign in with Apple JS en ventana emergente** (`usePopup: true`, `response_mode=web_message`): la respuesta vuelve a la misma página, así que no hace falta una ruta de retorno ni un servidor que reciba un `form_post`. El script oficial (`appleid.auth.js`) se carga solo cuando se muestran las opciones de login y solo si hay Services ID; se **precarga** al mostrar el botón para que el toque abra la ventana sin esperas (si hubiera una espera antes, el navegador la bloquea).
- **Botón dibujado por nosotros** (`AppleSignInButton.web.tsx`) con el estilo oficial (blanco sobre fondo oscuro, logo y "Iniciar sesión con Apple" en negro), 280×40 en píldora como el de Google. No se usa el botón que genera el script porque obliga a esperar al script y sale en inglés con el script `en_US`.
- **Interruptor**: el botón web aparece solo con `EXPO_PUBLIC_APPLE_SERVICES_ID` (variable del repositorio en `deploy-web.yml`) y API. Así la web se sigue publicando en cada push a `main` sin depender de la API nueva, que se publica recién cuando el usuario tenga las claves de Apple y cree el tag.
- **`client_id` por token**: Apple exige canjear y revocar con el mismo `client_id` de la autorización, que en la web es el Services ID y no el bundle ID. Se toma del `aud` del `identityToken` (ya validado contra `APPLE_AUDIENCES`) y se guarda **dentro del texto cifrado** junto al refresh token (JSON `{c, t}`), en vez de agregar una columna: no hay migración (había otra en paralelo en el esquema) y los tokens guardados antes, a secas, se siguen leyendo con `APPLE_CLIENT_ID`. El `client_secret` se firma por `client_id` (misma clave `.p8`).
- **`redirectUri`**: en la web, Apple pide en `/auth/token` el mismo `redirect_uri` de la autorización. Lo manda el cliente (es `origen + "/"`); la API solo lo reenvía a Apple, que lo compara con el registrado, así que no hace falta otra variable de entorno. Solo se acepta `https`.
- **Nombre del primer login**: Apple lo da una sola vez. El cliente lo recuerda en memoria por `sub` y lo reenvía si el `POST /auth/apple` falla (`lib/appleName.ts`). La API lo usa al crear la cuenta y, en una existente, solo completa `displayName` si está vacío (nunca reemplaza ni borra); el nombre del token de Google no rellena cuentas existentes.
- **Avisos de Apple**: la documentación actual usa `account-deleted` en los ejemplos (antes `account-delete`); se aceptan los dos.
- Apple no acepta `localhost` como Return URL: el login web con Apple solo se prueba de punta a punta en `https://web.touchedblock.app` (o con un túnel con dominio propio; ver `despliegue.md` → 6.10).

### Aviso por Telegram con cada reporte (18 nov 2026)

Para no depender de revisar la tabla a mano y cumplir el plazo de 24 h, cada reporte nuevo manda un mensaje de Telegram al dueño (`moderation/telegram.ts`).
- **Telegram** y no correo: no necesita un servicio de envío ni dominio verificado, llega al celular al instante y un bot se crea en un minuto con @BotFather. Opcional: sin `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` no se envía nada (un log al arrancar dice si está activo).
- **Nunca afecta al reporte**: se lanza sin esperarlo (`void`), con timeout de 5 s, y cualquier error queda en el log **sin el token** (se borra del texto por si la URL aparece en el error).
- **Sin datos del reportante** (ni su @usuario): el aviso solo sirve para saber que hay algo que revisar; quién reportó se ve en `moderation.mjs reports`. Así un chat de Telegram (servicio externo) no guarda quién denunció a quién.
- **Anti-spam en memoria**: como mucho un aviso por usuario reportado cada 10 min. Los reportes de esa ventana no avisan, pero se suman (línea "+N reportes…") al próximo aviso de ese usuario, y el conteo de pendientes siempre es el real. En memoria basta: hay una sola instancia de la API y un reinicio a lo más manda un aviso de más.
- Escapa el texto del jugador (`parse_mode: HTML`) y no muestra vista previa de enlaces. Prueba: `scripts/telegram-test.mjs` (o `moderation.mjs telegram-test`), y `--chat-id` para descubrir el chat id con `getUpdates`.

### Moderación: filtro de nombres, reportar y bloquear (18 nov 2026)

Para la guía 1.2 de Apple (contenido generado por usuarios). Lo único que un jugador escribe y otros ven es su nombre de usuario (rankings, perfiles, búsqueda).
- **Plazo de 24 horas**, no 7 días como prefería el usuario: el texto de la guía 1.2 solo pide "timely responses to concerns", pero el mensaje de rechazo de App Review por esa guía dice "The developer must act on objectionable content reports within 24 hours by removing the content and ejecting the user who provided the offending content". Se usa en los términos, en soporte y en el juego.
- **Filtro solo en la API** (`users/username-filter.ts`), dentro de `usernameProblem`: rige al crear la cuenta (el nombre generado desde Google lo cumple), en `PATCH /me`, en `check-username` y en el cambio forzado. Normaliza tildes, separadores, leet (0→o, 1→i/l, 3→e, 4→a, 5→s, 7→t, @→a, $→s) y letras repetidas (cada letra del término es `x+`). Para no caer en el "problema de Scunthorpe" hay tres listas: términos largos o inequívocos que valen en cualquier parte, palabras cortas que solo valen completas (con artículo delante y plural/diminutivo detrás) y `admin` al principio o al final. Los dígitos se cambian por letras solo si están pegados a una letra, y el 1→l solo entre dos letras (si no, "ana1" sería "anal"). Se sacaron "kike" (apodo común de Enrique) y "dev". Tests con casos positivos y negativos (`computadora`, `vergara`, `badminton`, `pineapple`, `therapist`, `yamashita`…).
- **Nombres existentes no se tocan solos** (regla de no romper registros): `scripts/check-usernames.mjs` los lista y `--rename` les pone `jugadorNNNN` si el dueño quiere.
- **Menú oculto por defecto** (pedido del usuario): botón "⋯" al pasar el mouse y toque sostenido de 500 ms en las filas de los rankings y en la cabecera del perfil público. El hover se detecta con `onPointerEnter/Leave` en un View que envuelve la fila y no con el hover de `Pressable`: en react-native-web un Pressable anidado (el enlace al perfil o el propio "⋯") corta el hover del de afuera (`contain: true`). El menú se abre **al soltar** el toque sostenido y los toques de los primeros 350 ms se ignoran: si se abría durante el toque, el navegador mandaba el "clic" del dedo al soltar al fondo del menú recién abierto y lo cerraba. El bloqueo se confirma dentro del mismo Modal (en iOS, abrir un Modal mientras otro se cierra puede fallar). Lista de bloqueados con "Desbloquear" en el Perfil, con una línea que explica cómo reportar.
- **Compatibilidad con la API v0.4.0**: la web se publica antes que la API. `GET /health` trae `features: ["moderation"]` y el cliente solo muestra el menú y la lista de bloqueados si aparece; si igual llega un 404 de ruta desconocida, dice "Disponible pronto".
- **Bloquear** borra los seguimientos en ambos sentidos y, mientras dure, nadie sigue al otro, no se ven en la búsqueda ni en los rankings de amigos (también se filtran en `resolveScope`, por si acaso) y el bloqueado recibe 404 en el perfil de quien lo bloqueó. Los rankings mundial y de país no cambian. "¿Quién te invitó?" con bloqueo da el corazón pero no crea seguimientos.
- **Reportes** en la tabla `Report` (uno por par y día UTC, con el nombre del reportado en ese momento; `SetNull` si alguna cuenta se borra, para no perder el historial). No hay correo: el dueño los revisa con `scripts/moderation.mjs` (no necesita token: quien entra al contenedor ya tiene la base) o con `/admin/*` y `ADMIN_TOKEN`. Sin la variable, o con un token incorrecto, `/admin/*` responde 404 para no revelar que existe. Eliminar desde moderación usa `UsersService.deleteMe` (revoca Apple). Migración `20261118200000_add_moderation`: solo agrega.

### Revisión adversarial de moderación y Apple (19 nov 2026)

Revisión adversarial del código de moderación, Telegram y Sign in with Apple, con cambios en la API, la app iOS, la política de privacidad, `/eliminar-cuenta/`, los términos y el soporte.
- **Los reportes se borran 1 año después de creados** (`REPORT_RETENTION_DAYS = 365`), en la limpieza periódica que ya borra partidas y sesiones vencidas. El usuario fijó ese máximo; ninguna norma aplicable exige menos, y un año es lo necesario para moderar reincidencias (ver si un nombre ya había sido reportado antes). Antes se guardaban sin plazo.
- **Lo que queda de un reporte tras eliminar una cuenta, declarado tal cual en la política**: el reporte se desvincula de la cuenta (`SetNull`) y se conservan el nombre de usuario del reportado en ese momento, el motivo, el comentario opcional, el estado, la resolución (lo que hizo el moderador) y las fechas. La política decía solo "nombre, motivo y fecha", que no coincidía con lo que se guarda. Los bloqueos se borran con la cuenta.
- **Telegram declarado como servicio externo** en la política de privacidad: recibe los datos del aviso de reporte (usuario reportado, motivo, comentario escapado, cuántos pendientes hay), nunca quién reportó.
- **Texto del bloqueo**: decía que quien te bloqueó "no puede ver tu perfil", pero los perfiles son públicos y sin sesión cualquiera los ve. Ahora dice que **con su cuenta** no puede seguirte ni ver tu perfil, y que los perfiles son públicos.
- **Nonce de Sign in with Apple, pospuesto**: el `identityToken` viaja solo por TLS directo a nuestra API y vence en minutos, así que por ahora no hace falta. Queda en pendientes.
- **El filtro de nombres mantiene "polla" y "retard"** (decisión del usuario).
- **La app iOS declara español** (`CFBundleDevelopmentRegion` "es" y `CFBundleLocalizations` ["es","en"]), para que el botón oficial de Apple, que traduce el sistema, salga en español a quien tenga el iPhone en español. Falta probarlo en un iPhone real.
- **Un solo refresh token de Apple por cuenta**: más adelante solo existirán las apps; la web es para probar e iterar rápido, así que no vale la pena guardar uno por plataforma.
- **`APPLE_TOKEN_KEY`** (opcional): clave propia para cifrar (AES-256-GCM) el refresh token de Apple, para desacoplarlo del `JWT_SECRET`. Sin ella se usa la derivada de `JWT_SECRET`, como antes; los tokens cifrados con la clave anterior se siguen leyendo, así que se puede rotar `JWT_SECRET` sin perder la revocación. Una vez definida no se cambia.
- **Aviso de Apple viejo ignorado por `event_time`**: `POST /auth/apple/notifications` ignora un aviso cuyo `event_time` sea anterior a la creación de la identidad, para que un reintento atrasado de Apple no borre una cuenta nueva creada después con el mismo Apple ID. Además queda con el límite de 20 por minuto del controlador de auth.
- **`DELETE /users/:username/block` no devuelve `block_self`** (solo `POST`): desbloquear es idempotente y responde 204.
- **Recorte de textos por caracteres (code points)**, no por unidades UTF-16, para no partir un emoji a la mitad.

### El antitrampas actual basta (12 nov 2026)

- Se repasó el sistema: replay con semilla del servidor, límites de toques por segundo, plazo de 2 h, duración compatible con el reloj real y una sola entrega por partida.
- Decisión del usuario: **alcanza para un juego pensado para usuarios comunes**. No se agregan heurísticas contra bots (precisión o ritmo inhumanos) por ahora; solo se reconsideran si aparecen puntajes sospechosos en los rankings. Las partidas rechazadas y sus toques quedan guardados por si hay que investigar.

### Los registros de los jugadores no se rompen (11 nov 2026)

- Al pasar el corazón de 1 a 2 s se subió `RULES_VERSION` a 5 (reinicio de rankings y récord local) siguiendo la regla de entonces. El usuario preguntó por qué se reiniciaba y decidió: queda en la v5, pero **de ahora en más no se rompen los registros** salvo un cambio muy grande que lo amerite, sobre todo porque se lanzará como app.
- Anotado en `CLAUDE.md`, `docs/desarrollo.md`, `docs/reglas-y-balance.md` y `docs/pendientes.md`.

### "¿Quién te invitó?" como buscador (10 nov 2026)

El usuario pidió que no haya que saberse el usuario exacto de quien te invitó: al escribir "S", "Se", "Seb"… se van mostrando los usuarios que calzan, primero los que **empiezan** con lo escrito y después los que lo tienen en **cualquier otra parte**, y un aviso si no hay nadie.
- `GET /users/search` pasó de buscar por prefijo a buscar en cualquier parte del usuario (también lo usa "Seguir").
- La búsqueda ignora tildes, mayúsculas, espacios, puntos y guiones bajos: "Sebastián S" encuentra a `sebastian.sanhueza`, porque los usuarios se generan desde el nombre de Google.
- Se hace con `strpos` en SQL y no con `LIKE`/`contains`, porque `_` es comodín en `LIKE` y es un carácter válido en los usuarios.
- Solo se busca por **usuario**, no por el nombre de Google (`displayName`), que es privado.
- Al tocar un resultado se pide confirmación, porque quien te invitó no se puede cambiar.
- Sin índice: recorre la tabla de usuarios, que es chica. Si crece mucho, agregar un índice trigram (`pg_trgm`).

---

## Cómo se trabajó

- El usuario pidió **usar subagentes** para delegar y los MCP/skills disponibles, y avisarle si hace falta instalar alguna conexión.
- El cliente, la API y partes del onboarding los construyeron subagentes a partir del plan. Luego se verificaron con tests y con Playwright en viewport de celular.
- El plan original aprobado está resumido en este documento. No existe otra copia en el repo.
