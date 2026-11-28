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
| `src/progress.ts` | Hitos de la partida (`MILESTONES`, `milestoneIndexAt`, calculados con las mismas curvas del motor) e insignias (`TIERS`, `tierForTicks`, `tierRefForTicks`): Papel, Cartón, Madera, Bronce, Plata, Oro y Diamante según la duración de la mejor partida (ninguna bajo 20 s) |
| `src/daily.ts` | Reto diario: fechas `AAAA-MM-DD` con aritmética entera, número del reto, modificadores de cada fecha (`dailyModsFor`: calendario semanal y, desde el 7 dic 2026, ciclo de 15), intentos y racha de días con perdón (`dailyStreak`) |
| `src/missions.ts` | Misiones del día (`missionsFor(fecha)`, 3 deterministas; pool de 13 y, desde el 7 dic 2026, de 28) y su avance (`missionProgress`) |
| `src/achievements.ts` | Logros de siete niveles (Papel a Diamante) |
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
| `/coleccion` | `(tabs)/coleccion.tsx`: pestaña con insignia, nivel, premios y logros (sin API, sin barra: se abre desde el Perfil), con la vista previa al final |

- Los retos se abren por **parámetro**, no por ruta: `/?reto=CÓDIGO` (reto a un amigo) y `/?diario=1` (reto diario). En GitHub Pages una ruta como `/reto/CODIGO` respondía 404 (aunque cargara la app) y rompía la vista previa del enlace en WhatsApp. En Cloudflare (modo SPA) una ruta ya respondería 200, pero el formato se mantiene para no romper los enlaces ya compartidos.

- Las pestañas (Jugar · Rankings · Colección · Perfil, barra flotante con íconos SVG animados en `components/TabIcons.tsx`) solo aparecen con cuentas activadas.
- `_layout.tsx` monta `GestureHandlerRootView`, `QueryClientProvider` (staleTime 30 s, sin refetch al enfocar) y los *toasts*.

**Carpetas de `src/`:**

