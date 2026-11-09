# API de Touched Block

NestJS + Prisma + PostgreSQL. Todas las peticiones y respuestas son JSON (`Content-Type: application/json`). Las fechas van en ISO 8601 UTC (`"2026-11-09T14:13:54.449Z"`). Los mensajes de error (`message`) vienen en español y se pueden mostrar tal cual al usuario.

- **Local**: `http://localhost:3000` (ver "Desarrollo local" al final).
- **Producción**: `https://api.<dominio>` (variable `EXPO_PUBLIC_API_URL` del cliente).

## Sesión

- `accessToken`: JWT HS256 que dura **15 min** (`accessTokenExpiresIn: 900`). Se manda en cada petición como `Authorization: Bearer <accessToken>`. Guardarlo solo en memoria.
- `refreshToken`: token opaco que dura **60 días**. Guardarlo en `localStorage` (web) o `expo-secure-store` (nativo). **Rota en cada uso y sirve una sola vez**. Por eso el cliente debe serializar los refresh: una sola petición `/auth/refresh` en vuelo y las demás esperan su resultado. Si dos pestañas lo usan a la vez, una recibe `401 invalid_refresh_token` y debe volver a leer el token del almacenamiento o pedir un nuevo inicio de sesión.
- Ante un `401` con `code` `invalid_access_token`, el cliente llama a `/auth/refresh` y reintenta una vez. Si el refresh también falla, borra la sesión y sigue como invitado.

Las rutas son de tres tipos:

| Tipo | Sin `Authorization` | Con `Authorization` inválido o vencido |
|---|---|---|
| **Pública** | OK | se ignora |
| **Sesión opcional** | OK, como invitado | `401 invalid_access_token` (no se degrada a invitado en silencio) |
| **Requiere sesión** | `401 unauthorized` | `401 invalid_access_token` |

## Formato de error

Todas las respuestas de error tienen la misma forma:

```json
{ "statusCode": 409, "code": "username_taken", "message": "Ese nombre de usuario ya está tomado." }
```

Los errores de validación del cuerpo o de la query agregan `fields`. `problems` lista las reglas de class-validator que no se cumplieron:

```json
{
  "statusCode": 400,
  "code": "validation_error",
  "message": "Datos inválidos.",
  "fields": [{ "field": "fieldW", "problems": ["min"] }]
}
```

No se aceptan propiedades extra en los cuerpos: devuelven `400 validation_error` con `problems: ["whitelistValidation"]`.

### Códigos de error

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `validation_error` | Cuerpo o query inválidos (incluye `fields`) |
| 400 | `bad_request` | JSON mal formado |
| 400 | `invalid_username` | El nombre no cumple las reglas (el `message` dice cuál) |
| 400 | `invalid_country` | Código de país inexistente |
| 400 | `country_required` | Ranking de país sin `country` y sin país en el perfil |
| 400 | `inviter_self` | Ponerse a uno mismo como quien te invitó |
| 400 | `follow_self` | Seguirse a uno mismo |
| 400 | `invalid_user_id` | `:userId` no es un UUID |
| 401 | `unauthorized` | Falta la sesión |
| 401 | `invalid_access_token` | JWT inválido o vencido, o la cuenta ya no existe |
| 401 | `invalid_refresh_token` | Refresh token inválido, vencido, revocado o ya usado |
| 401 | `invalid_provider_token` | No se pudo verificar el token de Google o de Apple |
| 403 | `not_your_run` | Terminar la partida de otro usuario |
| 403 | `invalid_claim_token` | Falta el `claimToken` o no corresponde |
| 404 | `not_found` | Ruta inexistente |
| 404 | `user_not_found` | Usuario inexistente |
| 404 | `run_not_found` | Partida inexistente (o id que no es UUID) |
| 409 | `username_taken` | Nombre de usuario tomado |
| 409 | `country_change_too_soon` | Cambio de país antes de 30 días (incluye `nextCountryChangeAt`) |
| 409 | `inviter_already_set` | Ya se indicó quién te invitó |
| 409 | `run_already_finished` | La partida ya se había terminado |
| 409 | `run_already_claimed` | La partida de invitado ya tiene dueño |
| 409 | `run_not_finished` | Reclamar una partida que no se ha terminado |
| 409 | `run_not_valid` | Reclamar una partida rechazada |
| 409 | `username_generation_failed` | No se pudo generar un nombre libre (muy improbable; reintentar) |
| 410 | `claim_expired` | Pasó más de 1 h desde que terminó la partida de invitado |
| 413 | `payload_too_large` | Cuerpo de más de 1 MB |
| 429 | `too_many_requests` | Límite de peticiones (ver abajo) |
| 500 | `internal_error` | Error inesperado |
| 503 | `provider_unavailable` | Login con un proveedor sin configurar (por ejemplo, Apple hoy) |
| 503 | `db_unavailable` | `/health` sin base de datos |

