// Configuracion de runtime del frontend. Este archivo se sirve tal cual
// (no pasa por el bundler). Vacio = usar rutas relativas del mismo origen,
// que nginx reenvia al backend (ver nginx.conf.template). Solo se necesita
// un valor aqui si el backend se sirve desde otro origen sin proxy.
window.APP_CONFIG = {
  API_URL: '',
};
