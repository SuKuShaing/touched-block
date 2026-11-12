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
| `src/game.ts` | Estado y reglas: `createGame`, `step`, `tap`, `blockAt`, `drainEvents`. Modificadores opcionales `GameConfig.mods` (`startAt`, `only`, `lives`, `noRed`), `validateMods` y `difficultyTime(s)` (segundos jugados + `startAt`, el reloj de todas las curvas). Sin `mods` la partida es idéntica a la de antes |
| `src/replay.ts` | `replay(config, inputs)`, `validateInputs`, `MAX_REPLAY_TICKS` (6 h) |
| `src/rng.ts` | PRNG mulberry32 (`nextRandom`), `randomSeed` |
| `src/progress.ts` | Hitos de la partida (`MILESTONES`, `milestoneIndexAt`, calculados con las mismas curvas del motor) e insignias (`TIERS`, `tierForTicks`, `tierRefForTicks`): madera I–III, bronce, plata, oro y diamante según la duración de la mejor partida |
| `src/daily.ts` | Reto diario: fechas `AAAA-MM-DD` con aritmética entera, número del reto, calendario de modificadores por día de la semana (`dailyModsFor`), intentos y racha de días con perdón (`dailyStreak`) |
| `src/missions.ts` | Misiones del día (`missionsFor(fecha)`, 3 deterministas) y su avance (`missionProgress`) |
| `src/achievements.ts` | Logros de cinco niveles (madera a diamante) |
| `test/game.test.ts` | Tests de reglas, generación, operaciones, castigos, combos, determinismo |
| `test/golden.test.ts` + `golden.json` | **Prueba dorada**: 40 partidas jugadas por un bot (20 semillas × 2 campos) que deben dar exactamente el mismo resultado y los mismos bloques. Se generó con el motor anterior a los modificadores y solo se regenera (`GOLDEN_WRITE=1`) con un cambio de reglas aprobado por el usuario |

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
| `/coleccion` | `coleccion.tsx`: insignia, nivel, premios y logros (se abre desde el Perfil) |

- Los retos se abren por **parámetro**, no por ruta: `/?reto=CÓDIGO` (reto a un amigo) y `/?diario=1` (reto diario). En GitHub Pages una ruta como `/reto/CODIGO` responde 404 (aunque cargue la app) y rompe la vista previa del enlace en WhatsApp.

- Las pestañas solo aparecen con cuentas activadas.
- `_layout.tsx` monta `GestureHandlerRootView`, `QueryClientProvider` (staleTime 30 s, sin refetch al enfocar) y los *toasts*.

**Carpetas de `src/`:**

| Carpeta | Qué hay |
|---|---|
| `game/` | `useGameRunner.ts` (bucle con `requestAnimationFrame` y acumulador de paso fijo; registra toques `[tick, x, y]`; crea la partida con `mods`; `onFrame` opcional; en desarrollo expone `window.__tb_debug`), `rankedRun.ts` (pide semilla en modo `normal`, `duel` o `daily`, envía y reclama partidas; en los retos no hay semilla local de respaldo y los fallos vuelven tipados), `playArea.ts` (área de juego con una sola escala y desplazamiento para los retos; toques fuera se ignoran), `notices.ts` (avisos de la franja, uno a la vez por prioridad), `endPrize.ts` (insignia nueva y premios desbloqueados de la partida), `endGuard.ts` (ignora por 450 ms los botones que empiezan otra partida al terminar), `sounds.ts` (paquetes de sonido: `sounds.play(nombre)`), `types.ts` |
| `screens/` | `GameScreen` (inicio, partida y pantalla final de todos los modos), `RankingsScreen` (General / Reto de hoy), `ProfileScreen`, `PublicProfileScreen`, `CollectionScreen` |
| `components/` | `Block` (con la paleta elegida), `Fx` (partículas según el efecto elegido, texto flotante, destello), `FieldBackground`, `Hud` (reloj, corazones, barra, racha, línea de avance), `Notice` (franja de avisos), `StageTrack` (camino de etapas), `PrizeCard`, `TierBadge`, `InstallCard`, `ChallengePanel`, `DailyCard`, `DailyRulesSheet`, `DailyResult`, `WeekStrip`, `MissionList`, `EndPanel`, `LoginOptions`, `AccountPrompt`, `LegalLinks`, `Toast`, `ConfirmModal`, `Segmented`… |
| `cosmetics/` | `catalog.ts` (premios y sus condiciones, funciones puras de las estadísticas), `palettes.ts` (paletas y la regla de no ventaja), `active.ts` (premios en uso, validados contra lo desbloqueado), `tiers.ts` (aspecto de cada insignia) |
| `onboarding/` | `Onboarding.tsx` (carrusel y textos), `demos.tsx` (una animación por slide), `timeline.ts`, `TapFinger.tsx` |
| `platform/` | Módulos por plataforma `*.web.ts` / `*.native.ts`: `auth` (Google Identity Services), `share` (Web Share API con tarjeta PNG en `<canvas>`, con insignia y etapa; también texto), `fx` (WebAudio + vibración, respetando los ajustes), `storage` (`localStorage`), `fieldTaps` (`pointerdown` nativo del DOM, por latencia y multitáctil), `install` (`beforeinstallprompt`, instrucciones de iOS, detección de app instalada). Hoy solo la versión web está completa |
| `api/` | `client.ts` (fetch con renovación de token), `session.ts`, `endpoints.ts`, `hooks.ts` (TanStack Query), `types.ts`, `daily.ts` + `dailyHooks.ts` (reto diario y misiones) |
| `lib/` | `history.ts` (récord e historial local), `historyKeys.ts`, `stats.ts`, `settings.ts`, `level.ts`, `stagePath.ts`, `challenge.ts`, `daily.ts`, `missions.ts`, `dailyShare.ts`, `onboarding.ts`, `periods.ts`, `countries.ts`, `legal.ts`, `shareText.ts`… |