| Carpeta | Qué hay |
|---|---|
| `game/` | `useGameRunner.ts` (bucle con `requestAnimationFrame` y acumulador de paso fijo; registra toques `[tick, x, y]`; crea la partida con `mods`; `onFrame` opcional; en desarrollo expone `window.__tb_debug`), `rankedRun.ts` (pide semilla en modo `normal`, `duel` o `daily`, envía y reclama partidas; en los retos no hay semilla local de respaldo y los fallos vuelven tipados), `playArea.ts` (área de juego con una sola escala y desplazamiento para los retos; toques fuera se ignoran), `notices.ts` (avisos de la franja, uno a la vez por prioridad), `endPrize.ts` (insignia nueva y premios desbloqueados de la partida), `endGuard.ts` (ignora por 450 ms los botones que empiezan otra partida al terminar), `sounds.ts` (paquetes de sonido: `sounds.play(nombre)`), `synth/` (los 6 paquetes sintetizados, ver abajo), `celebrations.ts` + `celebrationQueue.ts` (qué se celebra y la cola), `types.ts` |
| `screens/` | `GameScreen` (inicio, partida y pantalla final de todos los modos), `RankingsScreen` (General / Reto de hoy), `ProfileScreen`, `PublicProfileScreen`, `CollectionScreen` |
| `components/` | `Block` (con la paleta elegida), `Fx` (partículas según el efecto elegido, texto flotante, destello), `FieldBackground` + `backgrounds/` (`setA` y `setB` estáticos, `animated`), `AchievementIcon`, `EffectIcon`, `PaletteSwatch`, `PrizeModal` (premio en grande y compartir), `PreviewPanel` (vista previa de la Colección), `Hud` (reloj, corazones, barra, racha, línea de avance), `Notice` (franja de avisos), `StageTrack` (camino de etapas), `PrizeCard`, `TierBadge`, `InstallCard`, `ChallengePanel`, `DailyCard`, `DailyRulesSheet`, `DailyResult`, `WeekStrip`, `MissionList`, `EndPanel`, `LoginOptions`, `AccountPrompt`, `LegalLinks`, `Toast`, `ConfirmModal`, `Segmented`… |
| `cosmetics/` | `ids.ts` (ids de los premios), `catalog.ts` (los 55 premios y sus condiciones, funciones puras de las estadísticas), `palettes.ts` (paletas, su estilo de dibujo y la regla de no ventaja), `active.ts` (premios en uso, validados contra lo desbloqueado), `medal.ts` (insignias), `achievementIcon.ts` (iconos de logros como SVG), `tiers.ts` (colores de los materiales) |
| `onboarding/` | `Onboarding.tsx` (carrusel y textos), `demos.tsx` (una animación por slide), `timeline.ts`, `TapFinger.tsx` |
| `platform/` | Módulos por plataforma `*.web.ts` / `*.native.ts`. `synthAudio` (contexto de audio en vivo y `OfflineAudioContext` para renderizar los sonidos). Web: `auth` (Google Identity Services), `share` (Web Share API con tarjeta PNG en `<canvas>`), `fx` (WebAudio + `navigator.vibrate`), `storage` (`localStorage`), `fieldTaps` (`pointerdown` nativo del DOM, por latencia y multitáctil), `install` (`beforeinstallprompt`), `lifecycle` (`visibilitychange`), `locale`, `runPlatform` (`web_mobile`/`web_desktop` para `POST /runs`, con `lib/webPlatform.ts`). App (Android): `auth` (Google Sign-In nativo), `share` (tarjeta dibujada por `components/ShareCardHost.native.tsx`, capturada con `react-native-view-shot` y compartida con `expo-sharing`; texto al portapapeles), `fx` (`react-native-audio-api`, los mismos osciladores, + `expo-haptics`), `storage` (`expo-sqlite/kv-store`, síncrono), `fieldTaps` (`onTouchStart`), `lifecycle` (`AppState`), `locale` (`expo-localization` y tabla de países en español, porque Hermes no tiene `Intl.DisplayNames`), `runPlatform` (`app_android`/`app_ios` según `Platform.OS`). `lib/legal.native.ts` abre las páginas legales en el navegador integrado (Custom Tabs, con `expo-web-browser`; el del sistema solo si ese falla) |
| `api/` | `client.ts` (fetch con renovación de token), `session.ts`, `endpoints.ts`, `hooks.ts` (TanStack Query), `types.ts`, `daily.ts` + `dailyHooks.ts` (reto diario y misiones) |
| `lib/` | `history.ts` (récord e historial local), `historyKeys.ts`, `stats.ts`, `settings.ts`, `level.ts`, `stagePath.ts`, `challenge.ts`, `daily.ts`, `missions.ts`, `dailyShare.ts`, `onboarding.ts`, `periods.ts`, `countries.ts`, `legal.ts`, `shareText.ts`, `achievementValues.ts`, `fxShapes.ts` (fórmulas puras de los efectos), `previewStep.ts`… |
| `config.ts` | `features.accounts`: activo solo si existen `EXPO_PUBLIC_API_URL` **y** `EXPO_PUBLIC_GOOGLE_CLIENT_ID`. Sin ellas, la web queda solo para invitados. `config.unlockAll` (`EXPO_PUBLIC_UNLOCK_ALL=1`): todo desbloqueado, solo para el APK de prueba |

**Tests del cliente**: `vitest` solo para módulos puros (`lib/`, `cosmetics/`, `game/`, `components/**/*.test.ts`): `pnpm --filter @tb/client test`.

**Premios (cosméticos)**:

- Nada se guarda como ganado: `catalog.ts` lo recalcula desde las estadísticas (insignia, nivel, escalón de logro, partidas o invitados).
- **Paletas**: el motor asigna su color y el cliente lo traduce por posición; `blockPaint()` da el estilo (liso, atenuado, vidrio, contorno, degradé, esmerilado o relieve) con propiedades que sirven en web y en la app (sin desenfoque; los translúcidos van sobre un respaldo opaco; relieve con degradado en Android anterior a la API 29).
- **Fondos**: `FieldBackground` dibuja `grilla`, `estrellas` y `aurora` y delega el resto en `backgrounds/`, por id; un id desconocido no dibuja nada. Cada animado anima una sola propiedad por capa y se detiene en miniatura, con la partida terminada, con "reducir movimiento" y en segundo plano.
- **Efectos**: `lib/fxShapes.ts` sortea las piezas y calcula cada fotograma (worklets); `Fx.tsx` solo las dibuja y da a cada efecto su duración.
- **Sonidos**: híbrido. Cada sonido del paquete elegido se renderiza una vez a un `AudioBuffer` y se reutiliza (24 búferes, un paquete en memoria, 12 voces, limitador en el bus en vivo); si el búfer no está o el render falla, se sintetiza en vivo con la misma voz. En la app hay que soltar a mano cada contexto de render (`synthAudio.release`; ver el comentario).
- **Celebraciones**: al terminar la partida (`runCelebrations`) y, con sesión, desde la cuenta (`accountCelebrations`: invitados, días seguidos y porcentaje del reto). `tb_cele2` recuerda lo ya celebrado. Como el porcentaje lo guarda el servidor al leer `GET /daily`, `useMeRefresh` vuelve a pedir `/me` después de esa respuesta (una vez por fecha y día cerrado).

**Almacenamiento local**: todo envuelto en `try/catch`.

| Clave | Contenido |
|---|---|
| `tb_best6` / `tb_hist6` | Récord e historial (últimas 30) de las reglas v6, solo de partidas normales. Cada entrada `{k, m, d}` suma `t` (ticks) y `s` (mejor racha) opcionales |
| `tb_stats2` | Estadísticas del dispositivo `{bestTicks, bestStreak, totalKilled, runs, bonusXp}`, independientes de la versión de reglas (si falta, se arma desde `tb_hist6`/`tb_best6`). Definen la insignia y los premios como invitado |
| `tb_set1` | Ajustes del dispositivo: sonido, vibración, paleta, sonidos, efecto, fondo, si se descartó la tarjeta de instalar y `seenScore` (punto de novedad de la Colección; −1 = sin medir) |
| `tb_daily2` | Reto diario en este dispositivo: intentos por fecha (1 como invitado), mejores resultados, partidas por reclamar, racha local, si participó (`bestPct`), si vio las reglas y el aviso de ayer |
| `tb_miss2` | Misiones ya premiadas en este dispositivo, por fecha (invitado) |
| `tb_cele2` / `tb_cele2p` | Celebraciones ya anunciadas / las que faltan por ver |
| `tb_reto1` | Reto a un amigo pendiente mientras se ve el tutorial de la primera visita (vence a las 2 h) |
| `tb_onb1` / `tb_onb_adv1` | Ya vio el tutorial básico / el avanzado (`tb_onb1` era el del tutorial único de antes; cuenta como básico) |
| `tb_unlock1` | El reto y las misiones ya se desbloquearon en este dispositivo |
| `tb_visits1` / `tb_last1` | Visitas del dispositivo y última actividad (ms). Deciden cuándo se abre cada tutorial |
| `tb_rt1` | El *refresh token* (el de acceso solo vive en memoria) |
| `tb_me2` | Copia en caché del perfil propio |
| `tb_mig1` | Ya se hizo la mudanza desde la web vieja |

Con el reset de la v6 las claves de progreso cambiaron (`tb_best5`, `tb_hist5`, `tb_stats1`, `tb_daily1`, `tb_miss1`, `tb_cele1`, `tb_cele1p`, `tb_me1` y las anteriores): **no se borran ni se leen**, y nunca se copia una vieja a una nueva.

