# Plan de implementación de CAMBIO-001 a CAMBIO-026 y reset A

Fecha del plan: 2026-11-27. Rama: `feat/premios-y-logros`. Detalle de cada cambio: `config_logros/cambios.md` (líneas por entrada en el anexo). Referencia visual: la maqueta de `config_logros/` con "Con cambios".

## Orden general (actualizado el 2026-11-27)

El orquestador informa que el usuario autorizó el despliegue y el reset A, pidió **avanzar todo hasta la prueba en el celular** ("lo pruebo y te digo") y descartó el respaldo de producción.

**Tramo 1, ahora:**
1. Implementar (olas 0 a 2).
2. Suites completas, revisión adversarial y verificación web (P31 a P33).
3. APK de prueba instalado y verificado en el emulador (P34) y documentación (P35).
4. Avisar al usuario con la ruta del APK y la guía de prueba. **Detenerse.**

**Tramo 2, solo con el visto bueno del usuario tras probar** (en un mensaje suyo): conteo de solo lectura de producción, API con el reset, web y APK definitivo (C.7, solo el orquestador).

Los implementadores no hacen commit, push ni tag y no tocan producción.

---

## 0. Reglas comunes para todos los subagentes

Copiar en el encargo de cada paquete.

1. Árbol compartido, sin worktrees. **Prohibido cualquier comando git que escriba** (`commit`, `stash`, `checkout`, `restore`, `reset`, `clean`, `switch`), `push` y `tag`. Solo `git status` y `git diff`.
2. Tocar **solo los archivos de la lista del paquete** (y sus tests). Si hace falta otro, no editarlo: informarlo al orquestador.
3. Sin dependencias nuevas, sin `pnpm install`. Sin Metro, `expo export` ni `docker` (salvo los paquetes que lo digan). Sin tocar producción ni apuntar nada a `https://api.touchedblock.app`.
4. Textos visibles en español ("Touched Block" en inglés). Audio, vibración y almacenamiento con `try/catch`. Sin `alert`/`confirm`/`prompt`. Reglas del juego solo en el motor; el motor sin `Math.random`, `Date` ni `Math` no determinista. No regenerar `packages/engine/test/golden.json`.
5. Web y Android deben verse y jugarse igual. Animaciones nuevas respetan `useReducedMotion()`.
6. No editar `docs/` (lo hace P35): devolver en el informe las notas y motivos para documentar.
7. `cambios.md` tiene líneas muy largas: leer solo las entradas propias, en tramos de 140 líneas como máximo.
8. Verificación en el cliente, para no confundirse con paquetes a medio hacer (Bash):
   ```bash
   pnpm --filter @tb/client exec vitest run <tests propios>
   pnpm --filter @tb/client exec tsc --noEmit --pretty false | grep -E "src/(<regex de archivos propios>)"   # debe salir vacío
   ```

---

## A. Estado final consolidado

### A.1 Insignias (001, 002, 003, 005)

`TierId` y `step` no cambian (viajan en la API).

| índice | tier/step | Nombre | Requisito (`goal`) | segundos | Color (`tierColor`) |
|---|---|---|---|---|---|
| 0 | madera/1 | Papel | Llegar al 4 | 20 | `#ece2cb` |
| 1 | madera/2 | Cartón | Llegar al 6 | 60 | `#c9a26c` |
| 2 | madera/3 | Madera | Llegar al 8 | 100 | `#c49a63` |
| 3 | bronce/1 | Bronce | Llegar a las sumas y restas | 140 | `#db7a40` |
| 4 | plata/1 | Plata | Llegar a las multiplicaciones y divisiones | 275 | `#cfd6e0` |
| 5 | oro/1 | Oro | Llegar a la etapa final | 350 | `#ffcf47` |
| 6 | diamante/1 | Diamante | Llegar a los bloques de 2 s | 410 | `#9be7ff` |

Todos los valores salen de constantes del motor. Con menos de 20 s no hay insignia: `tierIndexForTicks` devuelve -1. Texto vacío de la Colección: "Llega al 4 para ganar Papel."

### A.2 Experiencia (004, 007)

`levelStart(n) = 25·n·(n+1)`, nivel mínimo 0 (0 a 49 bloques). Estimación: `floor((-1 + sqrt(1 + 4x/25)) / 2)` con ajuste entero. Nivel 1 = 50, 2 = 150, 3 = 300, 5 = 750, 10 = 2.750, 30 = 23.250.

### A.3 Logros, 4 × 7 (008, 009, 010, 011)

Materiales (nivel 1 a 7): Papel, Cartón, Madera, Bronce, Plata, Oro, Diamante.

| id | Nombre | Umbrales | Valor | Texto de meta |
|---|---|---|---|---|
| `racha` | Máximo combo | 10, 25, 50, 100, 200, 300, 500 | `bestStreak` | Racha de N |
| `partidas` (reemplaza `bloques`) | Partidas jugadas | 10, 50, 150, 500, 1500, 3000, 6000 | `runs` (con sesión, máximo con `totalRuns`) | Juega N partidas |
| `diasReto` | Días seguidos de reto diario | 3, 7, 14, 30, 100, 200, 365 | `dailyStreakBest` | Juega el reto N días seguidos |
| `mejorReto` | Mejor resultado en un reto diario | 0, 25, 50, 75, 90, 95, 99 | `bestDailyPct` (null = nunca) | nivel 1 "Participa en un reto diario"; resto "Mejor que el N % en un reto diario" |

Claves viejas `ach:bloques:*` se ignoran. Iconos: medallas hexagonales de `logros_iconos/` (4 × 7 + 4 vacíos).

### A.4 Catálogo: 55 premios (016 a 019, 022 a 026)

El orden de las filas es el orden de `CATALOG`.

**Paletas (14)**

| id | Nombre | Estilo | Requisito | Nota |
|---|---|---|---|---|
| clasica | Clásica | solid | siempre | |
| contraste | Alto contraste | solid | siempre | Pensada para daltónicos |
| pastel | Pastel | solid | nivel 3 | |
| neon | Neón | solid | nivel 7 | |
| tenue | Tenue | soft | nivel 9 | Relleno atenuado, borde intenso |
| cristal | Cristal | glass | nivel 12 | Translúcida, con brillo |
| retro | Retro | solid | nivel 15 | |
| boton | Botón | inset | nivel 16 | Relieve interior de botón |
| contorno | Contorno | outline | nivel 18 | Borde intenso, relleno translúcido |
| degrade | Degradé | gradient | nivel 22 | Degradé sutil, relleno opaco |
| dorado | Dorado | solid | nivel 25 | |
| esmerilado | Esmerilado | frosted | nivel 27 | Vidrio esmerilado, color insinuado |
| diamante | Diamante | solid + brillo | nivel 30 | Con brillo |
| constancia | **Amistad** | solid | invitar 2 (requiere cuentas) | |

**Sonidos (9)**: `8bits` "8 bits" (siempre), `suave` "Suave" (1 partida), `marimba` "Marimba" (insignia índice 0), `palitos` "Palitos" (1), `electronico` "Electrónico" (2), `viento` "Viento" (3), `piano` "Piano" (4), `guitarra` "Guitarra eléctrica" (5), `futurista` "Futurista" (6). Ninguno requiere reto diario.

**Efectos (12)** y **fondos (20)**: se ganan por logro salvo `normal`/`liso` (siempre) e invitaciones. Reparto definitivo (E = efecto, F = fondo):

| Logro | Papel (1) | Cartón (2) | Madera (3) | Bronce (4) | Plata (5) | Oro (6) | Diamante (7) |
|---|---|---|---|---|---|---|---|
| racha | grilla F | confeti E | circuito F | rayos E | oceano F | nebulosa F | pixeles E |
| partidas | chispas E | estrellas F | aurora F | monedas E | ciudad F | nieve F | galaxia F |
| diasReto | emojis E | puntos F | ondas E | atardecer F | cristales F | luciernagas F | fugaces E |
| mejorReto | rayas F | burbujas E | hexagonos F | topografia F | lluvia F | vitral F | fuegos E |

28 escalones, 28 premios; los 14 de `diasReto`/`mejorReto` llevan `requires: 'daily'`. Invitaciones (requieren cuentas): `corazones` E con 1, `constancia` (paleta) con 2, `bosque` F con 3.

