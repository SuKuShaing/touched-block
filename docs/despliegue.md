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
   - La app (Android e iOS) pide el `idToken` con este mismo Client ID web como `webClientId`, así que su audiencia sigue siendo el cliente web y **no** hace falta agregar los clientes Android/iOS a `GOOGLE_CLIENT_IDS` (ver secciones 5 y 6).

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
| `GOOGLE_CLIENT_IDS` | Client ID web. Los clientes Android/iOS no hacen falta: la app pide el `idToken` con el `webClientId` |
| `APPLE_AUDIENCES` | `app.touchedblock,app.touchedblock.web` (bundle ID de la app iOS, primero, y Services ID de la web): audiencias aceptadas del `identityToken` de Apple. Sin ella, `POST /auth/apple` responde 503; sin el Services ID, el login con Apple de la web responde 401 (sección 6) |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CLIENT_ID` | Revocación del token de Apple al eliminar la cuenta (sección 6). Opcionales: si falta alguna, el login con Apple funciona y la API avisa en el log que omite la revocación. `APPLE_CLIENT_ID` = `app.touchedblock` (por defecto, la primera de `APPLE_AUDIENCES`); es solo el de respaldo: cada token se canjea y revoca con el `client_id` de su login (bundle ID en iOS, Services ID en la web). `APPLE_PRIVATE_KEY` = contenido del `.p8`, en una sola línea con `\n` en lugar de los saltos de línea. **Nunca en el repo** |
| `CORS_ORIGINS` | `https://web.touchedblock.app,https://sukushaing.github.io` (separados por coma). **Hay que cambiarlo en Dokploy**: el valor por defecto de `deploy/docker-compose.yml` solo se usa si la variable no existe, y hoy existe con el valor viejo |
| `ADMIN_TOKEN` | Moderación (sección 7): secreto de los endpoints `/admin/*` (cabecera `X-Admin-Token`). 48 bytes aleatorios (mínimo 32 caracteres; con menos la API no arranca). Vacía = `/admin/*` responde 404; los scripts de moderación funcionan igual. **Nunca en el repo** |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Moderación (sección 7, "Avisos por Telegram"): aviso por Telegram con cada reporte nuevo. Opcionales: si falta alguna, no se envía nada (el log de arranque dice "Avisos de reportes por Telegram desactivados"). El token es **secreto: nunca en el repo** |
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
| `EXPO_PUBLIC_APPLE_SERVICES_ID` | `app.touchedblock.web`: muestra el botón de Sign in with Apple en la web. **Crearla solo después de publicar la API con Apple web** (sección 6.8); vacía o sin crear = sin botón |
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

y un cliente **iOS** (creado el 18 nov 2026) con el bundle ID `app.touchedblock`: Client ID `1065315828810-pgb0mm5hgvgpi6anuvkv3152q7j1qgka.apps.googleusercontent.com` (no es secreto). En la app va como `iosClientId` (`src/platform/auth.native.ts`, solo en iOS) y su ID invertido, `com.googleusercontent.apps.1065315828810-pgb0mm5hgvgpi6anuvkv3152q7j1qgka`, como `iosUrlScheme` del plugin `@react-native-google-signin/google-signin` en `app.json`.

La app usa el Client ID **web** (`EXPO_PUBLIC_GOOGLE_CLIENT_ID`) como `webClientId` (también en iOS), así que el `idToken` trae la audiencia del cliente web y la API no cambia. Al publicar en Google Play hay que agregar otro cliente Android con la SHA-1 de la clave de firma de Play (Play Console → Integridad de la app).

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

## 6. Sign in with Apple (app iOS y web)

Qué botón de login se ve en cada plataforma:

| Plataforma | Botones | Condición |
|---|---|---|
| Android (APK) | Solo Google | — |
| App iOS | Apple (arriba) y Google | Apple: cuando iOS confirma que está disponible |
| Web | Apple (arriba) y Google | Apple: solo si el build tiene `EXPO_PUBLIC_APPLE_SERVICES_ID` (variable del repositorio). Sin ella, la web se ve como antes |

Por qué: Apple exige ofrecer Sign in with Apple en la app iOS si tiene otro login social (guía 4.8) y, si se puede crear cuenta con Apple, revocar su token al eliminar la cuenta (guía 5.1.1(v)). En la web no es obligatorio, pero así quien juega en el iPhone y en el computador entra con la misma cuenta. El código ya está (ver `api.md`, `POST /auth/apple`); lo que sigue es la configuración, que **solo puede hacer el dueño de la cuenta de Apple**.

