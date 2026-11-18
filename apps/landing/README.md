# Página pública (touchedblock.app)

Sitio estático de Touched Block: portada con bloques que se pueden tocar, y las páginas legales y de soporte que piden Google Play y la App Store. HTML, CSS y JS sin dependencias ni paso de compilación; todo está en `public/`.

| Ruta | Archivo |
|---|---|
| `/` | `public/index.html` (bloques: `public/assets/blocks.js`; estilos: `public/assets/site.css`) |
| `/privacidad/` | `public/privacidad/index.html` |
| `/terminos/` | `public/terminos/index.html` |
| `/eliminar-cuenta/` | `public/eliminar-cuenta/index.html` |
| `/soporte/` | `public/soporte/index.html` |
| cualquier otra | `public/404.html` |

`public/_redirects` lleva los nombres antiguos (`/politica-de-privacidad`, `/condiciones-del-servicio`) a los nuevos, y `public/_headers` agrega cabeceras de seguridad y caché para las fuentes. Cloudflare los aplica; no se publican como archivos.

El correo de contacto (`contacto@touchedblock.app`) está escrito tal cual en varias páginas: para cambiarlo, buscar y reemplazar ese texto en `public/`.

## Ver en local

```sh
pnpm dlx serve apps/landing/public -l 5180
```

y abrir http://localhost:5180/. Para probar también las redirecciones, las cabeceras y la página 404 como en Cloudflare: `pnpm dlx wrangler@4 dev` desde `apps/landing`.

## Desplegar

Es un Worker de Cloudflare solo con activos estáticos (`wrangler.jsonc`), con los dominios `touchedblock.app` y `www.touchedblock.app`. Desde `apps/landing`:

```sh
pnpm dlx wrangler@4 deploy
```

Cada push a `main` que toque `apps/landing/**` también la publica con `.github/workflows/deploy-landing.yml`. A mano, la primera vez pide iniciar sesión en Cloudflare (`pnpm dlx wrangler@4 login`); la zona `touchedblock.app` tiene que estar en esa cuenta.