### Límite de peticiones (por IP)

General: 120 por minuto (`THROTTLE_LIMIT`). Límites por ruta:

| Ruta | Límite por minuto |
|---|---|
| `/auth/google`, `/auth/apple`, `/auth/logout` | 20 |
| `/auth/refresh` | 30 |
| `POST /runs`, `POST /runs/:id/finish` | 30 |
| `POST /runs/:id/claim` | 20 |
| `/users/check-username`, `/users/search` | 60 |

`/health` no tiene límite.

---

## Objetos comunes

### `Me` (usuario con sesión)

```json
{
  "id": "6f1c2a7e-6a53-4c43-9d43-3f5d3b2a9c10",
  "username": "sebastian.sanhueza",
  "country": "CL",
  "countryChangedAt": null,
  "nextCountryChangeAt": null,
  "invitedBy": { "id": "0b6e…", "username": "pepa" },
  "invitedCount": 2,
  "maxLives": 7,
  "followingCount": 3,
  "followersCount": 5,
  "createdAt": "2026-11-09T14:13:54.449Z"
}
```

- `country`: ISO 3166-1 alfa-2 en mayúsculas, o `null`.
- `countryChangedAt`: último cambio manual de país. Es `null` si nunca lo cambió, y entonces el primer cambio es libre.
- `nextCountryChangeAt`: desde cuándo puede volver a cambiarlo. Es `null` si ya puede.
- `invitedBy`: es `null` si todavía no indicó quién lo invitó.
- `maxLives`: corazones con que juega, `min(5 + invitedCount, 8)`.

