# Pendientes, riesgos e ideas

Estado al **12 nov 2026**.

## Estado

- **Web**: GitHub Pages **con cuentas y rankings activos** desde el 10 nov 2026 (variables `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_GOOGLE_CLIENT_ID` creadas). Incluye las reglas v5, las páginas legales y los dos tutoriales (básico y avanzado). Se verificó de punta a punta: partida de invitado validada por el servidor, rankings y login real con Google.
- **Dokploy** (panel `http://vps23906.cubepath.net:3000`, IP 144.225.147.103, Dokploy v0.31.0; ahí también vive el proyecto UltimaType con `ultimatype.xyz`):
  - Proyecto **Touched Block** (`6eSA39oT4nPDO4U034YGw`), entorno `production`.
  - Compose **API**: id `5ZlPmSATtXjdrF-3c-vPs`, appName `touched-block-bz408h`. Fuente Git `https://github.com/SuKuShaing/touched-block.git`, rama `main`, ruta `./deploy/docker-compose.yml`. *Isolated Deployment* activado y *autoDeploy* desactivado (se despliega por tag).
  - Las variables de `deploy/.env` están cargadas (incluida `DAILY_SECRET` desde el 12 nov 2026).
  - **API en producción: `https://vps23906.cubepath.net`** (hostname del VPS que da el proveedor). Certificado Let's Encrypt vigente hasta el 8 feb 2027, con renovación automática por Traefik. `/health` responde `rulesVersion: 5`, versión `v0.3.0` (desde el 12 nov 2026). CORS solo acepta `https://sukushaing.github.io`.
  - Tarea programada `touched-block-respaldo` (respaldo diario de la base, ver `despliegue.md`).
  - Se despliega solo con cada tag: `v0.1.1` y `v0.1.2` (10 nov 2026, buscador de "¿Quién te invitó?") corrieron completos, tests → GHCR → Dokploy.
  - Usar el hostname del VPS es provisorio. Si se cambia de VPS, o se le da HTTPS al panel de Dokploy en ese mismo host, hay que mover la API a un subdominio propio: cambiar el dominio en Dokploy y `EXPO_PUBLIC_API_URL`, y volver a publicar la web.
- **GHCR**: la imagen `ghcr.io/sukushaing/touched-block-api` (`v0.1.0` y `latest`) es pública.
- Los secretos `DOKPLOY_*` ya están en GitHub. El tag `v0.1.0` falló en el paso de Dokploy porque todavía no existían; `v0.1.1` funcionó completo.
- Google Cloud: la app está "En producción". Los orígenes `https://sukushaing.github.io` y `http://localhost:8081` están autorizados. La verificación de marca sigue pendiente; es opcional con los scopes básicos.

- **Corazón de recuperación (reglas v5)**: publicado el 10 nov 2026 (web y API `v0.2.0`/`v0.2.1`) con 1 s de duración; el 11 nov 2026 pasó a 2 s (reglas v5), API de producción con `RULES_VERSION = 5` desde el tag `v0.2.2` (11 nov 2026). Tiene su slide en el tutorial avanzado.

## Plan de jugabilidad y retención (12 nov 2026)

Plan por fases en [`plan-jugabilidad.md`](plan-jugabilidad.md). **Fases 1 a 5 publicadas el 12 nov 2026** (API `v0.3.0` y web). Decisiones de la implementación en `historia-y-decisiones.md`.

Cómo se publicó (12 nov 2026), en orden:
1. `tb-db` monta `/var/backups/touched-block` del VPS y la tarea de Dokploy `touched-block-respaldo` hace un `pg_dump` diario (07:00 UTC, guarda 14). Se sacó un respaldo justo antes de las migraciones (`touched_block-20261112-135728.dump`).
2. `DAILY_SECRET` agregada al Environment del Compose. Un script local leyó el Environment, comprobó que las otras 5 variables eran iguales a `deploy/.env` y agregó solo esa línea, sin mostrar valores. El primer despliegue del tag había fallado a propósito por no tenerla, sin tocar los contenedores.
3. Tag `v0.3.0`: las 5 migraciones se aplicaron al arrancar y `/health` responde `v0.3.0`, `rulesVersion: 5`. Antes se probó la imagen en local sobre una base de la v0.2.2 con partidas reales.
4. Relleno de rachas con una tarea temporal de Dokploy (ya borrada): 17 partidas de las reglas v5, todas coincidieron con su repetición; 1 jugador con mejor racha nueva.
5. Push de la web a `main`.

