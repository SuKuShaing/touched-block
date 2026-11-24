#!/usr/bin/env bash
# Reproduce toda la prueba (desde cualquier carpeta). Requiere Node y haber hecho `pnpm install` en el repo.
set -u
cd "$(dirname "$0")"
VITEST=../../../apps/client/node_modules/.bin/vitest
node generar-candidatas.mjs > /dev/null
node preparar-test.mjs
for v in base efectivo; do
  # la prueba del juego (copia con las candidatas); el código de salida != 0 solo indica que hay fallas
  TB_VARIANTE=$v $VITEST run --root . --config ./vitest.config.mts palettes.candidatas.test.ts \
    --reporter=json --outputFile=./vitest-$v.json > /dev/null 2>&1
  # medidas con valores y márgenes
  TB_VARIANTE=$v $VITEST run --root . --config ./vitest.config.mts medir.spec.ts > /dev/null 2>&1
done
node resumen.mjs
