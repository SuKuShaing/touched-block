# Arquitectura

Monorepo con **pnpm workspaces** (`pnpm-workspace.yaml`: `apps/*`, `packages/*`).

```
packages/engine/   @tb/engine   reglas del juego, TypeScript puro y determinista
apps/client/       @tb/client   web (Expo Router SDK 58, react-native-web); mañana Android/iOS
apps/api/          @tb/api      NestJS 12 + Prisma 7 + PostgreSQL
deploy/                         docker-compose de producción para Dokploy (API + Postgres)
legacy/                         juego original HTML/CSS/JS (reglas v6), solo referencia
docs/                           esta documentación
```

## 1. Motor (`packages/engine`)

| Archivo | Contenido |
|---|---|
| `src/constants.ts` | **Todas** las constantes de balance, curvas de progresión, combos, castigos por etapa (`missMultAt`), colores, `RULES_VERSION` |
| `src/game.ts` | Estado y reglas: `createGame`, `step`, `tap`, `blockAt`, `drainEvents` |
| `src/replay.ts` | `replay(config, inputs)`, `validateInputs`, `MAX_REPLAY_TICKS` (6 h) |
| `src/rng.ts` | PRNG mulberry32 (`nextRandom`), `randomSeed` |
| `test/game.test.ts` | Tests de reglas, generación, operaciones, castigos, combos, determinismo |

- **Determinismo**:
  - Paso fijo `DT = 1/60` s (un *tick*). El campo (`fieldW`, `fieldH`) se fija al crear la partida.
  - Todo azar sale del PRNG con semilla, guardado en el estado.
  - Prohibido `Math.random`, `Date` y funciones de `Math` cuyo resultado varíe entre motores JS.
- **Eventos** que el cliente consume para sonidos y efectos:
  - `spawn`, `hit`, `kill{gain}`
  - `trap{penalty}`, `expire{penalty}`, `trapGone`
  - `miss`, `combo{streak, bonus}`, `comboBreak{streak, earned}`, `end`
- **Bloque**:
  - Campos: `id, kind ('num'|'add'|'sub'|'mul'|'div'), a, b, label, value, total, left, trap, red, life, max, x, y, w, h, color`.
  - `trap` marca cualquier trampa; `red` marca la trampa roja. Una resta ≤ 0 tiene `trap` pero no `red`.
- **Empaquetado**:
  - `package.json` declara `"main": "dist/index.js"` (la API usa el JS compilado: `pnpm --filter @tb/engine build`).
  - También declara `"react-native": "src/index.ts"`; el cliente importa el código fuente vía `metro.config.js`.

## 2. Cliente (`apps/client`)

**Rutas** (`src/app`, Expo Router):

| Ruta | Archivo |
|---|---|
| `/` | `(tabs)/index.tsx`: inicio y juego |
| `/rankings` | `(tabs)/rankings.tsx` |
| `/perfil` | `(tabs)/perfil.tsx` |
| `/como-jugar?nivel=basico|avanzado|completo` | `como-jugar.tsx`: onboarding (básico, avanzado o los dos seguidos) |
| `/u/[username]` | `u/[username].tsx`: perfil público |

- Las pestañas solo aparecen con cuentas activadas.
- `_layout.tsx` monta `GestureHandlerRootView`, `QueryClientProvider` (staleTime 30 s, sin refetch al enfocar) y los *toasts*.

**Carpetas de `src/`:**

| Carpeta | Qué hay |
|---|---|
| `game/` | `useGameRunner.ts` (bucle con `requestAnimationFrame` y acumulador de paso fijo; registra toques `[tick, x, y]`; en desarrollo expone `window.__tb_debug`), `rankedRun.ts` (pide semilla, envía y reclama partidas), `types.ts` |
| `screens/` | `GameScreen`, `RankingsScreen`, `ProfileScreen`, `PublicProfileScreen` |
| `components/` | `Block`, `Fx` (partículas, texto flotante, banner, destello), `Hud` (reloj, corazones, barra, racha), `EndPanel`, `LoginOptions`, `AccountPrompt`, `LegalLinks`, `Toast`, `ConfirmModal`, `Segmented`… |
| `onboarding/` | `Onboarding.tsx` (carrusel y textos), `demos.tsx` (una animación por slide), `timeline.ts`, `TapFinger.tsx` |
| `platform/` | Módulos por plataforma `*.web.ts` / `*.native.ts`: `auth` (Google Identity Services), `share` (Web Share API con tarjeta PNG en `<canvas>`), `fx` (WebAudio + vibración), `storage` (`localStorage`), `fieldTaps` (`pointerdown` nativo del DOM, por latencia y multitáctil). Hoy solo la versión web está completa |
| `api/` | `client.ts` (fetch con renovación de token), `session.ts`, `endpoints.ts`, `hooks.ts` (TanStack Query), `types.ts` |
| `lib/` | `history.ts` (récord e historial local), `onboarding.ts`, `periods.ts`, `countries.ts`, `legal.ts`, `shareText.ts`… |
| `config.ts` | `features.accounts`: activo solo si existen `EXPO_PUBLIC_API_URL` **y** `EXPO_PUBLIC_GOOGLE_CLIENT_ID`. Sin ellas, la web queda solo para invitados |

