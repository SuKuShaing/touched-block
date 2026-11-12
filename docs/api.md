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
| 400 | `daily_date_invalid` | Fecha del reto diario mal formada, ausente o que ninguna zona horaria real tiene en este momento (ver "Reto diario") |
| 400 | `invalid_date` | `GET /missions` con una fecha mal formada o que ninguna zona horaria real tiene en este momento |
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
| 404 | `challenge_not_found` | Reto inexistente (o código sin la forma de un código) |
| 409 | `username_taken` | Nombre de usuario tomado |
| 409 | `country_change_too_soon` | Cambio de país antes de 30 días (incluye `nextCountryChangeAt`) |
| 409 | `inviter_already_set` | Ya se indicó quién te invitó |
| 409 | `run_already_finished` | La partida ya se había terminado |
| 409 | `run_already_claimed` | La partida de invitado ya tiene dueño |
| 409 | `run_not_finished` | Reclamar una partida que no se ha terminado |
| 409 | `run_not_valid` | Reclamar una partida rechazada |
| 409 | `daily_attempts_exhausted` | Ya se gastaron los 3 intentos del reto diario de esa fecha (al empezar), o se quiere reclamar una partida diaria de invitado cuando la cuenta ya empezó el reto de esa fecha |
| 409 | `username_generation_failed` | No se pudo generar un nombre libre (muy improbable; reintentar) |
| 410 | `claim_expired` | Pasó más de 1 h desde que terminó la partida de invitado |
| 410 | `challenge_expired` | Unirse a un reto vencido (30 días) o creado con otra versión de reglas |
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

