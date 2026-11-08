/* Service worker: guarda la app en el teléfono para que abra sin internet.
   La tasa no pasa por aquí (la app la guarda aparte y muestra la última conocida).

   Cómo llegan las versiones nuevas (corregido en 1.1.1):
   - La app registra este archivo con updateViaCache: 'none' y pide revisar al abrir, así que se
     nota enseguida que version.js cambió (antes la caché HTTP de GitHub Pages, de 10 minutos,
     lo escondía).
   - La instalación descarga todo con cache: 'reload' (sin la caché HTTP): la versión nueva
     entra completa, nunca mezclada con archivos de la anterior.
   - Cada versión sirve solo su propia copia (primero la copia guardada); lo nuevo llega entero con
     el siguiente version.js. La app se recarga sola cuando la versión nueva toma el control. */
importScripts('version.js');
var VERSION = 'mostrador-' + self.APP_VERSION;
var ARCHIVOS = [
  './',
  'index.html',
  'version.js',
  'estilos.css',
  'tema.js',
  'logica.js',
  'app.js',
  'manifest.webmanifest',
  'fuentes/plex-sans.woff2',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/icono-maskable-512.png',
  'iconos/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) {
        return c.addAll(ARCHIVOS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (claves) {
        return Promise.all(claves.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

// En la computadora de pruebas (127.0.0.1 / localhost) no se sirve nada guardado: así cada
// cambio se ve al recargar, aunque la versión no haya cambiado. En el teléfono no aplica.
var EN_PRUEBAS = /^(127\.0\.0\.1|localhost)$/.test(self.location.hostname);

self.addEventListener('fetch', function (e) {
  var pedido = e.request;
  if (EN_PRUEBAS) return;
  if (pedido.method !== 'GET') return;
  var url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;
  // Los APK se descargan siempre de la red (si no, una navegación recibiría la app en su lugar).
  if (/\.(apk|aab)$/i.test(url.pathname)) return;

  var clave = pedido.mode === 'navigate' ? 'index.html' : pedido;
  e.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(clave, { ignoreSearch: true }).then(function (guardado) {
        if (guardado) return guardado;
        return fetch(pedido).then(function (resp) {
          if (resp && resp.ok && resp.type === 'basic' && pedido.mode !== 'navigate') cache.put(pedido, resp.clone());
          return resp;
        });
      });
    })
  );
});
