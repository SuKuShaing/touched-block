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
  - "Retar a un amigo" aparece desde la 2.ª visita, salvo que el jugador haya llegado por un enlace de reto (regla del jugador nuevo).
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