`/health` no tiene límite. `GET /challenges/:code`, `GET /daily`, `GET /daily/leaderboard` y `GET /missions` usan el límite general.

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
  "createdAt": "2026-11-09T14:13:54.449Z",
  "stats": {
    "bestTicks": 16920,
    "bestStreak": 31,
    "totalKilled": 1245,
    "totalRuns": 58,
    "bonusXp": 90,
    "bestDailyPct": 72,
    "dailyStreakBest": 6
  },
  "tier": { "tier": "bronce", "step": 1 }
}
```

- `country`: ISO 3166-1 alfa-2 en mayúsculas, o `null`.
- `countryChangedAt`: último cambio manual de país. Es `null` si nunca lo cambió, y entonces el primer cambio es libre.
- `nextCountryChangeAt`: desde cuándo puede volver a cambiarlo. Es `null` si ya puede.
- `invitedBy`: es `null` si todavía no indicó quién lo invitó.
- `maxLives`: corazones con que juega, `min(5 + invitedCount, 8)`.
- `stats`: estadísticas del jugador (objeto `Stats`, abajo). Siempre viene; con ceros si todavía no jugó.
- `tier`: su insignia (`TierRef`, abajo), o `null` si todavía no terminó ninguna partida válida.

`stats` y `tier` también vienen en `user` de las respuestas de login (`LoginResponse`).

### `Stats` (estadísticas del jugador)

| Campo | Tipo | Qué es |
|---|---|---|
| `bestTicks` | number | Duración, en ticks (60 por segundo), de su partida más larga **de modo normal sin modificadores**. Define la insignia |
| `bestStreak` | number | Mejor racha en una partida **de modo normal sin modificadores** |
| `totalKilled` | number | Bloques destruidos en todas sus partidas válidas (todos los modos) |
| `totalRuns` | number | Partidas válidas (todos los modos) |
| `bonusXp` | number | Bloques extra para el nivel ganados con misiones del día |
| `bestDailyPct` | number \| null | Mejor "mejor que el N %" en un reto diario. `null` si nunca se registró uno. Se guarda al leer `GET /daily`, solo para días que ya cerraron (ver ahí); en un día con menos de 10 jugadores se guarda 0 (solo cuenta como participación) |
| `dailyStreakBest` | number | Mejor racha de días seguidos jugando el reto diario (`dailyStreak` del motor) |

Las partidas de reto (`duel`, `daily`) y las que tienen modificadores **no** suben `bestTicks` ni `bestStreak` (decisión D6); sí suman a `totalKilled` y `totalRuns`. Las partidas rechazadas no cuentan.

Las cuentas que ya existían al publicar la fase 2 recibieron sus totales de las partidas válidas guardadas (relleno de la migración). Su `bestStreak` parte en 0 hasta que se corre el script de relleno de rachas (ver [`despliegue.md`](despliegue.md)).

### `TierRef` (insignia)

```json
{ "tier": "madera", "step": 2 }
```

- `tier`: `"madera"`, `"bronce"`, `"plata"`, `"oro"` o `"diamante"`.
- `step`: 1, 2 o 3 en madera; siempre 1 en las demás.
- Se calcula con `tierRefForTicks(stats.bestTicks)` del motor (umbrales en `TIERS`); no se guarda. Es `null` cuando el jugador no tiene partidas válidas.

### `GameMods` (modificadores de una partida)

```json
{ "startAt": 140, "only": "mul", "lives": 3, "noRed": true }
```

Todos opcionales. Es el tipo `GameMods` del motor y se pasa tal cual a `createGame({ …, mods })`. En la API vale `null` cuando la partida no tiene modificadores (todas las normales y los retos a un amigo).

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
{ "status": "ok", "db": "ok", "rulesVersion": 5, "version": "v0.1.0", "time": "2026-11-09T14:13:54.353Z" }
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

`204`. Borra la cuenta con sus identidades, sesiones, partidas, récords, seguimientos, estadísticas, resultados de retos a un amigo y del reto diario, y premios de misiones. Quienes la tenían como "quién me invitó" quedan con `invitedBy: null`. Los retos que creó siguen existiendo (sin creador), con los resultados de los demás.

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

Busca el texto en **cualquier parte** del nombre de usuario. Antes de comparar, `q` se pasa a minúsculas, se le quitan las tildes y se deja solo con letras y números; del usuario se ignoran los puntos y guiones bajos (`"Sebastián S"` encuentra a `sebastian.sanhueza`). Devuelve hasta 20 resultados: primero los que **empiezan** con el texto y después el resto, cada grupo en orden alfabético.

`200`:

```json
{ "users": [{ "id": "…", "username": "pepa", "country": "CL", "isFollowing": true }] }
```

`isFollowing` solo viene con sesión. Si `q` queda vacío después de normalizarlo, o nadie calza, responde `{ "users": [] }`.

### `GET /users/:username` (sesión opcional; perfil público)

`200`:

```json
{
  "id": "…",
  "username": "pepa",
  "country": "CL",
  "tier": { "tier": "plata", "step": 1 },
  "best": { "killed": 42, "missed": 3, "achievedAt": "2026-11-09T14:13:54.449Z" },
  "invitedCount": 2,
  "followersCount": 5,
  "followingCount": 3,
  "createdAt": "2026-11-01T10:00:00.000Z",
  "isMe": false,
  "isFollowing": true
}
```

- `tier` es su insignia (`TierRef`), o `null` si no tiene partidas válidas. La insignia es pública.
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

1. **Antes de empezar a jugar**, el cliente llama `POST /runs` con el tamaño lógico del campo (y el modo, si es un reto). Recibe `seed`, `maxLives`, `fieldW`, `fieldH` y `mods`, y crea el juego con **exactamente esos valores de la respuesta**: `createGame({ seed, maxLives, fieldW, fieldH, mods })`. El servidor compara la duración simulada con el tiempo real transcurrido desde `POST /runs`, así que la partida no puede empezar antes de esa llamada.
2. Durante la partida guarda cada toque como `[tick, x, y]`, donde `tick` es `state.tick` en el momento del toque (antes del siguiente `step`). `x` e `y` deben ser **exactamente** los valores que se pasaron a `tap()`, en coordenadas del campo (`0…fieldW`, `0…fieldH` de la respuesta). Para que el JSON pese poco, conviene redondear las coordenadas (por ejemplo, a 1 decimal) **antes** de llamar a `tap`, no solo al enviarlas.
3. Al terminar (`state.over`), llama `POST /runs/:id/finish` con los toques y el resultado.
4. Si es invitado y después inicia sesión, llama `POST /runs/:id/claim` dentro de **1 hora**.

Si la API no responde en el paso 1, se juega con una semilla local (`randomSeed()`) y esa partida no puede entrar al ranking. Los retos (`duel`, `daily`) necesitan conexión: sin respuesta de `POST /runs` no hay reto.

### Modos de partida

| `mode` | Qué es | Campo (`fieldW`/`fieldH`) | Vidas | Modificadores | Ranking general, récord e historial | Estadísticas |
|---|---|---|---|---|---|---|
| `normal` (por defecto) | La partida de siempre | El que manda el cliente | `min(5 + invitados, 8)` con sesión; 5 como invitado | ninguno | Sí | Todas (`bestTicks` y `bestStreak` incluidos) |
| `duel` | Reto a un amigo: misma semilla y mismo campo para todos los que tengan el código | Lo decide el servidor (ver "Retos a un amigo") | 5 para todos | ninguno | **No** (D6) | Solo `totalKilled` y `totalRuns` |
| `daily` | Reto diario: misma partida para todos en una fecha | El del día (lo decide el servidor) | 5, o `mods.lives` si el modificador del día las cambia | Los del día (`dailyModsFor` del motor) | **No** (D6) | Solo `totalKilled` y `totalRuns` |

En `duel` y `daily` el cliente manda su tamaño real, como siempre, y **juega con el `fieldW`/`fieldH` que devuelve el servidor** (dibujado en un rectángulo escalado dentro de su pantalla). Los toques se envían en coordenadas de ese campo.

Las reglas actuales son la **versión 5** (`RULES_VERSION = 5` en `@tb/engine`): números hasta 10, bloques con sumas/restas y después multiplicaciones/divisiones, restas con resultado ≤ 0 como trampa, castigo por escape según la etapa (×5 / ×6 / ×7) combos que suman segundos y un corazón de recuperación cada 25 de racha. Las reglas exactas están en el motor (`packages/engine/src/constants.ts`) y en [`reglas-y-balance.md`](reglas-y-balance.md). Una buena partida puede durar 6–9 minutos: el límite de 2 h para enviarla y la comparación con el reloj real (+5 s) son relativos a la duración, así que no hay un tope de minutos de juego.

### `POST /runs` (sesión opcional)

```json
{ "fieldW": 390, "fieldH": 640 }
```

| Campo | Tipo | Obligatorio | Qué es |
|---|---|---|---|
| `fieldW`, `fieldH` | number | sí | Tamaño del campo en px lógicos (CSS), entre 160 y 4096. En los retos, el tamaño real de la pantalla del jugador |
| `mode` | `"normal"` \| `"duel"` \| `"daily"` | no (por defecto `"normal"`) | Modo de la partida |
| `challenge` | string (hasta 32) | no | Solo con `mode: "duel"`: código del reto al que se une. Se aceptan minúsculas y espacios alrededor. Sin él, se **crea** un reto nuevo |
| `date` | string `"AAAA-MM-DD"` | con `mode: "daily"` | Solo con `mode: "daily"`: fecha **local** del jugador (D7) |

Ejemplos: `{ "fieldW": 390, "fieldH": 640, "mode": "duel" }` (crear reto), `{ "fieldW": 412, "fieldH": 915, "mode": "duel", "challenge": "K7M2QXAB" }` (unirse), `{ "fieldW": 390, "fieldH": 640, "mode": "daily", "date": "2026-11-12" }` (reto diario).

Un cliente que manda solo `{ fieldW, fieldH }` recibe lo mismo que antes, más `mode: "normal"` y `mods: null`.

`201` (partida normal):

```json
{
  "runId": "efe6332b-b2d1-4490-8c4d-94fd6200dc11",
  "seed": 17496603,
  "maxLives": 5,
  "rulesVersion": 5,
  "fieldW": 390,
  "fieldH": 640,
  "startedAt": "2026-11-09T14:25:06.487Z",
  "claimToken": "Zii-47yTUO-vnPpKDq-Pq0kI1fDrd0y6zAKHHz3fgwU",
  "mode": "normal",
  "mods": null
}
```

- `claimToken` **solo para invitados**. El cliente lo guarda junto con `runId`: lo necesita para terminar y para reclamar la partida.
- `maxLives`: en `normal`, `min(5 + invitados, 8)` con sesión y `5` como invitado. En `duel`, 5. En `daily`, 5 o `mods.lives`.
- `fieldW`, `fieldH`: **el campo a jugar**. En `normal` es el enviado; en los retos lo decide el servidor.
- `mode`: el modo de la partida.
- `mods`: modificadores (`GameMods`) con que hay que crear el juego, o `null`.
- Si `rulesVersion` no coincide con el `RULES_VERSION` del motor del cliente, el cliente está desactualizado: hay que recargar la página.

`201` al **crear** un reto (`mode: "duel"` sin `challenge`): lo de arriba más

```json
{
  "mode": "duel",
  "mods": null,
  "maxLives": 5,
  "fieldW": 360,
  "fieldH": 540,
  "challengeCode": "K7M2QXAB",
  "challenge": { "code": "K7M2QXAB", "expiresAt": "2026-12-12T14:25:06.487Z", "creator": null }
}
```

`201` al **unirse** a un reto (`mode: "duel"` con `challenge`): igual, con la semilla y el campo del reto, y `creator` con el resultado de quien lo creó (o `null` si todavía no lo termina o su partida no fue válida):

```json
{
  "challengeCode": "K7M2QXAB",
  "challenge": {
    "code": "K7M2QXAB",
    "expiresAt": "2026-12-12T14:25:06.487Z",
    "creator": { "username": "seba", "tier": { "tier": "bronce", "step": 1 }, "killed": 47, "missed": 3 }
  }
}
```

- `creator.username` y `creator.tier` son `null` si el reto lo creó un invitado que no reclamó su partida.

`201` en el **reto diario** (`mode: "daily"`): lo de arriba más

```json
{
  "mode": "daily",
  "mods": { "startAt": 140 },
  "maxLives": 5,
  "fieldW": 360,
  "fieldH": 540,
  "daily": { "date": "2026-11-17", "number": 6, "title": "Directo a las sumas", "attemptsMax": 3, "attemptsUsed": 1 }
}
```

- `daily.number`: número del reto (`dailyNumber(date)` del motor; "Reto #6").
- `daily.title`: el modificador del día en palabras (`dailyModsFor(date).title`).
- `daily.attemptsMax`: 3 con sesión, 1 como invitado.
- `daily.attemptsUsed`: intentos gastados **contando este** (el intento se gasta al empezar). Como invitado siempre es 1: el servidor no puede contar los intentos de un invitado, así que el cliente lleva esa cuenta (clave local).

Errores:

| HTTP | `code` | Cuándo |
|---|---|---|
| 400 | `validation_error` | Cuerpo inválido. También `challenge` sin `mode: "duel"` o `date` sin `mode: "daily"` (`fields: [{ "field": "challenge", "problems": ["mode"] }]`) |
| 400 | `daily_date_invalid` | `mode: "daily"` sin `date`, con una fecha inválida o fuera de la ventana de fechas (ver "Reto diario") |
| 404 | `challenge_not_found` | El código no existe (o no tiene la forma de un código) |
| 409 | `daily_attempts_exhausted` | Con sesión, ya empezó 3 partidas del reto de esa fecha (terminadas o no) |
| 410 | `challenge_expired` | El reto venció (30 días) o es de otra versión de reglas |

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
- El cuerpo es el mismo en todos los modos.

El servidor repite la partida con el motor (`replay`, con la semilla, las vidas, el campo y los modificadores guardados al crearla) y la **rechaza** en estos casos:

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

Una partida rechazada no agrega ningún otro campo (tampoco `stats`, `challenge` ni `daily`), en ningún modo. En el reto diario el intento igual queda gastado.

Partida **normal** válida **con sesión**, `200`:

```json
{
  "runId": "…",
  "valid": true,
  "killed": 5,
  "missed": 1,
  "durationMs": 31250,
  "isNewBest": true,
  "newBestPeriods": ["week", "month", "year", "all"],
  "ranks": { "world": 12, "country": 3 },
  "stats": { "bestTicks": 1875, "bestStreak": 4, "totalKilled": 5, "totalRuns": 1, "bonusXp": 0, "bestDailyPct": null, "dailyStreakBest": 0 }
}
```

- `isNewBest` indica si es récord histórico.
- `newBestPeriods` lista los períodos donde mejoró el récord.
- `ranks` es la posición del **mejor puntaje histórico** del usuario, en el mundo y en su país. `country` es `null` si el usuario no tiene país, y `ranks` es `null` si el usuario aún no tiene récord.
- `stats`: las estadísticas del usuario **después** de esta partida (`Stats`). Comparándolas con las de antes (`GET /me`) el cliente sabe si subió de insignia o desbloqueó algo.

Partida **normal** válida **de invitado**, `200` (sin cambios):

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

Partida de **reto a un amigo** (`duel`) válida, `200`. No trae `isNewBest`, `newBestPeriods` ni `ranks` (no cuenta para el récord). Con sesión trae `stats` y `challenge`; como invitado, `claimable`, `claimExpiresAt` y `challenge`:

```json
{
  "runId": "…",
  "valid": true,
  "killed": 52,
  "missed": 2,
  "durationMs": 201300,
  "stats": { "…": "Stats" },
  "challenge": { "…": "ChallengeView (como GET /challenges/:code)" }
}
```

- `challenge` tiene el mismo formato que `GET /challenges/:code`, ya con este resultado incluido (si cuenta: con cuenta solo el primer intento de cada jugador). Su `isMe` marca el resultado de quien llama (con sesión) o el de esta partida (invitado).

Partida del **reto diario** (`daily`) válida **con sesión**, `200`. No trae `isNewBest`, `newBestPeriods` ni `ranks`:

```json
{
  "runId": "…",
  "valid": true,
  "killed": 58,
  "missed": 4,
  "durationMs": 241000,
  "stats": { "…": "Stats" },
  "daily": {
    "date": "2026-11-12",
    "number": 1,
    "attemptsLeft": 1,
    "isBestToday": true,
    "rank": 12,
    "total": 80,
    "betterThanPct": 86,
    "friends": { "beaten": 2, "total": 3 },
    "streak": { "current": 4, "best": 9 }
  }
}
```

| Campo de `daily` | Qué es |
|---|---|
| `date`, `number` | Fecha del reto y su número |
| `attemptsLeft` | Intentos que le quedan ese día (`3 − intentos empezados`) |
| `isBestToday` | Esta partida quedó como su mejor resultado del día |
| `rank` | Posición de su **mejor** resultado del día (cuántos tienen uno estrictamente mejor + 1). Mismo orden que los rankings |
| `total` | Jugadores con resultado ese día |
| `betterThanPct` | "Mejor que el N %": jugadores con peor puntaje que su mejor / (`total` − 1) × 100, hacia abajo. 0 si es el único. Con menos de 10 jugadores el cliente debería mostrar la posición ("Vas 2.º de 4") en vez del porcentaje |
| `friends` | Entre quienes sigue y jugaron ese día: `total`, y `beaten` = cuántos tienen peor puntaje que su mejor |
| `streak` | Racha de días jugando el reto (`dailyStreak` del motor con sus fechas jugadas, hoy = `date`): `current` y `best` |

Partida del **reto diario** válida **de invitado**, `200`: `claimable`, `claimExpiresAt` y dónde **habría** quedado:

```json
{
  "runId": "…",
  "valid": true,
  "killed": 58,
  "missed": 4,
  "durationMs": 241000,
  "claimable": true,
  "claimExpiresAt": "2026-11-12T15:25:06.487Z",
  "daily": { "date": "2026-11-12", "number": 1, "rank": 12, "total": 81, "betterThanPct": 86 }
}
```

- `rank`: posición que tendría (cuántos tienen un resultado estrictamente mejor + 1). `total` lo cuenta a él: jugadores con resultado + 1. `betterThanPct` con la misma fórmula. Su resultado **no** entra al ranking del día hasta que se reclame.

Errores: `404 run_not_found`, `403 not_your_run`, `403 invalid_claim_token`, `409 run_already_finished`, `400 validation_error`.

### `POST /runs/:id/claim` (requiere sesión)

```json
{ "claimToken": "Zii-47yTUO-…" }
```

Asigna al usuario una partida de invitado **válida** y actualiza sus récords y estadísticas. Para los récords cuenta la fecha en que terminó la partida. La partida conserva sus corazones de invitado, así que reclamarla no da ventaja.

`200`: igual que `finish` con sesión **del mismo modo**, sin `claimable`:

- `normal`: `valid`, `killed`, `missed`, `durationMs`, `isNewBest`, `newBestPeriods`, `ranks`, `stats`.
- `duel`: `valid`, `killed`, `missed`, `durationMs`, `stats`, `challenge`. El resultado del reto pasa a la cuenta. Si la cuenta ya tenía un resultado en ese reto, queda el del **primer** intento (por fecha) y el otro se descarta. Si el invitado había creado el reto, la cuenta queda como su creador.
- `daily`: `valid`, `killed`, `missed`, `durationMs`, `stats`, `daily` (con sesión). El intento de invitado (1, D8) pasa a ser el **primero** de la cuenta: solo se puede reclamar si la cuenta **todavía no empezó** el reto de esa fecha. Así se reclama como máximo **una** partida diaria por cuenta y fecha, y después le quedan 2 intentos con la cuenta. Si la cuenta ya tiene algún intento ese día (empezado, terminado o reclamado), responde `409 daily_attempts_exhausted` y la partida queda sin dueño. Va con el mismo bloqueo que `POST /runs`, así que dos reclamos simultáneos no pasan los dos.

Errores: `404 run_not_found`, `403 invalid_claim_token`, `409 run_already_claimed`, `409 run_not_finished`, `409 run_not_valid`, `409 daily_attempts_exhausted`, `410 claim_expired`.

Las partidas de invitado sin reclamar, y las que nunca se terminaron, se borran a las 24 h. Excepción: las partidas del reto diario **de una cuenta** que se empezaron y nunca se terminaron son intentos gastados y se borran recién a las **72 h**, cuando su fecha ya no se puede jugar (así no se recupera ningún intento).

### `GET /me/runs?period=week|month|year|all&limit=50` (requiere sesión)

Devuelve el historial de partidas **válidas de modo normal** del período actual, de la más reciente a la más antigua. Las partidas de reto (`duel`, `daily`) no aparecen (D6).

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
- Solo cuentan las partidas de modo `normal` (los retos no entran, D6).
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
    { "rank": 1, "userId": "…", "username": "ana", "country": "CL", "killed": 7, "missed": 0, "achievedAt": "2026-11-09T14:13:54.449Z", "tier": { "tier": "plata", "step": 1 }, "isMe": false },
    { "rank": 2, "userId": "…", "username": "beto", "country": "CL", "killed": 5, "missed": 2, "achievedAt": "2026-11-09T14:20:00.000Z", "tier": { "tier": "madera", "step": 3 }, "isMe": true }
  ],
  "me": { "rank": 2, "killed": 5, "missed": 2, "achievedAt": "2026-11-09T14:20:00.000Z", "tier": { "tier": "madera", "step": 3 } }
}
```