**Tests del cliente**: `vitest` solo para módulos puros (`lib/`, `cosmetics/`, `game/*.ts`): `pnpm --filter @tb/client test`.
| `config.ts` | `features.accounts`: activo solo si existen `EXPO_PUBLIC_API_URL` **y** `EXPO_PUBLIC_GOOGLE_CLIENT_ID`. Sin ellas, la web queda solo para invitados |

**Almacenamiento local**: todo envuelto en `try/catch`.

| Clave | Contenido |
|---|---|
| `tb_best5` / `tb_hist5` | Récord e historial (últimas 30) de las reglas v5, solo de partidas normales. Cada entrada `{k, m, d}` suma `t` (ticks) y `s` (mejor racha) opcionales desde el plan de jugabilidad; las viejas siguen valiendo. Las claves anteriores (`tb_best1/2/3/4`, `tb_hist1/2/3/4`) no se borran |
| `tb_stats1` | Estadísticas del dispositivo `{bestTicks, bestStreak, totalKilled, runs, bonusXp}`, independientes de la versión de reglas (la primera vez se arman desde el historial). Definen la insignia y los premios como invitado |
| `tb_set1` | Ajustes del dispositivo: sonido, vibración, paleta, sonidos, efecto, fondo y si se descartó la tarjeta de instalar |
| `tb_daily1` | Reto diario en este dispositivo: intentos por fecha (1 como invitado), mejores resultados, partidas por reclamar, racha local, si vio las reglas y el aviso de ayer |
| `tb_miss1` | Misiones ya premiadas en este dispositivo, por fecha (invitado) |
| `tb_reto1` | Reto a un amigo pendiente mientras se ve el tutorial de la primera visita (vence a las 2 h) |
| `tb_onb1` / `tb_onb_adv1` | Ya vio el tutorial básico / el avanzado (`tb_onb1` era el del tutorial único de antes; cuenta como básico) |
| `tb_visits1` / `tb_last1` | Visitas del dispositivo y última actividad (ms). Deciden cuándo se abre cada tutorial |
| `tb_rt1` | El *refresh token* (el de acceso solo vive en memoria) |
| `tb_me1` | Copia en caché del perfil propio |

**Archivos estáticos** (`public/`):
- `index.html` con las etiquetas `og:`/`twitter:`, el enlace al manifest, las etiquetas `apple-mobile-web-app-*` y un script corto que guarda `beforeinstallprompt` apenas llega.
- `manifest.webmanifest` (web instalable, `start_url` y `scope` en `/touched-block/`, sin service worker: un caché mal manejado dejaría a la gente con una web vieja).
- Íconos (`icon-512.png`, `icon-maskable-512.png`, …), `og-image.png`.
- Páginas legales `politica-de-privacidad/index.html` y `condiciones-del-servicio/index.html`, en HTML puro para que se lean sin JS.

## 3. API (`apps/api`)