Orden de efectos: normal, chispas, emojis, confeti, burbujas, ondas, rayos, monedas, pixeles, fugaces, fuegos, corazones.
Nombres: Clásico, Chispas, Emojis, Confeti, Burbujas, Ondas, Rayos, Monedas, Píxeles, Estrellas fugaces, Fuegos artificiales, Corazones.
Icono de fila (glifo y color) en `coleccion.js` → `EFECTOS`; los 4 actuales conservan su dibujo.

Orden de fondos: liso, grilla, rayas, estrellas, puntos, circuito, aurora, hexagonos, atardecer, topografia, oceano, ciudad, cristales, lluvia, nebulosa, nieve, luciernagas, vitral, galaxia, bosque.
Nombres: Liso, Grilla, Rayas, Estrellas, Puntos, Circuito, Aurora, Hexágonos, Atardecer, Topografía, Océano, Ciudad nocturna, Cristales, Lluvia, Nebulosa, Nieve, Luciérnagas, Vitral, Galaxia, Bosque nocturno.
Animados (4): lluvia, nieve, luciernagas, galaxia.
Las `nota` de sonidos, efectos y fondos nuevos se copian de `coleccion.js`.

**Textos de requisito**
- tier: `Insignia <nombre> · <Llega…>`
- achievement: `Logro <nombre> · <material> (<meta en minúscula inicial>)`
- level `Llega al nivel N`; invited `Invita a N amigo(s)`; runs sin cambio.

### A.5 Estilos de paleta (colores en orden de `COLORS`)

| Paleta | `colors` |
|---|---|
| tenue | `#c97e81 #c98156 #b18f3a #57a17d #5399cd #968cc2 #c17ea9 #3fa196 #a487bc` |
| cristal | `#ff9fb5 #ffb88a #ffd666 #94f0c2 #85cbff #a8a7ff #ff9be0 #6fe3d0 #c79bff` |
| boton | `#ed417d #e16a2f #c9a32f #1aaf6a #1b76c3 #8c56e1 #e873c5 #13c4a4 #b63bd7` |
| contorno | `#ff4d6d #ff8a1f #ffc400 #19e68c #3ab0ff #a89bff #ff3fb4 #00e0c6 #d484ff` |
| degrade | `#d34566 #ee7e0f #cea017 #39aa62 #2373da #8259ca #cb64c5 #2eb79c #9c3eb9` |
| esmerilado | `#f4282e #c74710 #d59a0a #2ebf6e #4893f4 #7e66d6 #f91395 #19c4be #8534db` |

| Estilo | Dibujo | Color bajo el número (lo que mide `palettes.test.ts`) |
|---|---|---|
| soft | relleno `colors`, borde 5 px del color del motor | `colors` |
| glass | respaldo opaco `#12121a` + relleno al 50 %, degradado blanco 160° .38 → 0 a 55 %, borde 1,5 px blanco .55, luz superior .50 | mezcla al 0,50: `#895968 #896552 #897440 #53816e #4c6f8d #5d5d8d #89577d #417b75 #6d578d` |
| outline | respaldo + relleno 0,55 + borde 3 px del color pleno | `#943248 #94541d #94740c #168759 #286998 #655d98 #942b6f #088379 #7d5198` |
| gradient | vertical; arriba 3,5 % hacia blanco, abajo 3,5 % hacia negro (por canal sRGB, redondeado) | los dos extremos (`#d54c6b…` / `#cc4362…`) |
| frosted | capa = mezcla(`#dde8ff`, color, 35 % color) al 70 % sobre `#12121a`; brillo 135° .30 → .08 a 60 %; borde 1 px .45; `inset 0 1px 0` .6; sombra `0 8px 24px` .35. Sin blur ni grano | capa sobre respaldo + blanco 0,117: `#b08995 #a7908e #a9a18d #85a9a3 #8ba0c0 #9796ba #b183ab #81aab4 #988bba` |
| inset | `boxShadow: '0 5px 0 rgba(0,0,0,.35), inset 3px 3px 4px rgba(255,255,255,.32), inset -3px -4px 5px rgba(0,0,0,.30)'`; Android API < 29: degradado equivalente | `colors` |

### A.6 Retos del día (013)

Antes de `2026-12-07`: calendario semanal actual. Desde esa fecha: índice `(dayIndex(fecha) − dayIndex('2026-12-07')) mod 15`.

| # | mods | título |
|---|---|---|
| 1 | null | Partida normal |
| 2 | `{startAt: ADD_START}` | Directo a las sumas |
| 3 | `{lives: 3}` | Solo 3 vidas |
| 4 | `{only:'mul', startAt: MUL_START}` | Solo multiplicaciones y divisiones |
| 5 | `{noRed: true}` | Sin trampas rojas |
| 6 | `{startAt: MUL_START}` | Directo a las multiplicaciones |
| 7 | null | Partida normal |
| 8 | `{lives: 4}` | Solo 4 vidas |
| 9 | `{only:'num'}` | Solo números |
| 10 | `{only:'add'}` | Solo sumas y restas |
| 11 | `{startAt: ADD_START, noRed: true}` | Sumas sin trampas rojas |
| 12 | `{lives: 2}` | Solo 2 vidas |
| 13 | `{only:'mul', startAt: MUL_START, lives: 3}` | Multiplicaciones con 3 vidas |
| 14 | `{startAt: LIFE_STAGE_START}` | Directo a la etapa final |
| 15 | `{lives: 1}` | Una sola vida |

Todos pasan `validateMods` sin cambios.

### A.7 Misiones (014, 015)

Antes de `2026-12-07`: exactamente las 13 actuales (mismo orden). Desde esa fecha: 28 = las 13 y, en este orden:

| id | kind | meta | premio |
|---|---|---|---|
| sigue | follow | 1, "Sigue a un jugador hoy" | 20 |
| racha20 | streak | 20 | 40 |
| racha40 | streak | 40 | 60 |
| llega9 | reach | hito num 9 (120 s) | 40 |
| llegaFinal | reach | `LIFE_STAGE_START` (350 s, "Llega a los bloques de 4 s") | 60 |
| destruye90 | killDay | 90 | 40 |
| destruye250 | killDay | 250 | 60 |
| juega6 | runsDay | 6 | 30 |
| racha30 | streak | 30 | 50 |
| racha50 | streak | 50 | 60 |
| llega7 | reach | hito num 7 (80 s) | 30 |
| destruye180 | killDay | 180 | 50 |
| destruye400 | killDay | 400 | 60 |
| juega10 | runsDay | 10 | 40 |
| juega15 | runsDay | 15 | 50 |

Por tipo: 7 streak, 7 reach, 7 killDay, 5 runsDay, 1 daily, 1 follow. Premios entre 20 y 60. Siguen 3 por día de tipos distintos; `missionsFor(key)` no cambia de firma. Los días en que el reto es "Partida normal" bajan a 2 de 15 (afecta a las misiones de racha y duración que cuentan el reto).

`follow` solo se cumple con cuenta: cuenta follows creados ese día local, sin contar a quien me invitó ni a quien yo invité. A un invitado se le muestra bloqueada: candado, "Crea tu cuenta para desbloquearla", al tocar va a `/perfil`, etiqueta "Sigue a un jugador hoy: bloqueada, crea tu cuenta para desbloquearla".

### A.8 Textos renombrados e interfaz

| Dónde | Antes | Después |
|---|---|---|
| Colección, sección | Nivel | Experiencia (se mantiene "Nivel N" y "bloques") |
| Logro | Mejor racha | Máximo combo |
| Pantalla final | Mejor racha: N | Máximo combo: N (decisión B3) |
| Logro | Bloques destruidos | Partidas jugadas |
| Paleta | Constancia | Amistad (id `constancia`) |
| Insignias | Madera I, II, III | Papel, Cartón, Madera |
| Landing | nivel | nivel de experiencia |
| Celebración de logro | ¡Logro de X! | `¡<Logro> · <Material>!` (rótulo "Logro nuevo", sub `<meta>.`) |

HUD "Racha N", razones y títulos de misiones "Racha de N" no cambian.

**Orden de la Colección** (006, 020): Insignia, Experiencia, Logros, Paletas, Sonidos, Efectos al destruir, Fondos del campo, Vista previa, pie.

### A.9 Contradicciones y huecos, y cómo se resuelven