- `country` solo viene con `scope=country`.
- `total` es la cantidad de jugadores en ese ranking.
- `tier` (en cada fila y en `me`) es la insignia del jugador (`TierRef`), calculada con su mejor duración histórica. Puede ser `null` en casos raros (un jugador sin estadísticas).
- `isMe` solo viene con sesión.
- `me` es la fila fija con mi posición, calculada como la cantidad de jugadores con un puntaje estrictamente mejor + 1. Aunque esté fuera del top `limit`:
  - Sin sesión, `me` no viene.
  - Con sesión pero sin puntaje en ese período (o si no es de ese país), `me` es `null`.

---

## Retos a un amigo

Un reto es una semilla y un campo fijos, identificados por un **código** de 8 caracteres sin ambiguos (letras `A–Z` sin `I`, `L` ni `O`, y dígitos `2–9`), por ejemplo `K7M2QXAB`. Se crea y se juega con `POST /runs` (`mode: "duel"`, ver arriba). Vence a los **30 días** y deja de poder jugarse si cambia la versión de reglas; sus resultados se siguen pudiendo ver.

**Campo del reto** (decisión D4): al crearlo se fija el menor, en cada dimensión, entre el campo que manda el creador y el **campo común**. Quien se une juega ese mismo campo, cualquiera sea su pantalla (el cliente lo escala).

