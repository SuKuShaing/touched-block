# Plan de jugabilidad y retención

Plan de implementación acordado el **12 nov 2026**. Objetivo: que quien prueba Touched Block **quiera volver a jugar, vuelva al día siguiente y se lo mande a alguien**. Sale de una conversación con el usuario en la que se eligieron estas ideas: camino de etapas, "una más", reto a un amigo, reto diario, insignias (madera, bronce, plata, oro, diamante) y premios desbloqueables (colores, sonidos, efectos).

**Estado: sin empezar.** Ninguna fase está implementada. Las diez decisiones del usuario ya están tomadas (sección 3). Al terminar cada fase, marcarla aquí y mover lo que quede a [`pendientes.md`](pendientes.md).

---

## 1. Resumen

| Fase | Qué entrega | Toca | Tamaño |
|---|---|---|---|
| 0 | Medición: cuánto duran las partidas, cuánta gente llega a cada etapa y qué tamaños de pantalla hay | Nada (solo consultas) | S |
| 1 | Camino de etapas, "una más", web instalable, silenciar | Motor (solo funciones nuevas), cliente | M |
| 2 | Estadísticas del jugador, insignias, Colección con premios | API, cliente | L |
| 3 | Campo común y reto a un amigo (misma partida) | API, cliente | L |
| 4 | Reto diario | API, cliente | L |
| 5 | Retos con modificador, misiones del día, logros de cinco niveles | Motor (configuración por partida), API, cliente | L |

Tamaños relativos: S = un cambio acotado; M = varias pantallas o módulos; L = esquema de base de datos, endpoints y pantallas nuevas.

El orden importa:

- La fase 0 fija los umbrales de las insignias con datos reales.
- La fase 1 no depende de la API y mejora todas las partidas desde el primer día.
- La fase 2 crea las estadísticas que usan las fases 4 y 5.
- La fase 3 crea el campo común y el modo de partida que reutiliza la fase 4.

---

## 2. Reglas que este plan respeta

Vienen de `CLAUDE.md` y de [`desarrollo.md`](desarrollo.md). Ninguna fase puede romperlas.

1. **No se rompen los registros de los jugadores.** `RULES_VERSION` se queda en 5 y las claves `tb_best5` / `tb_hist5` no cambian. Todo lo nuevo va en tablas, columnas y claves nuevas.
2. **Las reglas viven solo en el motor.** El cliente dibuja; la API valida repitiendo la partida.
3. **El motor sigue siendo determinista.** Nada de `Math.random`, `Date` ni funciones de `Math` que varíen entre motores JS.
4. **Una partida normal de hoy debe dar exactamente el mismo resultado después de cada fase.** Lo garantiza una prueba dorada (fase 1, paso 1.1).
5. **Ningún premio da ventaja.** Los premios son cosméticos. En particular, ninguna paleta puede hacer más visibles las trampas rojas.
6. Todo texto visible en español, salvo "Touched Block". Sin `alert` / `confirm` / `prompt`. Audio, vibración y almacenamiento local con `try/catch`.
7. Los textos toman los números de las constantes del motor; no se escriben a mano.
8. Las decisiones de balance son del usuario: los números de este plan marcados como *provisorios* se confirman con él antes de publicarse.
9. **La base de datos solo crece** (decisión del usuario, 12 nov 2026). Se puede modificar, pero manteniendo lo que hay:
   - Las migraciones solo agregan tablas, columnas e índices. Las columnas nuevas son opcionales o tienen valor por defecto.
   - Ninguna migración borra ni reescribe datos de jugadores (cuentas, partidas, récords, seguimientos).
   - Si alguna vez hiciera falta un cambio que no se puede hacer así, se consulta antes al usuario.
   - Se saca un respaldo antes de aplicar cada migración en producción.
   - La limpieza de partidas de invitado a las 24 h y "Eliminar cuenta" siguen funcionando igual; las tablas nuevas con datos de un usuario se borran con su cuenta, como promete la política de privacidad.

### Para que lo nuevo no estorbe

Todo esto mejora la experiencia solo si no se interpone entre el jugador y la partida. Reglas que cada fase debe cumplir, y que se revisan con Playwright antes de publicar:

| Dónde puede estorbar | Regla |
|---|---|
| Durante la partida (avisos de hito, récord, amigo superado, combos) | Un solo aviso a la vez, en la franja superior, nunca sobre un bloque. Si coinciden varios, se muestra el más importante y el resto se descarta. Tocar fuera de un bloque cuesta una vida, así que ningún aviso puede tapar ni parecer un bloque |
| Pantalla final (camino, cercanía, premios, ranking, compartir) | "Jugar de nuevo" siempre visible sin desplazarse y disponible de inmediato. Nada de ventanas que haya que cerrar: los premios y celebraciones son tarjetas dentro de la pantalla, y duran poco |
| Inicio (reto del día, misiones, instalar) | "Jugar" sigue siendo el botón principal. Como máximo una tarjeta promocional a la vez; la de instalar se puede descartar para siempre |
| Jugador nuevo | En su primera partida solo ve lo de hoy más el camino de etapas. La Colección, los retos y las misiones se presentan cuando le sirven (primer premio, segunda visita), no todos juntos |
| Quien no quiere premios ni retos | Todo es opcional. El juego se ve y suena como hoy mientras no elija otra cosa |
| Retos en celulares altos | Sobra una franja sin usar; los toques ahí se ignoran y no cuestan vida |
| Celulares lentos | Los elementos nuevos del marcador no pueden bajar la fluidez; se prueba con el procesador limitado en las herramientas del navegador |