**Revisión en producción** (12 nov 2026, Playwright con pantalla de celular, como invitado):
- 1.ª visita: se abre el tutorial básico; inicio sin reto diario ni retos (regla del jugador nuevo).
- Partida normal validada por el servidor (`valid: true`, 94 bloques): "¡Nuevo récord!", mejor racha, primera insignia (Madera II) con sus premios y "Probar ahora", camino de etapas.
- 2.ª visita: "Retar a un amigo", tarjeta del reto #1 (jueves: solo multiplicaciones y divisiones), misiones del día; tarjeta para instalar la web (Chromium la reconoce como instalable).
- Reto diario validado (`valid: true`): "Habrías quedado 1.º de 1", racha de 1 día, tira de la semana y misión "Juega el reto del día" cumplida. El ranking del día sigue vacío (las partidas de invitado no se guardan ahí).
- Reto a un amigo: creado (`?reto=…`, campo común 360 × 540); un invitado nuevo que abre el enlace ve primero el tutorial y vuelve al reto; al jugarlo, la comparación ("¡Empate!"), Revancha y Compartir resultado.
- Colección (insignia, nivel, paletas, sonidos, efectos, fondos del campo, logros), Rankings (general y "Reto de hoy") y Perfil (sonido, vibración, Colección, instalar). La consola solo muestra los 404 esperados de las rutas directas en Pages.
- Las claves locales siguen siendo `tb_best5`/`tb_hist5`.
- Lo que necesita una cuenta no se puede probar en producción porque el login de Google no se automatiza. Se probó el mismo día en local con el código publicado (API compilada con `AUTH_DEV_FAKE=1` y web de desarrollo, Playwright con pantalla de celular), además de los e2e de la API (63 en verde):
  - Un invitado juega el reto diario, entra con "Entrar (dev)" desde la pantalla final y la partida se **reclama** (`POST /runs/:id/claim` → válida): la cuenta queda con 1 de 3 intentos y la pantalla pasa a "Otro intento (quedan 2)".
  - **Ranking del día con cuenta**: la cuenta aparece con "TU POSICIÓN".
  - **Misiones guardadas en el servidor**: "Juega el reto del día" premiada al reclamar; después de una partida normal, "Llega al 5" y "Destruye 30 bloques hoy" también; `bonusXp` 80 y la tarjeta muestra 3/3.
  - **Partida normal con cuenta** validada: `UserStats` en el servidor (mejor racha, bloques, partidas), "¡Subiste a Madera III!" con sus premios y récord en el ranking.
  - **Colección y Perfil con sesión**: insignia y nivel de la cuenta (bloques + misiones), usuario, país, "¿Quién te invitó?" e invitar amigos.
  - **2.º intento del reto** con cuenta: empieza directo y queda "Te queda 1 intento".
- Datos de prueba que quedaron en producción: 4 partidas de invitado y un reto (`2MHKV5VF`, vence el 12 dic 2026). En la base local, la cuenta `prueba.publicacion`.

**Confirmado por el usuario (12 nov 2026)**: los valores provisorios quedan tal cual (umbrales de las insignias, catálogo de premios, nivel `25·n·(n−1)`, paleta Constancia a los 7 días, misiones, racha con perdón y logros) y el jueves del reto diario parte en la dificultad de las multiplicaciones.

**Volver a medir con jugadores reales** (regla 8 del plan):
- Umbrales de las insignias (D1). Datos de la fase 0 (sección 4.2 del plan, 12 nov 2026): de 6 cuentas, 5 llegan a Madera II, 1 a Madera III y **nadie a Bronce (140 s)**. La muestra es chica: volver a medir en unas semanas y bajar Bronce si sigue lejos (se mueve sin migraciones). Repetir también la primera consulta otros días para tener muestra de invitados.
- Martes y sábado del reto diario (directo a sumas / multiplicaciones) pueden ser muy cortos, porque parten con 10 s, hasta 6 bloques y castigo ×6/×7: revisar jugando.
- La paleta Dorado se rediseñó (ya no es toda dorada) para cumplir la regla de no ventaja: verla en el juego.
- `DAILY_EPOCH` = 12 nov 2026 es el reto #1: si se publica más tarde, conviene moverla al día de la publicación (no guarda nada, solo cambia el número).