**Campo común**: percentil 5 del ancho y del alto de los campos enviados en las partidas válidas de modo `normal` de los últimos 30 días, acotado a ancho 320–430 y alto 440–800 y redondeado hacia abajo a px enteros. Con menos de 200 partidas en ese período vale 360 × 540. Se recalcula como máximo una vez por hora. *Todos estos números son provisorios.*

**Resultados**: cada partida **válida** de un reto guarda su resultado (copia propia: sobrevive a la limpieza de partidas de invitado). Con cuenta, solo cuenta el **primer** resultado válido de cada jugador en ese reto; las siguientes partidas se juegan (y suman a las estadísticas) pero no lo reemplazan. Cada partida de invitado guarda un resultado propio.

### `GET /challenges/:code?runId=` (sesión opcional)

- `:code`: el código (se aceptan minúsculas).
- `runId` (opcional, UUID): una partida propia. Sirve a los invitados: marca `isMe` en el resultado de esa partida.

`200`:

```json
{
  "code": "K7M2QXAB",
  "playable": true,
  "expiresAt": "2026-12-12T14:25:06.487Z",
  "fieldW": 360,
  "fieldH": 540,
  "entries": [
    { "username": "pepa", "tier": { "tier": "bronce", "step": 1 }, "killed": 52, "missed": 2, "isMe": true, "isCreator": false, "createdAt": "2026-11-12T15:00:00.000Z" },
    { "username": "seba", "tier": { "tier": "plata", "step": 1 }, "killed": 47, "missed": 3, "isMe": false, "isCreator": true, "createdAt": "2026-11-12T14:29:00.000Z" },
    { "username": null, "tier": null, "killed": 20, "missed": 6, "isMe": false, "isCreator": false, "createdAt": "2026-11-12T16:10:00.000Z" }
  ]
}
```

