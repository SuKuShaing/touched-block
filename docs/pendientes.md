# Pendientes, riesgos e ideas

Estado al **10 nov 2026**.

## Estado

- **Web**: GitHub Pages, en modo invitado hasta que existan las variables de GitHub. Incluye las reglas v3, las páginas legales y los dos tutoriales (básico y avanzado).
- **Dokploy** (panel `http://vps23906.cubepath.net:3000`, IP 144.225.147.103, Dokploy v0.31.0; ahí también vive el proyecto UltimaType con `ultimatype.xyz`):
  - Proyecto **Touched Block** (`6eSA39oT4nPDO4U034YGw`), entorno `production`.
  - Compose **API**: id `5ZlPmSATtXjdrF-3c-vPs`, appName `touched-block-bz408h`. Fuente Git `https://github.com/SuKuShaing/touched-block.git`, rama `main`, ruta `./deploy/docker-compose.yml`. *Isolated Deployment* activado y *autoDeploy* desactivado (se despliega por tag).
  - Las variables de `deploy/.env` están cargadas.
  - **Desplegado el 10 nov 2026** (v0.1.0): `api` y `tb-db` están *healthy*, las migraciones se aplicaron y la API escucha en el puerto 3000. **Todavía no tiene dominio**, así que no se puede llamar desde fuera.
- **GHCR**: la imagen `ghcr.io/sukushaing/touched-block-api` (`v0.1.0` y `latest`) es pública.
- **Workflow del tag v0.1.0**: los tests y la imagen salieron bien, pero falló el paso "Desplegar en Dokploy". Probablemente faltan los secretos `DOKPLOY_*` en GitHub o están mal. El despliegue se hizo a mano con el MCP de Dokploy.

## Lo que tiene que hacer el usuario

Pasos detallados en [`despliegue.md`](despliegue.md).

1. Elegir el dominio de la API y agregarlo en Dokploy (Compose API → Domains): servicio `api`, puerto 3000, HTTPS con Let's Encrypt. Opciones:
   - `vps23906.cubepath.net`: ya apunta al VPS.
   - Un subdominio propio, por ejemplo `api.ultimatype.xyz`, con un registro A en Cloudflare.
2. Revisar los secretos de GitHub:
   - `DOKPLOY_URL` = `http://vps23906.cubepath.net:3000`
   - `DOKPLOY_API_KEY`
   - `DOKPLOY_COMPOSE_ID` = `5ZlPmSATtXjdrF-3c-vPs`
   - Y la variable `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
3. Crear la variable `EXPO_PUBLIC_API_URL` = `https://<dominio de la API>` y volver a publicar la web.
4. En Google Cloud, pasar la app a **producción** y poner las URLs legales con `/` final.
5. Probar el login real con Google: aún no se ha probado con un Client ID de verdad.
6. Seguridad: el panel de Dokploy va por HTTP, así que el token viaja sin cifrar. Conviene darle al panel un dominio con HTTPS.

## Riesgos conocidos

- **Balance sin probar con personas**:
  - Los castigos ×6/×7 son muy altos: "10+10" escapado resta −120 s y "5×5" resta −175 s.
  - Al empezar las restas, cerca del 30 % de las operaciones son trampas ("1−1", "1−2", "2−2").
  - Cambiar el balance después de abrir los rankings los reinicia (`RULES_VERSION`). Conviene ajustarlo antes de difundir.
- **Bots**: el replay garantiza que la partida es real, pero no distingue un script que toca bien de una persona. La etapa final hace que todos pierdan. Si aparecen puntajes sospechosos, se pueden agregar heurísticas (precisión y ritmo inhumanos).
- **Respaldos de la base**: no hay ninguno configurado todavía (ver `despliegue.md`).
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
