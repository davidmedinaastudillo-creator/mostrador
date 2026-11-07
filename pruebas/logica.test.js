// Pruebas de la lógica pura. Ejecutar desde la carpeta del proyecto:  node --test pruebas
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logica.js');

test('formato venezolano de montos', () => {
  assert.equal(L.formatear(1234567.891), '1.234.567,89');
  assert.equal(L.formatear(0.005), '0,01');
  assert.equal(L.formatear(-0.001), '0,00');
  assert.equal(L.formatear(-1500), '-1.500,00');
  assert.equal(L.formatear(NaN), '—');
  assert.equal(L.formatearLibre(41), '41');
  assert.equal(L.formatearLibre(3.5), '3,5');
  assert.equal(L.formatearLibre(1000), '1.000');
  assert.equal(L.formatearLibre(10 / 3), '3,3333');
  assert.equal(L.dinero(8961.225, 'bs'), 'Bs. 8.961,23');
  // Coma flotante: 10 × 896,1225 = 8961,224999999999 en binario
  assert.equal(L.formatear(10 * 896.1225), '8.961,23');
  assert.equal(L.formatear(1.005), '1,01');
  assert.equal(L.formatear(-1.005), '-1,01');
  assert.equal(L.formatear(2.5 * 1.005), '2,51');
  assert.equal(L.formatear(41 * 896.1225), '36.741,02');
  assert.equal(L.formatear(1e21), '—');
  assert.equal(L.formatear(999999999999.99), '999.999.999.999,99');
  assert.equal(L.dinero(10, 'usd'), '$ 10,00');
  assert.deepEqual(L.partirTasa(896.1225), { ent: '896,12', cola: '25', completa: '896,1225' });
});

test('leer números escritos de varias formas', () => {
  assert.equal(L.leerNumero('1.234,56'), 1234.56);
  assert.equal(L.leerNumero('1234.56'), 1234.56);
  assert.equal(L.leerNumero('1,234.56'), 1234.56);
  assert.equal(L.leerNumero('12,5'), 12.5);
  assert.equal(L.leerNumero('1.234.567'), 1234567);
  assert.equal(L.leerNumero('$ 10'), 10);
  assert.equal(L.leerNumero('Bs. 8.961,23'), 8961.23);
  assert.equal(L.leerNumero('-3,5'), -3.5);
  assert.ok(Number.isNaN(L.leerNumero('abc')));
  assert.ok(Number.isNaN(L.leerNumero('')));
  assert.ok(Number.isNaN(L.leerNumero('1,2.3,4')));
});

test('formato en vivo de los campos de dinero', () => {
  assert.deepEqual(L.formatearEntrada('1234'), { texto: '1.234', valor: 1234 });
  assert.deepEqual(L.formatearEntrada('1.2345,678'), { texto: '12.345,67', valor: 12345.67 });
  assert.deepEqual(L.formatearEntrada(','), { texto: '0,', valor: 0 });
  assert.deepEqual(L.formatearEntrada('0005'), { texto: '5', valor: 5 });
  assert.equal(L.formatearEntrada('').texto, '');
  assert.ok(Number.isNaN(L.formatearEntrada('').valor));
  assert.equal(L.formatearEntrada('897,53831', 4).texto, '897,5383');
  assert.equal(L.formatearEntrada('12,5', 0).texto, '12');
});

test('teléfonos para WhatsApp', () => {
  assert.deepEqual(L.normalizarTelefono('0414-123.45.67', '58'), { ok: true, intl: '584141234567', mensaje: '' });
  assert.equal(L.normalizarTelefono('414 1234567', '58').intl, '584141234567');
  assert.equal(L.normalizarTelefono('+58 412 765 4321', '58').intl, '584127654321');
  assert.equal(L.normalizarTelefono('0058 4241112233', '58').intl, '584241112233');
  assert.equal(L.normalizarTelefono('584161234567', '58').intl, '584161234567');
  assert.equal(L.normalizarTelefono('+1 305 555 1234', '58').ok, true);
  assert.equal(L.normalizarTelefono('3001234567', '57').intl, '573001234567');
  assert.equal(L.normalizarTelefono('0414-12345', '58').ok, false);
  assert.equal(L.normalizarTelefono('', '58').ok, false);
  assert.equal(L.mostrarTelefono('584141234567'), '0414-1234567');
  assert.equal(L.mostrarTelefono('13055551234'), '+13055551234');
});