### Orden de publicación en cada fase

La web se publica con cada push a `main` y la API con cada tag. Por eso, en toda fase que toque las dos:

1. Los cambios de la API son **compatibles con la web anterior**: campos nuevos opcionales, endpoints nuevos, nada renombrado ni eliminado.
2. Se publica primero la API (tag `vX.Y.Z`) y se verifica `/health`.
3. Después se hace push de la web.

---

## 3. Decisiones del usuario (tomadas el 12 nov 2026)

| # | Tema | Decisión | Afecta a |
|---|---|---|---|
| D1 | Umbrales de las insignias | Partir con las etapas del juego (tabla de la fase 2) y ajustarlos con los datos de la fase 0 | Fase 2 |
| D2 | Guardar un resumen de las partidas de invitado después de las 24 h | **No.** Se siguen borrando a las 24 h, como hoy. La política de privacidad no cambia por esto | Fase 0 |
| D3 | Identificador anónimo por dispositivo | **No por ahora.** El retorno se mide solo con las cuentas | Fase 0 |
| D4 | Tamaño del campo de los retos | **Se ajusta a la pantalla más chica.** Los celulares ya envían el tamaño de su pantalla; el servidor los compara y determina el campo (detalle en 3.1) | Fases 0, 3 y 4 |
| D5 | Usar ese campo también en el modo normal | **No por ahora** | Fase 3 |
| D6 | ¿Las partidas de reto cuentan para el ranking general y el récord? | **No.** Repetir una misma semilla permite practicarla | Fases 3 y 4 |
| D7 | Cambio de día del reto diario | **A la medianoche de cada jugador** | Fase 4 |
| D8 | Intentos del reto diario | **3 con cuenta y 1 como invitado** | Fase 4 |
| D9 | Paleta para daltónicos | **Gratis desde el inicio**, con la misma regla de contraste que las demás | Fase 2 |
| D10 | Respaldos de la base | **Sí, antes de publicar la fase 2** (hoy no hay ninguno) | Fase 2 |

Además: la base de datos se puede modificar, pero solo para agregar (regla 9 de la sección 2).

---

## 4. Fase 0: medir

**Objetivo:** saber cuánto duran las partidas, qué porcentaje llega a cada etapa y qué tamaños de pantalla tienen los jugadores. Con eso se fijan los umbrales de las insignias (D1), se decide si el camino necesita más hitos tempranos y se confirma el campo de los retos (D4).

No se cambia nada en la API ni en la base (D2 y D3): son solo consultas.

### 0.1 Consultas sobre los datos que ya existen

La tabla `Run` guarda la duración (`ticks`, 60 por segundo) y el tamaño del campo de cada partida. Limitación aceptada: las partidas de invitado sin reclamar se borran a las 24 h, así que hay historia completa solo de las cuentas. Para tener una muestra de invitados, se repite la primera consulta en varios días distintos: cada vez muestra los invitados de las últimas 24 h.

Se corre en la terminal del contenedor `tb-db` en Dokploy (`psql -U <usuario> <base>`):

```sql
-- Por partida: dónde terminan
SELECT "rulesVersion",
       count(*)                                              AS partidas,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ticks) / 60.0) AS mediana_s,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY ticks) / 60.0) AS p90_s,
       count(*) FILTER (WHERE ticks <  20 * 60)  AS antes_de_20s,
       count(*) FILTER (WHERE ticks >= 40 * 60)  AS llegan_al_5,
       count(*) FILTER (WHERE ticks >= 100 * 60) AS llegan_al_8,
       count(*) FILTER (WHERE ticks >= 140 * 60) AS llegan_a_sumas,
       count(*) FILTER (WHERE ticks >= 275 * 60) AS llegan_a_mult,
       count(*) FILTER (WHERE ticks >= 350 * 60) AS llegan_a_final,
       count(*) FILTER (WHERE ticks >= 440 * 60) AS llegan_a_1s
FROM "Run"
WHERE status = 'valid'
GROUP BY 1 ORDER BY 1;

-- Por jugador con cuenta: su mejor partida (es lo que define la insignia)
SELECT count(*)                                        AS jugadores,
       count(*) FILTER (WHERE mejor >= 140 * 60)       AS bronce,
       count(*) FILTER (WHERE mejor >= 275 * 60)       AS plata,
       count(*) FILTER (WHERE mejor >= 350 * 60)       AS oro,
       count(*) FILTER (WHERE mejor >= 440 * 60)       AS diamante,
       round(avg(partidas), 1)                         AS partidas_por_jugador
FROM (SELECT "userId", max(ticks) AS mejor, count(*) AS partidas
      FROM "Run" WHERE status = 'valid' AND "userId" IS NOT NULL GROUP BY 1) t;

-- Retorno de las cuentas: en cuántos días distintos jugó cada una
SELECT dias, count(*) AS jugadores
FROM (SELECT "userId", count(DISTINCT date_trunc('day', "finishedAt")) AS dias
      FROM "Run" WHERE status = 'valid' AND "userId" IS NOT NULL GROUP BY 1) t
GROUP BY 1 ORDER BY 1;

-- Tamaños de pantalla (campo de juego) que envían los celulares: base para el campo de los retos (D4)
SELECT count(*)                                                          AS partidas,
       min("fieldW")                                                     AS ancho_min,
       round(percentile_cont(0.05) WITHIN GROUP (ORDER BY "fieldW"))     AS ancho_p5,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY "fieldW"))     AS ancho_mediana,
       min("fieldH")                                                     AS alto_min,
       round(percentile_cont(0.05) WITHIN GROUP (ORDER BY "fieldH"))     AS alto_p5,
       round(percentile_cont(0.5)  WITHIN GROUP (ORDER BY "fieldH"))     AS alto_mediana
FROM "Run"
WHERE status = 'valid';
```

