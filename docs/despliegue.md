# Despliegue

| Pieza | Dónde | Cuándo se publica |
|---|---|---|
| Web (el juego) | Cloudflare Workers: `https://web.touchedblock.app` | Cada push a `main` que toque el cliente o el motor (no `apps/api/**`, `apps/landing/**`, `deploy/**` ni `docs/**`). También a mano (*Run workflow*) |
| Landing | Cloudflare Workers: `https://touchedblock.app` | Cada push a `main` que toque `apps/landing/**`, o a mano |
| Web vieja (solo redirige) | GitHub Pages: `https://sukushaing.github.io/touched-block/` | Cuando cambia `deploy/gh-pages-redirect/**`, o a mano |
| App Android | APK firmado (`apps/client/android/app/build/outputs/apk/release/app-release.apk`); por ahora se reparte a mano; Google Play más adelante | A mano (ver sección 5) |
| API + base de datos | VPS del usuario con **Dokploy** (servicio *Compose*): `https://api.touchedblock.app` (y `https://vps23906.cubepath.net`, que usa el APK ya repartido) | Cada tag `vX.Y.Z` |

**Regla de oro**: el repositorio es **público**. Ningún secreto entra al repo. Los valores reales viven en Dokploy (pestaña Environment) y en los *Secrets* de GitHub (Dokploy y Cloudflare). `.env` y `.env.*` están en `.gitignore`, salvo los `.env.example`.

---

## 1. Web (Cloudflare) y dominios

Desde el 17 nov 2026 el proyecto usa el dominio **`touchedblock.app`** (comprado y con DNS en Cloudflare):

| Dirección | Qué es | Dónde vive |
|---|---|---|
| `https://touchedblock.app` | Landing: inicio, `/privacidad/`, `/terminos/`, `/eliminar-cuenta/`, `/soporte/` | Cloudflare Workers, activos estáticos (`apps/landing`, `apps/landing/wrangler.jsonc`) |
| `https://web.touchedblock.app` | El juego web (este cliente Expo, en la raíz) | Cloudflare Workers, activos estáticos (`apps/client/wrangler.jsonc`) |
| `https://api.touchedblock.app` | La API | Dokploy (sección 3). `https://vps23906.cubepath.net` sigue funcionando: el APK ya repartido apunta ahí |
| `https://sukushaing.github.io/touched-block/` | Web vieja: solo redirige al juego y le pasa los datos locales | GitHub Pages (`deploy/gh-pages-redirect/`) |

### El juego: `.github/workflows/deploy-web.yml`