### `LoginResponse`

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs…",
  "accessTokenExpiresIn": 900,
  "refreshToken": "q8V3w…(43 caracteres)",
  "refreshTokenExpiresAt": "2027-01-08T14:13:54.449Z",
  "isNew": true,
  "user": { "…": "Me" }
}
```

`isNew` es `true` solo cuando la cuenta se creó en este inicio de sesión. El cliente puede aprovecharlo para ofrecer cambiar el nombre generado.

### Reglas del nombre de usuario

- Entre 3 y 20 caracteres.
- Solo `a-z`, `0-9`, `.` y `_`.
- No puede empezar ni terminar con `.`, ni tener `..`.
- Hay algunos nombres reservados (`admin`, `soporte`, `invitado`…).
- Al recibirlo se recortan los espacios, se quita una `@` inicial y se pasa a minúsculas, así que `@Pepa` equivale a `pepa`. Es único sin distinguir mayúsculas.
- Al registrarse se genera a partir del nombre de Google: "Sebastián Sanhueza" → `sebastian.sanhueza`. Si ese nombre está tomado, se agregan dígitos: `sebastian.sanhueza42`.

---

## Salud

### `GET /health` (pública)

`200`:

```json
{ "status": "ok", "db": "ok", "rulesVersion": 2, "version": "v0.1.0", "time": "2026-11-09T14:13:54.353Z" }
```

`503 db_unavailable` si la base no responde. Lo usan el `HEALTHCHECK` de Docker y Dokploy.

---

## Auth

### `POST /auth/google` (pública)

```json
{ "idToken": "<credential de Google Identity Services>", "country": "CL" }
```

- `idToken`: el JWT que entrega Google Identity Services (`credential`). Se verifica contra `GOOGLE_CLIENT_IDS`.
- `country` (opcional): región del navegador (`new Intl.Locale(navigator.language).region`). Solo se usa al **crear** la cuenta. Si no es un código ISO válido, se ignora y queda `null`.

`200` → `LoginResponse`. Errores: `401 invalid_provider_token`, `503 provider_unavailable`, `400 validation_error`.

**Login de desarrollo**: con `AUTH_DEV_FAKE=1` y `NODE_ENV` distinto de `production`, también acepta `idToken` con la forma `dev:<sub>:<nombre>` (`<sub>`: `a-z0-9_.-`, hasta 64 caracteres; `<nombre>`: hasta 60), sin hablar con Google. La identidad queda como `google` / `dev:<sub>`, así que el mismo `<sub>` vuelve a la misma cuenta. Sirve para probar el login de punta a punta en local (el cliente muestra "Entrar (dev)" con `EXPO_PUBLIC_AUTH_DEV_FAKE=1`). En producción esa variable se ignora y el token se verifica con Google como siempre.

### `POST /auth/apple` (pública; queda lista para la app iOS)

```json
{ "identityToken": "<JWT de Sign in with Apple>", "fullName": "Ana Pérez", "country": "CL" }
```

- `fullName` (opcional): Apple solo lo entrega en el primer inicio de sesión.
- Requiere `APPLE_AUDIENCES`. Sin esa variable responde `503 provider_unavailable`.

`200` → `LoginResponse`.

### `POST /auth/refresh` (pública)

```json
{ "refreshToken": "q8V3w…" }
```

`200` → `LoginResponse`, con un `refreshToken` **nuevo** e `isNew: false`. El anterior queda revocado. Error: `401 invalid_refresh_token`.

### `POST /auth/logout` (pública)

```json
{ "refreshToken": "q8V3w…" }
```

`204` sin cuerpo. Revoca ese refresh token. El access token sigue siendo válido hasta que vence (15 min máx.), así que el cliente debe descartarlo.

---

## Usuarios

### `GET /me` (requiere sesión)

`200` → `Me`.

### `PATCH /me` (requiere sesión)

```json
{ "username": "pepa_99", "country": "AR" }
```

Ambos campos son opcionales. Enviar el mismo valor que ya tiene no hace nada.

- **País**: el primer cambio manual es libre; después, uno cada **30 días**. Al cambiarlo, se mueven a ese país todos los récords del usuario, así que el usuario aparece en el ranking del país nuevo.

`200` → `Me` actualizado. Errores:

- `400 invalid_username`, con el motivo en `message`.
- `409 username_taken`.
- `400 invalid_country`.
- `409 country_change_too_soon`:

  ```json
  { "statusCode": 409, "code": "country_change_too_soon", "message": "Solo puedes cambiar de país una vez cada 30 días.", "nextCountryChangeAt": "2026-12-09T14:13:54.449Z" }
  ```

### `DELETE /me` (requiere sesión)

`204`. Borra la cuenta con sus identidades, sesiones, partidas, récords y seguimientos. Quienes la tenían como "quién me invitó" quedan con `invitedBy: null`.

### `GET /users/check-username?u=Pepa` (sesión opcional)

`200`:

```json
{ "username": "pepa", "valid": true, "available": false, "message": "Ese nombre de usuario ya está tomado." }
```

- `username` es el valor normalizado.
- Si el nombre no es válido, responde `valid: false`, `available: false` y el motivo en `message`.
- Con sesión, el nombre propio aparece como `available: true`.
- `message` solo viene cuando `valid` o `available` es `false`.

### `GET /users/search?q=pe` (sesión opcional)

Busca por prefijo del nombre de usuario. Devuelve hasta 20 resultados, en orden alfabético.

`200`:

```json
{ "users": [{ "id": "…", "username": "pepa", "country": "CL", "isFollowing": true }] }
```

`isFollowing` solo viene con sesión. Si `q` queda vacío después de normalizarlo, responde `{ "users": [] }`.

### `GET /users/:username` (sesión opcional; perfil público)

`200`:

```json
{
  "id": "…",
  "username": "pepa",
  "country": "CL",
  "best": { "killed": 42, "missed": 3, "achievedAt": "2026-11-09T14:13:54.449Z" },
  "invitedCount": 2,
  "followersCount": 5,
  "followingCount": 3,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "isMe": false,
  "isFollowing": true
}
```

- `best` es el récord histórico con la versión de reglas actual, o `null`.
- `isMe` e `isFollowing` solo vienen con sesión.

Error: `404 user_not_found`.

---

## Social

### `POST /me/inviter` (requiere sesión): "¿Quién te invitó?"

```json
{ "username": "@pepa" }
```

- Se puede indicar **una sola vez** y nunca a uno mismo.
- Ambos usuarios quedan siguiéndose mutuamente.
- Quien invitó gana un corazón, hasta un máximo de 8.

`200`:

```json
{ "inviter": { "id": "…", "username": "pepa" }, "inviterInvitedCount": 3, "inviterMaxLives": 8 }
```

Errores: `404 user_not_found`, `400 inviter_self`, `409 inviter_already_set`.

### `POST /follows/:userId` (requiere sesión)

`204`. Es idempotente: seguir de nuevo a alguien no da error. Errores: `400 follow_self`, `400 invalid_user_id`, `404 user_not_found`.

### `DELETE /follows/:userId` (requiere sesión)

`204`. Es idempotente.

### `GET /me/following` y `GET /me/followers` (requieren sesión)

`200`:

```json
{ "users": [{ "id": "…", "username": "pepa", "country": "CL", "followedAt": "2026-11-09T14:13:54.449Z" }] }
```

Ordenados del más reciente al más antiguo.

---

## Partidas

### Flujo

1. **Antes de empezar a jugar**, el cliente llama `POST /runs` con el tamaño lógico del campo. Recibe `seed` y `maxLives` y crea el juego con exactamente esos valores: `createGame({ seed, maxLives, fieldW, fieldH })`. El servidor compara la duración simulada con el tiempo real transcurrido desde `POST /runs`, así que la partida no puede empezar antes de esa llamada.
2. Durante la partida guarda cada toque como `[tick, x, y]`, donde `tick` es `state.tick` en el momento del toque (antes del siguiente `step`). `x` e `y` deben ser **exactamente** los valores que se pasaron a `tap()`. Para que el JSON pese poco, conviene redondear las coordenadas (por ejemplo, a 1 decimal) **antes** de llamar a `tap`, no solo al enviarlas.
3. Al terminar (`state.over`), llama `POST /runs/:id/finish` con los toques y el resultado.
4. Si es invitado y después inicia sesión, llama `POST /runs/:id/claim` dentro de **1 hora**.

Si la API no responde en el paso 1, se juega con una semilla local (`randomSeed()`) y esa partida no puede entrar al ranking.

Las reglas actuales son la **versión 2** (`RULES_VERSION = 2` en `@tb/engine`): números hasta 10, bloques con sumas/restas y después multiplicaciones/divisiones, restas con resultado ≤ 0 como trampa, castigo por escape según el tipo (×3 / ×4 / ×5) y combos que suman segundos. Las reglas exactas están en el motor (`packages/engine/src/constants.ts`). Una buena partida puede durar 6–9 minutos: el límite de 2 h para enviarla y la comparación con el reloj real (+5 s) son relativos a la duración, así que no hay un tope de minutos de juego.

### `POST /runs` (sesión opcional)

```json
{ "fieldW": 390, "fieldH": 640 }
```

`fieldW` y `fieldH` son números entre 160 y 4096, en px lógicos (CSS).

`201`:

```json
{
  "runId": "efe6332b-b2d1-4490-8c4d-94fd6200dc11",
  "seed": 17496603,
  "maxLives": 5,
  "rulesVersion": 2,
  "fieldW": 390,
  "fieldH": 640,
  "startedAt": "2026-11-09T14:25:06.487Z",
  "claimToken": "Zii-47yTUO-vnPpKDq-Pq0kI1fDrd0y6zAKHHz3fgwU"
}
```

- `claimToken` **solo para invitados**. El cliente lo guarda junto con `runId`: lo necesita para terminar y para reclamar la partida.
- `maxLives` vale `min(5 + invitados, 8)` con sesión y `5` como invitado.
- Si `rulesVersion` no coincide con el `RULES_VERSION` del motor del cliente, el cliente está desactualizado: hay que recargar la página.

### `POST /runs/:id/finish` (sesión opcional)

```json
{
  "inputs": [[12, 101.5, 230.2], [19, 101.5, 230.2], [31, 250, 410.7]],
  "killed": 5,
  "missed": 1,
  "claimToken": "Zii-47yTUO-…"
}
```

- Si la partida se creó con sesión, solo su dueño puede terminarla (`403 not_your_run`).
- Si es de invitado, `claimToken` es obligatorio, haya o no sesión (`403 invalid_claim_token`).
- `inputs` admite como máximo 50 000 toques.

El servidor repite la partida con el motor (`replay`) y la **rechaza** en estos casos:

| `reason` | Motivo |
|---|---|
| `rules_version` | La partida se creó con otra versión de reglas |
| `expired` | Se envió más de 2 h después de `POST /runs` |
| `invalid_inputs` | Toques mal formados o fuera de orden |
| `out_of_bounds` | Algún toque fuera de `[0, fieldW] × [0, fieldH]` |
| `tap_rate` | Más de 15 toques/s sostenidos (ventana de 3 s) o más de 25 en 1 s |
| `not_finished` | La repetición no termina dentro del tiempo real transcurrido (+5 s de holgura) |
| `unused_inputs` | Hay toques después del final |
| `mismatch` | `killed` o `missed` no coinciden con la repetición |

Una partida rechazada responde igual con **`200`**, `valid: false` y los valores calculados por el servidor:

```json
{
  "runId": "…",
  "valid": false,
  "killed": 5,
  "missed": 1,
  "durationMs": 31250,
  "reason": "mismatch",
  "message": "El resultado no coincide con la repetición de la partida."
}
```

Partida válida **con sesión**, `200`:

```json
{
  "runId": "…",
  "valid": true,
  "killed": 5,
  "missed": 1,
  "durationMs": 31250,
  "isNewBest": true,
  "newBestPeriods": ["week", "month", "year", "all"],
  "ranks": { "world": 12, "country": 3 }
}
```

- `isNewBest` indica si es récord histórico.
- `newBestPeriods` lista los períodos donde mejoró el récord.
- `ranks` es la posición del **mejor puntaje histórico** del usuario, en el mundo y en su país. `country` es `null` si el usuario no tiene país, y `ranks` es `null` si el usuario aún no tiene récord.

Partida válida **de invitado**, `200`:

```json
{
  "runId": "…",
  "valid": true,
  "killed": 5,
  "missed": 1,
  "durationMs": 31250,
  "claimable": true,
  "claimExpiresAt": "2026-11-09T15:25:06.487Z"
}
```

Errores: `404 run_not_found`, `403 not_your_run`, `403 invalid_claim_token`, `409 run_already_finished`, `400 validation_error`.

### `POST /runs/:id/claim` (requiere sesión)

```json
{ "claimToken": "Zii-47yTUO-…" }
```

Asigna al usuario una partida de invitado **válida** y actualiza sus récords. Para los récords cuenta la fecha en que terminó la partida. La partida conserva sus 5 corazones de invitado, así que reclamarla no da ventaja.

`200`: igual que `finish` con sesión (`valid`, `killed`, `missed`, `durationMs`, `isNewBest`, `newBestPeriods`, `ranks`).

Errores: `404 run_not_found`, `403 invalid_claim_token`, `409 run_already_claimed`, `409 run_not_finished`, `409 run_not_valid`, `410 claim_expired`.

Las partidas de invitado sin reclamar, y las que nunca se terminaron, se borran a las 24 h.

### `GET /me/runs?period=week|month|year|all&limit=50` (requiere sesión)

Devuelve el historial de partidas **válidas** del período actual, de la más reciente a la más antigua.

- `period`: por defecto `all`.
- `limit`: entre 1 y 100; por defecto 50.

`200`:

```json
{
  "period": "week",
  "periodKey": "2026-W46",
  "best": { "runId": "…", "killed": 42, "missed": 3, "achievedAt": "2026-11-09T14:13:54.449Z" },
  "runs": [
    { "id": "…", "killed": 42, "missed": 3, "durationMs": 95000, "maxLives": 6, "finishedAt": "2026-11-09T14:13:54.449Z", "isBest": true }
  ]
}
```

---

## Rankings

### `GET /leaderboards?scope=world|country|friends&period=week|month|year|all&country=CL&limit=50` (sesión opcional)

| Parámetro | Valores | Por defecto |
|---|---|---|
| `scope` | `world`, `country` o `friends` | `world` |
| `period` | `week`, `month`, `year` o `all` | `all` |
| `country` | código ISO-2 | el país del usuario (solo para `scope=country`) |
| `limit` | 1 a 100 | 50 |

- **Períodos (UTC)**: `week` es la semana ISO actual, de lunes a domingo (`"2026-W46"`); `month` es el mes actual (`"2026-11"`); `year` es el año actual (`"2026"`); `all` es el histórico (`"all"`).
- **Orden**: más `killed`; a igualdad, menos `missed`; si sigue el empate, gana quien lo logró antes (`achievedAt`).
- Cada usuario aparece una vez por período, con su mejor partida.
- `scope=country` sin `country` y sin sesión (o con un usuario sin país) da `400 country_required`.
- `scope=friends` requiere sesión (`401`). Incluye a las personas que sigo **y a mí**.
- Solo cuentan las partidas con el `RULES_VERSION` actual. Al subir esa versión, los rankings parten de cero.

`200`:

```json
{
  "scope": "country",
  "period": "week",
  "periodKey": "2026-W46",
  "country": "CL",
  "total": 3,
  "entries": [
    { "rank": 1, "userId": "…", "username": "ana", "country": "CL", "killed": 7, "missed": 0, "achievedAt": "2026-11-09T14:13:54.449Z", "isMe": false },
    { "rank": 2, "userId": "…", "username": "beto", "country": "CL", "killed": 5, "missed": 2, "achievedAt": "2026-11-09T14:20:00.000Z", "isMe": true }
  ],
  "me": { "rank": 2, "killed": 5, "missed": 2, "achievedAt": "2026-11-09T14:20:00.000Z" }
}
```

- `country` solo viene con `scope=country`.
- `total` es la cantidad de jugadores en ese ranking.
- `isMe` solo viene con sesión.
- `me` es la fila fija con mi posición, calculada como la cantidad de jugadores con un puntaje estrictamente mejor + 1. Aunque esté fuera del top `limit`:
  - Sin sesión, `me` no viene.
  - Con sesión pero sin puntaje en ese período (o si no es de ese país), `me` es `null`.

---

## Desarrollo local

```bash
# 1. Postgres (puerto 5434 del host; crea touched_block y touched_block_test)
docker compose -f apps/api/docker-compose.yml up -d --wait