| # | Contradicción o hueco | Resolución |
|---|---|---|
| 1 | 016 mantiene Constancia por racha del reto; 025 la da por invitar 2 y se renombra | Vale 025 y el cierre del 2026-11-27 |
| 2 | Niveles y requisitos de 022, 023 y 024 (nivel, racha, partidas; "Piano requiere reto") | Reemplazados por 025/026 |
| 3 | 025 habla de 21 premios y "10 dependen del reto"; 026 de 28 y 14 | Vale la tabla de 026 (A.4) |
| 4 | 009 da umbrales de "Partidas"; 010 los cambia | Vale 010 |
| 5 | 014 describe un pool intermedio; 015 llega a 28 y dice "sin cambios de API ni cliente" | 28; los cambios de API y cliente de 014 sí hacen falta |
| 6 | 017 recomienda guardar en `colors` el color ya mezclado; 017/019/022 piden medir el color efectivo | `colors` crudo (borde, partículas, muestras) y `effectiveFills()` para el test |
| 7 | 019 pedía blur en Esmerilado; 022 lo cierra sin blur. 017 Contorno sin relleno vs 0,55 | Sin blur; 0,55 |
| 8 | 024 "conclusión: tiempo real" y "la web sigue sintetizando en vivo" vs decisión cerrada híbrida | La frase de la web se refiere a la maqueta. En el juego, web y app usan el híbrido |
| 9 | Casi todas las entradas dicen "no cambia RULES_VERSION ni claves tb_*"; el reset A las cambia | Vale el reset A |
| 10 | `config_logros/CLAUDE.md` dice que el alcance del reset está por confirmar | Cerrado (opción A); borrar producción exige confirmación al desplegar |
| 11 | La raíz manda sumar claves nuevas a CLAVES y REGLAS; el comentario de la página vieja dice que no hace falta | Se sigue CLAUDE.md |
| 12 | 004 y 022 discuten niveles de fondos | Obsoleto: no hay fondos por nivel |
| 13 | `herramientas/prueba-paletas/candidatas.json` tiene `#1cc7c2` | Vale `#19c4be` |
| 14 | 024 define solo `hit`, `kill`, `combo` de los 6 paquetes | Decisión B12 |
| 15 | 005 (material Madera de logros) y 010 (mapeo a insignias) | Resueltos por 011 (iconos propios) |
| 16 | Las entradas figuran "propuesto"; solo 001 "aprobado" | El usuario pidió ejecutarlas; las propuestas sin respuesta van en B |
| 17 | La celebración de hoy no ve invitados ni el porcentaje del servidor (`CelebrationHost.tsx:37`) | 025: corregir en P22 |
| 18 | 012 no está maquetado; nivel 0 sin texto definido | B6 y B2 |

---

## B. Decisiones abiertas (valor por defecto adoptado)

Se implementa el valor por defecto. **R** = conviene que el usuario lo confirme antes de publicar.

| # | R | Tema | Por defecto |
|---|---|---|---|
| B1 | | 005 nombres y glifo | Papel, Cartón, Madera; estrella, sin numerales; dibujos de `insignias_nuevas/` |
| B2 | | 004 nivel 0 | "Nivel 0" en Colección y Perfil; "Te faltan 50 bloques para el nivel 1." |
| B3 | | 008 pantalla final | "Máximo combo"; misiones, HUD e ids sin cambio |
| B4 | R | 010 umbrales | Los anotados. Combo 300/500, 365 días y 6.000 partidas pueden ser inalcanzables y tienen premio. Cambiarlos después no pierde datos |
| B5 | | 011 iconos | Tal como están diseñados (llama, diana roja, tamaños, vacío) |
| B6 | | 012 compartir | Vacío abre "Todavía no lo tienes" sin compartir; insignia y logro con imagen; cosméticos tarjeta simple con texto; la función desbloqueada sin compartir; usuario solo con cuenta |
| B7 | R | 013/015 fecha de inicio | `2026-12-07` (lunes). Hoy es 2026-11-27: quedan 10 días. **API y web deben estar publicadas antes**; si no, mover ambas constantes al lunes siguiente antes de desplegar |
| B8 | | 015 metas | Las anotadas (estimadas); `juega6` +30; "Invita a alguien" queda fuera |
| B9 | R | 016 niveles | 3 a 30 como A.4 (el salto 25 → 30 queda) |
| B10 | | 017/018/019 | Contorno 0,55; "Degradé", nivel 22, 3,5 %; nombres Esmerilado, Tenue, Botón; Android < 29 con degradado |
| B11 | | 020 vista previa | Al final, no fija; mezcla números, operaciones y una trampa; solo lo equipado |
| B12 | R | 7 sonidos sin definir (`start`, `trap`, `heal`, `expire`, `miss`, `end`, `milestone`) | Mismo timbre y escala del paquete (tabla abajo). El usuario dijo que los definiría "en un momento": quedan en un solo archivo (`game/synth/events.ts`) para reemplazarlos |
| B13 | R | 024 volumen y realismo | Síntesis (sin muestras grabadas), volumen como hoy; ajustar de oído en teléfono |
| B14 | | 023 efectos | Movimiento reducido en los 8 nuevos (los 4 de hoy sin cambio); emojis 🎉⭐🔥💥😎😍💯✨, 6 por estallido; Rayos un solo parpadeo; Fuegos como está |
| B15 | | 022 miniaturas y animación | Prop `thumb`; 4 fondos animados |
| B16 | R | 026 reparto 4 × 7 | El de A.4 |
| B17 | | 025 porcentaje invitado → cuenta | El de la cuenta (como hoy) |
| B18 | | 025 logro + premio | Ventanas separadas en la misma cola |
| B19 | | 025 celebrar al entrar en otro dispositivo | Se celebran una vez los premios por invitar y por porcentaje ya ganados (aceptado en 025) |
| B20 | | Reset: restos locales | Reiniciar "visto en Colección"; conservar `tb_unlock1`, ajustes y selección (un premio elegido vuelve solo al recuperarlo) |
| B21 | R | Reset: clientes viejos | La API rechaza reto y desafío de clientes sin `rulesVersion` con "Actualiza Touched Block para jugar el reto." APK 0.3.1 deja de entrar al ranking: hay que repartir el 0.4.0 y avisar |
| B22 | | Reset: respaldo y restauración | Opcional **descartado por el usuario** (2026-11-27: acepta perder los datos) |
| B23 | | 021 APK de prueba en el celular | Id propio `app.touchedblock.prueba`, firma debug (se instala **junto** a la app real, sin perder datos), API ficticia `https://api.invalid`, todo desbloqueado y galería de insignias y logros. No toca producción ni prueba flujos con cuenta |
| B24 | | Versiones | API `v0.7.0` (el último tag es `v0.6.0`); app `0.4.0`, `versionCode` 6 |

**B12, derivación** (`E[i]` = escala de 13 notas del paquete en `sonidos.js`):

| Sonido | Notas |
|---|---|
| start | `E[5]`, 0,12 s |
| heal | `E[7], E[9], E[11]`, cada 70 ms |
| milestone | `E[5], E[7], E[8], E[10]`, cada 90 ms |
| end | `E[7], E[5], E[3], E[0]`, cada 150 ms, cola larga |
| trap | `E[0]/2` y `E[0]/2·0,944` (disonante), a 90 ms, 0,45 s, la más fuerte |
| miss | `E[0]·0,63`, 0,25 s |
| expire | `E[1]·0,75`, 0,15 s, volumen bajo |

`trap`, `miss` y `expire` nunca ascendentes (no deben sonar a premio).

---

## C. Reset A

Implementar el reset solo crea código; no borra nada. El borrado en producción lo ejecuta solo el orquestador, **después del visto bueno del usuario tras probar en el celular** y de mostrarle el conteo de solo lectura (C.7). Sin respaldo previo por decisión del usuario: **el borrado no se puede deshacer**.

### C.1 Versión de reglas

`RULES_VERSION` 5 → 6 (`packages/engine/src/constants.ts:4`). No cambian reglas de partida: `golden.json` no se toca y su test debe seguir pasando. La API ya rechaza versiones distintas (`run-verification.ts:95`) y el cliente no envía partidas si difiere (`rankedRun.ts:117`).

### C.2 Claves locales