**Hecho cuando:** hay una tabla con los porcentajes por etapa y los tamaños de pantalla, y el usuario confirmó los umbrales de las insignias.

---

## 5. Fase 1: camino de etapas, "una más", instalable y silenciar

**Objetivo:** que cada partida muestre lo cerca que estuvo de lo siguiente y que volver a jugar sea un toque. No depende de la API.

### 1.1 Prueba dorada del motor (antes de tocar nada)

- `packages/engine/test/golden.test.ts`: para unas 20 semillas fijas y dos tamaños de campo, juega con un bot determinista y compara `killed`, `missed`, `bestStreak`, `ticks` y `endReason` contra valores guardados.
- Se generan con el motor **actual** y no se regeneran salvo un cambio de reglas aprobado.
- Es la red de seguridad de la regla 4: si una fase altera una partida normal, esta prueba falla.

### 1.2 Hitos e insignias en el motor (`packages/engine/src/progress.ts`)

Funciones puras nuevas, derivadas de las constantes. No cambian `game.ts`.

- `MILESTONES`: lista ordenada de hitos `{ at, kind, value }`, con `at` en segundos.

  | Segundo | Hito | Sale de |
  |---|---|---|
  | 20, 40, 60, 80, 100, 120 | Aparece el 4, 5, 6, 7, 8, 9 | `NUM_STEP` |
  | 140 | Aparece el 10 y las sumas y restas | `ADD_START` |
  | 275 | Multiplicaciones y divisiones | `MUL_START` |
  | 350, 380, 410, 440 | Etapa final: bloques de 4, 3, 2 y 1 s | `LIFE_STAGE_START`, `LIFE_STAGE_STEP` |

- `milestoneIndexAt(played)`: cuántos hitos se han cruzado. Se calcula con las mismas funciones del motor (`maxNumFor`, `maxAddFor`, `maxMulFor`, `stageLifeFor`), para que el aviso coincida exactamente con el momento en que el motor cambia.
- `TIERS` y `tierForTicks(ticks)`: la insignia según la duración, comparando enteros (`ticks >= at * TICKS_PER_SECOND`), para que cliente y servidor den siempre lo mismo.
- Tests: la lista coincide con las constantes; `tierForTicks` en los bordes.

### 1.3 Duración y racha en el historial local

- `lib/history.ts`: `HistEntry` suma dos campos **opcionales**, `t` (ticks) y `s` (mejor racha). La clave `tb_hist5` no cambia y las entradas antiguas siguen siendo válidas.
- `lib/stats.ts` (nuevo): clave `tb_stats1` con `{ bestTicks, bestStreak, totalKilled, runs }`. No depende de la versión de reglas. La primera vez se inicializa con lo que haya en `tb_hist5` y `tb_best5`.
- `recordRun` recibe el `GameResult` completo y actualiza ambas.

### 1.4 Camino de etapas en la pantalla final (`components/StageTrack.tsx`)

- Pista horizontal con los hitos, un marcador "hoy" y otro "tu mejor".
- Una frase debajo, con este orden de prioridad:
  1. Si cruzó un hito nuevo para él: "¡Llegaste a las sumas y restas!".
  2. Si no: "Te faltaron 28 s para las sumas y restas" (el siguiente hito).
- La escala no es lineal: cada hito ocupa el mismo ancho, para que los primeros 140 s no se vean como una barra casi vacía.
- Con movimiento reducido, sin animación de llenado.

### 1.5 Avance durante la partida

- `components/Hud.tsx`: línea fina bajo la barra de tiempo que se llena hacia el próximo hito, con su ícono al final (`5`, `+ −`, `× ÷`, `4 s`).
- `GameScreen`: al aumentar `milestoneIndexAt(s.played)`, un aviso breve con sonido propio. En los cambios de etapa incluye el castigo, tomado de las constantes: "¡Sumas y restas! Escapar ahora resta ×6".
- El aviso no tapa bloques: va en la franja superior del campo, como el de la racha.

### 1.6 "Una más"

- **Botón arriba.** Hoy "Jugar de nuevo" queda debajo del historial y en pantallas chicas hay que desplazarse. Nuevo orden: título → bloques destruidos → camino de etapas → **Jugar de nuevo** → ranking y compartir → historial.
- **Cercanía al récord**: "Te faltaron 4 bloques para tu récord" cuando no hubo récord.
- **Cercanía a un amigo** (con sesión): con `GET /leaderboards?scope=friends&period=week`, que ya existe, "Estás a 3 bloques de @jose esta semana". Sin cambios en la API.
- **Avisos en plena partida**: al pasar el récord local ("¡Nuevo récord!") y al superar el puntaje semanal de un amigo ("Superaste a @jose"). Los puntajes de los amigos se piden al empezar; si no llegan, no hay aviso. Máximo un aviso por objetivo.

### 1.7 Web instalable

