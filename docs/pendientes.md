# Pendientes, riesgos e ideas

Estado al **10 nov 2026**.

## Estado

- **Web**: GitHub Pages **con cuentas y rankings activos** desde el 10 nov 2026 (variables `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_GOOGLE_CLIENT_ID` creadas). Incluye las reglas v3, las páginas legales y los dos tutoriales (básico y avanzado). Se verificó de punta a punta: partida de invitado validada por el servidor, rankings y login real con Google.
- **Dokploy** (panel `http://vps23906.cubepath.net:3000`, IP 144.225.147.103, Dokploy v0.31.0; ahí también vive el proyecto UltimaType con `ultimatype.xyz`):
  - Proyecto **Touched Block** (`6eSA39oT4nPDO4U034YGw`), entorno `production`.
  - Compose **API**: id `5ZlPmSATtXjdrF-3c-vPs`, appName `touched-block-bz408h`. Fuente Git `https://github.com/SuKuShaing/touched-block.git`, rama `main`, ruta `./deploy/docker-compose.yml`. *Isolated Deployment* activado y *autoDeploy* desactivado (se despliega por tag).
  - Las variables de `deploy/.env` están cargadas.
  - **API en producción: `https://vps23906.cubepath.net`** (hostname del VPS que da el proveedor). Certificado Let's Encrypt vigente hasta el 8 feb 2027, con renovación automática por Traefik. `/health` responde `rulesVersion: 3`, versión `v0.1.2`. CORS solo acepta `https://sukushaing.github.io`.
  - Se despliega solo con cada tag: `v0.1.1` y `v0.1.2` (10 nov 2026, buscador de "¿Quién te invitó?") corrieron completos, tests → GHCR → Dokploy.
  - Usar el hostname del VPS es provisorio. Si se cambia de VPS, o se le da HTTPS al panel de Dokploy en ese mismo host, hay que mover la API a un subdominio propio: cambiar el dominio en Dokploy y `EXPO_PUBLIC_API_URL`, y volver a publicar la web.
- **GHCR**: la imagen `ghcr.io/sukushaing/touched-block-api` (`v0.1.0` y `latest`) es pública.
- Los secretos `DOKPLOY_*` ya están en GitHub. El tag `v0.1.0` falló en el paso de Dokploy porque todavía no existían; `v0.1.1` funcionó completo.
- Google Cloud: la app está "En producción". Los orígenes `https://sukushaing.github.io` y `http://localhost:8081` están autorizados. La verificación de marca sigue pendiente; es opcional con los scopes básicos.

- **Corazón de recuperación (reglas v4)**: publicado el 10 nov 2026 (web y API `v0.2.0`). Falta mencionarlo en el tutorial (slide de vidas/combos).

## Lo que tiene que hacer el usuario

1. Seguridad: el panel de Dokploy va por HTTP, así que el token viaja sin cifrar. Conviene darle al panel un dominio con HTTPS.
2. Opcional: pedir la verificación de marca en Google Cloud (Centro de verificación), para que el login muestre el nombre y el logo de la app.
3. Opcional: mover la API a un subdominio propio (ver arriba).

## Riesgos conocidos

- **Balance sin probar con personas**:
  - Los castigos ×6/×7 son muy altos: "10+10" escapado resta −120 s y "5×5" resta −175 s.
  - Al empezar las restas, cerca del 30 % de las operaciones son trampas ("1−1", "1−2", "2−2").
  - Cambiar el balance después de abrir los rankings los reinicia (`RULES_VERSION`). Conviene ajustarlo antes de difundir.
- **Bots**: el replay garantiza que la partida es real, pero no distingue un script que toca bien de una persona. La etapa final hace que todos pierdan. Si aparecen puntajes sospechosos, se pueden agregar heurísticas (precisión y ritmo inhumanos).
- **Respaldos de la base**: no hay ninguno configurado todavía (ver `despliegue.md`).
- **Búsqueda de usuarios** sin índice (`strpos` recorre la tabla). Basta con pocos miles de usuarios; si crece, agregar un índice trigram (`pg_trgm`).
- **Peso de la web**: ~2 MB de JS (≈600 KB comprimido) por react-native-web.
- Quien ya vio el tutorial único de antes (`tb_onb1`) no vuelve a ver el básico; verá el avanzado en su 3.ª visita contada desde este cambio.

## Ideas (sugerencias, no decisiones)

- Pausa, y botón para silenciar sonido y vibración.
- Que las restas aparezcan un poco después que las sumas.
- App Android/iOS:
  - Módulos `.native` (login nativo de Google y Apple, compartir con `react-native-view-shot` + `expo-sharing`, `expo-audio`, `expo-haptics`).
  - EAS Build y Submit, cuentas de desarrollador.
  - Clientes OAuth de Android/iOS en `GOOGLE_CLIENT_IDS`.
- Dominio propio: necesario para Sign in with Apple en la web y para cookies de sesión del mismo sitio.
- Más tipos de bloque (tiempo extra, congelar, escudo).
- Limpiar los íconos sobrantes de la raíz (`favicon-32.png`, `favicon-192.png`, `apple-touch-icon.png`, `favicon.svg`, `og-image.png`), porque los que se usan están en `apps/client/public/`. Confirmar antes de borrar.
