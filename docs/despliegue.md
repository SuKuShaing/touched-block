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

Las migraciones de Prisma no se deshacen solas. Si la versión nueva cambió el esquema, revisa la compatibilidad antes de volver atrás.

### Respaldos

El volumen `tb_pgdata` guarda todo. Dokploy no lo respalda solo en un Compose. Opciones:
- Programar `pg_dump` (por ejemplo con *Schedules* de Dokploy):
  ```bash
  docker compose exec tb-db pg_dump -U tb touched_block > respaldo.sql
  ```
- Usar *Volume Backups* de Dokploy hacia S3.

Pendiente de decidir con el usuario.

## 4. Desarrollo local con cuentas

- `apps/api/.env` y `apps/client/.env` (ignorados) ya tienen el Client ID real y apuntan a `http://localhost:3000`.
- Para probar sin Google: `AUTH_DEV_FAKE=1` en la API y `EXPO_PUBLIC_AUTH_DEV_FAKE=1` en el cliente. Aparece un login falso "Entrar (dev)", que la API ignora con `NODE_ENV=production`.
- Comandos en [`desarrollo.md`](desarrollo.md).
