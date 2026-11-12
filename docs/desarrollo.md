# Desarrollo

## Entorno de la máquina del usuario

- **Windows 11**. Claude Code tiene PowerShell y Git Bash disponibles.
- **No hay npm ni npx.** Se usa `pnpm` (12.x, fijado en `packageManager`), `pnpm exec` en vez de `npx` y `pnpm dlx`.
  - `create-expo-app` falla porque usa npm por dentro. El cliente se armó a mano (`package.json` + `CI=1 pnpm exec expo install …`).
- **No hay Python.** Para editar archivos usa las herramientas de edición, `sed` o scripts `node -e`.
- Node 24, Docker 29 (Docker Desktop).
- TypeScript 7 en el motor y TypeScript 6 en el cliente y la API.
- **No hay `gh` (GitHub CLI).** Los secretos y variables de GitHub los configura el usuario desde la web.
- Puerto de Postgres local: **5434**, para no chocar con otros proyectos.

## Comandos

```bash
pnpm install

# Motor
pnpm --filter @tb/engine test
pnpm --filter @tb/engine build       # genera dist/, que usa la API (el cliente usa el código fuente)

# Cliente
pnpm --filter @tb/client web                      # http://localhost:8081 (en la raíz; el baseUrl /touched-block solo aplica al exportar)
pnpm --filter @tb/client exec tsc --noEmit
pnpm --filter @tb/client test                     # vitest, solo módulos puros (lib/, cosmetics/, game/*.ts)
pnpm --filter @tb/client exec expo export -p web --output-dir dist

# API
docker compose -f apps/api/docker-compose.yml up -d --wait   # Postgres local (bases touched_block y touched_block_test)
pnpm --filter @tb/api prisma:deploy
pnpm --filter @tb/api start:dev                               # http://localhost:3000
pnpm --filter @tb/api test                                    # unitarios
pnpm --filter @tb/api test:e2e                                # e2e contra touched_block_test

# Compose de producción en local (prueba de humo)
docker build -f apps/api/Dockerfile -t ghcr.io/sukushaing/touched-block-api:prueba .
# luego: copia deploy/.env con API_TAG=prueba y
docker compose -p tbprueba -f deploy/docker-compose.yml --env-file <ese .env> up -d --pull never --wait
docker compose -p tbprueba -f deploy/docker-compose.yml --env-file <ese .env> down -v
```

Resultado esperado al 12 nov 2026 (plan de jugabilidad): motor **160/160** (incluye la prueba dorada), API unitarios **77/77**, API e2e **63/63**, cliente **249/249**, `tsc` del cliente sin errores y `expo export` sin errores.

La API de desarrollo necesita `DAILY_SECRET` solo en producción (en local usa un valor de desarrollo). Para probar con el cliente: `AUTH_DEV_FAKE=1`, `CORS_ORIGINS=http://localhost:8081` y, si el puerto 3000 está ocupado, otro `PORT`; el cliente con `EXPO_PUBLIC_API_URL` apuntando a ese puerto y `EXPO_PUBLIC_AUTH_DEV_FAKE=1`. Expo con `CI=1` no recarga los cambios del código.

## Cómo probar el juego

- **Playwright (MCP)** con viewport de celular (por ejemplo 390×844) y toques reales.
- En desarrollo, `window.__tb_debug` expone el estado del motor, para inspeccionar o forzar situaciones (p. ej. `__tb_debug.state.played = 139` para ver el aviso de las sumas).
- Para simular una visita nueva (tarjetas del inicio, tutorial avanzado), hay que retroceder `tb_last1` más de 30 min con `addInitScript` de Playwright: al salir de la página (`pagehide`) la app lo vuelve a escribir.
- Para probar el cambio de día del reto diario, se desplaza el reloj del navegador; la API solo acepta fechas que alguna zona horaria real tenga en ese momento.
- Para probar cuentas sin Google: API con `AUTH_DEV_FAKE=1` y cliente con `EXPO_PUBLIC_AUTH_DEV_FAKE=1`.
- Si el puerto 8081 queda ocupado por un servidor de Expo anterior, hay que cerrarlo (`taskkill /PID <pid> /F`). Si el clasificador de permisos le niega eso a un subagente, se le pide al usuario; no se intenta por otra vía.

## Problemas conocidos y cómo se resolvieron

| Problema | Solución |
|---|---|
| TypeScript 7: `moduleResolution=node10 has been removed` | `module` y `moduleResolution` en `nodenext` (`packages/engine/tsconfig.json`) |
| El binario nativo de SWC no carga en Windows (vitest de la API) | vitest usa el transformador **oxc** |
| `pnpm dlx create-expo-app` falla (necesita npm) | Proyecto Expo armado a mano |
| Playwright bloquea `file://` | Abrir `about:blank` y cargar el contenido como data URL |
| Test del bot perfecto con cota muy justa | La cota quedó entre `LIFE_STAGE_START` y 15 min, no un número exacto |
| `pnpm/action-setup@v4` con pnpm 12 | Funciona: lee `packageManager` (la web se publicó bien el 9 nov 2026) |

## Convenciones

- **Todo texto visible en español**, salvo el nombre "Touched Block".
- Nada de `alert`, `confirm` ni `prompt` en la web: se usan modales propios (`ConfirmModal`, `Toast`).
- Audio, vibración y almacenamiento local siempre envueltos en `try/catch`.
- **Commits** en español, estilo *conventional commits*: `feat: se añade…`, `refactor: se mejora…`, `docs: …`.
- **Commit y push solo cuando el usuario lo pide.** Un push a `main` reemplaza la web publicada.
- **No romper los registros de los jugadores** (decisión del usuario, 11 nov 2026): subir `RULES_VERSION` o cambiar las claves locales reinicia rankings y récords. Solo con un cambio muy grande que lo amerite y con aprobación expresa; si no, buscar una alternativa compatible.
- Al cambiar reglas:
  1. Evaluar si el cambio obliga a reiniciar (casi nunca debería). Si sí y está aprobado: subir `RULES_VERSION`.
  2. En ese caso, cambiar las claves locales (`tb_bestN`/`tb_histN`).
  3. Actualizar `docs/reglas-y-balance.md` y los tests del motor.
  - Los textos del onboarding se actualizan solos si usan las constantes.

## Cómo trabaja el usuario

- Escribe en español y prefiere respuestas en español.
- Diseña las reglas él mismo y las ajusta jugando. Quiere un juego **difícil y tenso**, con trampas **sutiles**.
- Las decisiones de balance son suyas. Se proponen como sugerencias, no se aplican por iniciativa propia.
  - Ejemplo: la vida de un bloque **no** depende de su número ni de su operación. Hay que consultarlo antes de cambiarlo.
- Pidió **usar subagentes** para delegar y los MCP/skills disponibles. Si hace falta instalar un MCP o una conexión, se le avisa.
- Pregunta cosas de infraestructura (Google Cloud, Dokploy, GitHub) y agradece guías paso a paso con dónde está cada botón.
