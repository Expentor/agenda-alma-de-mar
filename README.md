# Alma de Mar · Facial & Wellness

Sitio web del spa. Son dos páginas y un servidor:

| Parte | Archivo | Quién entra |
|---|---|---|
| **Página pública** | `index.html` | Las clientas. Presentación del spa, carta de tratamientos, galería y reserva por WhatsApp. |
| **Agenda** | `agenda.html` | Solo tú, con usuario y contraseña. Citas, clientas y ajustes. |
| **Servidor** | `api/` | Nadie directamente. Es lo que habla con la base de datos. |

Las citas se guardan en una **base de datos MySQL**, así que son las mismas desde el
celular, la tablet y la computadora. La contraseña la comprueba el servidor, no el navegador.

---

## Qué necesita para funcionar

- **PHP 8.1 o superior** con las extensiones `pdo_mysql` y `openssl`
- **MySQL 5.7+ o MariaDB 10.3+**
- Un servidor web (Apache o Nginx)

En tu computadora eso lo da **XAMPP**, que ya tienes instalado. Para verlo desde fuera
de casa hace falta un hosting con PHP y MySQL: ver [DESPLIEGUE.md](DESPLIEGUE.md).

---

## Instalación

1. Enciende **Apache** y **MySQL** desde el panel de XAMPP.
2. Abre <http://localhost/alma-de-mar/instalar.php>.
3. Rellena las dos secciones:
   - **Acceso a MySQL**: en XAMPP recién instalado es `root` con la contraseña vacía.
     Solo se usa en ese momento para crear la base; no queda guardado.
   - **Tu usuario de la agenda**: el que usarás siempre. **Contraseña larga**, mínimo
     10 caracteres. Cuatro palabras sueltas (`concha-dorada-martes-91`) es más segura
     y más fácil de recordar que una palabra corta con símbolos.
4. **Borra `instalar.php`** del servidor. Es el paso que más se olvida y el más importante.

El instalador crea la base de datos, las tablas, los 11 tratamientos de tu carta, un
usuario de base de datos con contraseña aleatoria y el archivo `api/config.php`.

> Si algo falla, borra `api/config.php` y vuelve a abrir `instalar.php`.

---

## Cómo está protegido

| Qué | Cómo |
|---|---|
| Contraseñas | **bcrypt** con coste 12. En la base no está tu contraseña, solo una huella que no se puede deshacer. |
| Sesión | Cookie **httpOnly** y **SameSite=Lax**: el JavaScript de la página no puede leerla, así que no se puede robar con un script inyectado. Caduca a las 2 horas sin actividad. |
| Robo de sesión | Al entrar y al cambiar la contraseña, el identificador de sesión se renueva. |
| Peticiones falsas (CSRF) | Cada operación que cambia algo exige un token que solo conoce nuestro propio JavaScript. |
| Fuerza bruta | Tras 6 intentos fallidos, ese usuario y esa IP quedan bloqueados 15 minutos. |
| Inyección de SQL | Consultas preparadas de verdad (`EMULATE_PREPARES = false`) en toda la API. |
| Fugas de información | Los errores internos van al log del servidor; al navegador solo le llega una frase neutra. |
| Base de datos | La aplicación entra con un usuario propio que solo puede leer y escribir en esta base, nunca con `root`. |
| Contraseña de la base | En `api/config.php`, que está en `.gitignore` y que Apache no sirve (`api/.htaccess`). |

**Lo que falta y depende de ti:** cuando lo publiques en internet, **tiene que ser por
HTTPS**. Sin HTTPS, la contraseña viaja en claro por la red. Está explicado en
[DESPLIEGUE.md](DESPLIEGUE.md).

---

## Qué hace la agenda

- **Día** — el horario dividido en franjas; los huecos libres se agendan con un clic.
- **Semana** — los siete días con las citas de cada uno.
- **Clientes** — ficha por clienta: teléfono, visitas, gasto acumulado e historial.
- **Ajustes** — servicios, terapeutas, mensaje de WhatsApp, contraseña y copias.
- **WhatsApp** — abre el chat de la clienta con la confirmación ya escrita.
- **Avisos de cruce** — si dos citas se solapan, avisa antes de guardar.
- **Solo dentro del horario** — no deja agendar fuera de los turnos, ni una cita que
  **termine** después del cierre. Los días cerrados no tienen huecos.
- **Al volver a la pestaña** se vuelve a preguntar al servidor, por si agendaste algo
  desde el celular mientras tanto.

---

## Dónde se cambia cada cosa

