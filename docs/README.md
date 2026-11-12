# Documentación de Touched Block

Esta carpeta es la memoria del proyecto: qué se hizo, cómo funciona y, sobre todo, **por qué** se hizo así. Está escrita para quien retome el trabajo sin el contexto de las conversaciones anteriores, sea una persona o una sesión nueva de Claude.

`CLAUDE.md`, en la raíz, es el resumen corto que se carga solo en cada sesión. Estos documentos son el detalle.

## Orden de lectura sugerido

| Documento | Para qué |
|---|---|
| [`historia-y-decisiones.md`](historia-y-decisiones.md) | Cronología del proyecto y cada decisión técnica con su motivo. **Empieza aquí.** |
| [`reglas-y-balance.md`](reglas-y-balance.md) | Reglas del juego con sus valores exactos, progresión, trampas, combos y la historia de cada cambio de reglas (v1–v8). Léelo antes de tocar el balance. |
| [`arquitectura.md`](arquitectura.md) | Cómo está armado el monorepo: motor determinista, cliente Expo, API NestJS, flujo de una partida, almacenamiento local. |
| [`api.md`](api.md) | Contrato exacto de cada endpoint de la API (cuerpos, respuestas, errores, límites). |
| [`despliegue.md`](despliegue.md) | Cómo se publica la web (GitHub Pages) y la API (Dokploy). Incluye Google Cloud, secretos y variables de GitHub, y cómo volver atrás. |
| [`desarrollo.md`](desarrollo.md) | Entorno de la máquina del usuario, comandos, cómo probar, problemas conocidos y cómo trabaja el usuario. |
| [`pendientes.md`](pendientes.md) | Estado actual, tareas pendientes, riesgos e ideas. |
| [`plan-jugabilidad.md`](plan-jugabilidad.md) | Plan por fases para que la gente vuelva y comparta: camino de etapas, insignias y premios, reto a un amigo, reto diario, misiones y logros. Incluye las decisiones del usuario y el estado de cada fase. |

## Reglas para mantener esta documentación

- Si cambias una regla o constante del motor, actualiza `reglas-y-balance.md` en el mismo cambio y agrega una entrada a su historial.
- Si tomas una decisión técnica no obvia, anótala en `historia-y-decisiones.md` con su motivo. El *porqué* es lo que más cuesta reconstruir después.
- Si cambias un endpoint, actualiza `api.md`.
- Mueve a `pendientes.md` lo que quede a medias y quita lo que ya se hizo.
- Todo en español. Las fechas, absolutas (por ejemplo "9 nov 2026", no "ayer").
