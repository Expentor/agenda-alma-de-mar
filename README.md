# Agenda · Alma de Mar

Agenda de citas para **Alma de Mar · Facial & Wellness**. Página web sin servidor:
se abre en cualquier navegador (móvil o computadora) y guarda las citas en el propio
dispositivo. Diseñada con la paleta y la tipografía del manual de marca.

## Qué hace

- **Día** — horario del spa dividido en franjas; los huecos libres se agendan con un clic.
- **Semana** — vista de los siete días con las citas de cada uno.
- **Clientes** — ficha por clienta: teléfono, número de visitas, gasto acumulado e historial.
- **Ajustes** — horario, servicios (nombre, duración, precio), terapeutas, mensaje de
  WhatsApp y copias de seguridad.
- **WhatsApp** — botón que abre el chat de la clienta con el mensaje de confirmación escrito.
- **Avisos de cruce** — si dos citas se solapan, avisa antes de guardar.
- Se instala en el móvil desde el navegador (*Añadir a pantalla de inicio*).

## Dónde viven los datos

En el navegador del dispositivo (`localStorage`), no en internet. Esto significa:

- Las citas **no se comparten** entre el móvil y la computadora.
- Si borras los datos del navegador, se pierden.
- **Descarga una copia cada semana** desde *Ajustes → Copia de seguridad*.

Cuando haga falta agenda compartida entre dispositivos o reservas de las clientas,
el siguiente paso es añadir un backend (ver *Siguientes pasos* en [DESPLIEGUE.md](DESPLIEGUE.md)).

## Probar en local

```bash
python3 -m http.server 8777 --directory .
```

Luego abre <http://localhost:8777>.

## Estructura

```
index.html              Estructura de la página
assets/css/estilos.css  Paleta y tipografía de marca
assets/js/app.js        Lógica: citas, vistas, WhatsApp, copias
assets/img/             Logo oficial (SVG/PNG), isotipo y favicon
```

## Marca

| Color | Hex | Uso |
|---|---|---|
| Azul profundo | `#182D45` | Texto, botones principales |
| Oro | `#C7A970` | Acentos, citas confirmadas |
| Agua | `#C7DDE5` | Citas pendientes, fondos suaves |
| Agua media | `#95BEC9` | Detalles secundarios |
| Crema | `#F7F3EB` | Fondo general |

Tipografías del manual: **Chantria** (títulos) y **Cera Pro** (texto). Como no son fuentes
web libres, la página usa sus equivalentes de Google Fonts: **Josefin Sans** y **Jost**.
Si compras las licencias web de las originales, se cambian en `--display` y `--texto`
en `assets/css/estilos.css`.