# 2. Variables
cp apps/api/.env.example apps/api/.env

# 3. Dependencias, motor, migraciones
pnpm install
pnpm --filter @tb/engine build
pnpm --filter @tb/api prisma:deploy     # o prisma:migrate para crear migraciones nuevas

# 4. API con recarga automática en http://localhost:3000
pnpm --filter @tb/api start:dev

# Tests
pnpm --filter @tb/api test         # unitarios
pnpm --filter @tb/api test:e2e     # e2e contra touched_block_test (verificador de Google simulado)
```

Imagen Docker (el contexto es la raíz del repositorio):

```bash
docker build -f apps/api/Dockerfile -t touched-block-api .
docker run --rm -p 3000:3000 --network touched-block_default \
  -e DATABASE_URL=postgresql://tb:tb@db:5432/touched_block \
  -e JWT_SECRET=<secreto de 32+ caracteres> -e GOOGLE_CLIENT_IDS=<client id> \
  -e CORS_ORIGINS=http://localhost:8081 touched-block-api
```

Al arrancar, el contenedor aplica las migraciones pendientes (`prisma migrate deploy`) y luego inicia la API.

### Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | sí | `postgresql://usuario:clave@host:5432/base` |
| `JWT_SECRET` | sí | Secreto HS256; en producción, al menos 32 caracteres |
| `GOOGLE_CLIENT_IDS` | para el login con Google | Client IDs de OAuth aceptados como audiencia, separados por coma (web hoy; Android/iOS después) |
| `APPLE_AUDIENCES` | no | Bundle ID / Services ID de Apple, separados por coma |
| `CORS_ORIGINS` | no | Orígenes permitidos, separados por coma (por defecto `http://localhost:8081`; `*` permite todos) |
| `PORT` | no | 3000 |
| `THROTTLE_LIMIT` | no | Peticiones por minuto por IP (120) |
| `CLEANUP_INTERVAL_MS` | no | Cada cuánto se limpian partidas viejas y sesiones vencidas (1 h; `0` la desactiva) |
| `TRUST_PROXY` | no | Valor de `trust proxy` de Express (por defecto `loopback, linklocal, uniquelocal`, que sirve detrás de Traefik/Dokploy) |
| `APP_VERSION` | no | Lo pone la imagen Docker (tag de git) y aparece en `/health` |
| `AUTH_DEV_FAKE` | no | Solo desarrollo: `1` acepta el login `dev:<sub>:<nombre>` en `/auth/google`. Se ignora con `NODE_ENV=production` |