**Almacenamiento local**: todo envuelto en `try/catch`.

| Clave | Contenido |
|---|---|
| `tb_best5` / `tb_hist5` | Récord e historial (últimas 30) de las reglas v5. Las claves anteriores (`tb_best1/2/3/4`, `tb_hist1/2/3/4`) no se borran |
| `tb_onb1` / `tb_onb_adv1` | Ya vio el tutorial básico / el avanzado (`tb_onb1` era el del tutorial único de antes; cuenta como básico) |
| `tb_visits1` / `tb_last1` | Visitas del dispositivo y última actividad (ms). Deciden cuándo se abre cada tutorial |
| `tb_rt1` | El *refresh token* (el de acceso solo vive en memoria) |
| `tb_me1` | Copia en caché del perfil propio |

**Archivos estáticos** (`public/`):
- `index.html` con las etiquetas `og:`/`twitter:`.
- Íconos, `og-image.png`.
- Páginas legales `politica-de-privacidad/index.html` y `condiciones-del-servicio/index.html`, en HTML puro para que se lean sin JS.

## 3. API (`apps/api`)

| Módulo | Qué hace |
|---|---|
| `auth` | `POST /auth/google` y `/auth/apple` (verificadores en `verifiers.ts`), `/auth/refresh`, `/auth/logout`. JWT de acceso de 15 min y *refresh token* rotativo (hash sha256 en la base). Con `AUTH_DEV_FAKE=1` acepta `dev:<sub>:<nombre>`, solo fuera de producción |
| `users` | `/me` (ver, editar nombre y país, eliminar), disponibilidad del nombre de usuario, búsqueda, perfil público |
| `social` | "¿Quién te invitó?" (`POST /me/inviter`), seguir y dejar de seguir |
| `runs` | Crear partida (semilla), terminarla (`run-verification.ts` repite la partida con el motor), reclamar partida de invitado, historial propio. `runs-cleanup.service.ts` borra las partidas de invitado sin reclamar a las 24 h |
| `leaderboards` | `best-scores.service.ts` actualiza los 4 récords (semana, mes, año, histórico) de una partida válida; `leaderboards.service.ts` arma el top y tu posición |
| `health` | `GET /health`: estado, base de datos, `rulesVersion`, versión |

- **Esquema** en `prisma/schema.prisma`: `User`, `AuthIdentity`, `RefreshToken`, `Run`, `BestScore`, `Follow`. Las migraciones están en `prisma/migrations/`.
- **Contrato exacto** en [`api.md`](api.md).
- **Configuración** en `src/config/app-config.ts`, leída de variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_IDS`, `APPLE_AUDIENCES`, `CORS_ORIGINS`, `PORT`, `TRUST_PROXY`, `THROTTLE_LIMIT`, `CLEANUP_INTERVAL_MS`, `AUTH_DEV_FAKE`.
- Límite de peticiones por IP con `@nestjs/throttler`.
- **Docker**: el `Dockerfile` es *multi-stage* sobre `node:24-alpine`, con el contexto de build en la raíz del monorepo para incluir el motor. Al arrancar ejecuta `prisma migrate deploy` y luego `node dist/main.js`. Tiene `HEALTHCHECK` contra `/health`.

## 4. Flujo de una partida con ranking

1. El cliente llama a `POST /runs` (con o sin sesión) y recibe `{runId, seed, maxLives, rulesVersion, claimToken?}`.
2. Juega localmente con `createGame({seed, maxLives, fieldW, fieldH})` y guarda los toques.
3. Al terminar, llama a `POST /runs/:id/finish {inputs, fieldW, fieldH, killed, missed}`. El servidor ejecuta `replay()` y compara el resultado.
   - Si es válida y la partida tiene usuario, se actualizan sus `BestScore`.
4. Si era invitado e inicia sesión, `POST /runs/:id/claim {claimToken}` asigna la partida a su cuenta.
5. El cliente invalida las consultas `lb`, `myRuns`, `me` y `profile`.

## 5. Despliegue (resumen)

| Qué | Cuándo | Cómo |
|---|---|---|
| Web | Cada push a `main` | `.github/workflows/deploy-pages.yml` a GitHub Pages |
| API | Cada tag `vX.Y.Z` | `.github/workflows/deploy-api.yml`: imagen en GHCR y despliegue del Compose en Dokploy |

Detalle en [`despliegue.md`](despliegue.md).
