# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

"Touched Block" (antes "Rompe el bloque"): juego táctil para celular, en español. Aparecen bloques con un número o una operación ("2+3", "8÷2"); hay que tocar cada uno tantas veces como su resultado antes de que desaparezca. Supervivencia contra el reloj, con vidas, combos y bloques trampa. Es una web (`https://web.touchedblock.app`, en Cloudflare; landing en `https://touchedblock.app`) con cuentas y rankings y, desde el 16 nov 2026, también una app Android (`app.touchedblock`, APK) con el mismo código; iOS más adelante.

**Estado (27 nov 2026)**: la rama `feat/premios-y-logros` trae las reglas v6 (reinicio de registros aprobado), premios y logros nuevos. **Sin desplegar, sin datos borrados y sin probar en teléfono**: producción sigue en la v5. El despliegue y el reinicio se hacen solo tras el visto bueno del usuario en el celular y de mostrarle el conteo de producción (`docs/despliegue.md`, sección 8; `docs/pendientes.md`).

La documentación completa está en `docs/` (índice en `docs/README.md`). Es la memoria del proyecto: qué se hizo y **por qué**.
- `docs/historia-y-decisiones.md`: cronología y motivo de cada decisión técnica. Léelo al empezar.
- `docs/reglas-y-balance.md`: reglas con sus valores exactos e historial de cambios de reglas (v1–v11), premios, logros, retos y misiones. Léelo antes de cambiar reglas o balance, y actualiza sus tablas si cambias reglas o constantes.
- `docs/arquitectura.md`, `docs/api.md` (contrato de la API), `docs/despliegue.md`, `docs/desarrollo.md`, `docs/pendientes.md`.
- Al tomar una decisión no obvia, anótala con su motivo en `docs/historia-y-decisiones.md`; al terminar o dejar algo a medias, actualiza `docs/pendientes.md`.

## Estructura (monorepo pnpm)

- `packages/engine` (`@tb/engine`): motor del juego en TypeScript puro y **determinista** (PRNG mulberry32 con semilla, paso fijo de 1/60 s). Lo usan el cliente y la API (que repite cada partida con `replay()` para validar el puntaje). **Todas las reglas y constantes de balance viven en `src/constants.ts`.**
- `apps/client` (`@tb/client`): Expo Router (SDK 58), web primero. El juego se dibuja con `View` + Reanimated (sin Skia, para que la web cargue liviana). Módulos por plataforma en `src/platform/*.web.ts` / `*.native.ts` (audio, vibración, almacenamiento, toques, login, compartir, ciclo de vida, país); las dos versiones están completas. La web y la app deben verse y jugarse igual: todo cambio visual se revisa en las dos.
- `apps/api` (`@tb/api`): NestJS 12 + Prisma 7 + PostgreSQL. Contrato exacto de cada endpoint en `docs/api.md`.
- Premios (en `apps/client/src`): `cosmetics/` (catálogo, paletas, insignias, iconos de logros), `components/backgrounds/` (fondos), `lib/fxShapes.ts` (efectos), `game/synth/` (sonidos), `game/celebrations*.ts`.
- `config_logros/`: maqueta aparte donde se analizan logros y premios (tiene su propio `CLAUDE.md`).
- Claves locales (v6): `tb_best6`, `tb_hist6`, `tb_stats2`, `tb_daily2`, `tb_miss2`, `tb_me2`, `tb_cele2`, `tb_cele2p`; sin cambio `tb_set1`, `tb_rt1`, `tb_onb1`, `tb_onb_adv1`, `tb_visits1`, `tb_last1`, `tb_unlock1`, `tb_reto1`, `tb_mig1`. Las anteriores no se borran ni se leen.
- `EXPO_PUBLIC_UNLOCK_ALL=1` y `TB_TEST_APK=1`: solo para probar; nunca en lo que se publica.
- `apps/api/scripts/reset-progress.mjs` borra datos: no correrlo contra producción sin confirmación expresa del usuario.
- `legacy/`: el juego original en HTML/CSS/JS (su "v6" de reglas es la numeración antigua, no `RULES_VERSION` 6). Solo referencia; ya no se publica.