| Antes | Después | Archivo | Paquete |
|---|---|---|---|
| `tb_best5` / `tb_hist5` | `tb_best6` / `tb_hist6` | `lib/historyKeys.ts` | P12 |
| `tb_stats1` | `tb_stats2` | `lib/stats.ts` | P12 |
| `tb_daily1` | `tb_daily2` | `lib/daily.ts` | P12 |
| `tb_miss1` | `tb_miss2` | `lib/missions.ts` | P12 |
| `tb_me1` | `tb_me2` | `api/session.ts` | P12 |
| `tb_cele1` / `tb_cele1p` | `tb_cele2` / `tb_cele2p` | `game/celebrationQueue.ts` | P02 |
| `tb_set1.collectionSeen` | campo `seenScore` (-1) | `lib/settings.ts` | P02 |

Se conservan: `tb_rt1`, `tb_set1`, `tb_unlock1`, `tb_reto1`, `tb_onb1`, `tb_onb_adv1`, `tb_visits1`, `tb_last1`, `tb_mig1`. Las claves viejas **no se borran ni se leen**; nunca copiar una vieja a una nueva.

### C.3 Mudanza

- `apps/client/public/index.html` (script `tb-mudanza`): en `REGLAS` y en el bloque de sesión (líneas 66-68) reemplazar los nombres por los nuevos; quitar las reglas de las claves viejas.
- `deploy/gh-pages-redirect/index.html` y `404.html` (deben quedar idénticos): `CLAVES` con los nombres nuevos, incluida `tb_cele2`.
- La web vieja solo tiene claves viejas, así que desde ella pasan ajustes, tutoriales, visitas, desbloqueo, reto pendiente y sesión. Es lo buscado.
- `lib/mudanza.test.ts`: actualizar las 14 claves; test nuevo: un fragmento con `tb_best5`, `tb_hist5`, `tb_stats1`, `tb_daily1`, `tb_miss1`, `tb_cele1`, `tb_me1` no escribe nada de eso ni las claves nuevas.

### C.4 Trampas que podrían revivir datos

| Trampa | Cierre | Test |
|---|---|---|
| El servidor recalcula `bestDailyPct` desde `DailyEntry` (`saveClosedPcts`) | Borrar `DailyEntry` | e2e del reset |
| El cliente toma el máximo entre dispositivo y servidor | Claves nuevas + servidor en cero | stats.test |
| `stats.fromHistory()` reconstruye desde historial y récord | Lee `tb_hist6`/`tb_best6` | stats.test con claves viejas presentes |
| Mudanza reimporta datos viejos | C.3 | mudanza.test |
| `tb_me` viejo siembra celebraciones y suma estadísticas | `tb_me2` | session/stats test |
| Celebraciones sembradas con datos previos al reset | Orden de despliegue: **reset antes de publicar la web** | lista de despliegue |
| APK 0.3.1 con datos locales | Su versión 5 es rechazada; no hay endpoint que reciba estadísticas del cliente | e2e |
| Reclamo de una partida v5 entre despliegue y reset | El reset la borra | e2e |

### C.5 Servidor (P11)

**Migración aditiva** `prisma/migrations/20261127000000_add_data_reset/` (esta sí corre sola al arrancar, `Dockerfile` CMD):

```prisma
/// Marca de un reinicio de datos ya aplicado (scripts/reset-progress.mjs).
model DataReset {
  id        String   @id @db.VarChar(32)
  appliedAt DateTime @default(now())
  details   Json?
}
```

**El borrado NO va en `prisma/migrations/`** (se ejecutaría solo al desplegar). Va en un script manual:
- `src/maintenance/reset-progress.ts`: `export const RESET_ID = 'v6-2026'; export async function resetProgress(prisma, opts: { apply: boolean; log(m: string): void }): Promise<ResetReport>`.
- `scripts/reset-progress.mjs` (patrón de `backfill-streaks.mjs`): sin argumentos es simulación de solo lectura que informa cuentas totales, cuentas con partidas (total y últimos 7 días), partidas (con y sin cuenta), récords, retos diarios, desafíos, premios de misión e invitaciones; borra solo con `--apply --confirm=BORRAR-PROGRESO`; se niega si `RULES_VERSION < 6`. Agregarlo a `"files"` de `apps/api/package.json` (si no, no entra en la imagen). Ningún arranque, workflow ni compose lo invoca.

Una sola transacción:

```sql
SELECT pg_advisory_xact_lock(hashtext('tb-reset-v6'));
-- si existe "DataReset" id 'v6-2026': salir sin tocar nada (idempotente)
DELETE FROM "BestScore";
DELETE FROM "DailyEntry";
DELETE FROM "ChallengeEntry";
DELETE FROM "Challenge";
DELETE FROM "MissionReward";
DELETE FROM "Run";
UPDATE "UserStats" SET "bestTicks"=0, "bestStreak"=0, "totalKilled"=0, "totalRuns"=0,
  "bonusXp"=0, "bestDailyPct"=NULL, "updatedAt"=now();
UPDATE "User" SET "invitedById"=NULL, "invitedAt"=NULL
  WHERE "invitedById" IS NOT NULL OR "invitedAt" IS NOT NULL;
INSERT INTO "DataReset"("id","details") VALUES ('v6-2026', <conteos>);
```

Intactos: `User` (resto de columnas), `AuthIdentity`, `RefreshToken`, `Follow`, `Block`, `Report`, `DailyChallenge` (solo guarda el campo del día). `setInviter` ya permite volver a responder (condición `invitedById: null`); los corazones vuelven a 5.

**Reversibilidad**: ninguna. Respaldo y restauración: opcional descartado por el usuario (2026-11-27).

### C.6 Clientes viejos (APK 0.3.1, pestañas sin recargar)

| Acción | Con API v6 |
|---|---|
| Partida normal | Recibe `rulesVersion: 6`, juega en local y avisa "recarga la página" (en el APK el texto confunde y no se puede cambiar). Queda una `Run` sin terminar, que no cuenta |
| Reto diario o desafío | `409 client_outdated` con mensaje en español, sin crear filas ni gastar intento |
| Terminar una partida v5 | Rechazada `rules_version` |
| Rankings, perfil, seguir, invitar | Funcionan (datos nuevos legítimos) |
| Colección local | Muestra sus datos viejos (solo en ese equipo) |

`client_outdated`: `CreateRunDto` gana `@Allow() rulesVersion?: unknown`; en `RunsService.create`, si `mode !== 'normal'` y `dto.rulesVersion !== RULES_VERSION`, lanzar el 409. El cliente nuevo lo envía solo en `duel` y `daily`. La API debe publicarse antes que la web (`forbidNonWhitelisted` rechaza el campo en la API actual).

### C.7 Despliegue (tramo 2, solo orquestador)

Mezclar a `main` publica **solo** web, landing y redirección; la API se publica por tag. Por eso:

1. Requisitos de F cumplidos, visto bueno del usuario y fecha anterior a B7.
2. Commit en la rama, tag `v0.7.0` sobre ese commit y push del tag (no mezclar aún a `main`). Esperar el workflow y comprobar `/health` con `rulesVersion: 6`. La migración aditiva corre sola; no borra nada.
3. En el servicio `api`: `node scripts/reset-progress.mjs` (solo lectura). **Mostrar al usuario cuántas cuentas y partidas hay** (antes habló de "hartos testers" y después de dos) y esperar su respuesta.
4. Con su sí: `node scripts/reset-progress.mjs --apply --confirm=BORRAR-PROGRESO`. Repetir la simulación (progreso en cero, mismas cuentas) y comprobar rankings vacíos.
5. Inmediatamente: mezclar a `main` y push (web, redirección, landing). Entre 2 y 5 la web vieja no entra al ranking: hacerlo seguido.
6. APK definitivo 0.4.0 (C.8): verificar firma, URL y paquete, probarlo en el emulador y entregarlo.

Si la API nueva falla antes del paso 4: `API_TAG=v0.6.0` y *Deploy* (el esquema es compatible). Después del paso 4 se puede volver de versión, pero los datos borrados no vuelven.

### C.8 APK de release