| Módulo | Qué hace |
|---|---|
| `auth` | `POST /auth/google` y `/auth/apple` (verificadores en `verifiers.ts`), `/auth/refresh`, `/auth/logout`. JWT de acceso de 15 min y *refresh token* rotativo (hash sha256 en la base). Con `AUTH_DEV_FAKE=1` acepta `dev:<sub>:<nombre>`, solo fuera de producción |
| `users` | `/me` (ver, editar nombre y país, eliminar), disponibilidad del nombre de usuario, búsqueda, perfil público |
| `social` | "¿Quién te invitó?" (`POST /me/inviter`), seguir y dejar de seguir |
| `runs` | Crear partida (semilla) en modo `normal`, `duel` o `daily`, terminarla (`run-verification.ts` repite la partida con el motor, con la semilla, vidas, campo y `mods` guardados), reclamar partida de invitado, historial propio (solo modo normal). `common-field.service.ts`: campo común de los retos (percentil 5 de los campos reales de los últimos 30 días, con límites; en memoria 1 h). `runs-cleanup.service.ts` borra las partidas de invitado sin reclamar a las 24 h y los intentos diarios abandonados de las cuentas a las 72 h |
| `stats` | `UserStats` por cuenta (mejor duración y racha solo de partidas normales; bloques y partidas de todos los modos), con una sola sentencia atómica. `backfill-streaks.ts` + `scripts/backfill-streaks.mjs` rellenan la mejor racha repitiendo partidas guardadas |
| `challenges` | Reto a un amigo: código de 8 caracteres, misma semilla y campo para todos, `GET /challenges/:code`. Cuenta el primer intento válido de cada cuenta |
| `daily` | Reto diario: semilla `HMAC-SHA256(DAILY_SECRET, fecha)`, campo del día fijado con la primera partida, 3 intentos con cuenta, ranking del día, porcentaje, racha, `GET /daily` y `GET /daily/leaderboard` |
| `missions` | `GET /missions`: avance de las misiones del día calculado al leer; premio único en bloques extra (`MissionReward` + `UserStats.bonusXp`) |
| `leaderboards` | `best-scores.service.ts` actualiza los 4 récords (semana, mes, año, histórico) de una partida válida de modo normal; `leaderboards.service.ts` arma el top y tu posición, con la insignia de cada fila |
| `health` | `GET /health`: estado, base de datos, `rulesVersion`, versión |

- **Esquema** en `prisma/schema.prisma`: `User`, `AuthIdentity`, `RefreshToken`, `Run` (con `mode`, `challengeCode`, `dailyDate`, `config`, `bestStreak`, `endReason`), `BestScore`, `Follow`, `UserStats`, `Challenge`, `ChallengeEntry`, `DailyChallenge`, `DailyEntry`, `MissionReward`. Las migraciones están en `prisma/migrations/` y **solo agregan** (regla 9 del plan de jugabilidad): ninguna borra ni reescribe datos de jugadores. Las tablas nuevas con datos de un usuario se borran con su cuenta (`onDelete: Cascade`).
- **Contrato exacto** en [`api.md`](api.md).
- **Configuración** en `src/config/app-config.ts`, leída de variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_IDS`, `APPLE_AUDIENCES`, `CORS_ORIGINS`, `PORT`, `TRUST_PROXY`, `THROTTLE_LIMIT`, `CLEANUP_INTERVAL_MS`, `AUTH_DEV_FAKE`, `DAILY_SECRET` (obligatoria en producción, mínimo 32 caracteres).
- Límite de peticiones por IP con `@nestjs/throttler`.
- **Docker**: el `Dockerfile` es *multi-stage* sobre `node:24-alpine`, con el contexto de build en la raíz del monorepo para incluir el motor. Al arrancar ejecuta `prisma migrate deploy` y luego `node dist/main.js`. Tiene `HEALTHCHECK` contra `/health`.

## 4. Flujo de una partida con ranking

1. El cliente llama a `POST /runs` (con o sin sesión; con `mode` `duel` o `daily` para los retos) y recibe `{runId, seed, maxLives, rulesVersion, fieldW, fieldH, mode, mods, claimToken?}`. En los retos el servidor decide el campo, las vidas y los modificadores.
2. Juega localmente con `createGame({seed, maxLives, fieldW, fieldH, mods})` y guarda los toques. En los retos el campo del servidor se dibuja escalado y centrado en la pantalla; los toques fuera de él se ignoran.
3. Al terminar, llama a `POST /runs/:id/finish {inputs, fieldW, fieldH, killed, missed}`. El servidor ejecuta `replay()` y compara el resultado.
   - Si es válida y la partida tiene usuario, se actualizan sus `UserStats` y, solo en modo normal, sus `BestScore` (las partidas de reto no entran al ranking general ni al récord, decisión D6).
   - En un reto a un amigo se guarda una `ChallengeEntry`; en el reto diario, la `DailyEntry` del día si mejora.
4. Si era invitado e inicia sesión, `POST /runs/:id/claim {claimToken}` asigna la partida a su cuenta.
5. El cliente invalida las consultas `lb`, `myRuns`, `me` y `profile`.

## 5. Despliegue (resumen)

| Qué | Cuándo | Cómo |
|---|---|---|
| Web | Cada push a `main` | `.github/workflows/deploy-pages.yml` a GitHub Pages |
| API | Cada tag `vX.Y.Z` | `.github/workflows/deploy-api.yml`: imagen en GHCR y despliegue del Compose en Dokploy |

Detalle en [`despliegue.md`](despliegue.md).