- `playable`: `false` si venció o es de otra versión de reglas (unirse daría `410 challenge_expired`).
- `entries`: hasta 100 resultados, ordenados como los rankings (más `killed`, menos `missed`, el más antiguo primero).
  - `username` y `tier` son `null` para un invitado que no reclamó su partida.
  - `isMe`: el resultado es de quien llama (con sesión) o de la partida `runId`.
  - `isCreator`: es la partida con que se creó el reto.
  - `createdAt`: cuándo terminó esa partida.

Errores: `404 challenge_not_found`, `400 validation_error` (`runId` que no es UUID). Sin límite especial (el general de 120 por minuto).

---

## Reto diario

Una partida por día, **igual para todos**: misma semilla, mismo campo y mismos modificadores.

- **Fecha**: la fecha **local** del jugador, `AAAA-MM-DD` (D7). El servidor la acepta solo si **alguna zona horaria real** (de UTC−12 a UTC+14) está en esa fecha en este momento: `D 00:00 UTC − 14 h ≤ ahora < (D+1) 00:00 UTC + 12 h`. Por ejemplo, el 13 se acepta desde las 10:00 UTC del 12 (medianoche en UTC+14) hasta las 12:00 UTC del 14 (medianoche en UTC−12), sin incluirla. Un jugador con el reloj bien puesto siempre está dentro; nadie recibe la semilla de una fecha que todavía no empezó en ningún lugar. Fuera de la ventana, `400 daily_date_invalid`. La misma ventana vale para `GET /daily` y `GET /missions`.
- **Semilla**: `HMAC-SHA256(DAILY_SECRET, fecha)` recortada a 31 bits. No se puede adivinar la de mañana, y el servidor no la entrega antes de que esa fecha empiece en alguna zona horaria.
- **Campo**: el campo común vigente cuando se juega la **primera** partida de esa fecha; desde ahí queda fijo para todos ese día.
- **Modificadores y título**: `dailyModsFor(fecha)` del motor (calendario por día de la semana). Vidas: 5, o `mods.lives`.
- **Número**: `dailyNumber(fecha)` del motor ("Reto #42").
- **Intentos** (D8): 3 con cuenta (cuenta el mejor) y 1 como invitado. Un intento se gasta **al empezar** (`POST /runs`), aunque la partida nunca se termine. El servidor cuenta los de las cuentas; los del invitado los cuenta el cliente. Una partida de invitado se puede reclamar solo si la cuenta todavía no empezó el reto de ese día (ver `POST /runs/:id/claim`).
- No entra al ranking general, al récord ni al historial (D6). Suma a `totalKilled` y `totalRuns`.
- **Ranking del día**: el mejor resultado de cada cuenta en esa fecha, con el mismo orden que los rankings.