test('plantilla y enlace de WhatsApp', () => {
  const t = L.llenarPlantilla('Hola, {nombre}. Motivo: { motivo } {otro}', { nombre: 'María', motivo: 'Pago' });
  assert.equal(t, 'Hola, María. Motivo: Pago {otro}');
  assert.equal(L.enlaceWhatsApp('584141234567', 'Hola & adiós\n*bien*'),
    'https://wa.me/584141234567?text=Hola%20%26%20adi%C3%B3s%0A*bien*');
  assert.equal(L.enlaceWhatsApp('', 'x'), 'https://wa.me/?text=x');
});

test('fechas en español', () => {
  assert.equal(L.fechaLarga('2026-11-06', '2026-11-07'), 'viernes 6 de noviembre');
  assert.equal(L.fechaLarga('2025-12-31', '2026-11-07'), 'miércoles 31 de diciembre de 2025');
  assert.equal(L.fechaCorta('2026-11-09'), 'lun 9 nov');
  assert.equal(L.hora12(new Date(2026, 10, 7, 0, 5)), '12:05 a. m.');
  assert.equal(L.hora12(new Date(2026, 10, 7, 13, 42)), '1:42 p. m.');
  // 2026-11-08 02:00 UTC todavía es 7 de noviembre en Caracas (UTC−4)
  assert.equal(L.hoyCaracas(new Date('2026-11-08T02:00:00Z')), '2026-11-07');
  const ahora = new Date('2026-11-07T12:00:00Z');
  assert.equal(L.haceCuanto('2026-11-07T11:57:00Z', ahora), 'hace 3 min');
  assert.equal(L.haceCuanto('2026-11-07T10:00:00Z', ahora), 'hace 2 horas');
});

test('tasa vigente, anterior y próxima (como responde la API hoy)', () => {
  const historico = [
    { fuente: 'oficial', promedio: 893.2173, fecha: '2026-11-04' },
    { fuente: 'oficial', promedio: 894.8876, fecha: '2026-11-05' },
    { fuente: 'oficial', promedio: 896.1225, fecha: '2026-11-06' },
    { fuente: 'oficial', promedio: 897.5383, fecha: '2026-11-09' }
  ];
  const oficial = { promedio: 896.1225, fechaActualizacion: '2026-11-06T00:00:00-04:00' };
  const h = L.unirHistorial(L.leerHistorico(historico), L.leerOficial(oficial));
  assert.equal(h.length, 4);
  const r = L.resumenTasa(h, '2026-11-07');
  assert.deepEqual(r.vigente, { fecha: '2026-11-06', valor: 896.1225 });
  assert.deepEqual(r.anterior, { fecha: '2026-11-05', valor: 894.8876 });
  assert.deepEqual(r.proxima, { fecha: '2026-11-09', valor: 897.5383 });
  assert.equal(L.textoCambio(r.cambio), 'Subió 0,14 %');
  // El lunes, la "próxima" pasa a ser la vigente sin volver a consultar
  const lunes = L.resumenTasa(h, '2026-11-09');
  assert.equal(lunes.vigente.valor, 897.5383);
  assert.equal(lunes.proxima, null);
  assert.equal(L.resumenTasa([], '2026-11-07'), null);
  // Datos rotos se descartan
  assert.equal(L.unirHistorial([{ fecha: 'x', valor: 1 }, { fecha: '2026-01-01', valor: -2 }]).length, 0);
  assert.equal(L.textoCambio(-0.5), 'Bajó 0,50 %');
  assert.equal(L.textoCambio(0.001), 'Sin cambio');
});

test('calendario: tasa que regía en cada fecha', () => {
  const lista = L.expandirHistorial([
    ['2026-11-06', 896.1225], ['2026-11-04', 893.2173], ['2026-11-05', 894.8876],
    ['2026-11-09', 897.5383], ['2023-01-03', 17.5591], ['malo', 1], ['2026-11-05', 894.8876]
  ]);
  assert.equal(lista.length, 5);
  assert.equal(lista[0].fecha, '2023-01-03');
  assert.deepEqual(L.compactarHistorial(lista)[1], ['2026-11-04', 893.2173]);
  const jueves = L.tasaEnFecha(lista, '2026-11-05');
  assert.equal(jueves.valor, 894.8876);
  assert.equal(jueves.exacta, true);
  assert.equal(L.textoCambio(jueves.cambio), 'Subió 0,19 %');
  // Domingo: rige la del viernes
  const domingo = L.tasaEnFecha(lista, '2026-11-08');
  assert.equal(domingo.fecha, '2026-11-06');
  assert.equal(domingo.exacta, false);
  // Entre 2023 y 2026 sin datos intermedios: rige la última conocida
  assert.equal(L.tasaEnFecha(lista, '2025-06-01').fecha, '2023-01-03');
  assert.equal(L.tasaEnFecha(lista, '2023-01-03').anterior, null);
  assert.equal(L.tasaEnFecha(lista, '2022-12-31').antesDelInicio, true);
  assert.equal(L.tasaEnFecha([], '2026-11-05'), null);
});