Documentación oficial usada (revisada el 18 nov 2026):
- Configurar el entorno: https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple
- Services ID para la web: https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
- Crear la clave privada: https://developer.apple.com/help/account/keys/create-a-private-key y su Key ID: https://developer.apple.com/help/account/keys/get-a-key-identifier
- Avisos servidor a servidor: https://developer.apple.com/help/account/configure-app-capabilities/enabling-server-to-server-notifications y https://developer.apple.com/documentation/signinwithapple/processing-changes-for-sign-in-with-apple-accounts
- Sign in with Apple JS (web): https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple
- Canje y revocación del token: https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens

Los nombres de menús y botones de Apple están en inglés (así aparecen en su sitio). Apple cambia su interfaz de vez en cuando: si algún botón no calza exacto, la idea es la misma.

### 6.0 Antes de empezar

- **Membresía del Apple Developer Program** (pago anual, USD 99; https://developer.apple.com/programs/). Sin ella no aparece *Certificates, Identifiers & Profiles*. Una cuenta de Apple gratis **no** sirve.
- Entrar con el rol **Account Holder** o **Admin** (los otros roles no pueden crear claves).
- Tener a mano: acceso a Dokploy (pestaña *Environment* del Compose de la API) y a GitHub (*Settings* del repositorio).
- Los identificadores que usa el código (no cambiarlos sin cambiar también el código y las variables):
  - **App ID / bundle ID** de la app iOS: `app.touchedblock` (en `apps/client/app.json`).
  - **Services ID** de la web: `app.touchedblock.web` (puede ser otro, pero tiene que ser el mismo en Apple, en `APPLE_AUDIENCES` y en `EXPO_PUBLIC_APPLE_SERVICES_ID`).
  - **Return URL** de la web: `https://web.touchedblock.app/` (con la `/` final: el cliente la arma como `origen + "/"` y Apple exige que sea idéntica).

Orden recomendado (cada paso se comprueba antes de pasar al siguiente):
1. Apple Developer: App ID (6.1), Services ID (6.2), clave `.p8` (6.3), Team ID (6.4).
2. Convertir la clave a una línea (6.5) y pegar las variables en Dokploy (6.6).
3. Publicar la API con un tag nuevo (6.7).
4. Crear la variable de la web en GitHub y volver a publicar la web (6.8).
5. Probar (6.9).

Lista de verificación completa (marcar a medida que se avanza):

- [ ] **Apple Developer**: Sign in with Apple activado en el App ID `app.touchedblock` (6.1).
- [ ] **Apple Developer**: Services ID `app.touchedblock.web` con el dominio `web.touchedblock.app` y la Return URL `https://web.touchedblock.app/` (6.2).
- [ ] **Apple Developer**: clave `.p8` descargada y guardada en el gestor de contraseñas; anotar su Key ID (6.3) y el Team ID (6.4).
- [ ] **Opcional**: avisos servidor a servidor apuntando a `https://api.touchedblock.app/auth/apple/notifications` (6.1).
- [ ] **Dokploy → Environment**: `APPLE_AUDIENCES=app.touchedblock,app.touchedblock.web`, `APPLE_CLIENT_ID=app.touchedblock`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (en una línea, 6.5–6.6). Si se quieren los endpoints `/admin/*`, también `ADMIN_TOKEN` (sección 7). Para recibir cada reporte en el celular, también `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (sección 7, "Avisos por Telegram"; opcionales). Guardar (todavía sin *Deploy*: lo hace el tag).
- [ ] **Respaldo**: correr a mano la tarea `touched-block-respaldo` y revisar que diga `OK` (la versión trae migraciones nuevas).
- [ ] **Tag de la API** (6.7): lo crea Claude cuando el usuario le avisa; o `git tag vX.Y.Z && git push origin vX.Y.Z`. Comprobar `https://api.touchedblock.app/health`: versión nueva y `features` con `moderation`.
- [ ] **Nombres antiguos**: `check-usernames.mjs` (sección 7) y revisar la lista antes de renombrar.
- [ ] **Recién ahora, GitHub → Variables**: `EXPO_PUBLIC_APPLE_SERVICES_ID=app.touchedblock.web` y volver a correr *Desplegar la web en Cloudflare* (6.8).
- [ ] **Probar** en `https://web.touchedblock.app` (6.9): entrar con Apple, cerrar sesión, volver a entrar (el nombre se mantiene), eliminar una cuenta de prueba y comprobar que desaparece de *Iniciar sesión con Apple* en account.apple.com.
- [ ] **Avisarle a Claude** para actualizar la política de privacidad y `/eliminar-cuenta/` (hoy dicen que Apple estará disponible "cuando la app para iPhone esté disponible").

**No crear la variable de la web (paso 4) antes de publicar la API nueva (paso 3)**: la API de producción `v0.4.0` no conoce el campo `redirectUri` y respondería `400 validation_error` al login con Apple. Mientras la variable no exista, la web publicada en cada push a `main` funciona igual que hoy con la API `v0.4.0`.

### 6.1 App ID con Sign in with Apple (lo usan la app iOS y la web)

1. Abre https://developer.apple.com/account/resources (o https://developer.apple.com/account → **Certificates, Identifiers & Profiles**).
2. En la barra lateral, **Identifiers**. Arriba a la derecha, el filtro debe decir **App IDs**.
3. Busca `app.touchedblock` y ábrelo.
   - Si no existe: botón **+** (arriba a la izquierda) → **App IDs** → **Continue** → tipo **App** → **Continue** → *Description* "Touched Block", *Bundle ID* **Explicit** = `app.touchedblock` → sigue con el punto 4 en esa misma pantalla.
4. En la pestaña **Capabilities**, marca **Sign in with Apple** y presiona **Edit** (o **Configure**) a su derecha:
   - Elige **Enable as a primary App ID**.
   - **Server-to-Server Notification Endpoint**: `https://api.touchedblock.app/auth/apple/notifications` (opcional, recomendado: si alguien deja de usar su Apple ID con el juego o lo borra, la API borra su cuenta). Apple acepta una sola URL por grupo de apps y la exige con esquema, dominio y ruta.
   - **Save** en el cuadro.
5. **Save** arriba a la derecha y confirma (**Confirm**) si Apple avisa que se invalidan los perfiles de aprovisionamiento. EAS los regenera solo en el próximo build; si los hiciste a mano, regénéralos.
6. En `app.json` ya están `ios.usesAppleSignIn: true` y el plugin `expo-apple-authentication`, que agregan el *entitlement* a la app.

Comprobar: en **Identifiers → app.touchedblock**, la casilla **Sign in with Apple** queda marcada.

### 6.2 Services ID para la web

1. **Certificates, Identifiers & Profiles → Identifiers** → botón **+**.
2. Elige **Services IDs** → **Continue**.
3. *Description*: `Touched Block web` (es lo que ve la persona en la ventana de Apple). *Identifier*: `app.touchedblock.web`. → **Continue** → **Register**.
4. Vuelve a la lista. Arriba a la derecha cambia el filtro de **App IDs** a **Services IDs** y abre `app.touchedblock.web`.
5. Marca **Sign in with Apple** → **Configure**. En el cuadro:
   - **Primary App ID**: `app.touchedblock` (el del paso 6.1).
   - **Domains and Subdomains**: `web.touchedblock.app` (solo el dominio, sin `https://` ni `/`).
   - **Return URLs**: `https://web.touchedblock.app/` (exacta, con `https://` y la `/` final). Apple no acepta `localhost` ni IPs (ver 6.10).
   - **Next** → **Done**.
6. **Continue** → **Save**.

Según la documentación actual de Apple, para dominios y subdominios **no hace falta subir un archivo de verificación**. Si aun así el cuadro muestra un botón **Download**/**Verify** junto al dominio, ver "Dominio no verificado" en 6.11.

Comprobar: al reabrir el Services ID, **Sign in with Apple** está marcado y en **Configure** aparecen el dominio y la Return URL.

### 6.3 Clave privada (`.p8`) para el canje y la revocación

La API firma con esta clave el `client_secret` que Apple pide para canjear el `authorizationCode` y revocar el token al eliminar la cuenta. La misma clave sirve para la app (`app.touchedblock`) y para la web (`app.touchedblock.web`), porque el Services ID está agrupado con el App ID principal. Apple permite como máximo **dos** claves por App ID principal.

1. **Certificates, Identifiers & Profiles → Keys** (barra lateral) → botón **+**.
2. *Key Name*: `Touched Block Sign in with Apple`.
3. Marca **Sign in with Apple** → **Configure** (a la derecha) → *Primary App ID*: `app.touchedblock` → **Save**.
4. **Continue** → revisa → **Register** (o **Confirm**).
5. **Download**. Baja un archivo `AuthKey_XXXXXXXXXX.p8`.
   - **Solo se puede descargar una vez**: Apple no lo guarda. Guárdalo en el gestor de contraseñas. **Nunca** en el repo (es público).
   - Si se pierde: crea otra clave, cambia las variables y revoca la vieja (**Keys** → la clave → **Revoke**).
6. **Done**.
7. **Key ID**: en **Keys**, haz clic en la clave; el identificador (10 caracteres) aparece debajo del nombre. También es la parte `XXXXXXXXXX` del nombre del archivo.

### 6.4 Team ID

En https://developer.apple.com/account, baja hasta **Membership details**: el **Team ID** son 10 caracteres (letras y números). También aparece arriba a la derecha, junto al nombre del equipo, en *Certificates, Identifiers & Profiles*.

### 6.5 Pasar el `.p8` a una sola línea (Windows)

La pestaña *Environment* de Dokploy guarda una variable por línea, así que la clave va en **una línea** con `\n` (barra invertida y n, dos caracteres) en lugar de cada salto de línea. La API los vuelve a convertir.

En PowerShell (cambia la ruta por la de tu archivo); deja el resultado en el portapapeles:

```powershell
(Get-Content -Raw "$env:USERPROFILE\Downloads\AuthKey_XXXXXXXXXX.p8").Trim() -replace '\r?\n', '\n' | Set-Clipboard
```

Debe quedar así (todo en una línea, sin comillas):

```
-----BEGIN PRIVATE KEY-----\nMIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...\n-----END PRIVATE KEY-----
```

Para revisarlo antes de pegarlo, quita `| Set-Clipboard` y se imprime en la consola. No lo pegues en chats ni en issues.

### 6.6 Variables en Dokploy

Dokploy → proyecto **Touched Block** → Compose **API** → pestaña **Environment**. Agrega estas líneas al final (y lo mismo en la copia local `deploy/.env`, que está ignorada por git):

```
APPLE_AUDIENCES=app.touchedblock,app.touchedblock.web
APPLE_CLIENT_ID=app.touchedblock
APPLE_TEAM_ID=<Team ID, 10 caracteres>
APPLE_KEY_ID=<Key ID, 10 caracteres>
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----
```

- `APPLE_AUDIENCES`: audiencias aceptadas del `identityToken`. El de la app trae `aud = app.touchedblock`; el de la web, `aud = app.touchedblock.web`. **Las dos**, separadas por coma y sin espacios, con el bundle ID **primero** (sin la segunda, el login web responde `401 invalid_provider_token`).
- `APPLE_CLIENT_ID`: el bundle ID. Es el `client_id` de respaldo para los tokens guardados sin él; cada token nuevo se canjea y revoca con el `client_id` de su propio login (el `aud` del token), que la API guarda cifrado junto al token.
- `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`: de 6.3–6.5. Sin alguna, el login con Apple funciona igual, pero no se guarda el token y no se podrá revocar (aviso en el log).
- `CORS_ORIGINS` no cambia: ya incluye `https://web.touchedblock.app`.

**Save**. No hace falta *Deploy* todavía: el tag del paso siguiente despliega con estas variables. (Si despliegas ahora, la `v0.4.0` las ignora sin problema.)

### 6.7 Publicar la API nueva (tag)

La API con Apple web, el canje con el Services ID y la migración `20261118190000_add_identity_provider_refresh_token` (y las que haya en `main` en ese momento) se publica con el siguiente tag, p. ej.:

```bash
git tag v0.5.0
git push origin v0.5.0
```

`deploy-api.yml` corre los tests, sube la imagen y despliega en Dokploy (sección 3, "Publicar una versión de la API"). La API aplica las migraciones al arrancar.

Comprobar:
- `https://api.touchedblock.app/health` responde `{"status":"ok","db":"ok",…}`.
- En Dokploy → Compose **API** → **Logs** del servicio `api`, al arrancar no hay errores. El aviso `Revocación de Sign in with Apple desactivada: faltan …` aparece solo después de un login con Apple y significa que falta o está vacía una variable de 6.6.

### 6.8 Botón de Apple en la web (variable de GitHub)

1. GitHub → repositorio → **Settings → Secrets and variables → Actions** → pestaña **Variables** → **New repository variable**.
2. *Name*: `EXPO_PUBLIC_APPLE_SERVICES_ID`. *Value*: `app.touchedblock.web` → **Add variable**.
3. Vuelve a publicar la web: pestaña **Actions** → workflow **Desplegar la web en Cloudflare** → **Run workflow** (rama `main`). También vale cualquier push a `main` que toque el cliente.

`deploy-web.yml` pasa la variable a `expo export` (queda dentro del JS: no es secreta). Vacía o sin crear = sin botón de Apple. Para apagar el botón: borra la variable (o déjala vacía) y vuelve a publicar.

### 6.9 Probar

**Web** (en `https://web.touchedblock.app`, Safari o Chrome, de preferencia en una ventana privada):
1. Perfil → aparece **Iniciar sesión con Apple** (blanco, arriba del de Google, del mismo tamaño).
2. Al tocarlo se abre una ventana de Apple. La primera vez pide compartir nombre y correo (prueba también "Ocultar mi correo").
3. Vuelve con la sesión iniciada. El nombre de usuario sale del nombre de Apple (p. ej. `ana.perez`).
4. Cierra sesión y entra de nuevo: Apple ya **no** manda el nombre; la cuenta es la misma y el nombre guardado no cambia.
5. En el log de la API no debe aparecer `No se pudo guardar el token de Apple…`.
6. Eliminar la cuenta desde el Perfil: en https://account.apple.com → **Inicio de sesión y seguridad → Iniciar sesión con Apple**, "Touched Block web" debe desaparecer (puede tardar un poco).
7. Para repetir el "primer login" (con nombre): en esa misma página de Apple, deja de usar Iniciar sesión con Apple con Touched Block y entra otra vez.

**App iOS** (en un iPhone real; necesita Mac o EAS Build):
- Botón de Apple (blanco, arriba del de Google), primer login con nombre y correo, segundo login sin nombre, eliminar cuenta y ver que la app desaparece de *Ajustes → [tu nombre] → Iniciar sesión con Apple*; login con Google en iOS.
- **Publicar la API (6.7) antes de repartir la app iOS**: la API `v0.4.0` rechaza el campo `authorizationCode` (`400 validation_error`).

**Nombre de Apple**: Apple lo entrega solo en el primer login (iOS: `credential.fullName`; web: el objeto `user`). El cliente lo manda como `fullName`; si ese primer `POST /auth/apple` falla (p. ej. sin conexión), el cliente lo guarda en memoria y lo vuelve a mandar en el reintento (`lib/appleName.ts`). La API lo usa al crear la cuenta y, en una cuenta existente, solo lo completa si quedó vacía: nunca lo reemplaza ni lo borra. Si se recarga la página entre el fallo y el reintento, el nombre se pierde y la cuenta usa el correo para el nombre de usuario (se puede cambiar en el Perfil).

### 6.10 Probar en local (Apple no acepta `localhost`)

Apple exige que la Return URL tenga un dominio real (ni `localhost` ni IPs), y en la ventana emergente devuelve el resultado solo a una página del **mismo origen** que esa URL. Por eso el botón de Apple **no funciona en `http://localhost:8081`** (si pones `EXPO_PUBLIC_APPLE_SERVICES_ID` en local, el botón aparece, pero Apple responde con error).

- Lo que **sí** se prueba en local, sin Apple: la API con los tests (`pnpm --filter @tb/api test`: canje con el Services ID y el `redirect_uri`, revocación con el mismo `client_id`, nombre del primer login; y `test:e2e`, `test/apple.e2e-spec.ts`, con un verificador falso) y el cliente (`lib/appleName.test.ts`). El aspecto del botón se revisa con el dev server y esa variable.
- De punta a punta, lo más simple es probar en `https://web.touchedblock.app` tras publicar (6.7 y 6.8).
- Si hace falta probar antes desde el computador: un túnel HTTPS con dominio propio, p. ej. **Cloudflare Tunnel** con un subdominio fijo (`dev.touchedblock.app` → `http://localhost:8081`). Hay que agregar ese dominio y su Return URL (`https://dev.touchedblock.app/`) al Services ID (6.2), su origen a `CORS_ORIGINS` de la API que uses y apuntar el cliente a esa API. Los túneles con dominio aleatorio (`*.trycloudflare.com`) cambian en cada arranque y obligan a reconfigurar Apple cada vez.

### 6.11 Errores típicos

| Síntoma | Causa probable | Solución |
|---|---|---|
| La ventana de Apple muestra **invalid_client** | `EXPO_PUBLIC_APPLE_SERVICES_ID` no coincide con el Services ID, o el Services ID no tiene Sign in with Apple configurado y guardado (6.2), o se puso el bundle ID en la variable | Revisa el identificador exacto y que en 6.2 se haya hecho **Save** |
| La ventana de Apple dice que la **redirect_uri** / Return URL no es válida o no coincide | La Return URL registrada no es exactamente `https://web.touchedblock.app/` (falta la `/`, `http`, `www`…), o se probó desde otro dominio (localhost) | Corrige la Return URL en 6.2; prueba desde `https://web.touchedblock.app` |
| **Dominio no verificado** (*domain not verified*) junto a `web.touchedblock.app` | Cuentas antiguas de Apple pedían subir un archivo | Descarga el archivo que ofrece Apple, ponlo en `apps/client/public/.well-known/apple-developer-domain-association.txt`, publica la web y presiona **Verify** |
| El login web responde **401 invalid_provider_token** | Falta `app.touchedblock.web` en `APPLE_AUDIENCES` | Corrige la variable en Dokploy y *Deploy* |
| El login con Apple responde **400 validation_error** | La API de producción todavía es la `v0.4.0` (no conoce `redirectUri` ni `authorizationCode`) | Publica la API (6.7) |
| El login responde **503 provider_unavailable** | `APPLE_AUDIENCES` vacía | Agrégala (6.6) |
| Login OK, pero el log dice `Apple /auth/token respondió 400 (invalid_client)` | `client_secret` mal firmado: Team ID, Key ID o clave no coinciden, la clave no está asociada al App ID `app.touchedblock`, o la clave se pegó mal | Revisa 6.3–6.6 (la clave debe empezar con `-----BEGIN PRIVATE KEY-----\n`) |
| El log dice `… (invalid_grant)` | El código venció (5 min) o ya se usó, o el `redirect_uri` no coincide con el de la autorización | Vuelve a entrar; si se repite, revisa la Return URL |
| El log dice `Invalid key data` o similar al firmar | `APPLE_PRIVATE_KEY` incompleta o con saltos de línea reales | Repite 6.5 |
| El navegador **bloquea la ventana** de Apple | Bloqueador de ventanas emergentes | Permitir ventanas emergentes para `web.touchedblock.app` (el juego avisa con un mensaje) |
| La app no desaparece de la lista de Apple al eliminar la cuenta | La cuenta se creó antes de cargar las variables (no hay token guardado), o Apple falló al revocar (queda en el log) | Se guarda en el siguiente login de esa persona; la cuenta se borra igual |

Notas:
- El refresh token de Apple se guarda cifrado (AES-256-GCM con una clave derivada de `JWT_SECRET`) junto con el `client_id` con que se obtuvo. Si se cambia `JWT_SECRET`, los tokens ya guardados no se pueden descifrar y esas cuentas se borrarían sin revocar (queda un aviso en el log); se vuelven a guardar en el siguiente login de cada persona.
- Una misma persona entra a la **misma cuenta** desde la app iOS y desde la web: el `sub` de Apple es el mismo para todas las apps y webs agrupadas bajo el App ID principal.
- Los avisos de Apple (`consent-revoked`, `account-delete`/`account-deleted`) llegan con `aud = app.touchedblock` (el App ID principal), que ya está en `APPLE_AUDIENCES`.

---

## 7. Moderación (guía 1.2 de Apple)

Los nombres de usuario son el único contenido que un jugador escribe y otros ven. Apple exige (guía 1.2, contenido generado por usuarios): un filtro, una forma de **reportar** con respuesta a tiempo, una forma de **bloquear** y un contacto publicado. Lo que hay:

- **Filtro de nombres** en la API (`apps/api/src/users/username-filter.ts`): groserías, insultos, odio y suplantación. Rige al crear la cuenta y al cambiar el nombre. Los nombres que ya existían no se cambian solos (ver "Nombres antiguos").
- **Reportar y bloquear** en el juego: en las filas de los rankings y en el perfil público, con el mouse aparece un botón "⋯"; con el dedo, un toque sostenido (~500 ms). El menú tiene "Reportar nombre" y "Bloquear jugador". La lista de bloqueados (con "Desbloquear") está en el Perfil. Contrato en `docs/api.md`, sección "Moderación".
- **Contacto**: `contacto@touchedblock.app`, publicado en `https://touchedblock.app/soporte/` y en los términos.
- **Plazo**: **24 horas** para revisar cada reporte y actuar (cambiar el nombre o eliminar la cuenta). Lo dicen los términos, la página de soporte y el propio juego. La guía 1.2 solo pide "timely responses", pero el mensaje de rechazo de App Review por esta guía dice: *"The developer must act on objectionable content reports within 24 hours by removing the content and ejecting the user who provided the offending content."*

Los reportes quedan en la tabla `Report` (no hay aviso por correo; sí por Telegram si se configura, ver "Avisos por Telegram"). **Revisarlos al menos una vez al día** mientras la app esté en la App Store (y siempre antes de 24 h si llega un correo a contacto@).

### Consola de moderación

La **consola de moderación** es el script `moderation.mjs` (y su equivalente HTTP `/admin/*`). No tiene interfaz gráfica: se usa desde la terminal del contenedor. Dos formas equivalentes:

1. **Línea de comandos** (recomendada; no necesita `ADMIN_TOKEN`). En Dokploy: pestaña del Compose → contenedor `api` → *Terminal* (o en el VPS, en la carpeta del Compose, `docker compose exec api …`):

   ```sh
   # reportes pendientes (primero los más antiguos; dice cuántos tienen más de 24 h)
   docker compose exec api node scripts/moderation.mjs reports
   docker compose exec api node scripts/moderation.mjs reports --all          # también los cerrados

   # el nombre infringe: ponerle uno automático (jugadorNNNN) o uno elegido; cierra sus reportes
   docker compose exec api node scripts/moderation.mjs rename pepa.mala --dry-run
   docker compose exec api node scripts/moderation.mjs rename pepa.mala
   docker compose exec api node scripts/moderation.mjs rename pepa.mala pepa.nueva

   # caso grave o reincidente: eliminar la cuenta (como "Eliminar cuenta"; revoca Apple) y cerrar sus reportes
   docker compose exec api node scripts/moderation.mjs delete pepa.mala --yes

   # el reporte no tenía razón: descartarlo (por id, o todos los de un usuario con @)
   docker compose exec api node scripts/moderation.mjs resolve <idReporte> --dismiss --note="No infringe"
   docker compose exec api node scripts/moderation.mjs resolve @pepa --dismiss
   ```

   Sin argumentos muestra la ayuda. En local (con `pnpm --filter @tb/engine build` y `pnpm --filter @tb/api build`): `node apps/api/scripts/moderation.mjs reports`.

2. **HTTP** con `ADMIN_TOKEN` (variable del Compose; sin ella `/admin/*` responde 404). Por ejemplo, desde PowerShell:

   ```powershell
   $h = @{ 'X-Admin-Token' = '<ADMIN_TOKEN>' }
   Invoke-RestMethod https://api.touchedblock.app/admin/reports -Headers $h
   Invoke-RestMethod https://api.touchedblock.app/admin/users/pepa.mala/rename -Method Post -Headers $h -ContentType 'application/json' -Body '{}'
   Invoke-RestMethod https://api.touchedblock.app/admin/reports/<id>/resolve -Method Post -Headers $h -ContentType 'application/json' -Body '{"status":"dismissed","resolution":"No infringe"}'
   Invoke-RestMethod https://api.touchedblock.app/admin/users/pepa.mala -Method Delete -Headers $h
   ```

   Si el token no coincide, también responde 404 (a propósito: no revela que la ruta existe).

### Avisos por Telegram

Con dos variables, la API manda un mensaje de Telegram cada vez que alguien reporta a un jugador. Es opcional: sin ellas todo funciona igual, sin avisos. El mensaje se ve así:

```
🚩 Nuevo reporte en Touched Block
Usuario: @pepa.mala
Motivo: nombre ofensivo
Comentario: «texto que escribió quien reportó»
Pendientes: 2 de @pepa.mala · 3 en total
Hora: 2026-11-18 21:05 UTC (18:05 en Chile)

Revisar antes de 24 h: node scripts/moderation.mjs reports
```

- No dice quién reportó (eso se ve en `moderation.mjs reports`).
- Como mucho **un aviso por jugador reportado cada 10 minutos**. Si llegan más reportes contra el mismo jugador en ese rato, no avisan; se suman al próximo aviso de ese jugador con una línea "(+N reportes contra @… sin aviso propio…)". Los "Pendientes" siempre son los reales.
- Si Telegram falla o tarda (más de 5 s), el reporte se guarda igual y el error queda en los logs de la API (sin el token).

**Configurarlo (una vez, ~5 minutos):**

1. **Crear el bot.** Abre Telegram (celular o https://web.telegram.org) → en la búsqueda escribe `BotFather` y abre **@BotFather**, el que tiene la marca azul de verificado (hay copias falsas). Toca **Iniciar** (o escribe `/start`).
2. Escríbele `/newbot`. Te pide:
   - el **nombre** visible: `Touched Block Moderación`;
   - el **usuario** del bot: tiene que terminar en `bot` y no estar tomado, p. ej. `touchedblock_mod_bot` (si está tomado, prueba otro).
3. BotFather responde con el **token**, algo como `1234567890:AAH…` (después de "Use this token to access the HTTP API"). Cópialo y guárdalo en tu gestor de contraseñas. **Es secreto**: quien lo tenga puede escribir como el bot. No lo pegues en el repo, en issues ni en chats. (Si se filtra: en @BotFather, `/revoke` y elige el bot; da uno nuevo.)
4. **Deja que el bot te pueda escribir.** Toca el enlace `t.me/<usuario_del_bot>` que te dio BotFather (o búscalo por su usuario) y toca **Iniciar** (`/start`). Un bot no puede escribirle a nadie que no lo haya iniciado antes.
5. **Obtén tu chat id** (un número; el tuyo es el de tu cuenta de Telegram). Justo después del paso 4 (Telegram guarda esos mensajes 24 h):
   - **Opción A (navegador):** abre `https://api.telegram.org/bot<TOKEN>/getUpdates` reemplazando `<TOKEN>` por el token completo (sin los `<>`; queda `…/bot1234567890:AAH…/getUpdates`). Busca `"chat":{"id":` y copia el número que sigue, p. ej. `"chat":{"id":123456789,"first_name":"…"` → `123456789`. Si sale `"result":[]`, escríbele "hola" al bot y recarga. Esa dirección lleva el token: no la compartas y cierra la pestaña al terminar.
   - **Opción B (script, cuando la API ya tenga el token):** en la terminal del contenedor `api`, `node scripts/telegram-test.mjs --chat-id`. Muestra el `id` de cada chat que le escribió al bot (sin imprimir el token).
6. **Pégalas en Dokploy** → proyecto **Touched Block** → Compose **API** → pestaña **Environment**, al final (y en la copia local `deploy/.env`):

   ```
   TELEGRAM_BOT_TOKEN=1234567890:AAH...
   TELEGRAM_CHAT_ID=123456789
   ```

   **Save**. Las toma el siguiente despliegue (el tag de la API; o **Deploy** en Dokploy si la versión publicada ya trae los avisos).
7. **Probar**, después del tag: en los logs del servicio `api`, al arrancar aparece `Avisos de reportes por Telegram activados.` (si dice `desactivados (falta …)`, revisa el nombre de la variable). Luego, en la terminal del contenedor `api`:

   ```sh
   node scripts/telegram-test.mjs              # o: node scripts/moderation.mjs telegram-test
   ```

   Debe llegarte "✅ Prueba de avisos de Touched Block". Si dice `400 (Bad Request: chat not found)`, el chat id está mal o no tocaste Iniciar en el bot (paso 4); si dice `401 (Unauthorized)`, el token está mal copiado.

Para apagar los avisos: borra (o deja vacía) cualquiera de las dos variables y vuelve a desplegar.

### Rutina

- **Cuando llega un aviso de Telegram**: revisar ese reporte antes de 24 h (lo de abajo). Sin Telegram configurado, el único aviso es revisar a mano.
- **Cada día** (o al menos antes de que se cumplan 24 h desde el reporte más antiguo): `moderation.mjs reports`. Para cada reporte pendiente, mirar el nombre (`@usuario` y "reportado como"):
  - infringe → `rename` (lo normal) o `delete` (grave o reincidente);
  - no infringe → `resolve <id> --dismiss`.
- **Cada semana**: `moderation.mjs reports --all --limit=50` para ver lo resuelto, y `check-usernames.mjs` por si un nombre se coló.
- Si el mismo jugador vuelve a ponerse un nombre ofensivo (el filtro no lo atrapó), eliminar la cuenta.
- Si una palabra se cuela o el filtro rechaza algo inocente, agregarla en `username-filter.ts` con su caso en `username-filter.spec.ts` (positivo y negativo).

### Nombres antiguos

El filtro no cambia nombres existentes. Después de publicar la API con el filtro:

```sh
docker compose exec api node scripts/check-usernames.mjs                    # solo lista los que no pasan
docker compose exec api node scripts/check-usernames.mjs --rename --dry-run # qué nombre recibiría cada uno
docker compose exec api node scripts/check-usernames.mjs --rename           # les pone jugadorNNNN
```

Revisar la lista antes de `--rename`: puede haber falsos positivos (mejor cambiar esos uno por uno con `moderation.mjs rename`, o ajustar el filtro).

### Publicar

La web se publica sola y puede llegar antes que la API: el menú "⋯" solo aparece cuando `GET /health` trae `features: ["moderation"]`, así que con la API v0.4.0 no se ve nada nuevo. Para activarlo:

1. Agregar `ADMIN_TOKEN` en la pestaña Environment de Dokploy (opcional, solo para `/admin/*`) y, si se quieren los avisos, `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` ("Avisos por Telegram", arriba).
2. Crear el tag de la API (`vX.Y.Z`). La migración `20261118200000_add_moderation` solo agrega las tablas `Report` y `Block` (no toca datos).
3. Correr `check-usernames.mjs` (arriba).