Corre en cada push a `main`, salvo que solo cambien `apps/api/**`, `apps/landing/**`, `deploy/**`, `docs/**` o los otros workflows. También se puede lanzar a mano (*Actions → Desplegar la web en Cloudflare → Run workflow*). Hace lo siguiente:
1. Revisa que existan los secretos `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`; si falta alguno, falla con un mensaje que dice cuál.
2. Instala pnpm (versión de `packageManager` en `package.json`), Node 24 y las dependencias.
3. Ejecuta los tests del motor.
4. Corre `expo export -p web` con `EXPO_PUBLIC_API_URL=https://api.touchedblock.app` (escrita en el workflow: es pública y así no depende de la variable vieja del repositorio, que apunta al VPS) y `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (variable del repositorio).
5. Instala Wrangler 4 global con npm y publica `apps/client/dist` con `cloudflare/wrangler-action@v4` (`wrangler deploy` en `apps/client`). Wrangler va global para que la acción no intente instalarlo dentro del workspace de pnpm (npm falla con las dependencias `workspace:*` y pnpm lo agregaría al `package.json`).

`apps/client/wrangler.jsonc`: Worker `touchedblock-web`, sin código de servidor, solo `assets` desde `./dist` con `not_found_handling: "single-page-application"`, y el dominio propio `web.touchedblock.app` (`routes` con `custom_domain: true`: Cloudflare crea el registro DNS y el certificado al publicar). Detalles:
- **Rutas**: una ruta que no es un archivo (`/como-jugar`, `/rankings`, `/u/<usuario>`) recibe `index.html` con 200, así que ya no hace falta el `404.html` de Pages. Los HTML estáticos de `public/` (las redirecciones legales) se sirven tal cual.
- **Enlaces de retos**: siguen siendo por parámetro (`/?reto=CÓDIGO`, `/?diario=1`), porque ya hay enlaces repartidos. Ahora una ruta también respondería 200 (la vista previa de WhatsApp ya no se rompería), así que pasar a `/reto/CÓDIGO` es una mejora posible, siempre aceptando también el formato viejo.
- **Caché**: `public/_headers` (Expo lo copia a `dist/`; Cloudflare lo lee y no lo publica) marca `/_expo/static/*` y `/assets/*` (todos llevan un hash en el nombre) con un año e `immutable`. `index.html` y lo demás quedan con lo de Cloudflare por defecto (`max-age=0, must-revalidate`), para que una versión nueva llegue al tiro.
- `compatibility_date` está fija; subirla a mano y probar.
- Probar en local: `pnpm --filter @tb/client exec expo export -p web` y luego, en `apps/client`, `pnpm dlx wrangler@4 dev --port 5182` (crea `.wrangler/`, que está ignorado).

### La landing: `.github/workflows/deploy-landing.yml`

En cada push a `main` que toque `apps/landing/**` (o a mano): revisa los mismos dos secretos, instala Wrangler 4 global y corre `wrangler deploy` en `apps/landing` con `cloudflare/wrangler-action@v4`. La configuración es `apps/landing/wrangler.jsonc`.

### Secretos de Cloudflare

En GitHub: **Settings → Secrets and variables → Actions → *Secrets***.

| Secreto | De dónde sale |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → *My Profile* → **API Tokens** → *Create Token* → plantilla **Edit Cloudflare Workers**. En *Account Resources*, la cuenta; en *Zone Resources*, la zona `touchedblock.app` (hace falta para los dominios propios). Cópialo al tiro: no se vuelve a mostrar |
| `CLOUDFLARE_ACCOUNT_ID` | Panel de Cloudflare → *Workers & Pages* (columna derecha, *Account ID*), o el tramo de la URL `dash.cloudflare.com/<account-id>/…` |

La variable del repositorio `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (pestaña *Variables*) sigue igual: `1065315828810-mr72tnt45h219lvr056efbojdjpvman0.apps.googleusercontent.com`. La variable `EXPO_PUBLIC_API_URL` ya no la usa ningún workflow (se puede borrar).

### La web vieja: redirección y mudanza de datos

`.github/workflows/deploy-pages.yml` publica en GitHub Pages **solo** `deploy/gh-pages-redirect/` (cuando cambia esa carpeta o el workflow, o a mano). Ya no lleva el juego. Tiene `index.html` y `404.html` idénticos (el workflow vuelve a copiar uno en el otro), `.nojekyll` y dos páginas mínimas para las direcciones legales viejas (`politica-de-privacidad/`, `condiciones-del-servicio/`), que llevan a `https://touchedblock.app/privacidad/` y `/terminos/`.

La página lleva a la misma ruta y parámetros del sitio nuevo: `/touched-block/como-jugar?nivel=basico` → `https://web.touchedblock.app/como-jugar?nivel=basico`, `/touched-block/?reto=K7M2QXAB` → `https://web.touchedblock.app/?reto=K7M2QXAB`. No es un 301 ciego porque **los datos locales del jugador** (récord, historial, sesión, tutoriales vistos…) viven en el `localStorage` del origen `https://sukushaing.github.io` y no pasan solos a otro dominio:
1. Con JavaScript, la página lee **solo las claves del juego**, por nombre exacto (el origen `sukushaing.github.io` lo comparten todos los proyectos del autor): `tb_rt1`, `tb_me1`, `tb_best5`, `tb_stats1`, `tb_hist5`, `tb_onb1`, `tb_onb_adv1`, `tb_visits1`, `tb_last1`, `tb_unlock1`, `tb_set1`, `tb_miss1`, `tb_daily1`, `tb_reto1` y `tb_cele1`. No borra ni cambia nada en el origen viejo.
2. Las empaqueta en el **fragmento** de la URL nueva: `#tbmigrar=<base64url de {"v":1,"d":{clave:valor}}>`. El fragmento nunca viaja a ningún servidor (tampoco a Cloudflare). Tope de unos 200 KB; los datos reales pesan pocos KB.
3. Hace `location.replace` (la página vieja no queda en el historial). Sin JavaScript, un `<meta http-equiv="refresh">` lleva a `https://web.touchedblock.app/` y queda un enlace visible.

En el sitio nuevo, el script `tb-mudanza` del `<head>` de `apps/client/public/index.html` (corre antes que la app; tests en `apps/client/src/lib/mudanza.test.ts`, que ejecutan los dos scripts reales) importa el fragmento:
- **Solo si viene de la web vieja**: `document.referrer` tiene que ser `https://sukushaing.github.io` (la página vieja fija `referrer: origin`; en desarrollo, de `localhost` a `localhost`). Sin eso no se importa nada: un enlace fabricado con `#tbmigrar=` no puede subir el récord, las estadísticas ni dejar a alguien entrado en otra cuenta.
- **Siempre borra el fragmento** (aunque sea inválido o enorme) con `history.replaceState(…, location.href.split('#')[0])`, para que no quede en la barra, al recargar ni en un enlace copiado.
- Solo acepta esas claves, cada una con su formato, como máximo 100 000 caracteres por clave. Todo va en `try/catch`.
- **Mezcla sin bajar nada ni contar doble** (repetir la mudanza da lo mismo):

  | Clave | Regla |
  |---|---|
  | `tb_best5`, `tb_visits1`, `tb_last1` | El mayor |
  | `tb_onb1`, `tb_onb_adv1`, `tb_unlock1` | `1` si alguno de los dos lados la tiene |
  | `tb_stats1` | El mayor campo a campo (como `maxOf` de `lib/stats.ts`). `runs`, `totalKilled` y `bonusXp` son acumulados: si se jugó en los dos sitios, queda el mayor de los dos y no la suma (sumar contaría doble si la mudanza se repite) |
  | `tb_hist5` | Unión sin repetir (misma fecha, destruidos y escapados), la más reciente primero, máx. 30 (`HIST_MAX`) |
  | `tb_cele1` | Unión (logros ya celebrados: así no se repiten) |
  | `tb_miss1` | Unión de ids por fecha (una misión premiada en cualquiera de los dos no se vuelve a premiar) |
  | `tb_daily1` | Fechas jugadas unidas (racha), `rulesSeen` si alguno, `yesterdaySeen` y `bestPct` el mayor. Por día: intentos con el mayor (no regala intentos al invitado), partidas unidas, reclamo y "habrías quedado" del sitio nuevo si los hay |
  | `tb_set1`, `tb_reto1` | Se conserva el del sitio nuevo; el viejo solo si aquí no hay |
  | `tb_rt1` + `tb_me1` | Solo si aquí no hay sesión (nunca se cambia de cuenta). El token viaja de nuestro dominio viejo al nuevo, por fragmento y en el mismo navegador. Si ya se había usado (rota en cada uso), la app lo descarta sola y queda como invitado |
- **Tutorial**: como `tb_onb1`, `tb_visits1` y `tb_last1` se importan antes de que la app cuente la visita, un jugador antiguo no vuelve a ver el tutorial de la 1.ª visita.
- Al importar, marca `tb_mig1=1`.

**Ida y vuelta (una vez por navegador).** Los enlaces que se comparten ya apuntan a `web.touchedblock.app`, así que un jugador antiguo puede llegar primero al sitio nuevo. Por eso, si no existe `tb_mig1` y no llegó `#tbmigrar`, el script:
1. Guarda `tb_mig1=1` **antes de salir** (y comprueba que quedó guardado; si el almacenamiento no dura, no sale). Así nunca hay bucle y, si GitHub Pages falla, la próxima visita ya no vuelve a intentarlo.
2. Marca `window.__tbMudanza` (la app no arranca mientras se va: `src/app/_layout.tsx`) y hace `location.replace` a `https://sukushaing.github.io/touched-block/?volver=<ruta y query codificadas>`.
3. La página vieja valida `volver` (empieza con una sola `/`, no `//` ni `/\`, sin esquema ni caracteres de control; si no, va a `/`) y devuelve al jugador a esa misma dirección, con `#tbmigrar=…` si hay datos o sin fragmento si no. Un `/?reto=K7M2QXAB` termina en `/?reto=K7M2QXAB`.

No se hace en `localhost`, si la dirección ya trae `?volver=`, ni para bots conocidos por su *user agent* (Googlebot, vistas previas de WhatsApp/Telegram/Discord, Lighthouse…); sin JavaScript no pasa nada. Le cuesta a cada navegador nuevo un salto extra a GitHub Pages, una sola vez.

Límites:
- Una web instalada desde Pages (PWA) abre la dirección vieja y la redirección la saca al navegador; conviene instalarla de nuevo desde `web.touchedblock.app`.
- Safari (ITP) borra el almacenamiento de un sitio que no se visita en 7 días: a quien no abrió la web vieja en una semana ya no le quedan datos que traer. Las protecciones contra *bounce tracking* de los navegadores podrían tratar el salto a `sukushaing.github.io` como rastreo y borrar sus datos más adelante; por eso la mudanza va al primer ingreso.
- Si se agrega o renombra una clave `tb_*`: sumarla a `CLAVES` de la página vieja y a `REGLAS` del script `tb-mudanza`.

Para probarla en local: una copia de `deploy/gh-pages-redirect/` servida bajo `/touched-block/` con `DESTINO` cambiado a `http://localhost:5182`, y una copia del `dist/` del cliente en el 5182 (`wrangler dev`) con `VIEJA` apuntando a `http://localhost:5181` e `IDA_Y_VUELTA = true`.

## 2. Google Cloud (login con Google)

Ya hecho por el usuario el 9 nov 2026. El Client ID está arriba. Para rehacerlo o revisarlo, en https://console.cloud.google.com:

1. **APIs y servicios → Pantalla de consentimiento de OAuth** (*Google Auth Platform*).
   - Nombre de la app: "Touched Block".
   - Página principal: `https://touchedblock.app/`.
   - Política de privacidad: `https://touchedblock.app/privacidad/`.
   - Condiciones del servicio: `https://touchedblock.app/terminos/`.
   - Usa las URLs **con `/` al final**, para que respondan 200 sin redirección.
   - Dominio autorizado: `touchedblock.app` (cubre también `web.` y `api.`). Puede quedar también `sukushaing.github.io` mientras exista la redirección.
   - Antes (hasta nov 2026) eran `https://sukushaing.github.io/touched-block/…` con el dominio `sukushaing.github.io`; esas direcciones siguen respondiendo (redirigen).
2. **Clientes → Crear cliente → Aplicación web**. Orígenes de JavaScript autorizados: `https://web.touchedblock.app`, `https://sukushaing.github.io` (una pestaña vieja todavía abierta) y `http://localhost:8081`. **Sin `https://web.touchedblock.app` el botón de Google no funciona en la web nueva**: agrégalo antes de publicarla. No hacen falta URI de redirección: Google Identity Services entrega el `idToken` en la misma página.
3. **Público → Publicar la app** (pasar de "Prueba" a "En producción").
   - **Importante:** en modo prueba solo pueden entrar los usuarios de prueba que agregues.
   - Como solo se piden los *scopes* básicos (email, perfil), no hace falta la revisión de Google.
   - Si subes un logo, Google puede pedir verificar la marca.
4. El mismo Client ID va en dos lugares:
   - En la API, `GOOGLE_CLIENT_IDS`: la audiencia aceptada del `idToken`.
   - En la web, `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
   - Para la app móvil habrá que crear clientes Android/iOS y agregarlos a `GOOGLE_CLIENT_IDS`, separados por coma.

## 3. API en Dokploy

### Cómo funciona

- `deploy/docker-compose.yml` define dos servicios:
  - **`api`**: imagen `ghcr.io/sukushaing/touched-block-api:${API_TAG:-latest}` con `pull_policy: always`.
  - **`tb-db`**: `postgres:17-alpine` con el volumen `tb_pgdata`.
- Dokploy clona el repo, escribe las variables de su pestaña *Environment* en un `.env` junto al compose y ejecuta `docker compose up`.
- **La base de datos se crea sola** la primera vez. La API espera a que esté sana y aplica las migraciones de Prisma al arrancar (`prisma migrate deploy`).
- Ningún servicio publica puertos: Traefik (de Dokploy) llega a la API por la red interna. Postgres nunca queda expuesto a internet.
- Se probó en local el 9 nov 2026 con la imagen real: se creó la base, se aplicó la migración `init` y `/health` respondió con `rulesVersion: 3`.

### Variables (pestaña Environment del Compose)

El archivo `deploy/.env` (ignorado por git) ya tiene los valores reales generados: contraseña de Postgres, `JWT_SECRET` aleatorio y Client ID. **Se copia su contenido completo y se pega en Dokploy.** La plantilla con explicaciones está en `deploy/.env.example`.

| Variable | Nota |
|---|---|
| `POSTGRES_PASSWORD` | Solo letras y números (va dentro de la URL de conexión). Se fija al crear el volumen: cambiarla después **no** cambia la contraseña de la base existente |
| `JWT_SECRET` | 48 bytes aleatorios. Si cambia, todas las sesiones se cierran |
| `DAILY_SECRET` | **Obligatoria desde la fase 4** (reto diario): sin ella el Compose no arranca (`falta DAILY_SECRET`) y la API tampoco. 48 bytes aleatorios (mínimo 32 caracteres): `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Es la llave de la semilla del reto diario (`HMAC-SHA256(DAILY_SECRET, fecha)`): sin ella nadie puede adivinar la partida de mañana. **No cambiarla** una vez publicada: cambiaría la partida del día en curso a mitad del día |
| `GOOGLE_CLIENT_IDS` | Client ID web; más adelante, también los de Android/iOS, separados por coma |
| `CORS_ORIGINS` | `https://web.touchedblock.app,https://sukushaing.github.io` (separados por coma). **Hay que cambiarlo en Dokploy**: el valor por defecto de `deploy/docker-compose.yml` solo se usa si la variable no existe, y hoy existe con el valor viejo |
| `API_TAG` | `latest`. Para volver a una versión anterior: `v0.1.0`, etc. |

### Configuración inicial en Dokploy (una vez)

1. **DNS**: crea un registro A `api.<tu-dominio>` que apunte a la IP del VPS (hoy `api.touchedblock.app`, en Cloudflare: **solo DNS**, nube gris, para que Let's Encrypt de Traefik pueda emitir el certificado; el dominio viejo `vps23906.cubepath.net` se deja también en *Domains*).
   - Hace falta un dominio real, porque la web está en HTTPS y el navegador bloquea llamadas a una API sin HTTPS.
   - Los dominios `traefik.me` que sugiere Dokploy no sirven: son HTTP.
2. **Project → Create Service → Compose**.
   - Proveedor *Git* (o *GitHub*) con el repo `https://github.com/sukushaing/touched-block.git`, rama `main`.
   - **Compose Path:** `./deploy/docker-compose.yml`. Tipo: Docker Compose.
3. **Environment**: pega el contenido de `deploy/.env` y guarda.
4. **Advanced → Isolated Deployment**: actívalo. Así la API y la base quedan en una red propia y Traefik llega a la API sin mezclarse con otros proyectos.
5. **Domains → Add Domain**:
   - Servicio `api`, host `api.<tu-dominio>`, path `/`, puerto del contenedor **3000**.
   - HTTPS activado, certificado *Let's Encrypt*.
   - Con *Preview Compose* puedes ver las etiquetas que agrega Dokploy.
6. Todavía **no** despliegues: la imagen recién existirá después del primer tag (paso 4 de la sección siguiente).

### Secretos de GitHub (para que el tag despliegue solo)

En GitHub: **repositorio → Settings → Secrets and variables → Actions**. La pestaña **Secrets** tiene el botón *New repository secret*; la pestaña **Variables** tiene *New repository variable*.

| Secreto | De dónde sale |
|---|---|
| `DOKPLOY_URL` | La dirección con la que abres el panel de Dokploy en el navegador, sin `/` al final (por ejemplo `https://dokploy.tudominio.com` o `http://IP-del-VPS:3000`). GitHub tiene que poder llegar a ella desde internet |
| `DOKPLOY_API_KEY` | En Dokploy: avatar (arriba a la derecha) → **Profile** → sección **API/CLI** → *Generate Token*. Cópialo al tiro: no se vuelve a mostrar |
| `DOKPLOY_COMPOSE_ID` | El id del Compose. Es el último tramo de la URL cuando abres el servicio en Dokploy. También se puede ver con `curl -H "x-api-key: <token>" https://<dokploy>/api/project.all` (campo `composeId`) |

| Variable | Valor |
|---|---|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | El Client ID. Se puede crear ya |
| `EXPO_PUBLIC_API_URL` | Ya no se usa: `deploy-web.yml` lleva escrita `https://api.touchedblock.app` |

### Publicar una versión de la API

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/deploy-api.yml` hace lo siguiente:
1. Corre los tests del motor y de la API, con un Postgres de servicio.
2. Construye la imagen y la sube a GHCR con los tags `:v0.1.0` y `:latest`.
3. Llama a `POST $DOKPLOY_URL/api/compose.deploy {composeId}` con la cabecera `x-api-key`.

Si falta un secreto, el último paso falla con un mensaje claro.

**Primera vez:**
1. Configura los 3 secretos y el Compose en Dokploy (sin desplegar).
2. Crea el tag `v0.1.0` y súbelo.
3. Cuando termine el workflow, revisa la visibilidad de la imagen: GitHub → tu perfil → **Packages** → `touched-block-api` → *Package settings*. Si es **privada**, Dokploy no puede bajarla. Tienes dos opciones:
   - Cámbiala a **Public**. Es lo simple, y el código ya es público.
   - O agrega el registro en Dokploy (*Settings → Registry*: `ghcr.io`, tu usuario y un token con `read:packages`).
4. Si el despliegue había fallado por eso, presiona *Deploy* en Dokploy.
5. Comprueba que `https://api.<tu-dominio>/health` responda `{"status":"ok","db":"ok","rulesVersion":3,…}`.
6. Publica la web (*Run workflow* de `deploy-web.yml`); su `EXPO_PUBLIC_API_URL` está en el workflow. Desde ahí aparecen las cuentas y los rankings.

### Volver a una versión anterior

En Dokploy, cambia `API_TAG=v0.1.0` (o la versión que quieras) en Environment y presiona *Deploy*. Para volver a la normalidad, deja `API_TAG=latest`.

Las migraciones de Prisma no se deshacen solas. Si la versión nueva cambió el esquema, revisa la compatibilidad antes de volver atrás. Las migraciones del plan de jugabilidad (fases 2 a 5) solo **agregan** tablas, columnas opcionales o con valor por defecto e índices, así que una API anterior sigue funcionando sobre la base nueva (ignora lo que no conoce).

### Respaldos

El volumen `tb_pgdata` guarda todo. **Decisión D10 (12 nov 2026)**: respaldos funcionando antes de publicar la fase 2. El usuario eligió un volcado en el mismo VPS, sin servicios pagados (12 nov 2026):

- **Tarea programada de Dokploy** `touched-block-respaldo` (en el Compose **API**, pestaña *Schedules*, servicio `tb-db`), todos los días a las **07:00 UTC** (04:00 en Chile). Corre `pg_dump -Fc` (formato comprimido de Postgres) dentro de `tb-db`.
- **Dónde quedan**: en el VPS, en `/var/backups/touched-block/` (`touched_block-AAAAMMDD-HHMMSS.dump`). `deploy/docker-compose.yml` monta esa carpeta en `tb-db` como `/respaldos`.
- **Se borran solos**: la tarea guarda los **14 más recientes** y borra los más viejos.
- **Verifica cada respaldo**: lee el archivo nuevo con `pg_restore -l` (escribe cuántas tablas tienen datos) y solo entonces escribe `OK`. Si `pg_dump` falla, queda un `parcial.tmp` que la próxima corrida sobrescribe; los `.dump` buenos no se tocan. El 12 nov 2026 se probó que corre sola: se movió la hora a unos minutos después, corrió a las 14:24 UTC con `OK` (13 tablas con datos, 142 KB) y se dejó de nuevo a las 07:00.
- **Antes de cada versión con migraciones nuevas**: correr la tarea a mano (*Run now* en Dokploy) y revisar en su registro que diga `OK`.
- **El respaldo diario del proveedor del VPS** copia el disco entero, así que también se lleva estos archivos fuera del VPS. Son complementarios: el del proveedor sirve si se pierde el VPS, pero restaurarlo devuelve todo el servidor (también los otros proyectos) al estado de ese día; el `pg_dump` deja volver solo esta base a un momento exacto, por ejemplo justo antes de una migración, y es consistente aunque la base esté en uso.

Restaurar (solo si hiciera falta; **reemplaza** lo que haya en la base). En la terminal del contenedor `tb-db` en Dokploy:

```bash
ls -la /respaldos
pg_restore -U tb -d touched_block --clean --if-exists /respaldos/touched_block-AAAAMMDD-HHMMSS.dump
```

Para bajar uno al computador: `scp root@<vps>:/var/backups/touched-block/<archivo>.dump .`

### Publicar el plan de jugabilidad (fases 2 a 5)

**Ya se publicó el 12 nov 2026 (API `v0.3.0`)**; el detalle de cómo se hizo está en `pendientes.md`. Estos pasos quedan como referencia para una versión parecida.

La API nueva es **compatible con la web anterior** (campos nuevos opcionales y endpoints nuevos; nada se renombró ni se eliminó), así que el orden es siempre: **API primero, web después**.

1. **Respaldo** de la base (sección anterior): correr a mano la tarea `touched-block-respaldo` y revisar que diga `OK`.
2. **`DAILY_SECRET`** en la pestaña *Environment* de Dokploy (y en tu copia local `deploy/.env`). Sin ella el despliegue falla, porque `deploy/docker-compose.yml` la exige.
3. **Tag de la API** (`git tag vX.Y.Z && git push origin vX.Y.Z`). Al arrancar, el contenedor aplica las migraciones pendientes:

   | Migración | Qué agrega |
   |---|---|
   | `add_user_stats` (fase 2) | Columnas `Run.bestStreak` y `Run.endReason` (opcionales) y la tabla `UserStats`, con un **relleno inicial**: cada cuenta recibe sus totales de partidas válidas (mejor duración, bloques, partidas). Solo inserta filas nuevas |
   | `add_run_modes_and_challenges` (fase 3) | `Run.mode` (por defecto `normal`: las partidas existentes quedan así sin reescribirse), `Run.challengeCode`, `Run.dailyDate`, `Run.config` (opcionales) y las tablas `Challenge` y `ChallengeEntry` |
   | `add_daily_challenge` (fase 4) | Tablas `DailyChallenge` y `DailyEntry` |
   | `add_mission_rewards` (fase 5) | Tabla `MissionReward` |
   | `add_challenge_creator_run_index` | Índice en `Challenge.creatorRunId` (solo un índice; no toca datos) |

   Ninguna borra ni reescribe datos de jugadores.
4. Verifica `https://api.<tu-dominio>/health` (`status: "ok"`, `rulesVersion: 5`, la versión nueva).
5. **Relleno de rachas** (una vez, después del primer despliegue con la fase 2). La mejor racha no estaba guardada: este script la calcula repitiendo las partidas válidas guardadas de las reglas actuales (las de versiones anteriores no se pueden repetir y quedan sin racha) y sube `UserStats.bestStreak`. Es **idempotente**: si se corta o se corre dos veces, no pasa nada.

   ```bash
   # en el VPS, en la carpeta del Compose (o en la terminal del contenedor "api" de Dokploy, sin "docker compose exec api")
   docker compose exec api node scripts/backfill-streaks.mjs --dry-run   # prueba: muestra cuántas partidas actualizaría
   docker compose exec api node scripts/backfill-streaks.mjs             # lo hace
   ```

   Muestra al final cuántas partidas repitió y actualizó, cuántas no coinciden con su repetición (no se tocan), y cuántos jugadores subieron su mejor racha. Usa la `DATABASE_URL` del contenedor.
6. **Push de la web** a `main`.

## 4. Desarrollo local con cuentas

- `apps/api/.env` y `apps/client/.env` (ignorados) ya tienen el Client ID real y apuntan a `http://localhost:3000`.
- Para probar sin Google: `AUTH_DEV_FAKE=1` en la API y `EXPO_PUBLIC_AUTH_DEV_FAKE=1` en el cliente. Aparece un login falso "Entrar (dev)", que la API ignora con `NODE_ENV=production`.
- Comandos en [`desarrollo.md`](desarrollo.md).


## 5. App Android (APK)

**Identificador**: `app.touchedblock` (fijo para siempre una vez en Google Play).

**Clave de firma** (fuera del repo):
- `~/.touched-block/release.keystore` (PKCS12, alias `touchedblock`, válida 10 000 días) y `~/.touched-block/keystore.properties` con `TB_UPLOAD_STORE_FILE`, `TB_UPLOAD_KEY_ALIAS`, `TB_UPLOAD_STORE_PASSWORD` y `TB_UPLOAD_KEY_PASSWORD`. En CI se pueden pasar como variables de entorno con esos mismos nombres (`plugins/withReleaseSigning.js`). Sin ninguna de las cuatro, el release sale firmado con la clave debug (solo para probar) y Gradle lo avisa con un `AVISO`; si faltan algunas o el keystore no existe, el build falla con el motivo. Una ruta relativa en `TB_UPLOAD_STORE_FILE` se toma desde `~/.touched-block`. Comprobar con `./gradlew :app:signingReport` (en `android/`): la variante `release` debe mostrar `release.keystore` y el alias `touchedblock`.
- **Respaldarla** en un gestor de contraseñas o una nube privada. Si se pierde, un APK ya instalado no se puede actualizar: hay que desinstalarlo e instalar el nuevo. En Google Play, con *Play App Signing*, esta pasa a ser la clave de subida y se puede reemplazar.
- SHA-1: `B5:7F:86:E8:13:A8:B6:BA:11:90:81:A9:17:3C:4B:1E:0C:CA:58:0A`.

**Google Cloud** (proyecto *Touched Block* → Clientes): además del cliente web hay dos clientes **Android** con el paquete `app.touchedblock`:
- "Android debug (app.touchedblock)", con la SHA-1 de la clave debug de Expo (`5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`);
- "Android release APK (app.touchedblock)", con la SHA-1 de arriba.

La app usa el Client ID **web** (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`) como `webClientId`, así que la API no cambia. Al publicar en Google Play hay que agregar otro cliente Android con la SHA-1 de la clave de firma de Play (Play Console → Integridad de la app).

**Generar el APK** (apunta a la API de producción y no lleva `EXPO_PUBLIC_AUTH_DEV_FAKE`):

```bash
cd apps/client
pnpm exec expo prebuild -p android
cd android
EXPO_PUBLIC_API_URL=https://api.touchedblock.app NODE_ENV=production ./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
# → app/build/outputs/apk/release/app-release.apk
```

- Subir `android.versionCode` (y `version`) en `app.json` en cada APK que se reparta: Android no instala encima una versión con el mismo `versionCode`.
- La API no necesita CORS para la app, porque las apps no envían `Origin`.
- Los APK anteriores a noviembre de 2026 apuntan a `https://vps23906.cubepath.net`: ese dominio tiene que seguir en Dokploy (*Domains*) mientras haya gente con esos APK.
- La app comparte enlaces con `https://web.touchedblock.app/` (`config.siteUrl`) y abre las páginas legales de `https://touchedblock.app/` (`config.landingUrl`).
