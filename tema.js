/* Se carga en <head>, antes de pintar: aplica el tema elegido (sin destello) y apaga el
   vidrio en equipos muy modestos. Va en archivo aparte porque la política de seguridad
   (CSP) no permite scripts en línea. */
(function () {
  var raiz = document.documentElement;
  try {
    var a = JSON.parse(localStorage.getItem('mostrador.ajustes') || '{}');
    if (a && (a.tema === 'claro' || a.tema === 'oscuro')) raiz.setAttribute('data-tema', a.tema);
  } catch (e) {}
  // 2 núcleos o menos, o 2 GB de memoria o menos: superficies opacas, mismas formas.
  try {
    if ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) ||
        (navigator.deviceMemory && navigator.deviceMemory <= 2)) {
      raiz.classList.add('sin-vidrio');
    }
  } catch (e) {}
})();
