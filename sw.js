/* Service worker: guarda la app en el teléfono para que abra sin internet.
   La tasa no pasa por aquí (la app la guarda aparte y muestra la última conocida).
   El nombre de la caché sale de version.js: al subir la versión, los teléfonos descartan la copia vieja. */
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
  'fuentes/bricolage.woff2',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
  'iconos/icono-maskable-512.png',
  'iconos/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(ARCHIVOS); })
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

// Primero la copia guardada (abre al instante y sin conexión); en segundo plano se
// busca la versión nueva para la próxima vez.
self.addEventListener('fetch', function (e) {
  var pedido = e.request;
  if (pedido.method !== 'GET') return;
  var url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  var clave = pedido.mode === 'navigate' ? 'index.html' : pedido;
  e.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(clave, { ignoreSearch: true }).then(function (guardado) {
        var deRed = fetch(pedido).then(function (resp) {
          if (resp && resp.ok && resp.type === 'basic') cache.put(clave, resp.clone());
          return resp;
        }).catch(function () { return guardado; });
        if (guardado) {
          e.waitUntil(deRed.catch(function () {}));
          return guardado;
        }
        return deRed;
      });
    })
  );
});