Antes de compilarlo: borrar la caché de Metro y `./gradlew clean` (las `EXPO_PUBLIC_*` del APK de prueba podrían quedar en caché), sin `TB_TEST_APK` ni `EXPO_PUBLIC_UNLOCK_ALL`; comando de `docs/despliegue.md` sección 5. Comprobar: paquete `app.touchedblock`, firma con SHA-1 de release, `https://api.touchedblock.app` en el bundle (ni `localhost` ni `api.invalid`) y que al abrirlo **no** se vea "MODO PRUEBA".

---

## D. Oleadas y paquetes

```
Previo (orquestador)
Ola 0:  P01  ->  P02 y P11 (en paralelo)
Ola 1:  P12 P13 P14 P15 P16 P17 P18 P19 P20 P25   (en paralelo; P11 puede seguir)
Ola 2:  P21 P22 P23 P24                           (en paralelo)
Ola 3:  P31 -> P32 y P33 (paralelo) -> correcciones -> P34 -> P35 -> avisar al usuario y DETENERSE
Después del visto bueno: C.7
```

Tamaño: S (< 150 líneas cambiadas), M (150 a 500), L (500 a 900). Rutas relativas a `apps/client/src/` salvo que digan otra cosa.

**Previo (orquestador, antes de tocar código):** `pnpm --filter @tb/client exec expo export -p web` y anotar el peso de `dist/` y del bundle JS (gzip) como línea base; correr las suites actuales para saber que parten en verde.

### Ola 0

#### P01 · Motor (M) · CAMBIO-001, 002, 003, 008, 009, 010, 013, 014, 015, reset
- Archivos: `packages/engine/src/{constants,progress,achievements,daily,missions}.ts`; `packages/engine/test/{progress,achievements,daily,mods,missions}.test.ts`.
- Contratos que exporta:
```ts
// constants.ts
export const RULES_VERSION = 6;
// progress.ts: TIERS según A.1; tierIndexForTicks parte en -1
// achievements.ts
export const ACHIEVEMENT_MATERIALS = ['Papel','Cartón','Madera','Bronce','Plata','Oro','Diamante'] as const;
export type AchievementId = 'racha' | 'partidas' | 'diasReto' | 'mejorReto';
export interface Achievement { id: AchievementId; name: string;
  thresholds: readonly [number, number, number, number, number, number, number] }
// daily.ts
export const DAILY_CYCLE_FROM: DateKey = '2026-12-07';
export const DAILY_CYCLE: readonly Readonly<DailyMods>[];   // 15; DAILY_CALENDAR se mantiene
// missions.ts
export type MissionKind = 'streak' | 'reach' | 'killDay' | 'runsDay' | 'daily' | 'follow';
export const MISSIONS_POOL_FROM: DateKey = '2026-12-07';
export const MISSION_POOL: readonly Mission[];              // 28; antes de la fecha se usan slice(0, 13)
export interface DayAgg { runs: number; killed: number; bestStreak: number; maxTicks: number;
  playedDaily: boolean; followedToday: boolean }
```
- Tests: umbrales y -1 bajo 20 s; niveles 0 a 7 de cada logro; 2026-12-06 usa calendario semanal y 12-07 el #1, 12-21 el #15, 12-22 el #1; todos los mods válidos; misiones antes de la fecha **idénticas** a las de hoy (fijar varias fechas con la salida actual antes de cambiar), pool de 28 con conteo por tipo y premios 20..60; `follow`.
- Verificación: `pnpm --filter @tb/engine typecheck && pnpm --filter @tb/engine test && pnpm --filter @tb/engine build`.
- Aceptación: todo verde, `golden` sin cambios. Se espera que cliente y API queden rotos hasta P02 y P11.

#### P02 · Contratos del cliente y catálogo (L) · 004, 016, 022 a 026 (datos), 021, claves de celebración
- Archivos: nuevos `cosmetics/ids.ts`, `lib/achievementValues.ts`, `lib/unlockGuard.test.ts`; `cosmetics/{catalog,catalog.test,active,tiers}.ts`; `lib/{level,collectionScore,collectionNews,settings}.ts` y sus tests; `config.ts`; `game/{celebrations,celebrationQueue,endPrize}.ts` y tests; stubs y cambios mínimos de compilación en `lib/missions.ts` (solo `followedToday: false`), `screens/CollectionScreen.tsx`, `screens/GameScreen.tsx`, `components/{CelebrationHost,CelebrationModal,FieldBackground}.tsx`; stubs nuevos listados abajo.
- Contratos:
```ts
// cosmetics/ids.ts
export type PaletteId = 'clasica'|'contraste'|'pastel'|'neon'|'tenue'|'cristal'|'retro'|'boton'|'contorno'
  |'degrade'|'dorado'|'esmerilado'|'diamante'|'constancia';
export type PaletteStyle = 'solid'|'soft'|'glass'|'outline'|'gradient'|'frosted'|'inset';
export type SoundId = '8bits'|'suave'|'marimba'|'palitos'|'electronico'|'viento'|'piano'|'guitarra'|'futurista';
export type EffectId = 'normal'|'chispas'|'emojis'|'confeti'|'burbujas'|'ondas'|'rayos'|'monedas'|'pixeles'
  |'fugaces'|'fuegos'|'corazones';
export type BackgroundId = 'liso'|'grilla'|'rayas'|'estrellas'|'puntos'|'circuito'|'aurora'|'hexagonos'
  |'atardecer'|'topografia'|'oceano'|'ciudad'|'cristales'|'lluvia'|'nebulosa'|'nieve'|'luciernagas'
  |'vitral'|'galaxia'|'bosque';

// cosmetics/catalog.ts
export interface CatalogStats { bestTicks: number; bestStreak: number; totalKilled: number; runs: number;
  bonusXp: number; invitedCount: number; dailyStreakBest: number; bestDailyPct: number | null }
export type Requirement =
  | { kind: 'always' } | { kind: 'runs'; n: number } | { kind: 'tier'; index: number }
  | { kind: 'level'; n: number } | { kind: 'invited'; n: number }
  | { kind: 'achievement'; id: AchievementId; level: 1|2|3|4|5|6|7 };
// se eliminan 'streak' y 'dailyStreak'; isUnlocked: config.unlockAll || meets(...)
// tierIndexOfStats = tierIndexForTicks(bestTicks) si runs>0 o bestTicks>0 (puede ser -1)
// missingText para achievement: racha "te faltaron N bloques seguidos", partidas "te faltan N partidas",
// diasReto "te faltaron N días", mejorReto null; null si no hay avance

// lib/achievementValues.ts (sin importar catalog ni celebrations: evita ciclo)
export function achievementValues(s: { bestStreak: number; runs: number; dailyStreakBest: number;
  bestDailyPct: number | null }): Record<AchievementId, number | null>;

// cosmetics/active.ts  (bestDailyPct: me ? me.stats?.bestDailyPct ?? null : daily.bestPct ?? null)
export function catalogStatsFor(local: LocalStats, me: Me | null | undefined,
  daily?: { streakBest?: number; bestPct?: number | null }): CatalogStats;
// endStats(opts) gana dailyPct?: number | null
// ownedKeys(s), collectionScore(s), Snapshot { viewer; stats }: sin parámetro dailyPct aparte

// cosmetics/tiers.ts
export function tierColor(t: TierStep): string;
export const MATERIAL_COLOR: Record<AchievementMaterial, string>;   // colores de A.1

// config.ts
unlockAll: process.env.EXPO_PUBLIC_UNLOCK_ALL === '1'

// Stubs (firma definitiva, cuerpo vacío o provisorio)
// components/AchievementIcon.tsx
AchievementIcon(p: { id: AchievementId; level: number /*0 = vacío*/; size?: BadgeSize | number; label?: string })
// cosmetics/achievementIcon.ts
achievementIconSvg(id: AchievementId, level: number, px: number): string
achievementIconDataUri(id: AchievementId, level: number): string
// components/PaletteSwatch.tsx
PaletteSwatch(p: { paletteId: string; index: number; size: number; radius?: number;
  children?: ReactNode; style?: StyleProp<ViewStyle> })
// components/PrizeModal.tsx
export type PrizeRef = { kind: 'tier'; index: number /* -1 = vacío */ }
  | { kind: 'achievement'; id: AchievementId; level: number };
PrizeModal(p: { prize: PrizeRef | null; stats: CatalogStats; onClose(): void })
// components/PreviewPanel.tsx
PreviewPanel()
// components/backgrounds/types.ts
export interface BackgroundProps { cell: number; thumb: boolean; paused: boolean }
// components/backgrounds/{setA,setB,animated}.tsx
export const BACKGROUNDS: Partial<Record<BackgroundId, ComponentType<BackgroundProps>>> = {};
// FieldBackground props
{ id?: string; cell?: number; thumb?: boolean; paused?: boolean }
```
- Además: catálogo completo de A.4; `requires: 'daily'` automático para logros de reto; nivel de A.2; claves `tb_cele2`/`tb_cele2p`; `seenScore`.
- Tests: `catalog.test` (55 ids, orden, cada escalón de logro con exactamente un premio, requisitos y textos, fondo bloqueado cae en `liso`, `unlockAll`), `level.test`, `collectionScore`, `celebrations`/`endPrize`/`celebrationQueue` adaptados. `unlockGuard.test`: ningún archivo de `.github/workflows/` ni el comando de release de `docs/despliegue.md` contiene `EXPO_PUBLIC_UNLOCK_ALL` (excluir la línea del apartado de pruebas).
- Verificación: `pnpm --filter @tb/client exec tsc --noEmit && pnpm --filter @tb/client test`. Solo se admite que falle `lib/mudanza.test.ts` si importa claves cambiadas (lo cierra P12).
- Aceptación: `tsc` verde; el juego compila con los premios nuevos aunque se dibujen con respaldo.
- Si el contexto no alcanza: partir en P02a (ids, catalog, level, active, tiers, config, stubs) y P02b (celebraciones, puntaje, ajustes), en serie.