| Qué quieres cambiar | Dónde |
|---|---|
| Tratamientos, duraciones y precios | En la agenda: *Ajustes → Servicios*. La página pública se actualiza sola. |
| Teléfono, dirección, redes, mapa | `assets/js/config.js` |
| Horario de atención | `assets/js/config.js` → `horario` |
| Fotos del spa | `assets/img/spa/` (ver más abajo) |
| Tu contraseña | En la agenda: *Ajustes → Contraseña de acceso* |
| Textos de la página | `index.html` |

> **Importante sobre el horario:** manda en los dos sitios a la vez. Es lo que ven las
> clientas *y* las horas en las que la agenda permite agendar.

---

## Las fotos de tu spa

Mientras no haya fotos, la página muestra marcadores con los colores de la marca. Para
poner las tuyas:

1. Guárdalas en `assets/img/spa/` con **estos nombres exactos**:

   | Archivo | Dónde sale | Orientación |
   |---|---|---|
   | `hero.jpg` | Portada, a pantalla completa | Horizontal |
   | `recepcion.jpg` | Sección «El spa» | Vertical |
   | `producto.jpg` | Recuadro pequeño sobre la anterior | Cuadrada |
   | `cabina.jpg` | Sección «La cabina» | Vertical |
   | `facial.jpg` | Galería, pieza alta | Vertical |
   | `masaje.jpg` | Galería | Horizontal |
   | `detalle.jpg` | Galería | Horizontal |
   | `equipo.jpg` | Galería, pieza ancha | Horizontal |

2. En `assets/js/config.js`, cambia `fotosReales: false` por `fotosReales: true`.

Si alguna falta, esa sola vuelve a su marcador de color. Exporta a 1600–2000 px de ancho
y menos de 400 KB; la de portada admite hasta 2400 px.

---

## Copias de seguridad

Los datos ya no dependen de un navegador, pero el servidor puede fallar. Dos redes:

- **Desde la agenda**: *Ajustes → Copia de seguridad → Descargar copia*. Baja un `.json`
  con todo. *Restaurar copia* lo vuelve a meter en la base de datos.
- **De la base entera**, más completa:

```bash
C:\xampp\mysql\bin\mysqldump.exe -u root alma_de_mar > respaldo-alma-de-mar.sql
```

Guarda el archivo en tu Drive o tu correo. Una vez al mes basta.

---

## Probar en local

Con Apache y MySQL encendidos en XAMPP:

- <http://localhost/alma-de-mar/> — página pública
- <http://localhost/alma-de-mar/agenda.html> — agenda

Para entrar desde el celular **estando en el mismo WiFi**, mira la IP de tu computadora
(`ipconfig`) y usa `http://192.168.x.x/alma-de-mar/`. Puede que tengas que permitir
Apache en el Firewall de Windows.

---

## Estructura

```
index.html                   Página pública del spa
agenda.html                  Agenda, tras el inicio de sesión
instalar.php                 Instalador — BÓRRALO tras instalar

api/index.php                Toda la API: sesión, citas, servicios, ajustes
api/comun.php                Conexión, sesión, CSRF, freno a la fuerza bruta
api/config.php               Contraseña de la base — no se sube a GitHub
api/config.ejemplo.php       Plantilla del anterior
api/.htaccess                Impide que Apache sirva la configuración
sql/esquema.sql              Las tablas, como referencia

assets/css/landing.css       Estilos de la página pública (fondo crema)
assets/css/estilos.css       Estilos de la agenda (tema azul marino)

assets/js/config.js          Contacto, dirección, horario, fotos
assets/js/api.js             Cliente que habla con el servidor
assets/js/landing.js         Página pública: menú, carta, reserva por WhatsApp
assets/js/auth.js            Pantalla de acceso
assets/js/app.js             Agenda: citas, vistas, WhatsApp, copias

assets/img/logo*.svg         Logo oficial y su versión para fondos oscuros
assets/img/spa/              Fotos del spa (y sus marcadores de color)
```

Al cambiar un `.css` o un `.js`, sube el número de `?v=3` en `index.html` y
`agenda.html`. Así los navegadores de tus clientas cogen la versión nueva en vez de la
que tenían guardada.

---

## Marca

| Color | Hex | Uso |
|---|---|---|
| Azul profundo | `#182D45` | Tema de la agenda, secciones oscuras, texto |
| Oro | `#C7A970` | Acentos, botones principales, citas confirmadas |
| Agua | `#C7DDE5` | Fondos suaves |
| Agua media | `#95BEC9` | Detalles secundarios, citas pendientes |
| Crema | `#F7F3EB` | Fondo de la página pública |

Tipografías del manual: **Chantria** (títulos) y **Cera Pro** (texto). Como no son
fuentes web libres, la página usa sus equivalentes de Google Fonts: **Josefin Sans**
y **Jost**. Si compras las licencias web de las originales, se cambian en `--display`
y `--texto` al principio de los dos archivos `.css`.
