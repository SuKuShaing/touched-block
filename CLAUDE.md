# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

"Touched Block" (antes "Rompe el bloque"): juego táctil para celular, en español. Aparecen bloques con un número o una operación ("2+3", "8÷2"); hay que tocar cada uno tantas veces como su resultado antes de que desaparezca. Supervivencia contra el reloj, con vidas, combos y bloques trampa. Hoy es una web (GitHub Pages) con cuentas y rankings; más adelante, app Android/iOS con el mismo código.

`rompe-el-bloque.md` es el documento de traspaso: reglas con sus valores exactos, historial de decisiones (v1–v7) con sus motivos, riesgos e ideas pendientes. Léelo antes de cambiar reglas o balance. Si cambias reglas o constantes, actualiza también sus tablas.

## Estructura (monorepo pnpm)

- `packages/engine` (`@tb/engine`): motor del juego en TypeScript puro y **determinista** (PRNG mulberry32 con semilla, paso fijo de 1/60 s). Lo usan el cliente y la API (que repite cada partida con `replay()` para validar el puntaje). **Todas las reglas y constantes de balance viven en `src/constants.ts`.**
- `apps/client` (`@tb/client`): Expo Router (SDK 58), web primero. El juego se dibuja con `View` + Reanimated (sin Skia, para que la web cargue liviana). Módulos por plataforma en `src/platform/*.web.ts` / `*.native.ts` (audio, vibración, almacenamiento, toques, login, compartir); hoy solo la versión web está completa.
- `apps/api` (`@tb/api`): NestJS 12 + Prisma 7 + PostgreSQL. Contrato exacto de cada endpoint en `apps/api/API.md`.
- `legacy/`: el juego original en HTML/CSS/JS (reglas v6). Solo referencia; ya no se publica.

## Comandos

No hay npm en esta máquina: usar `pnpm`, `pnpm exec` (en vez de npx) y `pnpm dlx`. No hay Python.

- Motor: `pnpm --filter @tb/engine test` · `build` (genera `dist/`, que usa la API; el cliente importa el código fuente vía `metro.config.js`).
- Cliente: `pnpm --filter @tb/client web` (dev en http://localhost:8081/, en la raíz; el `baseUrl` `/touched-block` solo aplica al exportar) · `pnpm --filter @tb/client exec tsc --noEmit` · `pnpm --filter @tb/client exec expo export -p web`.
- API: `docker compose -f apps/api/docker-compose.yml up -d --wait` (Postgres en el puerto 5434) · `pnpm --filter @tb/api start:dev` · `test` · `test:e2e` · `prisma:deploy`.
- Sin `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_GOOGLE_CLIENT_ID` el cliente queda en modo solo invitado. Para probar cuentas en local: API con `AUTH_DEV_FAKE=1` y cliente con `EXPO_PUBLIC_AUTH_DEV_FAKE=1` (login falso "Entrar (dev)"; la API lo ignora con `NODE_ENV=production`).
- Para probar el táctil: Playwright (MCP) con viewport de celular.

## Despliegue

- **Web**: cada push a `main` (salvo cambios solo en `apps/api/**`) corre `.github/workflows/deploy-pages.yml`: tests del motor, `expo export -p web`, copia `index.html` a `404.html` (rutas SPA en Pages) y publica `apps/client/dist`. URL y Client ID de Google salen de las *variables* del repositorio `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
- **API**: cada tag `v*.*.*` corre `.github/workflows/deploy-api.yml`: tests, imagen Docker a `ghcr.io/sukushaing/touched-block-api` (`:vX.Y.Z` y `:latest`) y llamada a Dokploy (VPS del usuario) para desplegar. Secretos: `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_APP_ID`. Las variables de entorno de producción viven en Dokploy, nunca en el repo (el repo es público).
- Íconos, `og-image.png` y el `index.html` de la web (etiquetas `og:`/`twitter:` con URLs absolutas a `https://sukushaing.github.io/touched-block/`) están en `apps/client/public/`.

## Reglas importantes al tocar código

- **Las reglas viven solo en el motor.** El cliente dibuja a partir de los eventos (`drainEvents`) y nunca decide reglas; la API valida repitiendo la partida. Si cambias el balance: sube `RULES_VERSION` (los rankings guardan la versión y parten de cero solos) y cambia las claves locales (`tb_best2`/`tb_hist2` → siguiente número), como se ha hecho en cada cambio de reglas.
- El motor no puede usar `Math.random`, `Date`, ni funciones de `Math` cuyo resultado pueda variar entre motores JS (sin, cos, pow…): el replay del servidor debe dar exactamente lo mismo que el navegador.
- El texto del onboarding toma los números de las constantes del motor; no escribirlos a mano.
- Trampas: internamente `trap` (cualquier trampa) y `red` (trampa roja, texto `#ff2a2a`). Las restas con resultado ≤ 0 también son trampa y se ven normales. Si el color de fondo es rojizo (`REDDISH`), una trampa roja usa la paleta `SAFE`.
- El castigo por bloque escapado usa el resultado original (`b.total`), no los toques que faltan — pedido explícito del usuario.
- Audio, vibración y almacenamiento local siempre envueltos en `try/catch`.
- Nada de `alert`/`confirm`/`prompt` en la web: usar modales propios.

## Preferencias del usuario

- Quiere un juego difícil y tenso; las trampas deben ser sutiles. Ajusta los números a mano mientras juega.
- La vida de un bloque **no** debe depender de su número ni de su operación (decisión explícita); solo del tiempo jugado (etapa final 4→1 s). Consultar antes de cambiarlo.
- Todo texto visible va en español, salvo el nombre del juego, "Touched Block", que va en inglés.
- El tutorial (onboarding) aparece solo la primera vez en cada dispositivo; se repite únicamente desde el botón del Perfil.
