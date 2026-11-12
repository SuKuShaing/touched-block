# Despliegue

| Pieza | Dónde | Cuándo se publica |
|---|---|---|
| Web | GitHub Pages: `https://sukushaing.github.io/touched-block/` | Cada push a `main`, salvo que solo cambien `apps/api/**`, `deploy/**` o `docs/**`. También se puede lanzar a mano (*Run workflow*) |
| API + base de datos | VPS del usuario con **Dokploy** (servicio *Compose*) | Cada tag `vX.Y.Z` |

**Regla de oro**: el repositorio es **público**. Ningún secreto entra al repo. Los valores reales viven en Dokploy (pestaña Environment) y en los *Secrets* de GitHub. `.env` y `.env.*` están en `.gitignore`, salvo los `.env.example`.

---

## 1. Web (GitHub Pages)

`.github/workflows/deploy-pages.yml` hace lo siguiente:
1. Instala pnpm (versión de `packageManager` en `package.json`) y Node 24.
2. Ejecuta los tests del motor.
3. Corre `expo export -p web`.
4. Copia `index.html` a `404.html`, para que las rutas como `/rankings` funcionen al recargar.
5. Agrega `.nojekyll` y publica `apps/client/dist`.

La web lee dos **variables** del repositorio (no secretos; terminan dentro del JS público):

| Variable | Valor |
|---|---|
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID` | `1065315828810-mr72tnt45h219lvr056efbojdjpvman0.apps.googleusercontent.com` |
| `EXPO_PUBLIC_API_URL` | La URL HTTPS de la API en Dokploy, sin `/` al final (por ejemplo `https://api.tudominio.com`) |

Sin **las dos**, la web queda en modo solo invitado: funciona, pero sin pestañas ni rankings. Después de crearlas o cambiarlas hay que volver a publicar la web: haz un push a `main` o usa *Actions → Desplegar en GitHub Pages → Run workflow*.

## 2. Google Cloud (login con Google)

Ya hecho por el usuario el 9 nov 2026. El Client ID está arriba. Para rehacerlo o revisarlo, en https://console.cloud.google.com:

1. **APIs y servicios → Pantalla de consentimiento de OAuth** (*Google Auth Platform*).
   - Nombre de la app: "Touched Block".
   - Página principal: `https://sukushaing.github.io/touched-block/`.
   - Política de privacidad: `https://sukushaing.github.io/touched-block/politica-de-privacidad/`.
   - Condiciones del servicio: `https://sukushaing.github.io/touched-block/condiciones-del-servicio/`.
   - Usa las URLs **con `/` al final**: sin ella, GitHub Pages responde primero con una redirección 301.
   - Dominio autorizado: `sukushaing.github.io`.
2. **Clientes → Crear cliente → Aplicación web**. Orígenes de JavaScript autorizados: `https://sukushaing.github.io` y `http://localhost:8081`. No hacen falta URI de redirección: Google Identity Services entrega el `idToken` en la misma página.
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
| `CORS_ORIGINS` | `https://sukushaing.github.io` |
| `API_TAG` | `latest`. Para volver a una versión anterior: `v0.1.0`, etc. |

### Configuración inicial en Dokploy (una vez)

1. **DNS**: crea un registro A `api.<tu-dominio>` que apunte a la IP del VPS.
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
| `EXPO_PUBLIC_API_URL` | `https://api.<tu-dominio>`. Créala cuando la API responda |

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
6. Crea la variable `EXPO_PUBLIC_API_URL` en GitHub y vuelve a publicar la web (*Run workflow*). Desde ahí aparecen las cuentas y los rankings.

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