#### P11 · API y reset (M/L) · 014, 015, 001 (efecto en API), reset
- Archivos: `apps/api/**` (menos `src/generated`, que regenera Prisma). Único paquete que usa Docker.
- Tareas: `MissionsService.dayAgg` agrega `followedToday`; migración y script de C.5; `client_outdated` de C.6; actualizar `stats.service.spec.ts` (0 ticks ya no es Madera), specs y e2e de misiones, retos y `test/helpers` (enviar `rulesVersion`).
```ts
// en dayAgg (me = usuario con invitedById)
follow.count({ where: { followerId: userId, createdAt: { gte: start, lt: end },
  ...(me.invitedById ? { followeeId: { not: me.invitedById } } : {}),
  followee: { OR: [{ invitedById: null }, { invitedById: { not: userId } }] } } }) > 0
```
- Tests: e2e de follow (cuenta un follow normal; no cuenta invitador; no cuenta invitado); `test/reset.e2e-spec.ts` (simulación no cambia nada; aplicar borra y pone ceros; segunda aplicación no hace nada aunque haya datos nuevos; tablas intactas; sin `--confirm` no borra); reto con cliente viejo → 409 sin filas.
- Verificación: `docker compose -f apps/api/docker-compose.yml up -d --wait && pnpm --filter @tb/api typecheck && pnpm --filter @tb/api test && pnpm --filter @tb/api test:e2e && pnpm --filter @tb/api build`.
- Aceptación: todo verde; ninguna migración borra datos.

### Ola 1 (en paralelo; dependen de P02)

#### P12 · Reset en cliente y mudanza (M) · reset, B21
- Archivos: `lib/{historyKeys,stats,daily,missions,challenge,history}.ts` y tests; `lib/mudanza.test.ts`; `api/{session,endpoints,types}.ts`; `game/rankedRun.ts`; `components/EndPanel.tsx`; `apps/client/public/index.html`; `deploy/gh-pages-redirect/{index,404}.html`.
- Tareas: C.2 a C.4; enviar `rulesVersion` en `duel`/`daily`; textos "outdated" según plataforma (web: recargar; app: "actualiza la app").
- Verificación: `vitest run src/lib/{stats,history,daily,missions,mudanza}.test.ts` y `tsc` filtrado; `cmp` de `index.html` y `404.html`; Grep sin claves viejas en código (salvo comentarios históricos y tests que prueban que se ignoran).

#### P13 · Insignias (M) · 005
- Archivos: `cosmetics/medal.ts`, `medal.test.ts`.
- Referencia: `insignias_nuevas/madera-{1,2,3}[-small].svg`, `herramientas/gen-papel-carton.js`, `gen-madera.js`, `ESTILO_INSIGNIAS.md`. Papel (1), Cartón (2), Madera (3); borrar `roman()` y clavos. Mantener `MedalSpec` (el `emblem` se retira en P31). Sin `transform` ni `filter`.
- Aceptación: los 6 SVG equivalen a la referencia (comparar renderizados a 170, 38 y 22 px); distinguibles a 22 px; ids de degradados correctos en react-native-svg.

#### P14 · Iconos de logros (M) · 011
- Archivos: `cosmetics/achievementIcon.ts` y test, `components/AchievementIcon.tsx` (+ `.web`/`.native` si hace falta).
- Portar `herramientas/gen-logros.js` a TS (devuelve texto SVG). Web: `<img>` con data URI; app: `SvgXml` de `react-native-svg`. Etiqueta "<logro>, <material>" ("sin material" en vacío).
- Test: las 32 salidas coinciden con `config_logros/logros_iconos/*.svg` (salvo `width`/`height` y espacios); ids únicos.

#### P15 · Paletas y bloque (M) · 016 a 019
- Archivos: `cosmetics/palettes.ts`, `palettes.test.ts`, `components/Block.tsx`, `components/PaletteSwatch.tsx`.
```ts
export interface Palette { id: PaletteId; style: PaletteStyle; colors: readonly string[]; shine?: boolean }
export interface BlockPaint { backgroundColor: string; backgroundImage?: string; borderWidth?: number;
  borderColor?: string; boxShadow: string }
export function blockPaint(paletteId: string | null | undefined, engineColor: string): BlockPaint;
export function effectiveFills(p: Palette, pos: number): readonly string[];  // 1 o 2 colores
// paletteColor(engineColor, id) sigue devolviendo el color crudo (partículas)
```
- Translúcidas con respaldo opaco. El estado `gone` y la trampa roja se ven igual en todas.
- Tests: las 7 reglas sobre `effectiveFills` en las 14 paletas (ambos extremos en gradient); hex efectivos de A.5; la Clásica sin cambios.
- Aceptación: umbrales del test intactos.

#### P16 · Efectos (L) · 023, 026
- Archivos: `components/Fx.tsx`, nuevo `lib/fxShapes.ts` y test.
- `export type BurstEffect = EffectId`. Fórmulas puras en `fxShapes.ts`, espejo de `preview.js` → `FX_NUEVOS` (línea 331 en adelante) y `preview.css`. Vida por efecto (ms): burbujas, monedas y fuegos ≥ 950; emojis 850; ondas 800; rayos 500; pixeles ≥ 700 (640 de duración, 8 pasos); fugaces ≥ 800 (animación ≤ 760); los 4 de hoy 750. Los nuevos ignoran `count`. Emojis con `allowFontScaling={false}`. Un valor compartido por pieza, solo `transform`/`opacity`.
- Si no cabe en un agente, entregar primero `fxShapes` + 4 efectos y relanzar para los otros 4.
- Tests: límites de vida y cantidad de nodos (también en reducido), sin NaN en p = 0 y 1.

#### P17 · Fondos estáticos A (M) · 022
- Archivos: `components/FieldBackground.tsx`, `components/backgrounds/setA.tsx`.
- puntos, rayas, hexagonos, circuito, atardecer, oceano. Registro combinado `{...setA, ...setB, ...animated}`; `id` desconocido dibuja nada; `thumb` achica mosaicos; actualizar el comentario de cabecera. Recetas: tabla de 022 (cambios.md ~1000-1046); valores: `extras-fondos.css`. Componentes `memo`.

#### P25 · Fondos estáticos B (M) · 022, 026
- Archivos: `components/backgrounds/setB.tsx`.
- bosque, nebulosa, topografia, ciudad, cristales, vitral (recetas de 022 y 026). Verificar `Use`, `Pattern` y `vectorEffect` en react-native-svg; si no sirven, calcular trazos escalados.

#### P18 · Fondos animados (M) · 022, 026
- Archivos: `components/backgrounds/animated.tsx`.
- lluvia, nieve, luciernagas, galaxia. Una sola propiedad animada por capa (`translateY`, `opacity` + `translate`, `rotate`), sin blur; quietos con `paused`, movimiento reducido, miniatura o app en segundo plano; cancelar al desmontar.