### `GET /daily?date=AAAA-MM-DD` (sesión opcional)

- `date`: fecha local del jugador. Por defecto, la fecha UTC.

`200`:

```json
{
  "date": "2026-11-12",
  "number": 1,
  "title": "Solo multiplicaciones y divisiones",
  "mods": { "only": "mul" },
  "fieldW": 360,
  "fieldH": 540,
  "attemptsMax": 3,
  "attemptsUsed": 1,
  "best": { "killed": 58, "missed": 4, "bestStreak": 31, "achievedAt": "2026-11-12T15:00:00.000Z", "rank": 12 },
  "total": 80,
  "streak": { "current": 4, "best": 9 },
  "week": ["2026-11-07", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"],
  "yesterday": {
    "date": "2026-11-11",
    "rank": 12,
    "total": 80,
    "betterThanPct": 86,
    "winner": { "username": "jose", "killed": 91 }
  }
}
```

| Campo | Qué es |
|---|---|
| `date`, `number`, `title`, `mods` | El reto de esa fecha. `mods` es `GameMods` o `null` (día de partida normal) |
| `fieldW`, `fieldH` | Campo del día. Si todavía nadie jugó esa fecha, el campo común vigente (puede cambiar hasta que alguien juegue; la respuesta de `POST /runs` manda) |
| `attemptsMax` | 3 con sesión, 1 sin sesión |
| `attemptsUsed` | Con sesión, partidas del reto de esa fecha que empezó (terminadas o no). Sin sesión, siempre 0: el cliente lleva la cuenta del invitado |
| `best` | Con sesión, su mejor resultado del día con su posición (`rank`); `null` si no tiene o no hay sesión |
| `total` | Jugadores con resultado ese día |
| `streak` | Con sesión, su racha de días (`current`, `best`; ver `dailyStreak` del motor, hoy = `date`). Sin sesión, `{ "current": 0, "best": 0 }` |
| `week` | Con sesión, las fechas (`AAAA-MM-DD`, de la más antigua a la más reciente) en que jugó el reto diario (tiene resultado válido) dentro de los 7 días que terminan en `date`, incluida. Para la tira de la semana. Sin sesión, `[]` |
| `yesterday` | Resumen del día anterior a `date`, o `null` si ese día nadie tuvo resultado |
| `yesterday.rank`, `yesterday.betterThanPct` | Su posición y su "mejor que el N %" de ese día (misma fórmula que al terminar); `null` si no jugó ese día o no hay sesión |
| `yesterday.winner` | El primero de ese día (`username`, `killed`) |

