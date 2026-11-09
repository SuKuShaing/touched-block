# Pendientes, riesgos e ideas

Estado al **9 nov 2026**.

## Estado

- La web v2 (Expo) está publicada en GitHub Pages en modo invitado, porque todavía no hay API ni variables.
- En el repo, sin publicar todavía:
  - Las reglas v3 (castigo por etapa ×5/×6/×7).
  - La slide de restas ≤ 0.
  - Las páginas legales.
  - El despliegue por Compose.
  - Esta carpeta `docs/`.
- La API está probada en local, incluido el Compose de producción. Todavía no está desplegada.

## Lo que tiene que hacer el usuario

Pasos detallados en [`despliegue.md`](despliegue.md).

1. Publicar la web con las páginas legales (push a `main`) para que Google pueda verlas.
2. En Google Cloud, pasar la pantalla de consentimiento a **producción** y revisar que estén las URLs de privacidad y condiciones.
3. Tener un (sub)dominio con HTTPS apuntando al VPS para la API.
4. Crear el Compose en Dokploy y pegar `deploy/.env` en Environment.
5. Configurar en GitHub:
   - Secretos: `DOKPLOY_URL`, `DOKPLOY_API_KEY`, `DOKPLOY_COMPOSE_ID`.
   - Variable: `EXPO_PUBLIC_GOOGLE_CLIENT_ID`.
6. Crear y subir el tag `v0.1.0`. Revisar que el paquete de GHCR sea público (o configurar el registro en Dokploy).
7. Crear la variable `EXPO_PUBLIC_API_URL` y volver a publicar la web.
8. Probar el login real con Google: aún no se ha probado con un Client ID de verdad.

## Riesgos conocidos

- **Balance sin probar con personas**:
  - Los castigos ×6/×7 son muy altos: "10+10" escapado resta −120 s y "5×5" resta −175 s.
  - Al empezar las restas, cerca del 30 % de las operaciones son trampas ("1−1", "1−2", "2−2").
  - Cambiar el balance después de abrir los rankings los reinicia (`RULES_VERSION`). Conviene ajustarlo antes de difundir.
- **Bots**: el replay garantiza que la partida es real, pero no distingue un script que toca bien de una persona. La etapa final hace que todos pierdan. Si aparecen puntajes sospechosos, se pueden agregar heurísticas (precisión y ritmo inhumanos).
- **Respaldos de la base**: no hay ninguno configurado todavía (ver `despliegue.md`).
- **Peso de la web**: ~2 MB de JS (≈600 KB comprimido) por react-native-web.
- En el Perfil, el botón "Ver tutorial de nuevo" muestra el tutorial actual. Quien ya lo vio (`tb_onb1`) no ve automáticamente las slides nuevas, a menos que se suba a `tb_onb2`. No se ha hecho; decidirlo con el usuario.

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