- `public/manifest.webmanifest`: nombre, `start_url` y `scope` en `/touched-block/`, `display: standalone`, orientación vertical, colores `#12121a`, íconos de 192 y 512 px y uno *maskable*.
- Generar `icon-512.png` e `icon-maskable-512.png` desde `favicon.svg`.
- `public/index.html`: `<link rel="manifest">` y las etiquetas `apple-mobile-web-app-*`.
- **Sin service worker** en esta versión. Un caché mal manejado dejaría a la gente con una web vieja, y el cliente desactualizado no entra al ranking. Al implementar, confirmar con Lighthouse que Chrome ofrece instalar sin él.
- `platform/install.web.ts` (y `.native.ts` vacío): captura `beforeinstallprompt` en Android. En iOS no existe ese evento, así que se muestran las instrucciones ("Compartir → Agregar a inicio").
- Dónde se ofrece: una tarjeta en el inicio desde la 2.ª visita (ya se cuentan en `lib/onboarding.ts`) y una fila fija en el Perfil. Se puede descartar; no se ofrece si ya está instalada.

### 1.8 Silenciar

- `lib/settings.ts`: clave `tb_set1` con `{ sound, haptics }` (después suma el tema elegido).
- `platform/fx`: `beep` y `buzz` respetan los ajustes.
- Controles: dos interruptores en el Perfil ("En este dispositivo") y un ícono de sonido en la pantalla de inicio.

### Pruebas y publicación

- Motor: tests nuevos y prueba dorada.
- Cliente: `tsc --noEmit`; Playwright en 360×640, 390×844 y 412×915: el botón "Jugar de nuevo" se ve sin desplazarse, el camino no se corta, los avisos no tapan bloques. Con `window.__tb_debug.state.played` se fuerza cada etapa.
- Solo web: push a `main`.
- Documentación: `reglas-y-balance.md` (sección Interfaz), `arquitectura.md` (claves locales y archivos nuevos), `historia-y-decisiones.md`.

**Hecho cuando:** un jugador nuevo ve en su primera pantalla final cuánto le faltó para el siguiente hito y puede reintentar sin desplazarse.

---

## 6. Fase 2: estadísticas, insignias y Colección

**Objetivo:** que cada partida deje algo, aunque no sea récord, y que el jugador tenga metas visibles.

### 2.1 Insignias

| Insignia | Se gana al llegar a | Tiempo jugado | Constante |
|---|---|---|---|
| Madera I | Primera partida terminada | — | — |
| Madera II | El 5 | 40 s | `NUM_STEP` |
| Madera III | El 8 | 100 s | `NUM_STEP` |
| Bronce | Sumas y restas | 140 s | `ADD_START` |
| Plata | Multiplicaciones y divisiones | 275 s | `MUL_START` |
| Oro | Etapa final | 350 s | `LIFE_STAGE_START` |
| Diamante | Bloques de 1 s | 440 s | `LIFE_STAGE_START + 3 × LIFE_STAGE_STEP` |

Umbrales *provisorios* (D1). Meta orientativa: Bronce para cerca de un tercio de los jugadores, Plata para uno de cada diez, Oro para pocos y Diamante para casi nadie. Si los datos de la fase 0 muestran que Bronce queda demasiado lejos, se ata a un tiempo menor en vez de a la etapa.

### 2.2 API

**Esquema** (una migración):

- `Run`: columnas nuevas `bestStreak Int?` y `endReason String?`. `verifyRun` pasa a devolver ambos valores, que `replay()` ya calcula, y se guardan al terminar la partida.
- Tabla `UserStats`: `userId` (clave), `bestTicks`, `bestStreak`, `totalKilled`, `totalRuns`, `updatedAt`.
- **Relleno inicial** dentro de la migración, para que los jugadores actuales reciban lo que ya ganaron:

  ```sql
  INSERT INTO "UserStats" ("userId", "bestTicks", "bestStreak", "totalKilled", "totalRuns", "updatedAt")
  SELECT "userId", max(ticks), 0, sum(killed), count(*), now()
  FROM "Run" WHERE status = 'valid' AND "userId" IS NOT NULL GROUP BY 1;
  ```

- La mejor racha no está guardada. `scripts/backfill-streaks.mjs` la calcula repitiendo las partidas guardadas **de las reglas actuales** (las de versiones anteriores no se pueden repetir con este motor). Las demás parten en 0.

**Servicio** `stats/stats.service.ts`:

- `record(userId, { ticks, killed, bestStreak })` con una sola sentencia atómica (`INSERT … ON CONFLICT DO UPDATE` con `GREATEST` y sumas). Se llama donde hoy se llama `recordBest`: al terminar con sesión y al reclamar.
- Solo las partidas de modo normal cuentan para `bestTicks` y `bestStreak` (ver D6). `totalKilled` y `totalRuns` cuentan todas.

**Contrato** (todo campos nuevos, compatibles con la web anterior):

- `Me`: `stats: { bestTicks, bestStreak, totalKilled, totalRuns }` y `tier: { tier, step }`.
- Perfil público y cada fila de `GET /leaderboards`: `tier`.
- `RunResult` válido con sesión: `stats` (después de la partida).

La insignia se calcula con `tierForTicks` del motor; no se guarda.

### 2.3 Cliente: estadísticas y nivel

- Con sesión manda el servidor; como invitado, `tb_stats1`. Para la Colección de este dispositivo se usa el máximo de ambos. La insignia **pública** siempre sale del servidor.
- `lib/level.ts`: nivel según el total de bloques destruidos. *Provisorio*: el nivel `n` pide `25 · n · (n − 1)` bloques (nivel 2 = 50, nivel 5 = 500, nivel 10 = 2.250, nivel 20 = 9.500).

### 2.4 Cliente: premios

- `cosmetics/catalog.ts`: cada premio con `id`, tipo, nombre y una condición que es **función pura de las estadísticas**. Nada se "entrega" ni se guarda: lo desbloqueado se recalcula.
- La selección se guarda en `tb_set1` (solo en este dispositivo).