## Comandos

No hay npm en esta máquina: usar `pnpm`, `pnpm exec` (en vez de npx) y `pnpm dlx`. No hay Python.

- Motor: `pnpm --filter @tb/engine test` · `build` (genera `dist/`, que usa la API; el cliente importa el código fuente vía `metro.config.js`).
- Cliente: `pnpm --filter @tb/client web` (dev en http://localhost:8081/; el sitio vive en la raíz, sin `baseUrl`, igual que en producción) · `pnpm --filter @tb/client exec tsc --noEmit` · `pnpm --filter @tb/client exec expo export -p web`.
- API: `docker compose -f apps/api/docker-compose.yml up -d --wait` (Postgres en el puerto 5434) · `pnpm --filter @tb/api start:dev` · `test` · `test:e2e` · `prisma:deploy`.
- Sin `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_GOOGLE_CLIENT_ID` el cliente queda en modo solo invitado. Para probar cuentas en local: API con `AUTH_DEV_FAKE=1` y cliente con `EXPO_PUBLIC_AUTH_DEV_FAKE=1` (login falso "Entrar (dev)"; la API lo ignora con `NODE_ENV=production`).
- Para probar el táctil: Playwright (MCP) con viewport de celular.
- App Android: `pnpm exec expo run:android` (en `apps/client`; `android/` se genera con `expo prebuild`, no se edita) y el emulador `Pixel_Mi_Device`. Pasos, rutas largas de Windows y APK firmado en `docs/desarrollo.md` y `docs/despliegue.md`.

## Despliegue

- **Dominios**: `touchedblock.app` (landing, `apps/landing`), `web.touchedblock.app` (el juego), `api.touchedblock.app` (la API, detrás del proxy de Cloudflare; el dominio viejo `vps23906.cubepath.net` se quitó el 24 nov 2026 y los APK que lo usaban ya no se conectan). DNS en Cloudflare.
- **Web**: cada push a `main` que toque el cliente o el motor (no `apps/api/**`, `apps/landing/**`, `deploy/**`, `docs/**`) corre `.github/workflows/deploy-web.yml`: tests del motor, `expo export -p web` (con `EXPO_PUBLIC_API_URL=https://api.touchedblock.app` escrita en el workflow y la *variable* `EXPO_PUBLIC_GOOGLE_CLIENT_ID`) y `wrangler deploy` a Cloudflare Workers con activos estáticos (`apps/client/wrangler.jsonc`, modo SPA; caché en `public/_headers`). Secretos: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. La landing se publica igual con `deploy-landing.yml` (`apps/landing/**`).
- **Web vieja** (`https://sukushaing.github.io/touched-block/`): `deploy-pages.yml` publica en GitHub Pages solo `deploy/gh-pages-redirect/`, que lleva a la misma ruta en `web.touchedblock.app` y pasa los datos locales del jugador por el fragmento `#tbmigrar=…`; el script `tb-mudanza` del `<head>` de `apps/client/public/index.html` los importa (solo si vienen de la web vieja) mezclándolos sin bajar nada, y la 1.ª vez que alguien entra directo al sitio nuevo hace una ida y vuelta a la web vieja para traerlos (marca `tb_mig1`). **Si se agrega o renombra una clave local (`tb_*`), sumarla a `CLAVES` de la página vieja y a `REGLAS` del script** (tests en `src/lib/mudanza.test.ts`; detalle en `docs/despliegue.md`).
- **API**: cada tag `v*.*.*` corre `.github/workflows/deploy-api.yml`: tests, imagen Docker a `ghcr.io/sukushaing/touched-block-api` (`:vX.Y.Z` y `:latest`) y llamada a Dokploy (`compose.deploy`, VPS del usuario). Dokploy corre `deploy/docker-compose.yml`, un *Compose* con la API y su Postgres (`tb-db`, sin puertos expuestos); la API aplica las migraciones al arrancar. Secretos de GitHub: `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_COMPOSE_ID`. Las variables de producción viven en la pestaña Environment de Dokploy (copia local en `deploy/.env`, ignorado), nunca en el repo (el repo es público). Guía: `docs/despliegue.md`.
- Íconos, `og-image.png` y el `index.html` de la web (etiquetas `og:`/`twitter:` con URLs absolutas a `https://web.touchedblock.app/`) están en `apps/client/public/`. Las páginas legales que exige Google OAuth viven en la landing (`https://touchedblock.app/privacidad/`, `/terminos/`; el cliente las abre con `lib/legal.ts`); en `public/` solo quedan `politica-de-privacidad/` y `condiciones-del-servicio/` como redirecciones de las direcciones viejas: no crear rutas de Expo con esos nombres.

## Reglas importantes al tocar código

- **Las reglas viven solo en el motor.** El cliente dibuja a partir de los eventos (`drainEvents`) y nunca decide reglas; la API valida repitiendo la partida.
- **No romper los registros de los jugadores.** Ya hay gente jugando y habrá app móvil: los rankings, récords e historiales **no se reinician** salvo un cambio muy grande que lo amerite y que el usuario apruebe expresamente (preguntar antes). Subir `RULES_VERSION` o cambiar las claves locales (`tb_best6`/`tb_hist6`) **reinicia** rankings y récord local: no se hace por ajustes menores (duración de un bloque, textos, interfaz, valores que apenas alteran los puntajes). Antes de tocar reglas, evalúa si el cambio es compatible; si no lo es, propón alternativas (p. ej. temporadas con rankings archivados, o migrar el récord local en vez de cambiar la clave). El reinicio de la v6 fue una excepción aprobada; no autoriza otros. Si de verdad hay reinicio: subir `RULES_VERSION`, cambiar las claves locales (siguiente número) y avisarlo con claridad.
- El motor no puede usar `Math.random`, `Date`, ni funciones de `Math` cuyo resultado pueda variar entre motores JS (sin, cos, pow…): el replay del servidor debe dar exactamente lo mismo que el navegador.
- El texto del onboarding toma los números de las constantes del motor; no escribirlos a mano.
- Trampas: internamente `trap` (cualquier trampa) y `red` (trampa roja, texto `#ff2a2a`). Las restas con resultado ≤ 0 también son trampa y se ven normales. Si el color de fondo es rojizo (`REDDISH`), una trampa roja usa la paleta `SAFE`.
- El castigo por bloque escapado usa el resultado original (`b.total`), no los toques que faltan, multiplicado según la **etapa** en que se escapa (×5 / ×6 / ×7, `missMultAt`), no según el tipo de bloque — pedidos explícitos del usuario.
- Audio, vibración y almacenamiento local siempre envueltos en `try/catch`.
- Nada de `alert`/`confirm`/`prompt` en la web: usar modales propios.

## Preferencias del usuario

- Quiere un juego difícil y tenso; las trampas deben ser sutiles. Ajusta los números a mano mientras juega.
- La vida de un bloque **no** debe depender de su número ni de su operación (decisión explícita); solo del tiempo jugado (etapa final 4→1 s). Consultar antes de cambiarlo.
- Todo texto visible va en español, salvo el nombre del juego, "Touched Block", que va en inglés.
- Hay dos tutoriales (`?nivel=basico|avanzado|completo` en `/como-jugar`). El **básico** (tocar, tiempo, escapes, vidas, trampas rojas, combos, + invitar/ranking) se abre solo en la **1.ª visita** del dispositivo; en la **2.ª** se va directo a jugar; el **avanzado** (operaciones, restas ≤ 0, solo positivos) se abre solo en la **3.ª**. Una visita nueva = volver después de 30 min sin actividad (recargar no cuenta). Se repiten únicamente desde "Ver tutorial de nuevo" en el Perfil: muestra el básico o, si ya vio los dos, el completo (`?nivel=completo`: básico y después avanzado). Lógica en `apps/client/src/lib/onboarding.ts`.
