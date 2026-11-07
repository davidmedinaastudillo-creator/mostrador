/* Mostrador — interfaz. La lógica pura está en logica.js (MostradorLogica). */
(function () {
  'use strict';

  var L = window.MostradorLogica;
  var doc = document;
  var raiz = doc.documentElement;
  function $(id) { return doc.getElementById(id); }

  /* ================================================================ datos */

  var CLAVES = {
    visitas: 'mostrador.visitas',
    precios: 'mostrador.precios',
    ajustes: 'mostrador.ajustes',
    tasa: 'mostrador.tasa'
  };
  var PLANTILLA_VISITANTE = 'Hola, {nombre}. Registramos tu visita del {fecha} a las {hora}.\nMotivo: {motivo}\n¡Gracias por venir!';
  var PLANTILLA_FIJO = '*Nueva visita*\nNombre: {nombre}\nTeléfono: {telefono}\nMotivo: {motivo}\nFecha: {fecha}, {hora}';
  var MOTIVOS_BASE = ['Consulta', 'Pago', 'Entrega', 'Información'];
  var API_OFICIAL = 'https://ve.dolarapi.com/v1/dolares/oficial';
  var API_HISTORICO = 'https://ve.dolarapi.com/v1/historicos/dolares/oficial';
  var TASA_VIEJA_MS = 30 * 60 * 1000;
  var MAX_VISITAS_EN_PANTALLA = 200;
  var COLOR_BARRA = { claro: '#DCEFEB', oscuro: '#06202B' };

  var AJUSTES_BASE = {
    destino: 'visitante',
    numeroFijo: '',
    codigoPais: '58',
    plantillaVisitante: PLANTILLA_VISITANTE,
    plantillaFijo: PLANTILLA_FIJO,
    tasaManual: false,
    valorTasaManual: null,
    usarProxima: false,
    tema: 'auto'
  };

  function leer(clave, base) {
    try {
      var v = localStorage.getItem(clave);
      return v ? JSON.parse(v) : base;
    } catch (e) {
      return base;
    }
  }

  function guardar(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      avisar('No se pudo guardar en este teléfono. Libera espacio y vuelve a intentarlo.');
      return false;
    }
  }

  function lista(v) { return Array.isArray(v) ? v : []; }
  function objeto(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  var visitas = lista(leer(CLAVES.visitas, [])).filter(function (v) { return v && v.id && v.fecha; });
  var precios = lista(leer(CLAVES.precios, [])).filter(function (p) { return p && p.id && p.usd > 0; });
  var ajustes = Object.assign({}, AJUSTES_BASE, objeto(leer(CLAVES.ajustes, {})));
  var tasaGuardada = Object.assign({ historial: [], consultada: null }, objeto(leer(CLAVES.tasa, null)));
  tasaGuardada.historial = lista(tasaGuardada.historial);

  function guardarAjustes() { guardar(CLAVES.ajustes, ajustes); }

  function idNuevo() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  var persistenciaPedida = false;
  function pedirPersistencia() {
    if (persistenciaPedida) return;
    persistenciaPedida = true;
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  }

  /* ================================================================ aviso */

  var aviso = $('aviso'), avisoTexto = $('avisoTexto'), avisoAccion = $('avisoAccion');
  var avisoReloj = null, avisoFn = null;

  function avisar(texto, accionTexto, accion, ms) {
    avisoTexto.textContent = texto;
    avisoFn = accion || null;
    avisoAccion.hidden = !accionTexto;
    avisoAccion.textContent = accionTexto || '';
    try {
      if (aviso.matches(':popover-open')) aviso.hidePopover();
      aviso.showPopover();
    } catch (e) {
      aviso.classList.add('visible');
    }
    clearTimeout(avisoReloj);
    avisoReloj = setTimeout(ocultarAviso, ms || (accionTexto ? 6500 : 3800));
  }

  function ocultarAviso() {
    clearTimeout(avisoReloj);
    avisoFn = null;
    try { if (aviso.matches(':popover-open')) aviso.hidePopover(); } catch (e) {}
    aviso.classList.remove('visible');
  }

  avisoAccion.addEventListener('click', function () {
    var fn = avisoFn;
    ocultarAviso();
    if (fn) fn();
  });

  /* ================================================================ hojas (diálogos) */

  // Cada hoja abierta agrega una entrada al historial: el botón "atrás" de Android la cierra
  // en vez de salir de la app.
  var pila = [];
  var ignorarPop = 0;

  function abrirHoja(d) {
    if (d.open) return;
    d.showModal();
    pila.push(d);
    try { history.pushState({ hoja: d.id }, ''); } catch (e) {}
  }

  doc.querySelectorAll('dialog.hoja').forEach(function (d) {
    d.addEventListener('close', function () {
      var i = pila.indexOf(d);
      if (i < 0) return;
      pila.splice(i, 1);
      try {
        if (history.state && history.state.hoja === d.id) { ignorarPop++; history.back(); }
      } catch (e) {}
    });
    // Tocar fuera de la hoja la cierra.
    d.addEventListener('click', function (e) {
      if (e.target !== d) return;
      var r = d.getBoundingClientRect();
      var dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!dentro) d.close('fuera');
    });
  });

  doc.querySelectorAll('[data-cerrar]').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('dialog').close('cerrar'); });
  });

  window.addEventListener('popstate', function () {
    if (ignorarPop > 0) { ignorarPop--; return; }
    var d = pila.pop();
    if (d && d.open) d.close('atras');
  });

  var confirmarResolver = null;
  function confirmar(texto, boton) {
    var d = $('hojaConfirmar');
    $('confirmarTexto').textContent = texto;
    $('confirmarSi').textContent = boton || 'Borrar';
    d.returnValue = '';
    abrirHoja(d);
    return new Promise(function (resolver) { confirmarResolver = resolver; });
  }
  $('hojaConfirmar').addEventListener('close', function () {
    if (confirmarResolver) confirmarResolver(this.returnValue === 'si');
    confirmarResolver = null;
  });

  /* ================================================================ tema */

  var mqOscuro = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function aplicarTema() {
    if (ajustes.tema === 'claro' || ajustes.tema === 'oscuro') raiz.setAttribute('data-tema', ajustes.tema);
    else raiz.removeAttribute('data-tema');
    var oscuro = ajustes.tema === 'oscuro' || (ajustes.tema !== 'claro' && mqOscuro && mqOscuro.matches);
    doc.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute('content', oscuro ? COLOR_BARRA.oscuro : COLOR_BARRA.claro);
    });
  }
  if (mqOscuro && mqOscuro.addEventListener) mqOscuro.addEventListener('change', aplicarTema);

  /* ================================================================ campos de dinero */

  /**
   * Formatea un campo mientras se escribe: "1.234,56". El punto lo pone la app (miles);
   * si la persona escribe un punto y todavía no hay coma, se toma como coma decimal.
   */
  function campoDinero(input, maxDecimales, alCambiar) {
    input.dataset.previo = input.value;
    input.addEventListener('input', function () {
      var crudo = input.value;
      var cursor = input.selectionStart == null ? crudo.length : input.selectionStart;
      var previo = input.dataset.previo || '';
      var puntos = function (s) { return (s.match(/\./g) || []).length; };
      if (crudo.charAt(cursor - 1) === '.' && crudo.indexOf(',') < 0 && puntos(crudo) > puntos(previo)) {
        crudo = crudo.slice(0, cursor - 1) + ',' + crudo.slice(cursor);
      }
      var significativos = crudo.slice(0, cursor).replace(/[^\d,]/g, '').length;
      var r = L.formatearEntrada(crudo, maxDecimales);
      input.value = r.texto;
      var pos = 0, cuenta = 0;
      while (pos < r.texto.length && cuenta < significativos) {
        if (/[\d,]/.test(r.texto.charAt(pos))) cuenta++;
        pos++;
      }
      try { input.setSelectionRange(pos, pos); } catch (e) {}
      input.dataset.previo = r.texto;
      alCambiar(r.valor);
    });
    input.addEventListener('paste', function (e) {
      var texto = (e.clipboardData || window.clipboardData).getData('text');
      var n = L.leerNumero(texto);
      if (!isFinite(n) || n < 0) return;
      e.preventDefault();
      ponerDinero(input, n, maxDecimales);
      alCambiar(n);
    });
  }

  function ponerDinero(input, n, maxDecimales) {
    var texto = isFinite(n) ? L.formatearEntrada(L.formatear(n, maxDecimales), maxDecimales).texto : '';
    input.value = texto;
    input.dataset.previo = texto;
  }

  function valorDinero(input) {
    return L.formatearEntrada(input.value, 8).valor;
  }

  /* ================================================================ tasa */

  var consultando = false;
  var errorTasa = null;

  function resumen() { return L.resumenTasa(tasaGuardada.historial, L.hoyCaracas()); }

  /** La tasa con la que convierte toda la app. */
  function tasaEnUso() {
    if (ajustes.tasaManual && ajustes.valorTasaManual > 0) {
      return { valor: ajustes.valorTasaManual, origen: 'manual' };
    }
    var r = resumen();
    if (!r) return null;
    if (ajustes.usarProxima && r.proxima) return { valor: r.proxima.valor, fecha: r.proxima.fecha, origen: 'proxima' };
    return { valor: r.vigente.valor, fecha: r.vigente.fecha, origen: 'bcv' };
  }

  function describirTasa(t) {
    if (!t) return '';
    var cifra = L.formatear(t.valor, 2);
    if (t.origen === 'manual') return 'tasa manual de ' + cifra;
    return 'tasa BCV de ' + cifra + ' del ' + L.fechaCorta(t.fecha);
  }

  function pedirJSON(url, ms) {
    var control = window.AbortController ? new AbortController() : null;
    var reloj = setTimeout(function () { if (control) control.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: control ? control.signal : undefined })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .finally(function () { clearTimeout(reloj); });
  }

  function actualizarTasa(porPedido) {
    if (consultando) return;
    consultando = true;
    errorTasa = null;
    pintarTasa();
    var resultados = [pedirJSON(API_OFICIAL, 12000), pedirJSON(API_HISTORICO, 15000)].map(function (p) {
      return p.then(function (v) { return { ok: true, v: v }; }, function () { return { ok: false }; });
    });
    Promise.all(resultados).then(function (r) {
      var nuevos = [];
      if (r[0].ok) nuevos = nuevos.concat(L.leerOficial(r[0].v));
      if (r[1].ok) nuevos = nuevos.concat(L.leerHistorico(r[1].v).slice(-20));
      var validos = L.unirHistorial(nuevos, []);
      if (validos.length) {
        tasaGuardada = {
          historial: L.unirHistorial(tasaGuardada.historial, validos, 15),
          consultada: new Date().toISOString()
        };
        guardar(CLAVES.tasa, tasaGuardada);
        if (porPedido) avisar('Tasa actualizada.');
      } else {
        errorTasa = navigator.onLine === false ? 'sin-conexion' : 'fallo';
        if (porPedido) avisar(errorTasa === 'sin-conexion' ? 'No hay conexión a internet.' : 'No se pudo consultar la tasa. Intenta de nuevo en un rato.');
      }
    }).then(function () {
      consultando = false;
      pintarTodo();
    });
  }

  function tasaVieja() {
    return !tasaGuardada.consultada || (Date.now() - new Date(tasaGuardada.consultada)) > TASA_VIEJA_MS;
  }

  function pintarTasa() {
    var r = resumen();
    var enUso = tasaEnUso();
    var hoy = L.hoyCaracas();

    // Pastilla de la barra: siempre la tasa con la que se convierte.
    $('pildEtq').textContent = !enUso ? 'BCV' : enUso.origen === 'manual' ? 'Manual' :
      enUso.origen === 'proxima' ? 'BCV ' + L.fechaCorta(enUso.fecha).split(' ')[0] : 'BCV';
    $('pildValor').textContent = enUso ? L.formatear(enUso.valor, 2) : (consultando ? '…' : '—');

    // Tarjeta principal: la tasa vigente del BCV.
    if (r) {
      var partes = L.partirTasa(r.vigente.valor);
      $('tasaEnt').textContent = partes.ent;
      $('tasaCola').textContent = partes.cola;
      $('tasaCifra').setAttribute('aria-label', partes.completa + ' bolívares por dólar');
      $('tasaFecha').textContent = L.fechaLarga(r.vigente.fecha, hoy);
      if (r.cambio != null) {
        $('tasaCambio').hidden = false;
        $('tasaCambioTexto').textContent = L.textoCambio(r.cambio) + ' desde el ' + L.fechaCorta(r.anterior.fecha);
        $('tasaCambioIcono').setAttribute('href', r.cambio >= 0 ? '#i-subio' : '#i-bajo');
      } else {
        $('tasaCambio').hidden = true;
      }
    } else {
      $('tasaEnt').textContent = consultando ? '…' : '—';
      $('tasaCola').textContent = '';
      $('tasaCifra').removeAttribute('aria-label');
      $('tasaFecha').textContent = '—';
      $('tasaCambio').hidden = true;
    }
    $('tasaConsulta').textContent = consultando ? 'Consultando…' :
      tasaGuardada.consultada ? L.haceCuanto(tasaGuardada.consultada) : 'Todavía no';
    $('btnActualizar').classList.toggle('girando', consultando);

    var estado = $('tasaEstado');
    estado.classList.remove('alerta');
    if (!r && !consultando && errorTasa) {
      estado.textContent = 'No se pudo consultar la tasa. Revisa la conexión y toca actualizar, o escribe una tasa a mano en Ajustes.';
      estado.classList.add('alerta');
    } else if (r && errorTasa === 'sin-conexion') {
      estado.textContent = 'Sin conexión. Se muestra la última tasa guardada.';
    } else if (r && errorTasa) {
      estado.textContent = 'No se pudo actualizar. Se muestra la última tasa guardada.';
    } else if (ajustes.tasaManual && ajustes.valorTasaManual > 0) {
      estado.textContent = 'Para convertir estás usando una tasa escrita a mano: ' + L.formatear(ajustes.valorTasaManual, 2) + '. Puedes cambiarla en Ajustes.';
    } else {
      estado.textContent = '';
    }

    // La del próximo día hábil, cuando el BCV ya la publicó.
    var hayProxima = !!(r && r.proxima);
    $('proxima').hidden = !hayProxima;
    if (hayProxima) {
      $('proximaTitulo').textContent = 'Publicada para el ' + L.fechaLarga(r.proxima.fecha, hoy);
      $('proximaValor').textContent = L.formatear(r.proxima.valor, 4);
      var c = r.cambioProxima;
      $('proximaCambio').textContent = c == null ? '' : (c >= 0 ? '+' : '−') + L.formatear(Math.abs(c), 2) + ' %';
      $('usarProxima').checked = !!ajustes.usarProxima;
      $('usarProxima').disabled = !!ajustes.tasaManual;
    }
  }

  $('btnActualizar').addEventListener('click', function () { actualizarTasa(true); });
  $('pildTasa').addEventListener('click', function () { irA('tasa'); });
  $('usarProxima').addEventListener('change', function () {
    ajustes.usarProxima = this.checked;
    guardarAjustes();
    pintarTodo();
    avisar(this.checked ? 'Ahora conviertes con la tasa publicada para el próximo día hábil.' : 'Ahora conviertes con la tasa vigente.');
  });

  /* ================================================================ conversor */

  var cUsd = $('cUsd'), cBs = $('cBs');
  var ultimoConvertido = 'usd';

  function pintarConversor() {
    var t = tasaEnUso();
    $('convNota').textContent = t ? 'Con la ' + describirTasa(t) + '.' : 'Sin tasa todavía. Toca actualizar o escribe una tasa en Ajustes.';
    if (!t) return;
    if (ultimoConvertido === 'usd') {
      var u = valorDinero(cUsd);
      ponerDinero(cBs, isFinite(u) ? u * t.valor : NaN, 2);
    } else {
      var b = valorDinero(cBs);
      ponerDinero(cUsd, isFinite(b) ? b / t.valor : NaN, 2);
    }
  }

  campoDinero(cUsd, 2, function () { ultimoConvertido = 'usd'; pintarConversor(); });
  campoDinero(cBs, 2, function () { ultimoConvertido = 'bs'; pintarConversor(); });

  /* ================================================================ visitas */

  var formVisita = $('formVisita');
  var vNombre = $('vNombre'), vTel = $('vTel'), vMotivo = $('vMotivo');

  function ponerError(input, texto) {
    var p = $(input.id + 'Error');
    if (p) p.textContent = texto || '';
    if (texto) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  [vNombre, vTel, vMotivo].forEach(function (i) {
    i.addEventListener('input', function () { if (i.hasAttribute('aria-invalid')) ponerError(i, ''); });
  });
  vTel.addEventListener('blur', function () {
    if (!vTel.value.trim()) return;
    var t = L.normalizarTelefono(vTel.value, ajustes.codigoPais);
    ponerError(vTel, t.ok ? '' : t.mensaje);
  });

  function destinoActual(telVisitante) {
    if (ajustes.destino === 'fijo') {
      var f = L.normalizarTelefono(ajustes.numeroFijo, ajustes.codigoPais);
      return f.ok ? { ok: true, numero: f.intl } : { ok: false };
    }
    return { ok: true, numero: telVisitante };
  }

  function mensajeDe(v) {
    var d = new Date(v.fecha);
    var plantilla = ajustes.destino === 'fijo' ? ajustes.plantillaFijo : ajustes.plantillaVisitante;
    return L.llenarPlantilla(plantilla, {
      nombre: v.nombre,
      telefono: L.mostrarTelefono(v.telefono),
      motivo: v.motivo,
      fecha: L.fechaNumerica(d),
      hora: L.hora12(d)
    });
  }

  function abrirEnlace(url) {
    var a = doc.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    doc.body.appendChild(a);
    a.click();
    a.remove();
  }

  function enviarPorWhatsApp(v) {
    var destino = destinoActual(v.telefono);
    if (!destino.ok) {
      avisar('Falta el número que recibe las visitas.', 'Ponerlo', function () { abrirAjustes('aFijo'); });
      return false;
    }
    abrirEnlace(L.enlaceWhatsApp(destino.numero, mensajeDe(v)));
    return true;
  }

  formVisita.addEventListener('submit', function (e) {
    e.preventDefault();
    var nombre = vNombre.value.trim().replace(/\s+/g, ' ');
    var tel = L.normalizarTelefono(vTel.value, ajustes.codigoPais);
    var motivo = vMotivo.value.trim();
    ponerError(vNombre, nombre ? '' : 'Escribe el nombre.');
    ponerError(vTel, tel.ok ? '' : tel.mensaje);
    ponerError(vMotivo, motivo ? '' : 'Escribe el motivo de la visita.');
    var primero = !nombre ? vNombre : !tel.ok ? vTel : !motivo ? vMotivo : null;
    if (primero) { primero.focus(); return; }

    if (!destinoActual(tel.intl).ok) {
      avisar('Falta el número que recibe las visitas.', 'Ponerlo', function () { abrirAjustes('aFijo'); });
      return;
    }
    var visita = { id: idNuevo(), nombre: nombre, telefono: tel.intl, motivo: motivo, fecha: new Date().toISOString() };
    visitas.unshift(visita);
    if (!guardar(CLAVES.visitas, visitas)) { visitas.shift(); return; }
    pedirPersistencia();
    enviarPorWhatsApp(visita);
    formVisita.reset();
    pintarVisitas();
    pintarChips();
    avisar('Visita guardada. En WhatsApp, toca Enviar.');
  });

  function pintarDestino() {
    var texto, boton = 'Cambiar';
    if (ajustes.destino === 'fijo') {
      var f = L.normalizarTelefono(ajustes.numeroFijo, ajustes.codigoPais);
      if (f.ok) texto = 'Se envía al ' + L.mostrarTelefono(f.intl) + '.';
      else { texto = 'Falta el número que recibe las visitas.'; boton = 'Ponerlo'; }
    } else {
      texto = 'Se envía al teléfono del visitante.';
    }
    $('destinoTexto').textContent = texto;
    $('btnDestino').textContent = boton;
  }
  $('btnDestino').addEventListener('click', function () { abrirAjustes(ajustes.destino === 'fijo' ? 'aFijo' : null); });

  function pintarChips() {
    var vistos = {}, motivos = [];
    for (var i = 0; i < visitas.length && motivos.length < 4; i++) {
      var m = visitas[i].motivo.split('\n')[0].trim();
      var clave = m.toLowerCase();
      if (m && m.length <= 40 && !vistos[clave]) { vistos[clave] = true; motivos.push(m); }
    }
    if (!motivos.length) motivos = MOTIVOS_BASE;
    var caja = $('chipsMotivo');
    caja.textContent = '';
    motivos.forEach(function (m) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'chip';
      b.textContent = m;
      b.addEventListener('click', function () {
        vMotivo.value = m;
        ponerError(vMotivo, '');
        vMotivo.focus();
      });
      caja.appendChild(b);
    });
  }

  function sinAcentos(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function svgIcono(id) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = doc.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'ic');
    svg.setAttribute('aria-hidden', 'true');
    var use = doc.createElementNS(ns, 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function el(etiqueta, clase, texto) {
    var e = doc.createElement(etiqueta);
    if (clase) e.className = clase;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function tituloDia(clave, hoyClave, ayerClave) {
    if (clave === hoyClave) return 'Hoy';
    if (clave === ayerClave) return 'Ayer';
    var t = L.fechaLarga(clave, hoyClave);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function pintarVisitas() {
    var cont = $('listaVisitas');
    var busqueda = sinAcentos($('buscarVisita').value.trim());
    $('cajaBuscar').hidden = visitas.length < 6;
    if (visitas.length < 6 && $('buscarVisita').value) { $('buscarVisita').value = ''; busqueda = ''; }
    var filtradas = !busqueda ? visitas : visitas.filter(function (v) {
      return sinAcentos(v.nombre + ' ' + v.motivo + ' ' + v.telefono + ' ' + L.mostrarTelefono(v.telefono)).indexOf(busqueda) >= 0;
    });
    var mostradas = filtradas.slice(0, MAX_VISITAS_EN_PANTALLA);
    cont.textContent = '';

    var ahora = new Date();
    var hoyClave = L.claveDia(ahora);
    var ayer = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1);
    var ayerClave = L.claveDia(ayer);

    var grupos = [], porDia = {};
    mostradas.forEach(function (v) {
      var clave = L.claveDia(new Date(v.fecha));
      if (!porDia[clave]) { porDia[clave] = []; grupos.push(clave); }
      porDia[clave].push(v);
    });

    grupos.forEach(function (clave) {
      var dia = el('section', 'dia');
      var h = el('h3', 'dia-titulo', tituloDia(clave, hoyClave, ayerClave));
      var n = porDia[clave].length;
      h.appendChild(el('span', null, n === 1 ? '1 visita' : n + ' visitas'));
      dia.appendChild(h);
      var ul = el('ul', 'panel lista');
      porDia[clave].forEach(function (v) {
        var li = el('li', 'visita');
        li.dataset.id = v.id;
        li.appendChild(el('p', 'v-nombre', v.nombre));
        var hora = el('time', 'v-hora', L.hora12(new Date(v.fecha)));
        hora.setAttribute('datetime', v.fecha);
        li.appendChild(hora);
        li.appendChild(el('p', 'v-motivo', v.motivo));
        var tel = el('a', 'v-tel', L.mostrarTelefono(v.telefono));
        tel.href = 'tel:+' + v.telefono;
        tel.setAttribute('aria-label', 'Llamar a ' + v.nombre + ', ' + L.mostrarTelefono(v.telefono));
        li.appendChild(tel);
        var acciones = el('div', 'v-acciones');
        var reenviar = el('button', 'icono wa');
        reenviar.type = 'button';
        reenviar.dataset.accion = 'reenviar';
        reenviar.setAttribute('aria-label', 'Enviar de nuevo por WhatsApp la visita de ' + v.nombre);
        reenviar.appendChild(svgIcono('i-enviar'));
        var borrar = el('button', 'icono');
        borrar.type = 'button';
        borrar.dataset.accion = 'borrar';
        borrar.setAttribute('aria-label', 'Borrar la visita de ' + v.nombre);
        borrar.appendChild(svgIcono('i-borrar'));
        acciones.appendChild(reenviar);
        acciones.appendChild(borrar);
        li.appendChild(acciones);
        ul.appendChild(li);
      });
      dia.appendChild(ul);
      cont.appendChild(dia);
    });

    if (filtradas.length > mostradas.length) {
      cont.appendChild(el('p', 'mas-visitas',
        'Se muestran las ' + MAX_VISITAS_EN_PANTALLA + ' más recientes de ' + filtradas.length + '. Busca por nombre o exporta el registro para ver todas.'));
    }

    var vacio = $('vacioVisitas');
    vacio.hidden = filtradas.length > 0;
    vacio.textContent = visitas.length && busqueda ?
      'Ninguna visita coincide con «' + $('buscarVisita').value.trim() + '».' :
      'Aún no hay visitas. Cada visita que guardes aparece aquí, la más reciente arriba.';
  }

  $('buscarVisita').addEventListener('input', pintarVisitas);

  $('listaVisitas').addEventListener('click', function (e) {
    var boton = e.target.closest('button[data-accion]');
    if (!boton) return;
    var id = boton.closest('li').dataset.id;
    var i = visitas.findIndex(function (v) { return v.id === id; });
    if (i < 0) return;
    var v = visitas[i];
    if (boton.dataset.accion === 'reenviar') {
      if (enviarPorWhatsApp(v)) avisar('Mensaje listo en WhatsApp. Toca Enviar.');
    } else {
      visitas.splice(i, 1);
      guardar(CLAVES.visitas, visitas);
      pintarVisitas();
      pintarChips();
      avisar('Visita de ' + v.nombre + ' borrada.', 'Deshacer', function () {
        visitas.splice(Math.min(i, visitas.length), 0, v);
        guardar(CLAVES.visitas, visitas);
        pintarVisitas();
        pintarChips();
      });
    }
  });

  function compartirArchivo(nombre, contenido, tipo) {
    var blob = new Blob([contenido], { type: tipo });
    try {
      var archivo = new File([blob], nombre, { type: tipo });
      if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
        return navigator.share({ files: [archivo], title: nombre }).catch(function (err) {
          if (err && err.name === 'AbortError') return;
          descargar(blob, nombre);
        });
      }
    } catch (e) {}
    descargar(blob, nombre);
    return Promise.resolve();
  }

  function descargar(blob, nombre) {
    var url = URL.createObjectURL(blob);
    var a = doc.createElement('a');
    a.href = url;
    a.download = nombre;
    doc.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    avisar('Registro descargado: ' + nombre);
  }

  $('btnExportar').addEventListener('click', function () {
    if (!visitas.length) { avisar('Todavía no hay visitas para exportar.'); return; }
    var nombre = 'visitas-' + L.claveDia(new Date()) + '.csv';
    compartirArchivo(nombre, '﻿' + L.visitasCSV(visitas), 'text/csv');
  });

  // Elegir de los contactos del teléfono (Chrome en Android).
  var hayContactos = 'contacts' in navigator && navigator.contacts && 'select' in navigator.contacts;
  $('btnContacto').hidden = !hayContactos;
  if (hayContactos) {
    $('btnContacto').addEventListener('click', function () {
      navigator.contacts.select(['name', 'tel'], { multiple: false }).then(function (r) {
        var c = r && r[0];
        if (!c) return;
        if (c.name && c.name[0]) { vNombre.value = c.name[0]; ponerError(vNombre, ''); }
        if (c.tel && c.tel[0]) { vTel.value = c.tel[0]; ponerError(vTel, ''); }
        (vMotivo.value ? vNombre : vMotivo).focus();
      }).catch(function () {});
    });
  }

  /* ================================================================ calculadora */

  var calc = { expr: '', moneda: 'usd', anterior: '', recienIgual: false };

  function pintarCalc() {
    var r = L.calcular(calc.expr);
    var t = tasaEnUso();
    var res = $('calcRes'), num = $('calcNum');
    $('calcExpr').textContent = calc.recienIgual ? calc.anterior + ' =' : L.mostrarExpresion(calc.expr);
    $('calcMoneda').textContent = calc.moneda === 'usd' ? '$' : 'Bs.';
    res.classList.remove('largo', 'muy-largo', 'aviso-calc');
    $('calcMoneda').hidden = false;

    var valor = calc.expr ? r : 0;
    if (calc.expr && !isFinite(r) && !isNaN(r)) {
      num.textContent = 'No se puede dividir entre cero';
      res.classList.add('aviso-calc');
      $('calcMoneda').hidden = true;
      valor = NaN;
    } else if (calc.expr && Math.abs(r) >= 1e15) {
      num.textContent = 'Número demasiado grande';
      res.classList.add('aviso-calc');
      $('calcMoneda').hidden = true;
      valor = NaN;
    } else if (!calc.expr || isNaN(r)) {
      num.textContent = calc.expr === '-' ? '−' : '0';
      valor = calc.expr ? NaN : 0;
    } else {
      // Dinero: 41 → "41", 45,1 → "45,10"; montos menores que 1 con hasta 4 decimales.
      var texto = Math.abs(r) < 1 && r !== 0 ? L.formatearLibre(r, 4) :
        L.redondear(r, 2) % 1 === 0 ? L.formatearLibre(r, 2) : L.formatear(r, 2);
      num.textContent = texto;
      if (texto.length > 15) res.classList.add('muy-largo');
      else if (texto.length > 10) res.classList.add('largo');
    }

    var conv = $('calcConv');
    if (isFinite(valor) && valor !== 0 && t) {
      conv.textContent = calc.moneda === 'usd' ? '= ' + L.dinero(valor * t.valor, 'bs') : '= ' + L.dinero(valor / t.valor, 'usd');
    } else if (!t) {
      conv.textContent = 'Sin tasa para convertir';
    } else {
      conv.textContent = '';
    }

    // Fijar en Precios (siempre en dólares).
    var usd = !isFinite(valor) || valor <= 0 ? NaN : calc.moneda === 'usd' ? valor : t ? valor / t.valor : NaN;
    var btn = $('btnFijar');
    btn.disabled = !(usd > 0);
    btn.dataset.usd = usd > 0 ? String(L.redondear(usd, 2)) : '';
    btn.setAttribute('aria-label', usd > 0 ? 'Fijar ' + L.dinero(usd, 'usd') + ' en Precios' : 'Fijar en Precios');
  }

  function tecla(t) {
    if (t === '=') {
      var r = L.calcular(calc.expr);
      if (calc.expr && isFinite(r)) {
        calc.anterior = L.mostrarExpresion(calc.expr.replace(/[+\-*/.]+$/, ''));
        calc.expr = L.resultadoComoExpresion(r);
        calc.recienIgual = true;
      }
    } else {
      // Después de "=", un número empieza un cálculo nuevo; un operador sigue con el resultado.
      if (calc.recienIgual && (/^\d$/.test(t) || t === '00' || t === '.')) calc.expr = '';
      calc.recienIgual = false;
      calc.expr = L.teclaCalc(calc.expr, t);
    }
    pintarCalc();
  }

  $('teclado').addEventListener('click', function (e) {
    var b = e.target.closest('.tecla');
    if (b) tecla(b.dataset.t);
  });

  doc.querySelectorAll('.pantalla .segmentado button').forEach(function (b) {
    b.addEventListener('click', function () {
      calc.moneda = b.dataset.moneda;
      doc.querySelectorAll('.pantalla .segmentado button').forEach(function (o) {
        o.setAttribute('aria-checked', String(o === b));
      });
      pintarCalc();
    });
  });

  // Teclado físico (computadora o teclado bluetooth).
  var MAPA_TECLAS = { Enter: '=', '=': '=', Backspace: 'borrar', Delete: 'C', Escape: 'C', ',': '.', '.': '.', x: '*', X: '*' };
  doc.addEventListener('keydown', function (e) {
    if (vistaActual !== 'calc' || pila.length || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea')) return;
    var t = MAPA_TECLAS[e.key] || (/^[\d+\-*/%]$/.test(e.key) ? e.key : null);
    if (!t) return;
    e.preventDefault();
    tecla(t);
  });

  $('btnFijar').addEventListener('click', function () {
    var usd = Number(this.dataset.usd);
    if (!(usd > 0)) return;
    var p = { id: idNuevo(), nombre: '', usd: usd, creado: new Date().toISOString() };
    precios.unshift(p);
    if (!guardar(CLAVES.precios, precios)) { precios.shift(); return; }
    pedirPersistencia();
    pintarPrecios();
    irA('precios');
    abrirEdicion(p.id, true);
  });

  /* ================================================================ precios */

  var pUsd = $('pUsd'), pNombre = $('pNombre');

  function previaBs(usd) {
    var t = tasaEnUso();
    if (!(usd > 0) || !t) return '';
    return '= ' + L.dinero(usd * t.valor, 'bs');
  }

  campoDinero(pUsd, 2, function (v) {
    $('pPrevia').textContent = previaBs(v);
    $('pError').textContent = '';
    pUsd.removeAttribute('aria-invalid');
  });

  $('formPrecio').addEventListener('submit', function (e) {
    e.preventDefault();
    var usd = valorDinero(pUsd);
    if (!(usd > 0)) {
      $('pError').textContent = 'Escribe el precio en dólares.';
      pUsd.setAttribute('aria-invalid', 'true');
      pUsd.focus();
      return;
    }
    var p = { id: idNuevo(), nombre: pNombre.value.trim(), usd: usd, creado: new Date().toISOString() };
    precios.unshift(p);
    if (!guardar(CLAVES.precios, precios)) { precios.shift(); return; }
    pedirPersistencia();
    this.reset();
    pUsd.dataset.previo = '';
    $('pPrevia').textContent = '';
    pintarPrecios();
    avisar('Precio fijado.');
    pNombre.focus();
  });

  function pintarPrecios() {
    var t = tasaEnUso();
    var ul = $('listaPrecios');
    ul.textContent = '';
    ul.hidden = !precios.length;
    $('vacioPrecios').hidden = precios.length > 0;
    $('btnCompartir').hidden = !precios.length;
    $('preciosNota').textContent = !precios.length ? '' :
      t ? 'Convertidos con la ' + describirTasa(t) + '. Toca un precio para cambiarlo.' :
      'Sin tasa todavía: los bolívares aparecen cuando se consulte la tasa.';

    precios.forEach(function (p, i) {
      var li = doc.createElement('li');
      var b = el('button', 'precio');
      b.type = 'button';
      b.dataset.id = p.id;
      var nombre = p.nombre || 'Precio sin nombre';
      b.appendChild(el('span', 'precio-nombre' + (p.nombre ? '' : ' sin-nombre'), nombre));
      b.appendChild(el('span', 'precio-usd', L.dinero(p.usd, 'usd')));
      var bs = el('span', 'precio-bs', t ? L.formatear(p.usd * t.valor, 2) : '—');
      bs.insertBefore(el('small', null, 'Bs.'), bs.firstChild);
      b.appendChild(bs);
      b.setAttribute('aria-label', nombre + ': ' + L.dinero(p.usd, 'usd') + (t ? ', ' + L.dinero(p.usd * t.valor, 'bs') : '') + '. Editar');
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  $('listaPrecios').addEventListener('click', function (e) {
    var b = e.target.closest('.precio');
    if (b) abrirEdicion(b.dataset.id, false);
  });

  var editando = null;
  var ePUsd = $('ePUsd'), ePNombre = $('ePNombre');
  campoDinero(ePUsd, 2, function (v) {
    $('ePPrevia').textContent = previaBs(v);
    $('ePError').textContent = '';
    ePUsd.removeAttribute('aria-invalid');
  });

  function abrirEdicion(id, recienFijado) {
    var p = precios.find(function (x) { return x.id === id; });
    if (!p) return;
    editando = p.id;
    $('tPrecio').textContent = recienFijado ? 'Ponle nombre al precio' : 'Editar precio';
    ePNombre.value = p.nombre || '';
    ponerDinero(ePUsd, p.usd, 2);
    $('ePPrevia').textContent = previaBs(p.usd);
    $('ePError').textContent = '';
    ePUsd.removeAttribute('aria-invalid');
    abrirHoja($('hojaPrecio'));
    (recienFijado ? ePNombre : ePUsd).focus();
  }

  $('formEditarPrecio').addEventListener('submit', function (e) {
    if (!e.submitter || e.submitter.value !== 'guardar') return;   // cerrar sin guardar
    var usd = valorDinero(ePUsd);
    if (!(usd > 0)) {
      e.preventDefault();
      $('ePError').textContent = 'Escribe el precio en dólares.';
      ePUsd.setAttribute('aria-invalid', 'true');
      ePUsd.focus();
      return;
    }
    var p = precios.find(function (x) { return x.id === editando; });
    if (!p) return;
    p.nombre = ePNombre.value.trim();
    p.usd = usd;
    guardar(CLAVES.precios, precios);
    pintarPrecios();
  });

  $('btnBorrarPrecio').addEventListener('click', function () {
    var i = precios.findIndex(function (x) { return x.id === editando; });
    $('hojaPrecio').close('borrar');
    if (i < 0) return;
    var p = precios.splice(i, 1)[0];
    guardar(CLAVES.precios, precios);
    pintarPrecios();
    avisar('Precio borrado.', 'Deshacer', function () {
      precios.splice(Math.min(i, precios.length), 0, p);
      guardar(CLAVES.precios, precios);
      pintarPrecios();
    });
  });

  $('btnCompartir').addEventListener('click', function () {
    if (!precios.length) return;
    var t = tasaEnUso();
    var lineas = ['*Lista de precios*'];
    if (t) {
      lineas.push(t.origen === 'manual' ? 'Tasa: Bs. ' + L.formatear(t.valor, 2) + ' por dólar' :
        'Tasa BCV: Bs. ' + L.formatear(t.valor, 2) + ' por dólar (' + L.fechaLarga(t.fecha, L.hoyCaracas()) + ')');
    }
    lineas.push('');
    precios.forEach(function (p, i) {
      var nombre = p.nombre || 'Precio ' + (i + 1);
      lineas.push('• ' + nombre + ': ' + L.dinero(p.usd, 'usd') + (t ? ' = ' + L.dinero(p.usd * t.valor, 'bs') : ''));
    });
    var texto = lineas.join('\n');
    if (navigator.share) {
      navigator.share({ text: texto }).catch(function (err) {
        if (!err || err.name !== 'AbortError') abrirEnlace(L.enlaceWhatsApp('', texto));
      });
    } else {
      abrirEnlace(L.enlaceWhatsApp('', texto));
    }
  });

  /* ================================================================ ajustes */

  var hojaAjustes = $('hojaAjustes');
  var aPlantilla = $('aPlantilla'), aFijo = $('aFijo'), aCodigo = $('aCodigo'), aTasaManual = $('aTasaManual');

  function pintarAjustes() {
    doc.querySelectorAll('input[name="destino"]').forEach(function (r) { r.checked = r.value === ajustes.destino; });
    doc.querySelectorAll('input[name="tema"]').forEach(function (r) { r.checked = r.value === ajustes.tema; });
    $('campoFijo').hidden = ajustes.destino !== 'fijo';
    aFijo.value = ajustes.numeroFijo || '';
    aPlantilla.value = ajustes.destino === 'fijo' ? ajustes.plantillaFijo : ajustes.plantillaVisitante;
    $('aPlantillaEtq').textContent = ajustes.destino === 'fijo' ? 'Mensaje para el número fijo' : 'Mensaje para el visitante';
    aCodigo.value = ajustes.codigoPais;
    $('aManual').checked = !!ajustes.tasaManual;
    $('campoManual').hidden = !ajustes.tasaManual;
    ponerDinero(aTasaManual, ajustes.valorTasaManual > 0 ? ajustes.valorTasaManual : NaN, 4);
    ponerErrorAjuste(aFijo, '');
  }

  function ponerErrorAjuste(input, texto) {
    var ayuda = $(input.id + 'Ayuda');
    if (!ayuda.dataset.base) ayuda.dataset.base = ayuda.textContent;
    ayuda.textContent = texto || ayuda.dataset.base;
    ayuda.classList.toggle('error', !!texto);
    if (texto) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  function abrirAjustes(enfocar) {
    pintarAjustes();
    abrirHoja(hojaAjustes);
    if (enfocar && $(enfocar)) $(enfocar).focus();
  }
  $('btnAjustes').addEventListener('click', function () { abrirAjustes(null); });

  doc.querySelectorAll('input[name="destino"]').forEach(function (r) {
    r.addEventListener('change', function () {
      ajustes.destino = r.value;
      guardarAjustes();
      pintarAjustes();
      pintarDestino();
    });
  });
  doc.querySelectorAll('input[name="tema"]').forEach(function (r) {
    r.addEventListener('change', function () {
      ajustes.tema = r.value;
      guardarAjustes();
      aplicarTema();
    });
  });
  aFijo.addEventListener('input', function () {
    ajustes.numeroFijo = aFijo.value.trim();
    guardarAjustes();
    pintarDestino();
    if (aFijo.hasAttribute('aria-invalid') && L.normalizarTelefono(aFijo.value, ajustes.codigoPais).ok) ponerErrorAjuste(aFijo, '');
  });
  aFijo.addEventListener('blur', function () {
    if (!aFijo.value.trim()) return;
    var t = L.normalizarTelefono(aFijo.value, ajustes.codigoPais);
    ponerErrorAjuste(aFijo, t.ok ? '' : t.mensaje);
  });
  aPlantilla.addEventListener('input', function () {
    if (ajustes.destino === 'fijo') ajustes.plantillaFijo = aPlantilla.value;
    else ajustes.plantillaVisitante = aPlantilla.value;
    guardarAjustes();
  });
  $('btnPlantillaBase').addEventListener('click', function () {
    if (ajustes.destino === 'fijo') ajustes.plantillaFijo = PLANTILLA_FIJO;
    else ajustes.plantillaVisitante = PLANTILLA_VISITANTE;
    guardarAjustes();
    pintarAjustes();
  });
  aCodigo.addEventListener('input', function () {
    aCodigo.value = aCodigo.value.replace(/\D/g, '');
    ajustes.codigoPais = aCodigo.value || '58';
    guardarAjustes();
    pintarDestino();
  });
  $('aManual').addEventListener('change', function () {
    ajustes.tasaManual = this.checked;
    guardarAjustes();
    $('campoManual').hidden = !this.checked;
    if (this.checked) aTasaManual.focus();
    pintarTodo();
  });
  campoDinero(aTasaManual, 4, function (v) {
    ajustes.valorTasaManual = v > 0 ? v : null;
    guardarAjustes();
    pintarTodo();
  });

  $('btnBorrarVisitas').addEventListener('click', function () {
    if (!visitas.length) { avisar('No hay visitas que borrar.'); return; }
    var n = visitas.length;
    confirmar('¿Borrar las ' + n + (n === 1 ? ' visita' : ' visitas') + ' del registro? Esto no se puede deshacer.', 'Borrar todo').then(function (si) {
      if (!si) return;
      visitas = [];
      guardar(CLAVES.visitas, visitas);
      pintarVisitas();
      pintarChips();
      avisar(n === 1 ? 'Se borró 1 visita.' : 'Se borraron ' + n + ' visitas.');
    });
  });

  // Instalar como app (Chrome muestra el aviso cuando la página cumple los requisitos).
  var eventoInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    eventoInstalar = e;
    $('btnInstalar').hidden = false;
  });
  $('btnInstalar').addEventListener('click', function () {
    if (!eventoInstalar) return;
    eventoInstalar.prompt();
    eventoInstalar.userChoice.then(function () { eventoInstalar = null; $('btnInstalar').hidden = true; });
  });
  window.addEventListener('appinstalled', function () { $('btnInstalar').hidden = true; });

  /* ================================================================ pestañas */

  var VISTAS = ['visitas', 'tasa', 'calc', 'precios'];
  var vistaActual = 'visitas';
  var desplazamientos = {};
  var gota = $('gota');
  var primeraVista = true;

  function irA(vista) {
    if (VISTAS.indexOf(vista) < 0) vista = 'visitas';
    var cambio = vista !== vistaActual;
    desplazamientos[vistaActual] = window.scrollY;
    VISTAS.forEach(function (v) {
      var activa = v === vista;
      $('vista-' + v).hidden = !activa;
      var tab = $('tab-' + v);
      tab.setAttribute('aria-selected', String(activa));
      tab.tabIndex = activa ? 0 : -1;
    });
    if (primeraVista) gota.style.transition = 'none';
    $('pestanas').style.setProperty('--i', String(VISTAS.indexOf(vista)));
    if (primeraVista) {
      void gota.offsetWidth;
      gota.style.transition = '';
      primeraVista = false;
    } else if (cambio) {
      gota.classList.remove('estirando');
      void gota.offsetWidth;
      gota.classList.add('estirando');
    }
    vistaActual = vista;
    window.scrollTo(0, desplazamientos[vista] || 0);
    try { sessionStorage.setItem('mostrador.vista', vista); } catch (e) {}
    if (vista === 'tasa') {
      pintarTasa();
      if (tasaVieja()) actualizarTasa(false);
    }
  }

  gota.addEventListener('animationend', function () { gota.classList.remove('estirando'); });

  $('pestanas').addEventListener('click', function (e) {
    var b = e.target.closest('[role="tab"]');
    if (b) irA(b.dataset.vista);
  });
  $('pestanas').addEventListener('keydown', function (e) {
    var i = VISTAS.indexOf(vistaActual);
    var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? VISTAS.length - 1 : null;
    if (j == null) return;
    e.preventDefault();
    j = (j + VISTAS.length) % VISTAS.length;
    irA(VISTAS[j]);
    $('tab-' + VISTAS[j]).focus();
  });

  /* ================================================================ arranque */

  function pintarTodo() {
    pintarTasa();
    pintarConversor();
    pintarCalc();
    pintarPrecios();
    pintarDestino();
  }

  aplicarTema();
  pintarTodo();
  pintarVisitas();
  pintarChips();
  var vistaGuardada = null;
  try { vistaGuardada = sessionStorage.getItem('mostrador.vista'); } catch (e) {}
  var desdeEnlace = (location.hash || '').slice(1);
  irA(VISTAS.indexOf(desdeEnlace) >= 0 ? desdeEnlace : (vistaGuardada || 'visitas'));
  if (tasaVieja()) actualizarTasa(false);

  doc.addEventListener('visibilitychange', function () {
    if (doc.visibilityState === 'visible') {
      if (tasaVieja()) actualizarTasa(false);
      else pintarTodo();
    }
  });
  window.addEventListener('online', function () { if (errorTasa) actualizarTasa(false); });
  // "Consultada hace X min" se mantiene al día mientras la app está abierta.
  setInterval(function () { if (doc.visibilityState === 'visible' && vistaActual === 'tasa') pintarTasa(); }, 60000);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
})();