Catálogo inicial (*provisorio*):

| Premio | Tipo | Condición |
|---|---|---|
| Clásica | Paleta | Siempre |
| Alto contraste (daltónicos) | Paleta | Siempre (D9) |
| 8 bits | Sonido | Siempre (es el actual) |
| Suave | Sonido | Terminar 1 partida |
| Pastel | Paleta | Madera II |
| Chispas | Efecto al destruir | Madera III |
| Confeti | Efecto al destruir | Racha de 25 |
| Neón | Paleta | Bronce |
| Retro | Paleta | Plata |
| Marimba | Sonido | Plata |
| Dorado | Paleta y marco en el ranking | Oro |
| Diamante | Paleta con brillo y marco | Diamante |
| Grilla, Estrellas, Aurora | Fondo del campo | Nivel 5, 10, 20 |
| Corazones | Efecto al destruir | Invitar a 1 amigo |

**Paletas** (`cosmetics/palettes.ts`):

- El motor sigue asignando sus colores. El cliente traduce por posición en `COLORS` (9 colores) al dibujar el bloque, las partículas y el bloque que se apaga. El corazón de recuperación no cambia.
- Regla de no ventaja: el motor solo pone trampas rojas sobre los colores `SAFE` (posiciones 2, 3, 4, 5, 7 y 8). En cada paleta, el contraste entre el rojo de la trampa (`#ff2a2a`) y esos seis colores debe quedar dentro del rango de la paleta Clásica; y el texto blanco debe leerse igual o mejor.
- Un test lo comprueba para todas las paletas. El cliente no tiene tests hoy: se agrega `vitest` solo para módulos puros (`lib/`, `cosmetics/`).

**Sonidos** (`game/sounds.ts`):

- Hoy los tonos están escritos dentro de `GameScreen`. Se mueven a un paquete `8bits` con los mismos valores, y `GameScreen` llama `sounds.play('kill')`, `sounds.play('hit', n)`, etc.
- Los paquetes nuevos son otros juegos de parámetros (onda, notas, duración, volumen). Sin archivos de audio.

**Efectos y fondos**: `Fx.tsx` recibe la forma de la partícula; el campo recibe un estilo de fondo.

### 2.5 Cliente: pantallas

- **`/coleccion`** (se abre desde el Perfil): insignia actual y la siguiente con su avance; nivel; premios por tipo. Lo bloqueado se ve en gris con su requisito y cuánto falta ("Neón: llega a las sumas · te faltaron 28 s"). Tocar un premio desbloqueado lo activa.
- **`components/TierBadge.tsx`**: la insignia en tres tamaños. Se usa en rankings, perfil, perfil público, pantalla final y la tarjeta de compartir (`share.web.ts` la dibuja en el `<canvas>`).
- **Pantalla final**: si la partida desbloqueó algo (comparando estadísticas antes y después), tarjeta "¡Desbloqueaste Neón!" con "Probar ahora", que lo activa y empieza otra partida. Si subió de insignia, se celebra antes que el resto.
- **Tarjeta de compartir**: suma la insignia y la etapa ("Llegué a las multiplicaciones").

### Pruebas y publicación

- API: unitarios de `StatsService`; e2e (terminar con sesión, reclamar, concurrencia, relleno inicial).
- Cliente: test de paletas; Playwright de la Colección y del desbloqueo.
- Antes de publicar: respaldos de la base configurados (D10).
- Orden: tag de la API → verificar `/health` → push de la web.
- Política de privacidad: agregar las estadísticas guardadas y que la insignia es pública.
- Documentación: `api.md`, `arquitectura.md`, `reglas-y-balance.md` (insignias y premios), `historia-y-decisiones.md`.

**Hecho cuando:** un jugador que llega por primera vez a las sumas ve subir su insignia a Bronce, desbloquea Neón y la insignia aparece junto a su nombre en el ranking.

---

## 7. Fase 3: campo común y reto a un amigo

**Objetivo:** que compartir invite a hacer algo: jugar exactamente la misma partida y comparar.

### 3.1 Campo común (D4)

Hoy el campo es el tamaño de la pantalla de cada celular, y la posición de los bloques depende de él. La misma semilla da partidas distintas en dos dispositivos. Para que un reto sea la misma partida para todos, sus jugadores tienen que usar el mismo campo.

**Decisión del usuario:** el campo se ajusta a la pantalla más chica. Cada celular ya envía el tamaño de su campo en `POST /runs`; el servidor compara y determina. Así nadie juega con los bloques achicados.

**Cómo lo determina el servidor** (`runs/common-field.service.ts`):

- Toma el ancho y el alto de los campos enviados en las partidas válidas de los últimos 30 días y calcula el **percentil 5** de cada uno. Es decir, un campo que cabe sin achicarse en el 95 % de las pantallas que de verdad juegan.
- No se usa el mínimo absoluto: una sola ventana minúscula (la API acepta desde 160 px) achicaría el campo de todos.
- Límites de seguridad (*provisorios*): ancho entre 320 y 430, alto entre 440 y 800. Con menos de 200 partidas en el período, se usa 360 × 540.
- Se recalcula como máximo una vez por hora y queda en memoria.

**En un reto a un amigo** hay un límite que no se puede evitar: el reto es por enlace y cada uno juega cuando puede, así que quien lo crea juega antes de que se conozca la pantalla del otro. Por eso:

- El campo del reto se fija al crearlo: el menor, en cada dimensión, entre el campo del creador y el campo común. Queda guardado en el reto.
- Quien abre el enlace juega ese mismo campo, escalado a su pantalla. Si su pantalla es más grande, lo ve más grande. Si es más chica que el campo del reto (raro, por el percentil 5), lo ve un poco reducido.

