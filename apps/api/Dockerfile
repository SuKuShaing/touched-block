# syntax=docker/dockerfile:1.7
# API de Touched Block. El contexto de build es la RAÍZ del monorepo (necesita packages/engine):
#   docker build -f apps/api/Dockerfile -t touched-block-api .

ARG NODE_VERSION=24
ARG PNPM_VERSION=12.16.1

# ---------- build: instala, compila el motor y la API, y arma una carpeta con solo lo de producción
FROM node:${NODE_VERSION}-alpine AS build
ARG PNPM_VERSION
RUN apk add --no-cache openssl && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /repo

# primero los manifiestos, para aprovechar la caché de capas
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/engine/package.json packages/engine/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @tb/api...

COPY packages/engine packages/engine
COPY apps/api apps/api
RUN pnpm --filter @tb/engine build \
 && pnpm --filter @tb/api build \
 && pnpm --filter @tb/api deploy --prod /out
# /out queda con package.json, "files" (dist, prisma, prisma.config.ts) y node_modules de producción

# ---------- runtime
FROM node:${NODE_VERSION}-alpine AS runtime
ARG APP_VERSION=dev
RUN apk add --no-cache openssl
ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION=${APP_VERSION}
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# aplica las migraciones pendientes y arranca
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && exec node dist/main.js"]
