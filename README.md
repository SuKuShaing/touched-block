# Touched Block

Juego táctil para celular, en español: aparecen bloques con un número o una operación y hay que tocar cada uno tantas veces como su resultado antes de que desaparezca. Es de supervivencia contra el reloj, con vidas, combos, bloques trampa y rankings por país y mundiales.

**Jugar:** https://sukushaing.github.io/touched-block/

## Cómo se juega

- Toca cada bloque tantas veces como su resultado: un 6 = 6 toques, "2+3" = 5 toques, "8÷2" = 4 toques.
- El tiempo baja sin parar. Cada bloque que completas **suma** su resultado en segundos.
- Si un bloque se escapa, **resta** su resultado ×5, aunque ya le hayas dado algunos toques. Desde que aparecen las sumas y restas, cualquier bloque que se escape resta ×6; desde las multiplicaciones y divisiones, ×7.
- Tocar fuera de un bloque quita una vida.
- **Solo toca números o resultados positivos.** Son trampa los bloques con el texto rojo y las restas que dan 0 o negativo ("3−4"): habría que tocarlas 0 veces o menos, o sea, dejarlas pasar. Un toque a una trampa quita 30 s; si las dejas desaparecer, no pasa nada.
- **Combos**: 3 bloques seguidos sin errores dan +1 s, 5 dan +2 s, 10 dan +3 s, 15 dan +4 s y 20 dan +5 s; luego el ciclo se repite.
- La dificultad sube siempre: los números llegan a 10, luego aparecen sumas y restas, después multiplicaciones y divisiones, y al final los bloques duran cada vez menos (4, 3, 2 y 1 s).
- Puedes jugar como invitado o entrar con Google para aparecer en los rankings. Cada amigo que invitas te da un corazón extra (hasta 8).

Las reglas detalladas, con sus valores exactos y el historial de decisiones, están en [`docs/reglas-y-balance.md`](docs/reglas-y-balance.md). Toda la documentación del proyecto (arquitectura, decisiones, despliegue, pendientes) está en [`docs/`](docs/README.md).

[Política de privacidad](https://sukushaing.github.io/touched-block/politica-de-privacidad/) · [Condiciones del servicio](https://sukushaing.github.io/touched-block/condiciones-del-servicio/)

## Estructura

| Carpeta | Contenido |
|---|---|
| `packages/engine` | Motor del juego en TypeScript, determinista. Todas las reglas y constantes de balance |
| `apps/client` | La web (Expo Router, lista para convertirse en app Android/iOS) |
| `apps/api` | Backend NestJS + Prisma + PostgreSQL. Contrato en [`docs/api.md`](docs/api.md) |
| `deploy` | `docker-compose.yml` de producción para Dokploy (API + Postgres) |
| `docs` | Documentación: decisiones, arquitectura, reglas, despliegue, pendientes |
| `legacy` | El juego original en HTML/CSS/JS (solo referencia) |

## Ejecutar localmente

Requiere Node 24, pnpm y Docker.

```bash
pnpm install
pnpm --filter @tb/engine test          # tests de las reglas
pnpm --filter @tb/client web           # la web en http://localhost:8081 (modo invitado)

# API (opcional, para cuentas y rankings)
docker compose -f apps/api/docker-compose.yml up -d --wait
cp apps/api/.env.example apps/api/.env
pnpm --filter @tb/engine build
pnpm --filter @tb/api prisma:deploy
pnpm --filter @tb/api start:dev        # http://localhost:3000
```

Para que la web use la API, copia `apps/client/.env.example` a `apps/client/.env.local` y completa las variables.

## Despliegue

- **Web**: cada push a `main` publica en GitHub Pages (`.github/workflows/deploy-pages.yml`).
- **API**: cada tag `vX.Y.Z` construye la imagen Docker, la sube a GHCR y despliega en Dokploy el Compose `deploy/docker-compose.yml`, que incluye la base de datos (`.github/workflows/deploy-api.yml`). Guía paso a paso en [`docs/despliegue.md`](docs/despliegue.md).

Las variables de entorno de producción viven en Dokploy y en los secretos/variables de GitHub; nunca en el repositorio.

## Autores

- José Pinilla
- Sebastián Sanhueza
- Claude (Anthropic)