**En el reto diario** el campo del día es el campo común vigente cuando se crea la primera partida de esa fecha, y queda guardado para todos los que jueguen ese día (fase 4).

**El motor no cambia**: `createGame` ya recibe el tamaño del campo.

**Cliente:**

- En los modos de reto, el cliente envía su tamaño real, como hoy, y usa el `fieldW` / `fieldH` que **devuelve** el servidor (`POST /runs` ya los devuelve).
- La partida se dibuja en un rectángulo centrado con una sola escala `k = min(ancho / fieldW, alto / fieldH)`.
  - Los toques se convierten dividiendo por `k`.
  - Un toque fuera del rectángulo **se ignora** (no quita vida).
  - El rectángulo lleva un borde sutil, porque tocar dentro pero fuera de un bloque sí cuesta una vida.
- `GameScreen` ya escala posiciones con `sx` / `sy`; se generaliza a un "área de juego" con desplazamiento y escala.
- Probar en 360×640, 390×844 y 412×915, y creando el reto desde el más grande y desde el más chico.

**Modo normal (D5):** no cambia; sigue usando la pantalla completa de cada celular. Usar el campo común también ahí permitiría mandar cualquier partida como reto, pero cambia cómo se ve el juego principal. Se puede reconsiderar después de ver los retos funcionando.

### 3.2 Modos de partida en la API

- `Run.mode`: enum `normal | duel | daily`, por defecto `normal`. Las partidas existentes quedan como `normal` sin tocarlas.
- `POST /runs` acepta `mode` opcional. Sin él, todo funciona como hoy.
- En `duel` y `daily`:
  - el servidor decide el campo (3.1) y lo guarda en la partida,
  - `maxLives` es siempre 5, para todos,
  - la partida no entra a `BestScore` ni al récord (D6).
- `verifyRun` no cambia: repite con la semilla, las vidas y el campo guardados en la partida.

### 3.3 Reto a un amigo

**Flujo:**

1. En la pantalla final o en el inicio: "Retar a un amigo".
2. El jugador juega una partida de reto (semilla nueva, campo según 3.1).
3. Al terminar recibe un enlace con su resultado: "Hice 47 bloques en este reto de Touched Block. Juega la misma partida y supérame".
4. El amigo abre el enlace, juega **la misma partida** sin necesidad de cuenta y ve la comparación: "Tú 52 · @seba 47. ¡Ganaste por 5!".
5. Desde ahí: "Revancha" (reto nuevo con enlace nuevo) y "Compartir resultado".

**Esquema:**

- `Challenge`: `code` (8 caracteres, clave), `seed`, `fieldW`, `fieldH`, `rulesVersion`, `createdAt`, `expiresAt` (30 días).
- `ChallengeEntry`: `challengeCode`, `userId?`, `runId?`, `killed`, `missed`, `ticks`, `createdAt`. Guarda su propia copia del resultado, porque las partidas de invitado se borran a las 24 h. Si el invitado reclama la partida, la entrada toma su `userId`.

**Endpoints:**

- `POST /runs { mode: 'duel', fieldW, fieldH }`: crea el reto con su campo y devuelve además `challengeCode`.
- `POST /runs { mode: 'duel', challenge, fieldW, fieldH }`: se une a un reto existente; la respuesta trae la semilla y el campo del reto.
- Al terminar una partida válida de reto, el servidor crea la `ChallengeEntry`. Con cuenta, **cuenta el primer intento** de cada jugador; los siguientes se juegan pero no reemplazan el resultado.
- `GET /challenges/:code` (sesión opcional): `{ code, playable, entries: [{ username | null, tier, killed, missed, isMe }] }`. `playable` es falso si venció o si cambió la versión de reglas.
- Errores nuevos: `404 challenge_not_found`, `410 challenge_expired`.
- Límite: `POST /runs` ya tiene 30 por minuto por IP.

**Cliente:**

- **Enlace por parámetro**, no por ruta: `https://sukushaing.github.io/touched-block/?reto=K7M2QX`. En GitHub Pages una ruta como `/reto/K7M2QX` responde con código 404 (aunque cargue la app), y eso rompe la vista previa del enlace en WhatsApp.
- `(tabs)/index.tsx` lee `reto`; `GameScreen` muestra "Reto de @seba: 47 bloques. Juega la misma partida".
- **Primera visita con reto**: se abre igual el tutorial básico, y su botón "¡Jugar!" empieza el reto en vez de una partida normal (el código se guarda mientras tanto).
- Sin conexión no hay reto: "El reto necesita conexión". No hay semilla local de respaldo.
- `game/rankedRun.ts`: `RunMode` suma el modo y el código; `prepareRun` recibe opciones.
- `EndPanel`: variante de reto con la comparación, "Revancha" y "Compartir".
- Un invitado que juega un reto ve la misma oferta de iniciar sesión que hoy.

### Pruebas y publicación

- API: unitarios del campo común (percentil, límites, pocos datos); e2e de crear reto, unirse desde una pantalla más grande y desde una más chica, primer intento, invitado que reclama, vencimiento.
- Motor: test de que dos partidas con la misma semilla y el mismo campo generan los mismos bloques.
- Cliente: Playwright con dos contextos (quien reta y quien recibe el enlace), y el caso de primera visita con tutorial.
- Orden: tag de la API → push de la web.
- Política de privacidad: los resultados de un reto los ve cualquiera que tenga el enlace.
- Documentación: `api.md`, `arquitectura.md`, `reglas-y-balance.md`, `historia-y-decisiones.md` (cómo se determina el campo común, por qué parámetro y no ruta, por qué no cuenta para el ranking).