**Archivos estáticos** (`public/`):
- `index.html` con las etiquetas `og:`/`twitter:`, el enlace al manifest, las etiquetas `apple-mobile-web-app-*`, un script corto que guarda `beforeinstallprompt` apenas llega y otro que importa los datos locales que manda la web vieja de GitHub Pages (`#tbmigrar=…`, ver `despliegue.md`).
- `manifest.webmanifest` (web instalable, `start_url` y `scope` en `/`, sin service worker: un caché mal manejado dejaría a la gente con una web vieja).
- Íconos de la web (`icon-512.png`, `icon-maskable-512.png`, …), `og-image.png`. El ícono de la app (Android e iOS) es otro y está en `assets/icono/` (fondo azul completo; ver `historia-y-decisiones.md`).
- `politica-de-privacidad/index.html` y `condiciones-del-servicio/index.html`: solo redirigen a las páginas legales, que ahora viven en la landing (`https://touchedblock.app/privacidad/` y `/terminos/`).
- `_headers`: caché de Cloudflare (los archivos con hash, un año e `immutable`).

## 3. API (`apps/api`)

| Módulo | Qué hace |
|---|---|
| `auth` | `POST /auth/google` y `/auth/apple` (verificadores en `verifiers.ts`), `/auth/apple/notifications` (avisos de Apple), `/auth/refresh`, `/auth/logout`. `apple-tokens.ts`: canje del `authorizationCode` de Apple, refresh token de Apple cifrado y su revocación al eliminar la cuenta. JWT de acceso de 15 min y *refresh token* rotativo (hash sha256 en la base). Con `AUTH_DEV_FAKE=1` acepta `dev:<sub>:<nombre>`, solo fuera de producción |
| `users` | `/me` (ver, editar nombre y país, eliminar), disponibilidad del nombre de usuario, búsqueda, perfil público |
| `social` | "¿Quién te invitó?" (`POST /me/inviter`), seguir y dejar de seguir |
| `runs` | Crear partida (semilla) en modo `normal`, `duel` o `daily`, terminarla (`run-verification.ts` repite la partida con el motor, con la semilla, vidas, campo y `mods` guardados), reclamar partida de invitado, historial propio (solo modo normal). `common-field.service.ts`: campo común de los retos (percentil 5 de los campos reales de los últimos 30 días, con límites; en memoria 1 h). `runs-cleanup.service.ts` borra las partidas de invitado sin reclamar a las 24 h y los intentos diarios abandonados de las cuentas a las 72 h |
| `stats` | `UserStats` por cuenta (mejor duración y racha solo de partidas normales; bloques y partidas de todos los modos), con una sola sentencia atómica. `backfill-streaks.ts` + `scripts/backfill-streaks.mjs` rellenan la mejor racha repitiendo partidas guardadas |
| `challenges` | Reto a un amigo: código de 8 caracteres, misma semilla y campo para todos, `GET /challenges/:code`. Cuenta el primer intento válido de cada cuenta |
| `daily` | Reto diario: semilla `HMAC-SHA256(DAILY_SECRET, fecha)`, campo del día fijado con la primera partida, 3 intentos con cuenta, ranking del día, porcentaje, racha, `GET /daily` y `GET /daily/leaderboard` |
| `missions` | `GET /missions`: avance de las misiones del día calculado al leer; premio único en bloques extra (`MissionReward` + `UserStats.bonusXp`) |
| `leaderboards` | `best-scores.service.ts` actualiza los 4 récords (semana, mes, año, histórico) de una partida válida de modo normal; `leaderboards.service.ts` arma el top y tu posición, con la insignia de cada fila |
| `health` | `GET /health`: estado, base de datos, `rulesVersion`, versión |
| `maintenance` | `reset-progress.ts` + `scripts/reset-progress.mjs`: reinicio de registros **manual** (reglas v6), una sola vez (tabla `DataReset`); `despliegue.md`, sección 8 |

