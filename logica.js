/* Mostrador — lógica pura, sin pantalla.
   La usa la app (window.MostradorLogica) y también las pruebas de Node (module.exports).
   Convención de números: en pantalla "1.234,56" (punto de miles, coma decimal);
   por dentro, Number de JavaScript. */
(function (raiz) {
  'use strict';

  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
    'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* ---------------------------------------------------------------- números */

  /** Agrupa los miles de una cadena de dígitos: "1234567" → "1.234.567". */
  function agrupar(digitos) {
    return digitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /**
   * Redondeo decimal "hacia arriba desde el 5", sin el error de coma flotante:
   * 10 × 896,1225 da 8961,224999999999 en binario y debe mostrarse 8.961,23.
   */
  function redondear(n, d) {
    var limpio = Number(n.toPrecision(15));
    var s = String(Math.abs(limpio));
    if (/e/i.test(s)) return Number(limpio.toFixed(d));
    var r = Number(Math.round(Number(s + 'e' + d)) + 'e-' + d);
    return limpio < 0 ? -r : r;
  }

  /** 1234.5 → "1.234,50" (decimales fijos). */
  function formatear(n, decimales) {
    if (typeof n !== 'number' || !isFinite(n) || Math.abs(n) >= 1e15) return '—';
    var d = decimales == null ? 2 : decimales;
    var neg = n < 0;
    var partes = redondear(Math.abs(n), d).toFixed(d).split('.');
    var texto = agrupar(partes[0]) + (partes[1] ? ',' + partes[1] : '');
    return (neg && Number(partes.join('')) !== 0 ? '-' : '') + texto;
  }

  /** Como formatear, pero sin ceros sobrantes: 41 → "41", 3.5 → "3,5". Máximo `max` decimales. */
  function formatearLibre(n, max) {
    if (typeof n !== 'number' || !isFinite(n) || Math.abs(n) >= 1e15) return '—';
    var m = max == null ? 4 : max;
    var texto = formatear(n, m);
    if (m > 0) texto = texto.replace(/,?0+$/, '');
    return texto === '-0' ? '0' : texto;
  }

  function dinero(n, moneda) {
    var cifra = formatear(n, 2);
    return moneda === 'bs' ? 'Bs. ' + cifra : '$ ' + cifra;
  }

  /** Tasa BCV con 4 decimales, partida para la tipografía: { ent: "896,12", cola: "25" }. */
  function partirTasa(n) {
    var t = formatear(n, 4);
    return { ent: t.slice(0, -2), cola: t.slice(-2), completa: t };
  }

  /**
   * Lee lo que escribe una persona: "1.234,56", "1234.56", "12,5", "$ 10", "Bs. 8.961".
   * Regla: si hay coma y punto, el último que aparece es el decimal. Si solo hay uno de
   * los dos y aparece una sola vez, es el decimal. Si se repite, son separadores de miles.
   */
  function leerNumero(texto) {
    if (typeof texto === 'number') return isFinite(texto) ? texto : NaN;
    if (texto == null) return NaN;
    var s = String(texto).replace(/bs\.?|\$|\s/gi, '');
    if (!s) return NaN;
    var neg = false;
    if (s[0] === '-' || s[0] === '−') { neg = true; s = s.slice(1); }
    if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return NaN;
    var coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
    var decimal = null;
    if (coma >= 0 && punto >= 0) decimal = coma > punto ? ',' : '.';
    else if (coma >= 0) decimal = s.indexOf(',') === coma ? ',' : null;
    else if (punto >= 0) decimal = s.indexOf('.') === punto ? '.' : null;
    var entero = s, frac = '';
    if (decimal) {
      var i = s.lastIndexOf(decimal);
      entero = s.slice(0, i);
      frac = s.slice(i + 1);
      if (/[.,]/.test(frac) || entero.indexOf(decimal) >= 0) return NaN;
    }
    entero = entero.replace(/[.,]/g, '');
    var n = Number((entero || '0') + (frac ? '.' + frac : ''));
    return neg ? -n : n;
  }

  /**
   * Formato en vivo de un campo de dinero mientras se escribe.
   * En el campo, el punto siempre es de miles (lo pone la app) y la coma es el decimal.
   * Devuelve { texto, valor }.
   */
  function formatearEntrada(crudo, maxDecimales) {
    var maxD = maxDecimales == null ? 2 : maxDecimales;
    var s = String(crudo || '').replace(/[^\d,]/g, '');
    var i = s.indexOf(',');
    var entero = i >= 0 ? s.slice(0, i) : s;
    var frac = i >= 0 ? s.slice(i + 1).replace(/,/g, '').slice(0, maxD) : '';
    entero = entero.replace(/^0+(?=\d)/, '');
    if (entero.length > 13) entero = entero.slice(0, 13);
    var hayComa = i >= 0 && maxD > 0;
    if (!entero && hayComa) entero = '0';
    var texto = agrupar(entero) + (hayComa ? ',' + frac : '');
    var valor = entero || frac ? Number((entero || '0') + '.' + (frac || '0')) : NaN;
    return { texto: texto, valor: valor };
  }

  /* --------------------------------------------------------------- teléfono */

  /**
   * Convierte lo que se escribió en el número internacional que pide WhatsApp (solo dígitos).
   * "0414-123.45.67" → "584141234567" con código 58.
   */
  function normalizarTelefono(texto, codigoPais) {
    var cp = String(codigoPais || '58').replace(/\D/g, '') || '58';
    var crudo = String(texto || '').trim();
    var digitos = crudo.replace(/\D/g, '');
    if (!digitos) return { ok: false, intl: '', mensaje: 'Escribe el teléfono.' };
    var intl;
    if (crudo[0] === '+') intl = digitos;
    else if (digitos.indexOf('00') === 0) intl = digitos.slice(2);
    else if (digitos[0] === '0') intl = cp + digitos.replace(/^0+/, '');
    else if (digitos.indexOf(cp) === 0 && digitos.length >= cp.length + 9) intl = digitos;
    else intl = cp + digitos;

    if (intl.indexOf('58') === 0) {
      if (intl.length !== 12) {
        return { ok: false, intl: intl, mensaje: 'En Venezuela son 11 dígitos, por ejemplo 0414 123 4567.' };
      }
    } else if (intl.length < 8 || intl.length > 15) {
      return { ok: false, intl: intl, mensaje: 'El número no parece completo. Revísalo con el código de país.' };
    }
    return { ok: true, intl: intl, mensaje: '' };
  }

  /** "584141234567" → "0414-1234567"; otros países: "+57 3001234567". */
  function mostrarTelefono(intl) {
    var d = String(intl || '').replace(/\D/g, '');
    if (d.indexOf('58') === 0 && d.length === 12) return '0' + d.slice(2, 5) + '-' + d.slice(5);
    return d ? '+' + d : '';
  }

  /* --------------------------------------------------------------- WhatsApp */

  function llenarPlantilla(plantilla, datos) {
    return String(plantilla || '').replace(/\{\s*(\w+)\s*\}/g, function (todo, clave) {
      var k = clave.toLowerCase();
      return Object.prototype.hasOwnProperty.call(datos, k) ? String(datos[k]) : todo;
    });
  }

  function enlaceWhatsApp(numeroIntl, texto) {
    var num = String(numeroIntl || '').replace(/\D/g, '');
    return 'https://wa.me/' + num + '?text=' + encodeURIComponent(texto || '');
  }

  /* ------------------------------------------------------------------ fechas */

  function fechaLocalDeISO(iso) {
    var p = String(iso).slice(0, 10).split('-');
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }

  /** "2026-11-06" → "viernes 6 de noviembre" (+ año si no es el actual). */
  function fechaLarga(iso, hoyISO) {
    var f = fechaLocalDeISO(iso);
    if (isNaN(f)) return '';
    var txt = DIAS[f.getDay()] + ' ' + f.getDate() + ' de ' + MESES[f.getMonth()];
    if (hoyISO && String(hoyISO).slice(0, 4) !== String(iso).slice(0, 4)) txt += ' de ' + f.getFullYear();
    return txt;
  }

  /** "2026-11-06" → "vie 6 nov" */
  function fechaCorta(iso) {
    var f = fechaLocalDeISO(iso);
    if (isNaN(f)) return '';
    return DIAS[f.getDay()].slice(0, 3) + ' ' + f.getDate() + ' ' + MESES[f.getMonth()].slice(0, 3);
  }

  /** "2024-03-15" → "15 mar 2024"; si es del año de hoyISO, sin año: "6 nov". */
  function fechaBreve(iso, hoyISO) {
    var f = fechaLocalDeISO(iso);
    if (isNaN(f)) return '';
    var txt = f.getDate() + ' ' + MESES[f.getMonth()].slice(0, 3);
    if (!hoyISO || String(hoyISO).slice(0, 4) !== String(iso).slice(0, 4)) txt += ' ' + f.getFullYear();
    return txt;
  }

  /** Fecha de hoy en Caracas como "AAAA-MM-DD". */
  function hoyCaracas(ahora) {
    var d = ahora || new Date();
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(d);
    } catch (e) {
      return claveDia(d);
    }
  }

  /** Clave de día local "AAAA-MM-DD" de un Date. */
  function claveDia(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  /** Date → "10:42 a. m." */
  function hora12(d) {
    var h = d.getHours(), m = ('0' + d.getMinutes()).slice(-2);
    var sufijo = h < 12 ? 'a. m.' : 'p. m.';
    h = h % 12 || 12;
    return h + ':' + m + ' ' + sufijo;
  }

  /** Date → "06/11/2026" */
  function fechaNumerica(d) {
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear();
  }

  function haceCuanto(isoPasado, ahora) {
    var ms = (ahora || new Date()) - new Date(isoPasado);
    if (!isFinite(ms)) return '';
    var min = Math.round(ms / 60000);
    if (min < 1) return 'hace un momento';
    if (min < 60) return 'hace ' + min + ' min';
    var h = Math.round(min / 60);
    if (h < 24) return h === 1 ? 'hace 1 hora' : 'hace ' + h + ' horas';
    var dias = Math.round(h / 24);
    return dias === 1 ? 'hace 1 día' : 'hace ' + dias + ' días';
  }

  /* -------------------------------------------------------------------- tasa */

  /** Une registros {fecha, valor} sin repetir fechas; deja los `max` más recientes. */
  function unirHistorial(a, b, max) {
    var mapa = {};
    [].concat(a || [], b || []).forEach(function (r) {
      if (r && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha) && typeof r.valor === 'number' && r.valor > 0) {
        mapa[r.fecha] = r.valor;
      }
    });
    var lista = Object.keys(mapa).sort().map(function (f) { return { fecha: f, valor: mapa[f] }; });
    return lista.slice(-(max || 15));
  }

  /** Respuesta de /v1/historicos/dolares/oficial → [{fecha, valor}] */
  function leerHistorico(json) {
    if (!Array.isArray(json)) return [];
    return json.map(function (r) {
      return { fecha: String(r && r.fecha || '').slice(0, 10), valor: Number(r && r.promedio) };
    });
  }

  /** Respuesta de /v1/dolares/oficial → [{fecha, valor}] */
  function leerOficial(json) {
    if (!json || typeof json !== 'object') return [];
    var valor = Number(json.promedio != null ? json.promedio : json.venta);
    return [{ fecha: String(json.fechaActualizacion || '').slice(0, 10), valor: valor }];
  }

  /**
   * Con el historial y la fecha de hoy: la tasa vigente (la última con fecha ≤ hoy),
   * la anterior (para el cambio) y la próxima (el BCV publica la del siguiente día hábil
   * por la tarde, antes de que entre en vigencia).
   */
  function resumenTasa(historial, hoyISO) {
    var lista = unirHistorial(historial, [], 60);
    if (!lista.length) return null;
    var iv = -1;
    for (var i = 0; i < lista.length; i++) if (lista[i].fecha <= hoyISO) iv = i;
    if (iv < 0) iv = 0;
    var vigente = lista[iv];
    var anterior = lista[iv - 1] || null;
    var proxima = lista[iv + 1] && lista[iv + 1].fecha > hoyISO ? lista[iv + 1] : null;
    return {
      vigente: vigente,
      anterior: anterior,
      proxima: proxima,
      cambio: anterior ? (vigente.valor - anterior.valor) / anterior.valor * 100 : null,
      cambioProxima: proxima ? (proxima.valor - vigente.valor) / vigente.valor * 100 : null
    };
  }

  /** +0,138 → "Subió 0,14 %" */
  function textoCambio(pct) {
    if (pct == null || !isFinite(pct)) return '';
    var abs = Math.abs(pct);
    if (abs < 0.005) return 'Sin cambio';
    return (pct > 0 ? 'Subió ' : 'Bajó ') + formatear(abs, 2) + ' %';
  }

  /* ------------------------------------------- historial completo (calendario) */

  /** [{fecha, valor}] → [[fecha, valor]] ordenado y sin repetidos: formato compacto para guardar. */
  function compactarHistorial(lista) {
    return unirHistorial(lista, [], 1e6).map(function (r) { return [r.fecha, r.valor]; });
  }

  /** [[fecha, valor]] → [{fecha, valor}] válidos y ordenados. */
  function expandirHistorial(compacto) {
    var lista = (Array.isArray(compacto) ? compacto : []).map(function (p) {
      return Array.isArray(p) ? { fecha: p[0], valor: p[1] } : null;
    });
    return unirHistorial(lista, [], 1e6);
  }

  /**
   * La tasa que regía en una fecha: la última publicada con fecha valor ≤ esa fecha
   * (fines de semana y feriados rige la del último día hábil). La lista va ordenada.
   */
  function tasaEnFecha(lista, fechaISO) {
    if (!lista || !lista.length) return null;
    if (fechaISO < lista[0].fecha) return { antesDelInicio: true, primera: lista[0] };
    var lo = 0, hi = lista.length - 1;
    while (lo < hi) {
      var medio = (lo + hi + 1) >> 1;
      if (lista[medio].fecha <= fechaISO) lo = medio; else hi = medio - 1;
    }
    var actual = lista[lo];
    var anterior = lista[lo - 1] || null;
    return {
      fecha: actual.fecha,
      valor: actual.valor,
      exacta: actual.fecha === fechaISO,
      anterior: anterior,
      cambio: anterior ? (actual.valor - anterior.valor) / anterior.valor * 100 : null
    };
  }

  /** "2026-11-30" + 3 → "2026-12-03" */
  function sumarDias(fechaISO, n) {
    var f = fechaLocalDeISO(fechaISO);
    return claveDia(new Date(f.getFullYear(), f.getMonth(), f.getDate() + n));
  }

  /** (2026, 10) → "noviembre de 2026" */
  function nombreMesAnio(anio, mes0) {
    return MESES[mes0] + ' de ' + anio;
  }

  /**
   * Las 42 casillas (6 semanas) de un mes, empezando en domingo como en los calendarios de
   * Venezuela: [{ fecha, dia, delMes, semana }] (semana: 0 = domingo … 6 = sábado).
   */
  function mesCalendario(anio, mes0) {
    var primero = new Date(anio, mes0, 1);
    var celdas = [];
    for (var i = 0; i < 42; i++) {
      var d = new Date(anio, mes0, 1 - primero.getDay() + i);
      celdas.push({ fecha: claveDia(d), dia: d.getDate(), delMes: d.getMonth() === mes0, semana: d.getDay() });
    }
    return celdas;
  }

  /* ------------------------------------------------------------- calculadora */
  /* La expresión se guarda con '.', '+', '-', '*', '/', '%' y dígitos. */

  var OPERADORES = '+-*/';

  function esOperador(c) { return OPERADORES.indexOf(c) >= 0; }

  /** Número que se está escribiendo al final de la expresión ("12+3.5" → "3.5"). */
  function numeroFinal(expr) {
    var m = /[\d.]*$/.exec(expr);
    return m ? m[0] : '';
  }

  /** Aplica una tecla a la expresión y devuelve la nueva expresión. */
  function teclaCalc(expr, tecla) {
    var e = String(expr || '');
    var ultimo = e.slice(-1);
    var num = numeroFinal(e);

    if (tecla === 'C') return '';
    if (tecla === 'borrar') return e.slice(0, -1);
    if (e.length >= 60 && tecla !== '=') return e;

    if (/^\d$/.test(tecla) || tecla === '00') {
      if (ultimo === '%') e += '*';
      num = numeroFinal(e);
      if (num.replace('.', '').length >= 15) return e;
      if (tecla === '00') {
        if (!num || num === '0') return num === '0' ? e : e + '0';
        return e + '00';
      }
      if (num === '0') return e.slice(0, -1) + tecla;   // "0" + "5" → "5"
      return e + tecla;
    }
    if (tecla === '.') {
      if (ultimo === '%') e += '*';
      num = numeroFinal(e);
      if (num.indexOf('.') >= 0) return e;
      return e + (num ? '.' : '0.');
    }
    if (esOperador(tecla)) {
      if (!e) return tecla === '-' ? '-' : '';
      if (e === '-') return e;
      if (ultimo === '.') e = e.slice(0, -1);
      if (esOperador(e.slice(-1))) {
        // "5*" + "-" → "5*-" (negativo), cualquier otro: reemplaza el operador
        if (tecla === '-' && (e.slice(-1) === '*' || e.slice(-1) === '/')) return e + '-';
        e = e.replace(/[+\-*/]+$/, '');
        if (!e) return '';
      }
      return e + tecla;
    }
    if (tecla === '%') {
      if (ultimo === '.') e = e.slice(0, -1);
      if (!/\d$/.test(e)) return e;
      return e + '%';
    }
    return e;
  }

  /**
   * Evalúa la expresión sin eval(). Porcentaje como en una calculadora de bolsillo:
   * "200+10%" = 220, "200-10%" = 180, "200*10%" = 20, "10%" = 0,1.
   * Devuelve NaN si está incompleta; Infinity si divide entre cero.
   */
  function calcular(expr) {
    var s = String(expr || '').replace(/[+\-*/.]+$/, '');
    if (!s || s === '-') return NaN;
    var pos = 0;

    function ver() { return s[pos]; }

    function numero() {
      var m = /^\d*\.?\d*/.exec(s.slice(pos));
      if (!m || !m[0] || m[0] === '.') throw new Error('número');
      pos += m[0].length;
      var v = Number(m[0]);
      if (ver() === '%') { pos++; return { v: v / 100, pct: true }; }
      return { v: v, pct: false };
    }

    function factor() {
      if (ver() === '-') { pos++; var f = factor(); return { v: -f.v, pct: f.pct }; }
      return numero();
    }

    function termino() {
      var izq = factor();
      while (ver() === '*' || ver() === '/') {
        var op = s[pos++];
        var der = factor();
        izq = { v: op === '*' ? izq.v * der.v : izq.v / der.v, pct: false };
      }
      return izq;
    }

    try {
      var total = termino().v;
      while (ver() === '+' || ver() === '-') {
        var op = s[pos++];
        var der = termino();
        var valor = der.pct ? total * der.v : der.v;
        total = op === '+' ? total + valor : total - valor;
      }
      if (pos !== s.length) return NaN;
      // Quita el ruido de coma flotante (0,1 + 0,2 = 0,3).
      return isFinite(total) ? Number(total.toPrecision(15)) : total;
    } catch (err) {
      return NaN;
    }
  }

  /** "12*3+1234.5" → "12 × 3 + 1.234,5" */
  function mostrarExpresion(expr) {
    return String(expr || '')
      .replace(/\d+(\.\d*)?/g, function (n) {
        var p = n.split('.');
        return agrupar(p[0]) + (p.length > 1 ? ',' + p[1] : '');
      })
      .replace(/([\d%,])([+\-*/])/g, '$1 $2 ')
      .replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  }

  /** Resultado → expresión para seguir calculando ("=" deja el resultado como inicio). */
  function resultadoComoExpresion(n) {
    if (!isFinite(n)) return '';
    var t = Number(n.toFixed(6)).toString();
    return /e/i.test(t) ? '' : t;
  }

  /* ------------------------------------------------------------------- CSV */

  function celdaCSV(v) {
    var s = String(v == null ? '' : v);
    // Evita que una hoja de cálculo interprete el texto como fórmula.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Visitas → CSV con ";" (lo que abre bien Excel en español). */
  function visitasCSV(visitas) {
    var filas = [['Fecha', 'Hora', 'Nombre', 'Teléfono', 'Motivo']];
    (visitas || []).forEach(function (v) {
      var d = new Date(v.fecha);
      filas.push([fechaNumerica(d), hora12(d), v.nombre, mostrarTelefono(v.telefono), v.motivo]);
    });
    return filas.map(function (f) { return f.map(celdaCSV).join(';'); }).join('\r\n');
  }

  var api = {
    agrupar: agrupar, redondear: redondear, formatear: formatear, formatearLibre: formatearLibre, dinero: dinero,
    partirTasa: partirTasa, leerNumero: leerNumero, formatearEntrada: formatearEntrada,
    normalizarTelefono: normalizarTelefono, mostrarTelefono: mostrarTelefono,
    llenarPlantilla: llenarPlantilla, enlaceWhatsApp: enlaceWhatsApp,
    fechaLarga: fechaLarga, fechaCorta: fechaCorta, fechaBreve: fechaBreve, hoyCaracas: hoyCaracas, claveDia: claveDia,
    hora12: hora12, fechaNumerica: fechaNumerica, haceCuanto: haceCuanto,
    unirHistorial: unirHistorial, leerHistorico: leerHistorico, leerOficial: leerOficial,
    resumenTasa: resumenTasa, textoCambio: textoCambio,
    compactarHistorial: compactarHistorial, expandirHistorial: expandirHistorial, tasaEnFecha: tasaEnFecha,
    sumarDias: sumarDias, nombreMesAnio: nombreMesAnio, mesCalendario: mesCalendario,
    teclaCalc: teclaCalc, calcular: calcular, mostrarExpresion: mostrarExpresion,
    resultadoComoExpresion: resultadoComoExpresion, visitasCSV: visitasCSV
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.MostradorLogica = api;
})(this);