**Hecho cuando:** dos celulares de distinto tamaño abren el mismo enlace, ven los mismos bloques en el mismo orden y cada uno ve el resultado del otro.

---

## 8. Fase 4: reto diario

**Objetivo:** una razón para abrir el juego todos los días.

### 4.1 Reglas del modo

- Una partida por día, **igual para todos**: misma semilla, mismo campo (el campo común de ese día, 3.1), 5 vidas, reglas normales.
- **3 intentos** con cuenta; cuenta el mejor. **1 intento** como invitado (D8).
- Un intento se gasta al **empezar** la partida, no al terminarla. Así nadie mira los primeros bloques y abandona gratis. Si se corta la conexión a mitad, el intento se pierde; el texto lo avisa antes de empezar.
- Ranking propio por día. No entra al ranking general (D6).
- **Día**: la fecha local del jugador (D7). El cliente manda `date` (`AAAA-MM-DD`) y el servidor la acepta si está a no más de un día de la fecha UTC. Con UTC, en Chile el reto cambiaría a las 21:00.
- **Número del reto**: días desde una fecha de inicio fija ("Reto #42").

### 4.2 API

- **Semilla**: `HMAC-SHA256(DAILY_SECRET, fecha)` recortada a 31 bits. Sin tabla ni tarea programada, y nadie puede adivinar la de mañana. `DAILY_SECRET` es una variable nueva en Dokploy y en `deploy/.env.example`.
- **Esquema**:
  - `DailyChallenge`: `date` (clave), `fieldW`, `fieldH`, `createdAt`. Se crea con la primera partida de esa fecha y fija el campo del día para todos.
  - `Run.dailyDate` (fecha, nulo fuera del modo).
  - `DailyEntry`: `userId`, `date`, `runId`, `killed`, `missed`, `ticks`, `bestStreak`, `attempts`, `achievedAt`, `country`. Clave `(userId, date)`. Índices por `(date, killed desc, missed, achievedAt)` y con país, igual que `BestScore`.
- **Endpoints**:
  - `POST /runs { mode: 'daily', date }`: con sesión, cuenta las partidas de ese usuario y fecha (en cualquier estado); si ya hay 3, `409 daily_attempts_exhausted`. Fecha fuera de rango: `400 daily_date_invalid`.
  - `POST /runs/:id/finish`: en modo diario actualiza `DailyEntry` si mejora (misma lógica atómica que `BestScoresService.record`) y agrega a la respuesta `daily: { attemptsLeft, isBestToday, rank, total, betterThanPct, friends: { beaten, total }, streak }`.
  - `POST /runs/:id/claim`: si el usuario ya gastó sus intentos, `409 daily_attempts_exhausted`.
  - `GET /daily?date=` (sesión opcional): `{ date, number, attemptsMax, attemptsUsed, best, total, streak: { current, best }, yesterday }`. `yesterday` trae mi posición, el total y el ganador.
  - `GET /daily/leaderboard?date=&scope=world|country|friends&limit=`: misma forma que `GET /leaderboards`.
- **Porcentaje**: jugadores con peor puntaje que el mío sobre el resto. Con menos de 10 jugadores ese día se muestra la posición ("Vas 2.º de 4") en vez del porcentaje.
- **Racha de días**: se calcula al leer, desde las fechas de `DailyEntry`. Tolera un día sin jugar por cada siete (*provisorio*).
- Estadísticas (fase 2): las partidas del reto suman a `totalKilled` y `totalRuns`.

### 4.3 Cliente

- **Inicio**: tarjeta "Reto de hoy #42" con los intentos (●●○), la cuenta regresiva al siguiente y la racha de días. Tocarla abre una hoja breve con las reglas la primera vez (misma partida para todos, 3 intentos, el intento se gasta al empezar).
- **Al abrir el juego al día siguiente**: "Ayer quedaste 12.º de 80. Ganó @jose con 91". Se muestra una vez (clave local `tb_daily1`).
- **Pantalla final del reto**: mejor del día, intentos que quedan, porcentaje o posición, amigos superados, racha y la tira de la semana (L M M J V S D).
- **Rankings**: selector nuevo "General | Reto de hoy" sobre los filtros actuales.
- **Invitados**: un intento, guardado en `tb_daily1`. Ven "Habrías quedado 12.º"; al iniciar sesión la partida se reclama con el mecanismo que ya existe.
- **Compartir sin spoilers** (texto, no imagen), con una celda por paso de insignia alcanzado:

  ```
  Touched Block · Reto #42
  58 bloques · racha 31
  🟫🟫🟫🟧⬜⬛⬛
  Mejor que el 72 %
  https://sukushaing.github.io/touched-block/?diario=1
  ```

- Premio de constancia en el catálogo: paleta exclusiva por 7 días seguidos (*provisorio*).

### Pruebas y publicación

- API: unitarios de la semilla, la ventana de fechas y la racha; e2e de intentos, mejora del mejor del día, ranking del día, invitado que reclama con y sin intentos.
- Cliente: Playwright cambiando la fecha del navegador (cambio de día, cuenta regresiva, aviso de ayer).
- Orden: variable `DAILY_SECRET` en Dokploy → tag de la API → push de la web.
- Política de privacidad: resultados del reto diario públicos, como los rankings.
- Documentación: `api.md`, `despliegue.md` (variable nueva), `reglas-y-balance.md`, `historia-y-decisiones.md`.

