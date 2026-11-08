/* Se carga en <head>, antes de pintar: aplica el tema elegido (sin destello) y apaga el
   vidrio en equipos muy modestos. Va en archivo aparte porque la política de seguridad
   (CSP) no permite scripts en línea. */
(function () {
  var raiz = document.documentElement;
  try {
    var a = JSON.parse(localStorage.getItem('mostrador.ajustes') || '{}') || {};
    // Desde 1.2.0 el fondo negro (oscuro) es el de siempre; "Automático" de antes pasa a oscuro
    // (app.js lo deja guardado). Solo "Claro" elegido a mano se respeta tal cual.
    var tema = a.tema;
    if (!tema || (tema === 'auto' && !a.temaNegro)) tema = 'oscuro';
    if (tema === 'claro' || tema === 'oscuro') raiz.setAttribute('data-tema', tema);
  } catch (e) {
    raiz.setAttribute('data-tema', 'oscuro');   // sin acceso a lo guardado: el negro de siempre
  }
  // 2 núcleos o menos, o 2 GB de memoria o menos: superficies opacas, mismas formas.
  try {
    if ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
        (navigator.deviceMemory && navigator.deviceMemory <= 2)) {
      raiz.classList.add('sin-vidrio');
    }
  } catch (e) {}
})();
