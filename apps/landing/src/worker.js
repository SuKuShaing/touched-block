// Única lógica de la landing: www.touchedblock.app redirige (301) a touchedblock.app con la misma
// ruta y parámetros. Todo lo demás lo sirven los activos estáticos de ./public.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.touchedblock.app') {
      url.hostname = 'touchedblock.app';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