`yesterday` es **provisorio**: ese día todavía puede estar jugándose en otras zonas horarias, así que no se guarda nada al leerlo.

**Mejor porcentaje** (`stats.bestDailyPct`): al leer `GET /daily` con sesión, se revisan los días de la semana anterior a `date` que el jugador jugó y que ya **cerraron**, y se guarda su "mejor que el N %" (se queda con el mayor). Un día cierra cuando su ranking ya no puede cambiar: la fecha sale de la ventana (medianoche en UTC−12, es decir, las 12:00 UTC del día siguiente), más 3 h para terminar las partidas empezadas (2 h) y reclamar las de invitado (1 h). Por ejemplo, el reto del 12 cierra el 13 a las 15:00 UTC. Si ese día hubo menos de 10 jugadores se guarda 0: cuenta solo como participación (*provisorio*), para que un día casi vacío no regale el logro.

Errores: `400 daily_date_invalid`.

### `GET /daily/leaderboard?date=AAAA-MM-DD&scope=world|country|friends&country=CL&limit=50` (sesión opcional)

Igual que `GET /leaderboards`, pero con los mejores resultados de una fecha del reto diario.

| Parámetro | Valores | Por defecto |
|---|---|---|
| `date` | `AAAA-MM-DD`: las pasadas y la que ya empezó en alguna zona horaria (`ahora ≥ D 00:00 UTC − 14 h`); una fecha que todavía no empezó en ningún lugar da `400 daily_date_invalid` | la fecha UTC |
| `scope` | `world`, `country` o `friends` | `world` |
| `country` | código ISO-2 | el país del usuario (solo para `scope=country`) |
| `limit` | 1 a 100 | 50 |

`200`:

```json
{
  "scope": "world",
  "date": "2026-11-12",
  "number": 1,
  "total": 2,
  "entries": [
    { "rank": 1, "userId": "…", "username": "ana", "country": "CL", "killed": 58, "missed": 4, "achievedAt": "2026-11-12T15:00:00.000Z", "tier": { "tier": "bronce", "step": 1 }, "isMe": false },
    { "rank": 2, "userId": "…", "username": "beto", "country": "AR", "killed": 40, "missed": 1, "achievedAt": "2026-11-12T16:00:00.000Z", "tier": null, "isMe": true }
  ],
  "me": { "rank": 2, "killed": 40, "missed": 1, "achievedAt": "2026-11-12T16:00:00.000Z", "tier": null }
}
```

