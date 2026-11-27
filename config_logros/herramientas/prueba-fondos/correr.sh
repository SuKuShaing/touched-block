#!/usr/bin/env bash
# Reproduce la prueba de paletas sobre los fondos nuevos (CAMBIO-022). Desde cualquier carpeta; requiere Node y `pnpm install` en el repo.
# No toca el juego ni herramientas/prueba-paletas (solo importa su reglas.ts).
set -eu
cd "$(dirname "$0")"
node generar.mjs
../../../apps/client/node_modules/.bin/vitest run --root . --config ./vitest.config.mts medir.spec.ts > /dev/null 2>&1 || { echo "Falló la medición (corre vitest sin redirigir para ver el error)"; exit 1; }
node resumen.mjs