test('calendario: casillas del mes (empieza en domingo)', () => {
  const nov = L.mesCalendario(2026, 10);
  assert.equal(nov.length, 42);
  assert.deepEqual(nov[0], { fecha: '2026-11-01', dia: 1, delMes: true, semana: 0 });
  assert.equal(nov[41].fecha, '2026-12-12');
  const dic = L.mesCalendario(2026, 11);   // 1 de diciembre de 2026 es martes
  assert.deepEqual(dic[0], { fecha: '2026-11-29', dia: 29, delMes: false, semana: 0 });
  assert.equal(dic[2].fecha, '2026-12-01');
  assert.equal(L.sumarDias('2026-11-30', 3), '2026-12-03');
  assert.equal(L.sumarDias('2026-03-01', -1), '2026-02-28');
  assert.equal(L.nombreMesAnio(2023, 0), 'enero de 2023');
});

test('teclas de la calculadora', () => {
  const escribir = (teclas) => teclas.reduce((e, t) => L.teclaCalc(e, t), '');
  assert.equal(escribir(['1', '2', '*', '3', '+', '5']), '12*3+5');
  assert.equal(escribir(['+']), '');
  assert.equal(escribir(['-', '5']), '-5');
  assert.equal(escribir(['5', '+', '*']), '5*');
  assert.equal(escribir(['5', '*', '-', '2']), '5*-2');
  assert.equal(escribir(['.', '5']), '0.5');
  assert.equal(escribir(['1', '.', '.', '5']), '1.5');
  assert.equal(escribir(['0', '0', '7']), '7');
  assert.equal(escribir(['00']), '0');
  assert.equal(escribir(['5', '00']), '500');
  assert.equal(escribir(['5', '0', '%', '2']), '50%*2');
  assert.equal(escribir(['5', '+', '%']), '5+');
  assert.equal(escribir(['9', '9', 'borrar']), '9');
  assert.equal(escribir(['9', 'C']), '');
});

test('cálculos, con porcentaje de calculadora de bolsillo', () => {
  assert.equal(L.calcular('12*3+5'), 41);
  assert.equal(L.calcular('2+3*4'), 14);
  assert.equal(L.calcular('0.1+0.2'), 0.3);
  assert.equal(L.calcular('200+10%'), 220);
  assert.equal(L.calcular('200-10%'), 180);
  assert.equal(L.calcular('200*10%'), 20);
  assert.equal(L.calcular('10%'), 0.1);
  assert.equal(L.calcular('100+16%'), 116);
  assert.equal(L.calcular('5*-2'), -10);
  assert.equal(L.calcular('-5+3'), -2);
  assert.equal(L.calcular('12+'), 12);
  assert.equal(L.calcular('123456789012.34+0'), 123456789012.34); // montos grandes sin perder céntimos
  assert.equal(L.calcular('1.1*3'), 3.3);
  assert.equal(L.calcular('5/0'), Infinity);
  assert.ok(Number.isNaN(L.calcular('')));
  assert.ok(Number.isNaN(L.calcular('-')));
  assert.equal(L.mostrarExpresion('12*3+1234.5'), '12 × 3 + 1.234,5');
  assert.equal(L.mostrarExpresion('5*-2'), '5 × −2');
  assert.equal(L.resultadoComoExpresion(10 / 3), '3.333333');
  assert.equal(L.resultadoComoExpresion(-15), '-15');
});

test('exportar visitas a CSV', () => {
  const csv = L.visitasCSV([
    { fecha: new Date(2026, 10, 7, 9, 30).toISOString(), nombre: 'Ana "La Flaca"', telefono: '584141234567', motivo: '=SUMA(1;2)' }
  ]);
  const [cab, fila] = csv.split('\r\n');
  assert.equal(cab, 'Fecha;Hora;Nombre;Teléfono;Motivo');
  assert.equal(fila, '07/11/2026;9:30 a. m.;"Ana ""La Flaca""";0414-1234567;"\'=SUMA(1;2)"');
});