- En vez de `period` y `periodKey` trae `date` y `number`. Lo demás (`country`, `total`, `entries`, `isMe`, `me`) funciona exactamente como en `GET /leaderboards`.
- El país de cada fila es el del jugador al registrar su resultado, y se mueve si cambia de país (como los récords).

Errores: `400 daily_date_invalid` (fecha mal formada o que todavía no empezó), `400 invalid_country`, `400 country_required`, `401` (`scope=friends` sin sesión), `400 validation_error`.

---

## Misiones del día

Tres misiones por día, elegidas por el motor a partir de la fecha (`missionsFor(fecha)`), con datos que el servidor ya verifica. Premio: bloques extra para el nivel (`stats.bonusXp`).

### `GET /missions?date=AAAA-MM-DD&tz=-180` (requiere sesión)

- `date`: fecha local del jugador. Por defecto, la fecha UTC. Debe estar dentro de la misma ventana que el reto diario (alguna zona horaria real está en esa fecha ahora); si no, `400 invalid_date`.
- `tz`: minutos **al este** de UTC, entero entre −840 y 840. El cliente manda `-new Date().getTimezoneOffset()` (Chile en verano: `-180`). Por defecto 0.

El avance se calcula al leer, con las partidas **válidas** del usuario cuyo fin (`finishedAt`) cae dentro de ese día local (`[medianoche local, +24 h)`):

| Dato del día (`DayAgg` del motor) | Cómo se calcula |
|---|---|
| `runs` | Partidas válidas de cualquier modo |
| `killed` | Bloques destruidos, sumando todas |
| `bestStreak` | Mejor racha, solo en partidas **sin modificadores** |
| `maxTicks` | Duración de la más larga, solo en partidas **sin modificadores** |
| `playedDaily` | Tiene una partida válida del reto diario de **esa fecha** (`date`) |

Y `missionProgress(mision, dia)` del motor da `value` y `done`.

`200`:

```json
{
  "date": "2026-11-12",
  "missions": [
    { "id": "racha15", "kind": "streak", "title": "Racha de 15", "target": 15, "value": 9, "done": false, "reward": 30, "rewarded": false },
    { "id": "destruye60", "kind": "killDay", "title": "Destruye 60 bloques hoy", "target": 60, "value": 60, "done": true, "reward": 30, "rewarded": true },
    { "id": "reto", "kind": "daily", "title": "Juega el reto del día", "target": 1, "value": 0, "done": false, "reward": 40, "rewarded": false }
  ],
  "bonusXp": 120
}
```

- `missions`: las tres del día, en el orden de `missionsFor(date)`. `id`, `kind`, `title`, `target` y `reward` vienen del motor.
- `value`: avance entre 0 y `target`. `done`: `value >= target`.
- `rewarded`: el premio de esa misión ya se entregó. **La primera vez que se lee una misión cumplida, el servidor la premia** (suma `reward` a `bonusXp`) una sola vez por usuario, fecha y misión, aunque se pidan varias veces o al mismo tiempo. Por eso, en la misma respuesta en que pasa a `done: true` ya viene `rewarded: true`.
- `bonusXp`: total de bloques extra del usuario, ya con los premios de esta lectura.

Errores: `401 unauthorized`, `400 invalid_date`, `400 validation_error` (`tz` fuera de rango o no entero).

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
| `DAILY_SECRET` | en producción | Secreto de la semilla del reto diario (HMAC-SHA256 de la fecha); al menos 32 caracteres. Fuera de producción, si falta, se usa un valor fijo de desarrollo. No cambiarlo una vez publicado: cambiaría la partida del día en curso |
| `GOOGLE_CLIENT_IDS` | para el login con Google | Client IDs de OAuth aceptados como audiencia, separados por coma (web hoy; Android/iOS después) |
| `APPLE_AUDIENCES` | no | Bundle ID / Services ID de Apple, separados por coma |
| `CORS_ORIGINS` | no | Orígenes permitidos, separados por coma (por defecto `http://localhost:8081`; `*` permite todos) |
| `PORT` | no | 3000 |
| `THROTTLE_LIMIT` | no | Peticiones por minuto por IP (120) |
| `CLEANUP_INTERVAL_MS` | no | Cada cuánto se limpian partidas viejas y sesiones vencidas (1 h; `0` la desactiva) |
| `TRUST_PROXY` | no | Valor de `trust proxy` de Express (por defecto `loopback, linklocal, uniquelocal`, que sirve detrás de Traefik/Dokploy) |
| `APP_VERSION` | no | Lo pone la imagen Docker (tag de git) y aparece en `/health` |
| `AUTH_DEV_FAKE` | no | Solo desarrollo: `1` acepta el login `dev:<sub>:<nombre>` en `/auth/google`. Se ignora con `NODE_ENV=production` |