Aceptación de P17, P25 y P18: se ven como la miniatura y el campo de la maqueta (revisión en P33/P34); sin rojos que se confundan con la trampa.

#### P19 · Sonidos (L) · 024
- Archivos: `game/sounds.ts`, nuevos `game/synth/{notes,voices,packs,events,render}.ts` y tests, nuevos `platform/synthAudio.{web,native}.ts`, `platform/{fx.web,fx.native,fx.types}.ts`.
```ts
export interface SynthAudio { live(): BaseAudioContext | null;  // web: solo si ya nació en un gesto
  offline(length: number, sampleRate: number): OfflineAudioContext | null }
// sounds.play(name, arg, packId) y preview(packId) sin cambio de firma; nuevo sounds.prepare(packId?)
```
- Portar `sonidos.js`. Híbrido: por evento, `OfflineAudioContext` mono; 17 búferes (hit 0..12, kill, combo 1, 2, 3+) más los 7 de B12 = 24; un solo paquete en memoria; bus permanente ganancia → `WaveShaper` (limitador, no incluido en el render) → destino; máximo 12 voces; si el búfer no está listo, sonar en vivo con la misma voz. Render al elegir el sonido y en `play('start')`/`preview` (sin tocar `GameScreen`), incluida la cuerda de la guitarra. Respetar `settings.sound`; vibración igual; los 3 paquetes de hoy sin cambios. Descartar renders de un paquete ya reemplazado.
- Tests (puros, con contexto falso): listas de notas de `hit`, `kill`, `combo` iguales a las de `config_logros/sonidos.js` (cargarlo en el test); tope de voces; B12 completo; `8bits` intacto.

#### P20 · Misiones, seguir y landing (S/M) · 007, 008, 014
- Archivos: `components/MissionList.tsx`, `screens/{ProfileScreen,PublicProfileScreen}.tsx`, `apps/landing/public/{index.html,privacidad/index.html,terminos/index.html,eliminar-cuenta/index.html}`.
- Fila bloqueada de invitado (A.7), `useViewer` dentro del componente; tras `follow`/`unfollow` invalidar `['missions']`. Perfil: solo comprobar que nivel 0 e insignias nuevas se vean bien. Landing: "nivel de experiencia" (index ~277, privacidad ~169 y ~254, terminos ~162, eliminar-cuenta ~91), insignias "Papel, Cartón, Madera, Bronce, Plata, Oro o Diamante" (privacidad ~234, y revisar las de index ~280), "misiones del día" en el uso de "a quién sigues" (~148) y fecha de actualización.
- Verificación: `tsc` filtrado.

### Ola 2 (en paralelo; dependen de la ola 1)

#### P21 · Colección (M) · 006, 007, 009, 010, 011, 016, 022, 025
- Archivos: `screens/CollectionScreen.tsx`, nuevo `components/EffectIcon.tsx`.
- Orden A.8; "Experiencia"; texto vacío de insignia y caso sin insignia con siguiente = Papel; logros con `AchievementIcon` (38) y `MATERIAL_COLOR`, línea "Premio: …" del siguiente escalón; filas con `PaletteSwatch`, `FieldBackground thumb`, iconos de los 12 efectos; requisito de logro con su icono chico; tocar insignia o logro abre `PrizeModal`; `PreviewPanel` tras fondos; rótulo "MODO PRUEBA" si `config.unlockAll`; solo en ese modo, sección "Galería de prueba" antes del pie con las 7 insignias y los logros 4 × 7 más los vacíos (tocar abre `PrizeModal` con estadísticas ficticias al máximo, para verlos en grande y compartir). 55 filas: miniaturas animadas siempre en pausa.

#### P22 · Celebraciones y partida (M) · 008, 021, 022, 025
- Archivos: `game/{celebrations,celebrationQueue,endPrize}.ts` y tests, `components/CelebrationHost.tsx`, `screens/GameScreen.tsx`.
- Con sesión, `observeCelebrations` ofrece lo poseído y ausente de `tb_cele2` entre premios `invited`, logro `mejorReto` y sus premios (la primera siembra sigue en silencio); `OUTSIDE_KINDS`: invited, level y achievement solo `mejorReto`; `runCelebrations` incluye `racha`, `partidas`, `diasReto`; `reasonText` de logro "Por el logro <nombre> · <material>"; títulos de A.8; quitar la rama `t.at <= 0`; `useMeRefresh` al volver al inicio; pasar `dailyPct` a `endStats`; "Máximo combo"; `<FieldBackground paused={partida terminada}/>`; "MODO PRUEBA" en el inicio.
- Tests: invitado→2 celebra Amistad una vez; porcentaje tardío; no repetir; cambio de cuenta.

#### P23 · Ventanas y compartir (L) · 011, 012
- Archivos: `components/{CelebrationModal,PrizeCard,PrizeModal,ShareCardHost.native}.tsx`, `platform/share.{web,native,types}.ts`, `lib/{shareCardStore,shareText}.ts` y test.
- Logros con `AchievementIcon` 74 y paletas con `PaletteSwatch`; `PrizeModal` a 170 px sin confeti (B6); botón compartir con icono propio en la celebración: respeta `CELEBRATION_TAP_GUARD_MS`, no cierra ni avanza; preparar la imagen al mostrar (gesto en web). Nuevo tipo `PrizeShareCard` (no confundir con el componente `PrizeCard`) y `share.preparePrize` / `share.sharePrize`; no cambiar los métodos actuales. Textos en `shareText.ts`. La tarjeta nativa y la del canvas iguales.

#### P24 · Vista previa (M) · 020
- Archivos: `components/PreviewPanel.tsx`, nuevos `lib/previewStep.ts` y test.
- 9 bloques, `Pressable` sobre `Block` (`pointerEvents` none), paleta, fondo, efecto y sonido **equipados** (`sounds.play(…, packId)`), reaparición ~0,8 s, una trampa, ayuda y etiquetas de accesibilidad, `silentTipOnce` en el primer toque, limpiar temporizadores, pausar sin foco (`useIsFocused`). No usa el motor ni toca estadísticas. Referencia: `preview.js`.

### Ola 3

#### P31 · Integración (M)
- Un solo agente, árbol completo. Archivos propios extra: `apps/client/plugins/withReleaseSigning.js`, `apps/client/app.json`.
- Retirar `emblem`/`glyph` de `TierBadge` y `medal.ts`; con `TB_TEST_APK=1` el plugin no lee claves, firma el release con la clave debug y pone `applicationIdSuffix ".prueba"` (sin la variable, nada cambia); `version` 0.4.0 y `versionCode` 6; buscar restos ("Constancia", "Madera I", `'bloques'` como logro, claves viejas, stubs vacíos).
- Suites: motor (typecheck, test, build); API (typecheck, test, test:e2e, build); cliente (`tsc --noEmit`, `test`, `expo export -p web`). Comparar con la línea base (`LINEA_BASE.md` del scratchpad: motor 161, cliente 353, API 297 y e2e 95, todo verde; export web 3,0 MB en 12 bundles; no hay lint). Exportar con `--output-dir` al scratchpad.

#### P32 · Revisión adversarial (solo lectura)
- Skill `adversarial-code-review` sobre `git diff main`. Foco: reset (borrado, idempotencia, migraciones, claves), determinismo y compatibilidad cliente-servidor, reglas de no ventaja, fugas de temporizadores/animaciones/audio, `unlockAll`. Las correcciones se reparten al dueño original, sin solapes.

#### P33 · Verificación web
- Local: Postgres 5434, API con `AUTH_DEV_FAKE=1` y `CORS_ORIGINS=http://localhost:8081`; cliente con `EXPO_PUBLIC_API_URL=http://localhost:3000`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID` ficticio y `EXPO_PUBLIC_AUTH_DEV_FAKE=1`. Maqueta servida con un servidor estático de `node` (puerto 5176), "Con cambios".
- Playwright 412×915 y escritorio 1440×900, dos pasadas (normal y `EXPO_PUBLIC_UNLOCK_ALL=1`, reiniciando Metro con `--clear`): 14 paletas, 20 fondos, 12 efectos, 9 sonidos sin errores, iconos, insignias, orden de la Colección, vista previa, celebraciones, compartir, misión bloqueada como invitado y cumplida con cuenta, datos viejos en `localStorage` no reaparecen, movimiento reducido, consola sin errores. Capturas en `.playwright-mcp/`.
- Fechas posteriores a 12-07: comprobarlas con los tests del motor (no cambiar las constantes para probar).

#### P34 · APK de prueba y emulador (021)

**API del APK de prueba (definido):** `https://api.invalid` (dominio que nunca resuelve) con un client ID ficticio.