**Hecho cuando:** dos cuentas juegan el reto del día, cada una ve su posición frente a la otra, y al cambiar el día aparece el reto nuevo con el resumen de ayer.

---

## 9. Fase 5: modificadores, misiones y logros

**Objetivo:** variedad para quien ya juega todos los días, y que todos prueben las operaciones sin sobrevivir 140 s.

### 5.1 Retos con modificador

- **Motor**: `GameConfig.mods` opcional. Sin él, el motor se comporta exactamente como hoy (lo comprueba la prueba dorada). `RULES_VERSION` no cambia.
- Modificadores iniciales (*provisorios*):

  | Modificador | Efecto |
  |---|---|
  | `startAt` | La dificultad parte como si ya se hubieran jugado N segundos (por ejemplo 140: directo en sumas y restas) |
  | `only` | Solo una familia de bloques (por ejemplo multiplicaciones y divisiones) |
  | `lives` | Otra cantidad de vidas (por ejemplo 3) |
  | `noRed` | Sin trampas rojas |

- **API**: `Run.config` (JSON, nulo en partidas normales) se guarda al crear la partida y se pasa a `replay`. El reto de cada día toma su modificador de un calendario fijo por día de la semana, definido en el motor para que cliente y servidor coincidan.
- **Cliente**: la tarjeta del reto anuncia el modificador ("Hoy: directo a las sumas").
- Las partidas con modificador no cuentan para la insignia ni para la mejor racha.
- Tests del motor por modificador, y un test de repetición con cada uno.

### 5.2 Misiones del día

- Tres misiones por día, elegidas de forma determinista a partir de la fecha.
- Solo con datos que el servidor ya verifica: mejor racha, duración, bloques destruidos, partidas jugadas, haber jugado el reto. Ejemplos: "Racha de 15", "Llega al 8", "Destruye 60 bloques hoy".
- El avance se calcula al leer, con las partidas del día. Como invitado, con el historial local.
- Premio: bloques extra para el nivel (`UserStats.bonusXp`, columna nueva).
- Dónde se ven: en el inicio, bajo la tarjeta del reto, y en la pantalla final cuando una se completa.

### 5.3 Logros de cinco niveles

Los mismos cinco materiales para cada logro, calculados desde las estadísticas (*provisorio*):

| Logro | Madera | Bronce | Plata | Oro | Diamante |
|---|---|---|---|---|---|
| Mejor racha | 10 | 25 | 50 | 100 | 200 |
| Bloques destruidos en total | 100 | 500 | 2.000 | 10.000 | 50.000 |
| Días seguidos de reto diario | 3 | 7 | 14 | 30 | 100 |
| Mejor resultado en un reto diario | Participar | Mejor que el 50 % | 75 % | 90 % | 99 % |

Se muestran en la Colección, con su avance. El último necesita guardar el mejor porcentaje del jugador al cerrar cada día.

**Hecho cuando:** el reto de un día parte directo en sumas y restas, su partida se valida en el servidor, y las partidas normales siguen dando los mismos resultados que antes.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Un cambio en el motor altera las partidas normales | Prueba dorada (1.1) en cada fase; los modificadores son opcionales |
| La web nueva se publica antes que la API | Orden de publicación de la sección 2; campos nuevos siempre opcionales |
| Una paleta delata las trampas | Test de contraste sobre los seis colores `SAFE` (2.4) |
| Alguien practica la semilla del reto diario como invitado y después juega con su cuenta | Un intento por dispositivo como invitado. Si se abusa, exigir cuenta para el reto |
| Ranking diario casi vacío al principio | Posición en vez de porcentaje con menos de 10 jugadores; énfasis en amigos y en "tú ayer" |
| Insignias demasiado fáciles o imposibles | Umbrales con datos reales (fase 0); se pueden mover porque la insignia se calcula, no se guarda |
| Se pierde el progreso de los jugadores | Respaldos de la base antes de la fase 2 (D10) |
| Más peso de la web (ya son ~2 MB) | Sin librerías nuevas en el cliente; sonidos generados por código; insignias dibujadas con `View` |
| Diferencia de un día en la fecha local del reto | Ventana de ±1 día respecto de UTC; pruebas cambiando la zona horaria |
| Un celular más chico que el campo del reto ve los bloques reducidos | El campo común es el percentil 5 de las pantallas reales, así que afecta a pocos y por poco; se revisa con la consulta de la fase 0 |
| Solo se puede medir a las cuentas (las partidas de invitado se borran a las 24 h) | Repetir las consultas de la fase 0 en varios días para tener muestra de invitados |
| Lo nuevo distrae o tapa el juego | Reglas de "Para que lo nuevo no estorbe" (sección 2), revisadas con Playwright en cada fase |
| Una migración daña datos de jugadores | Migraciones solo aditivas y respaldo antes de cada una (regla 9) |

---

## 11. Fuera de este plan

- **Notificaciones** ("@jose te superó"): quedan para la app Android/iOS; en la web de iOS funcionan mal.
- **Pausa**: sigue como idea en `pendientes.md`.
- **Cambios de balance** (castigos ×6/×7, proporción de trampas al empezar las restas): se revisan con los datos de la fase 0, y son decisión del usuario.
- **Analítica de terceros**: la política de privacidad dice que no se usa. Si más adelante hace falta medir visitas o clics, se decide aparte.
- **Ver la partida del ganador del día**: el servidor guarda los toques, así que es posible; no está planificado.
- **Temporadas con rankings archivados**: solo si algún día hay un cambio de reglas grande.
