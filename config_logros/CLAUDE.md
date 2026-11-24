# Config de logros

Esta carpeta de configuración debe tomarse aparte de toda la aplicación.

Todo lo que está aquí es una réplica de la aplicación y no influye en ella.

## Referencias

La escala de etapas de `index.html` copia la de la pantalla final de la partida:

- `apps/client/src/components/StageTrack.tsx`: dibujo y estilos.
- `apps/client/src/lib/stagePath.ts`: posiciones (cada hito ocupa el mismo ancho).
- `packages/engine/src/progress.ts`: los hitos (`MILESTONES`) y sus íconos.
- `apps/client/src/theme.ts`: colores.

La recta "Bloques destruidos y nivel" usa la fórmula de `apps/client/src/lib/level.ts` (el nivel n empieza en `LEVEL_FACTOR · n · (n − 1)` bloques, `LEVEL_FACTOR = 25`) y marca los niveles que desbloquean un fondo según `apps/client/src/cosmetics/catalog.ts` (Grilla 5, Estrellas 10, Aurora 20).

Las insignias (`insignias/*.svg`) se generaron con `medalSvg()` de `apps/client/src/cosmetics/medal.ts`; sus umbrales son los de `TIERS` en `packages/engine/src/progress.ts`.

El modal de tamaños usa los de `TierBadge.tsx` (`BADGE_PX`: 22, 38, 74), `TabIcons.tsx` (`CHEST_BADGE`: 11) y `medal.ts` (`SHARE_BADGE.box`: 170).

El estado vacío (primera tarjeta, "Sin insignia") copia `EmptyMedal` y `TierCard` de `apps/client/src/screens/CollectionScreen.tsx`.

## Cómo trabajamos aquí

- Esta carpeta es para **analizar** logros, niveles, retos, premios e insignias y su forma de entregarse. **No se modifica nada del juego** (`apps/`, `packages/`, `docs/`) hasta que el usuario diga expresamente "aplica el cambio X".
- Cada cambio propuesto se anota en `cambios.md` como un ToDo con su contexto (qué, por qué, dónde en el código, qué más afecta). Leer ese archivo antes de proponer algo nuevo.
- La web tiene un interruptor **Ahora / Con cambios**. Lo propuesto vive en `CAMBIOS` de `script.js` y debe coincidir con `cambios.md`.
- Antes de aplicar un cambio, recordar la regla de la raíz: no reiniciar rankings ni récords (no subir `RULES_VERSION`).

Las secciones "Retos" y "Misiones" copian `DailyCard.tsx` y `MissionList.tsx` (apps/client/src/components); los datos salen de `packages/engine/src/daily.ts` (`DAILY_CALENDAR`, intentos, vidas, racha) y `packages/engine/src/missions.ts` (`MISSION_POOL`, `MISSIONS_PER_DAY`). Si cambian allí, actualizar `RETO_SEMANA`, `RETO_REGLAS` y `MISIONES` en `script.js`. `RETO_NUEVOS` son los 8 retos nuevos de CAMBIO-013 (solo con el interruptor en "Con cambios"); el contador junto al título "Retos" cuenta las tarjetas que se ven. `MISIONES_NUEVAS` son las 8 misiones nuevas: "Sigue a un jugador hoy" (CAMBIO-014: solo se cumple con cuenta, pero se sortea igual para todos y a un invitado se le muestra bloqueada con "Crea tu cuenta para desbloquearla"; la web tiene un selector "Ver como: con cuenta | invitado" que solo afecta esa fila) y 7 más (CAMBIO-015). `MISIONES_INICIO_POOL` (lunes 2026-12-07, el mismo de `RETO_INICIO_CICLO`) es la fecha desde la que rige el pool de 21; antes, el de 13. Igual que los retos, la lista de misiones depende del interruptor (`dibujarMisiones`, que `aplicarModo()` llama vía `var redibujarMisiones`) y su contador "Misiones posibles" pasa de 13 (Ahora) a 21 (Con cambios).

Las tablas de "Premios" (paletas, sonidos, efectos, fondos) y "Logros" viven en `coleccion.js` y `coleccion.css`; copian `CollectionScreen.tsx`, los requisitos de `apps/client/src/cosmetics/catalog.ts`, los colores de `palettes.ts` y los logros de `packages/engine/src/achievements.ts`. Sus requisitos por insignia y por nivel se calculan con las funciones de `script.js`, así que siguen el interruptor Ahora / Con cambios. Si cambia un premio o un logro en el juego, actualizar `PALETAS`, `SONIDOS`, `EFECTOS`, `FONDOS` y `LOGROS` en `coleccion.js`.

Los diseños propuestos de insignias están en `insignias_nuevas/`, generados por los scripts de `herramientas/`. Antes de hacer o cambiar un diseño, leer `ESTILO_INSIGNIAS.md` (reglas de estilo, cómo regenerar y verificar). Los subagentes que hagan diseños deben escribir solo en `insignias_nuevas/` y en `cambios.md`.

Los iconos propios de cada logro (rayo, play, calendario con llama, copa; siete materiales y estado vacío) están en `logros_iconos/`, generados por `herramientas/gen-logros.js`. La guía de estilo es `ESTILO_LOGROS.md` (CAMBIO-011). La tabla de Logros los muestra con el interruptor en "Con cambios"; un clic en un icono abre el modal con toda su familia (`abrirModalLogro` en `coleccion.js`).
