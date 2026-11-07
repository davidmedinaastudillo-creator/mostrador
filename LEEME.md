# Mostrador

App para Android (web instalable, PWA) con estética de vidrio líquido:

- **Visitas**: nombre, teléfono y motivo. Al tocar *Guardar y enviar por WhatsApp* se guarda en el
  registro y se abre WhatsApp con el mensaje ya escrito (al visitante o a un número fijo, según Ajustes).
  El registro se puede buscar, reenviar, borrar (con *Deshacer*) y exportar a CSV (abre en Excel).
- **Tasa**: dólar oficial del BCV (vía DolarApi), cuánto cambió y, cuando el BCV ya la publicó, la
  tasa del próximo día hábil. Conversor dólares ↔ bolívares.
- **Calcular**: calculadora de precios en $ o Bs., con el resultado convertido a la otra moneda y
  un botón para fijarlo en Precios.
- **Precios**: precios fijados en dólares; los bolívares se recalculan solos cuando cambia la tasa.
  Se pueden compartir como lista.

Todo se guarda solo en el teléfono (no hay servidor ni cuentas). Funciona sin internet con la
última tasa guardada.

## Sobre "enviar automáticamente"

WhatsApp no permite que una app envíe mensajes sola sin que la persona toque *Enviar* (solo lo
permite la API de WhatsApp Business, que es de pago y necesita un servidor). La app deja el chat
abierto con el mensaje escrito: falta un toque.

## Instalar en el teléfono

La app necesita estar publicada en una dirección `https://` para instalarse como app:

1. Publica esta carpeta (por ejemplo en GitHub Pages o Netlify).
2. En el teléfono, abre esa dirección en **Chrome**.
3. Menú ⋮ → **Instalar aplicación** (o *Agregar a la pantalla principal*). Queda en el cajón de apps
   con su ícono y abre a pantalla completa.

### Probarla ya desde el teléfono (misma red Wi-Fi, sin instalar)

En la laptop, en el Símbolo del sistema:

    python -m http.server 8765 --directory "C:\Users\Laptop\Documents\Mostrador"

Busca la IP de la laptop con `ipconfig` (por ejemplo `192.168.1.20`) y abre en el teléfono
`http://192.168.1.20:8765`. Así funciona todo, pero no se instala como app ni trabaja sin internet
(eso requiere `https`).

## Cambiar algo

- Archivos: `index.html` (estructura), `estilos.css` (diseño), `app.js` (comportamiento),
  `logica.js` (cálculos, formato, teléfonos, tasa), `sw.js` (funcionamiento sin internet).
- Después de cambiar archivos ya publicados, sube `VERSION` en `sw.js` (`mostrador-v2`, …) para
  que los teléfonos descarguen la versión nueva.
- Pruebas de la lógica: `node --test pruebas/logica.test.js`

## Créditos

- Fuente Bricolage Grotesque (SIL Open Font License, ver `fuentes/OFL.txt`).
- Tasa: Banco Central de Venezuela, consultada en [DolarApi](https://ve.dolarapi.com).