**Riesgos conocidos** (anotados, sin cambiar):
- Misiones: el cliente elige fecha y zona horaria en `GET /missions`, así que unas mismas partidas pueden contar para hasta 3 fechas. Solo afecta el nivel (cosmético).
- Un invitado puede practicar la semilla del reto diario sin límite (riesgo aceptado en el plan; si se abusa, exigir cuenta).
- Las copias de resultados de invitados en los retos a un amigo no vencen (no tienen datos personales).
- Ya existía: los números 1, 2, 7 y 10 siempre son de color rojizo; si son trampa roja, el motor les cambia el color a uno de `SAFE`, así que un "2" que no es naranja delata la trampa además del texto rojo. Cambiarlo es una decisión de reglas.
- Detalles menores del cliente: un invitado que vuelve a abrir un reto que ya jugó ve "Ya lo jugó 1 persona más" (se cuenta a sí mismo); si recarga en la 1.ª visita después de usar un enlace de reto, "Retar a un amigo" se oculta hasta la 2.ª visita.
- Sin probar en esta etapa: iOS/Safari (lo prueba el usuario en un iPhone antiguo), la fluidez con el procesador limitado (repetirla con el build de producción) y el camino de etapas con `startAt` en la app real (cubierto con tests). No hace falta por ahora (decisión del usuario): instalar la web en un Android real, porque eso será cuando sea app; ni repetir el login real de Google, que ya funcionaba y no cambió.
- La base de desarrollo local (`touched_block`) quedó con cuentas y partidas de prueba (`seba.prueba`, `*.bot`…). No afecta producción.

## Lo que tiene que hacer el usuario

1. Seguridad: el panel de Dokploy va por HTTP, así que el token viaja sin cifrar. Conviene darle al panel un dominio con HTTPS.
2. Opcional: pedir la verificación de marca en Google Cloud (Centro de verificación), para que el login muestre el nombre y el logo de la app.
3. Opcional: mover la API a un subdominio propio (ver arriba).

## Riesgos conocidos

- **Balance sin probar con personas**:
  - Los castigos ×6/×7 son muy altos: "10+10" escapado resta −120 s y "5×5" resta −175 s.
  - Al empezar las restas, cerca del 30 % de las operaciones son trampas ("1−1", "1−2", "2−2").
  - Cambiar el balance después de abrir los rankings los reinicia (`RULES_VERSION`). **Desde el 11 nov 2026 no se deben romper los registros de los jugadores** salvo un cambio muy grande y aprobado.
  - Idea para cumplirlo: separar los cambios compatibles (no reinician nada) de los que rompen la comparación (temporadas con rankings archivados) y migrar el récord local en vez de cambiar su clave. Sin hacer.
- **Bots**: el replay garantiza que la partida es real, pero no distingue un script que toca bien de una persona. La etapa final hace que todos pierdan. Decidido (12 nov 2026): con lo actual basta para un juego casual. Solo si aparecen puntajes sospechosos se agregarían heurísticas (precisión y ritmo inhumanos).
- **Respaldos de la base**: `pg_dump` diario en el mismo VPS (ver `despliegue.md`). Si se pierde el VPS, dependen del respaldo diario del proveedor.
- **Búsqueda de usuarios** sin índice (`strpos` recorre la tabla). Basta con pocos miles de usuarios; si crece, agregar un índice trigram (`pg_trgm`).
- **Peso de la web**: ~2 MB de JS (≈600 KB comprimido) por react-native-web.
- Quien ya vio el tutorial único de antes (`tb_onb1`) no vuelve a ver el básico; verá el avanzado en su 3.ª visita contada desde este cambio.

## Ideas (sugerencias, no decisiones)

- Pausa (silenciar sonido y vibración ya está, desde el plan de jugabilidad).
- Que las restas aparezcan un poco después que las sumas.
- App Android/iOS:
  - Módulos `.native` (login nativo de Google y Apple, compartir con `react-native-view-shot` + `expo-sharing`, `expo-audio`, `expo-haptics`).
  - EAS Build y Submit, cuentas de desarrollador.
  - Clientes OAuth de Android/iOS en `GOOGLE_CLIENT_IDS`.
- Dominio propio: necesario para Sign in with Apple en la web y para cookies de sesión del mismo sitio.
- Más tipos de bloque (tiempo extra, congelar, escudo).
- Limpiar los íconos sobrantes de la raíz (`favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`, `favicon.svg`, `og-image.png`), porque los que se usan están en `apps/client/public/`. Confirmar antes de borrar.