- **Esquema** en `prisma/schema.prisma`: `User`, `AuthIdentity`, `RefreshToken`, `Run` (con `mode`, `challengeCode`, `dailyDate`, `config`, `bestStreak`, `endReason`, `platform`: desde dónde se jugó, solo estadística, ver `docs/api.md`), `BestScore`, `Follow`, `UserStats`, `Challenge`, `ChallengeEntry`, `DailyChallenge`, `DailyEntry`, `MissionReward`, `DataReset`. Las migraciones están en `prisma/migrations/` y **solo agregan** (regla 9 del plan de jugabilidad): ninguna borra ni reescribe datos de jugadores (el borrado del reset va en un script aparte, para que no se ejecute solo al desplegar). Las tablas nuevas con datos de un usuario se borran con su cuenta (`onDelete: Cascade`).
- **Contrato exacto** en [`api.md`](api.md).
- **Configuración** en `src/config/app-config.ts`, leída de variables de entorno: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_IDS`, `APPLE_AUDIENCES`, `APPLE_CLIENT_ID`/`APPLE_TEAM_ID`/`APPLE_KEY_ID`/`APPLE_PRIVATE_KEY` (revocación de Apple, opcionales), `APPLE_TOKEN_KEY` (clave para cifrar el refresh token de Apple; opcional, si no está se deriva de `JWT_SECRET`), `CORS_ORIGINS`, `PORT`, `TRUST_PROXY`, `THROTTLE_LIMIT`, `THROTTLE_DISABLED` (solo tests e2e), `CLEANUP_INTERVAL_MS`, `AUTH_DEV_FAKE`, `NODE_ENV`, `DAILY_SECRET` (obligatoria en producción, mínimo 32 caracteres), `ADMIN_TOKEN` (endpoints `/admin/*`; opcional, mínimo 32 caracteres en producción), `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (avisos de reportes por Telegram, opcionales). `APP_VERSION` (la pone la imagen Docker) la lee `health/health.controller.ts` para `/health`.
- Límite de peticiones por IP con `@nestjs/throttler`.
- **Docker**: el `Dockerfile` es *multi-stage* sobre `node:24-alpine`, con el contexto de build en la raíz del monorepo para incluir el motor. Al arrancar ejecuta `prisma migrate deploy` y luego `node dist/main.js`. Tiene `HEALTHCHECK` contra `/health`.

## 4. Flujo de una partida con ranking

1. El cliente llama a `POST /runs` (con o sin sesión; con `mode` `duel` o `daily` para los retos) y recibe `{runId, seed, maxLives, rulesVersion, fieldW, fieldH, mode, mods, claimToken?}`. En los retos el servidor decide el campo, las vidas y los modificadores.
2. Juega localmente con `createGame({seed, maxLives, fieldW, fieldH, mods})` y guarda los toques. En los retos el campo del servidor se dibuja escalado y centrado en la pantalla; los toques fuera de él se ignoran.
   En los retos el cliente envía además `rulesVersion`; la API rechaza (`409 client_outdated`) a los clientes con otra versión antes de crear nada.
3. Al terminar, llama a `POST /runs/:id/finish {inputs, fieldW, fieldH, killed, missed}`. El servidor ejecuta `replay()` y compara el resultado.
   - Si es válida y la partida tiene usuario, se actualizan sus `UserStats` y, solo en modo normal, sus `BestScore` (las partidas de reto no entran al ranking general ni al récord, decisión D6).
   - En un reto a un amigo se guarda una `ChallengeEntry`; en el reto diario, la `DailyEntry` del día si mejora.
4. Si era invitado e inicia sesión, `POST /runs/:id/claim {claimToken}` asigna la partida a su cuenta.
5. El cliente invalida las consultas `lb`, `myRuns`, `me` y `profile`.

## 5. Despliegue (resumen)

| Qué | Cuándo | Cómo |
|---|---|---|
| Web | Cada push a `main` que toque el cliente o el motor | `.github/workflows/deploy-web.yml` a Cloudflare Workers (`https://web.touchedblock.app`) |
| Landing | Cada push a `main` que toque `apps/landing/**` | `.github/workflows/deploy-landing.yml` a Cloudflare Workers (`https://touchedblock.app`) |
| Redirección de la web vieja | Cuando cambia `deploy/gh-pages-redirect/**` | `.github/workflows/deploy-pages.yml` a GitHub Pages |
| API | Cada tag `vX.Y.Z` | `.github/workflows/deploy-api.yml`: imagen en GHCR y despliegue del Compose en Dokploy |

Detalle en [`despliegue.md`](despliegue.md).
