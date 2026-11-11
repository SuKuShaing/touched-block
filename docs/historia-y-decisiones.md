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