| Opción | Evaluación |
|---|---|
| Producción (hoy v5) | Descartada: escribe en producción, el cliente v6 queda "desactualizado" y el login no sirve con firma debug |
| API local en el PC | Descartada para el celular: exige USB o red, y HTTP sin cifrar está bloqueado en release |
| Sin API | Descartada: oculta pestañas y los premios de cuenta y de reto diario |
| API ficticia | **Elegida**: `features.accounts` activo, se listan los 55 premios y nada llega a producción |

```bash
# desde apps/client; antes, copiar al scratchpad el APK 0.3.1 de android/app/build/outputs/apk/release/
pnpm exec expo prebuild -p android && cd android
./gradlew clean
TB_TEST_APK=1 EXPO_PUBLIC_UNLOCK_ALL=1 EXPO_PUBLIC_API_URL=https://api.invalid \
EXPO_PUBLIC_GOOGLE_CLIENT_ID=prueba NODE_ENV=production \
./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a,x86_64
# copiar app-release.apk como touched-block-prueba.apk
```
- Comprobar: paquete `app.touchedblock.prueba` (`aapt dump badging`), firma debug (`apksigner`) y `api.invalid` en el bundle (las variables del comando mandan sobre `apps/client/.env`, que apunta a localhost).
- Emulador `Pixel_Mi_Device` (instalar con `adb -s <emulador>`). Lista de 021 más: cada paleta (bordes, `inset`, degradados, brillos), 20 fondos, 12 efectos, 9 sonidos (tiempo de render, tocar rápido), galería e iconos `SvgXml`, compartir imagen, logcat sin errores, fluidez con fondo animado y efecto pesado en la etapa final. Comparar con las capturas web.
- Flujos con cuenta (misión de seguir, celebraciones de invitados y porcentaje) se verifican aparte: build de desarrollo con `adb reverse`, API local y `AUTH_DEV_FAKE` (`docs/desarrollo.md`).
- Guía para el usuario: ruta absoluta del APK; se instala junto a su app sin borrar nada; es esperado ver "MODO PRUEBA", "Sin conexión con el servidor" y errores en rankings y reto diario; revisar paletas, fondos, efectos, sonidos, vista previa, galería, compartir y jugar al menos 20 s (celebración de Papel); las misiones nuevas se ven poniendo la fecha del teléfono en 2026-12-07 o después. **No subirlo ni repartirlo.** Instalarlo en el teléfono por USB solo si el usuario lo pide.

#### P35 · Documentación
- `docs/{historia-y-decisiones,reglas-y-balance,api,arquitectura,despliegue,desarrollo,pendientes,README}.md`, `CLAUDE.md` raíz (claves `tb_*`, reglas v6), `config_logros/{CLAUDE.md,cambios.md}` (marcar aplicados). Incluir: tablas de A, reset y su script, `client_outdated`, APK de prueba, motivos y decisiones B adoptadas. No afirmar que algo se desplegó o se probó en teléfono si no pasó.

### Mapa de CAMBIOs a paquetes

001-003: P01, P13, P22 · 004: P02 · 005: P02, P13 · 006: P21 · 007: P20, P21 · 008: P01, P20, P22 · 009-010: P01, P21 · 011: P14, P21, P23 · 012: P23 · 013: P01 · 014: P01, P11, P20 · 015: P01 · 016-019: P02, P15 · 020: P24 · 021: P02, P31, P34 · 022: P17, P25, P18 · 023: P16 · 024: P19 · 025: P02, P22 · 026: P16, P25, P18

---

## E. Riesgos y verificación

| Riesgo | Mitigación / cómo se verifica |
|---|---|
| El replay deja de coincidir | Sin cambios en `game.ts`; `golden` y determinismo sin regenerar; e2e de partidas |
| Cliente y servidor eligen distinto reto o misiones | Funciones puras del motor por fecha; tests de borde; API y web del mismo commit; publicar antes de 12-07 |
| Web publicada antes que API o reset | Orden C.7; no mezclar a `main` antes del paso 5 |
| Borrado accidental o repetido | Fuera de migraciones, simulación por defecto, confirmación literal, marca `DataReset`, e2e |
| Pérdida de datos sin vuelta atrás | Aceptada por el usuario; conteo de solo lectura y su respuesta antes de aplicar |
| APK viejo | `client_outdated`, rechazo v5; e2e; avisar y repartir 0.4.0 |
| `UNLOCK_ALL` en una versión real | `unlockGuard.test`, rótulo visible, limpieza de caché y comprobación en C.8 |
| Rendimiento Android (fondos animados, efectos, `Pattern` a pantalla completa, 55 miniaturas) | Una propiedad por capa, pausas; P34 y teléfono modesto. Respaldo: dejar estáticos los animados |
| Sombras `inset`, `backgroundImage`, `SvgXml`, `Pattern`/`Use` distintos en nativo | Comparación web/emulador en P34; fallback de Botón |
| `react-native-audio-api` (render offline, `PeriodicWave`, `WaveShaper`, latencia, memoria 1 a 2 MB) | Respaldo en vivo si el render falla; medir en emulador; escuchar en teléfono. Plan B: menos nodos, `oversample 'none'` |
| Audio en iOS web (contexto solo en gesto) | `live()` devuelve null antes del gesto; probar en Safari cuando haya |
| Peso del bundle web | Comparar con la línea base; avisar si el JS gzip crece más de 60 KB |
| Árbol compartido: paquetes que se pisan | Listas exclusivas, sin git, verificación filtrada; P31 integra |
| Regla de no ventaja (paletas y fondos claros bajo bloques) | `palettes.test` con color efectivo; revisión visual |
| Premios inalcanzables | B4 |

---

## F. Requisitos de despliegue, lo que requiere al usuario y fuera de alcance

**Requisitos para desplegar (comprobar antes del tramo 2):**

| Requisito | Estado al 2026-11-27 |
|---|---|
| Visto bueno tras la prueba en el celular | Pendiente |
| Commit, push, tag `v0.7.0` y mezcla a `main` | Los hace el orquestador; `gh` está instalado, sesión no comprobada |
| Secretos de GitHub `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_COMPOSE_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Documentados como creados; no comprobados |
| Acceso a Dokploy para ver registros y ejecutar el script en el servicio `api` (tarea temporal ejecutada a mano y borrada después, o terminal del panel) | No comprobado; si falta, el usuario corre los comandos en la terminal del panel |
| Clave de firma `~/.touched-block/release.keystore` y `keystore.properties` | Los archivos existen (contenido no leído) |
| Variables nuevas de producción | Ninguna |
| Versiones | API `v0.7.0`; app `0.4.0`, `versionCode` 6 |
| Fecha | Antes del 2026-12-07 (B7) |
| Android local (SDK, NDK, Java 21, AVD `Pixel_Mi_Device`) | Comprobado en la línea base; nada compilado aún |

**Requiere al usuario:** probar en su teléfono (sonido de oído, vibración, fluidez, compartir) y dar el visto bueno; confirmar las decisiones B marcadas R; responder al conteo previo al reset; probar el login con Google en el APK definitivo; repartirlo y avisar a quienes tengan el 0.3.1 de que sus registros parten de cero.

**Fuera de alcance:** respaldo y restauración de producción (opcional descartado por el usuario), iOS, Google Play, muestras de audio grabadas, blur real en Esmerilado, misión "Invita a alguien", actualizar la recta de niveles de la maqueta, cambios de reglas o balance de partida.

---

## Anexo: líneas de `cambios.md`

001:19 · 002:34 · 003:46 · 004:66 · 005:102 · 006:136 · 007:151 · 008:182 · 009:202 · 010:232 · 011:270 · 012:328 · 013:360 · 014:407 · 015:475 · 016:533 · 017:578 · 018:666 · 019:735 · 020:864 · 021:940 · 022:986 · 023:1111 · 024:1213 · 025:1375 · 026:1581 (fin 1635)
