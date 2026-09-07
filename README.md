# Alma de Mar · Facial & Wellness

Sitio web del spa. Son dos páginas y un servidor:

| Parte | Archivo | Quién entra |
|---|---|---|
| **Página pública** | `index.html` | Las clientas. Presentación del spa, carta de tratamientos, galería y reserva por WhatsApp. |
| **Acceso** | `acceso.html` | Solo tú. Usuario y contraseña, y nada más. |
| **Tienda** | `tienda.html` | Las clientas. Catálogo, carrito y pago con tarjeta. |
| **Agenda** | `agenda.html` | Solo tú, ya dentro. Citas, clientas, ingresos, pedidos, catálogo y ajustes. |
| **Servidor** | `api/` | Nadie directamente. Es lo que habla con la base de datos. |

Las dos pantallas tuyas se redirigen sola la una a la otra: si entras a la agenda sin
sesión te manda al acceso, y si entras al acceso teniendo sesión te manda a la agenda.
No hace falta acordarse de cuál es la dirección buena.

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
| Llaves de Stripe | En el `.env`, que está en `.gitignore` y que Apache no sirve (`.htaccess`). Puede ponerse fuera de la raíz web, donde ningún servidor lo alcanza. |

**Lo que falta y depende de ti:** cuando lo publiques en internet, **tiene que ser por
HTTPS**. Sin HTTPS, la contraseña viaja en claro por la red. Está explicado en
[DESPLIEGUE.md](DESPLIEGUE.md).

---

## Qué hace la agenda

- **Día** — el horario dividido en franjas; los huecos libres se agendan con un clic.
- **Semana** — los siete días con las citas de cada uno.
- **Clientes** — ficha por clienta: teléfono, visitas, gasto acumulado e historial.
- **Ingresos** — cuánto se cobró en un mes o entre dos fechas, con el desglose por
  servicio, por terapeuta y día a día. *Cobrado* es solo lo marcado como completado;
  lo pendiente y lo confirmado se cuenta aparte, como previsión.
- **Ajustes** — servicios, terapeutas, mensaje de WhatsApp, contraseña y copias.
  Cada servicio lleva una **categoría**, y es la que decide en qué grupo sale en la
  página pública. Los que no la tienen aparecen bajo «Otros tratamientos», nunca se
  pierden. Se corrige con el botón *Editar* de cada fila.
- **WhatsApp** — abre el chat de la clienta con la confirmación ya escrita.
- **Avisos de cruce** — si dos citas se solapan, avisa antes de guardar.
- **Solo dentro del horario** — no deja agendar fuera de los turnos, ni una cita que
  **termine** después del cierre. Los días cerrados no tienen huecos.
- **Al volver a la pestaña** se vuelve a preguntar al servidor, por si agendaste algo
  desde el celular mientras tanto.

---

## La tienda

Vende los productos de la marca con envíos a toda la república y pago con tarjeta.

- **Catálogo** — 129 productos en 8 categorías, sembrados desde la lista de precios.
- **Carrito** — vive en el navegador de la clienta, pero solo guarda ids y cantidades.
  **Los precios y el envío los calcula siempre el servidor**, en cada paso. Editar el
  JavaScript desde el navegador no sirve para pagar de menos.
- **Envío por peso facturable** — se compara el peso real contra el volumétrico y manda
  el mayor, igual que cobra la paquetería. Con velas gana casi siempre el volumétrico.
- **Recoger en el spa** — opción sin costo en el checkout.
- **Pago con Stripe Checkout** — la clienta paga *en Stripe* y vuelve. Los datos de su
  tarjeta no pasan por este servidor en ningún momento.
- **Pedidos y catálogo** se administran desde la agenda, en sus dos pestañas.

### Instalarla

1. Abre <http://localhost/alma-de-mar/instalar-tienda.php> (o tu dominio).
2. Si te pide un usuario de MySQL con permiso para crear tablas, dáselo: el usuario
   normal de la aplicación no puede crear tablas, y es a propósito.
3. **Borra `instalar-tienda.php`** del servidor.

Se puede volver a ejecutar sin miedo: actualiza nombres y precios del catálogo, pero
no pisa lo que hayas editado en el panel (descripciones, fotos, pesos, existencias) ni
toca los pedidos.

### Activar el cobro

Las llaves de Stripe y las tarifas de envío van en un archivo **`.env`**, que no
se sube a git. Copia la plantilla y rellénala:

```bash
cp .env.ejemplo .env
```

```bash
STRIPE_SECRETO=sk_live_...
STRIPE_WEBHOOK=whsec_...
```

> **Por qué un `.env` y no dentro del código:** el sitio se actualiza con `git pull`.
> Cualquier número que edites dentro de un `.php` se pierde en la siguiente
> actualización. Lo que vive en el `.env` sobrevive, porque git ni lo ve.

**Dónde ponerlo.** Se busca en dos sitios, por este orden:

1. **Un nivel arriba de la raíz del sitio.** Si el sitio está en
   `/home/uXXXX/public_html`, el archivo va en `/home/uXXXX/.env`. Es el sitio
   seguro: está fuera de lo que el servidor web puede servir, pase lo que pase.
2. **En la raíz**, junto a `index.html`. Más cómodo, pero ahí solo lo protege el
   `.htaccess`.

Usa el 1 si puedes. Si usas el 2, **comprueba que `https://tudominio.com/.env`
responde 403 o 404**, nunca el texto del archivo. Si alguna vez ves su contenido,
las llaves están expuestas: cámbialas en Stripe de inmediato.

El webhook se da de alta en Stripe apuntando a
`https://tudominio.com/api/webhook-stripe.php`, con el evento
`checkout.session.completed`. **Es lo que marca un pedido como pagado**: sin él los
cobros entran en Stripe pero los pedidos se quedan en «sin pagar». Volver a la página
de gracias no cuenta como prueba de pago — esa dirección la puede abrir cualquiera.

Mientras no pongas las llaves, el catálogo y el carrito funcionan y el botón de pagar
avisa de que falta configurarlo.

### Lo que hay que ajustar tú

| Qué | Dónde |
|---|---|
| Tarifas de envío, zona extendida, días de entrega | `.env` |
| Dirección para recoger, o desactivarlo | `.env` |
| Peso y medidas por tipo de producto | `api/envios.php` → `perfiles` |
| Peso y medidas de una pieza concreta | En el panel: *Tienda → Editar* |

Todo lo del `.env` está listado y explicado en `.env.ejemplo`. Lo que no pongas usa
el valor por defecto que trae el código.

> **Las tarifas y los pesos que trae son estimaciones**, puestas con precios públicos de
> guía prepagada terrestre. Pesa y mide unas cuantas piezas reales de cada tipo y pon tu
> cotización de paquetería: de ahí sale el cobro de todos tus envíos.

---

## Dónde se cambia cada cosa

| Qué quieres cambiar | Dónde |
|---|---|
| Tratamientos, duraciones y precios | En la agenda: *Ajustes → Servicios*. La página pública se actualiza sola. |
| Productos, precios y existencias de la tienda | En la agenda: *Tienda* |
| Costos de envío y llaves de Stripe | `.env` (plantilla en `.env.ejemplo`) |
| En qué grupo sale un tratamiento | En la agenda: *Ajustes → Servicios → Editar → Categoría* |
| Los grupos de la carta | `assets/js/config.js` → `categorias` |
| Teléfono, dirección, redes, mapa | `assets/js/config.js` |
| Horario de atención | `assets/js/config.js` → `horario` |
| Fotos del spa | `assets/img/spa/` (ver más abajo) |
| Tu contraseña | En la agenda: *Ajustes → Contraseña de acceso* |
| Textos de la página | `index.html` |

> **Importante sobre el horario:** manda en los dos sitios a la vez. Es lo que ven las
> clientas *y* las horas en las que la agenda permite agendar.

---

## Las fotos de tu spa

Van en `assets/img/spa/` con **estos nombres exactos**. El que falte se sustituye solo
por un marcador con los colores de la marca, sin romper nada.

| Archivo | Dónde sale | Orientación | Ahora |
|---|---|---|---|
| `hero.jpg` | Portada, a pantalla completa | **Horizontal** | ✅ el rótulo del spa |
| `recepcion.jpg` | Sección «El spa» | Vertical | ✅ la cabina desde la camilla |
| `producto.jpg` | Recuadro pequeño sobre la anterior | Cuadrada | ✅ el bote de hydrojelly |
| `cabina.jpg` | Sección «La cabina» | Vertical | ✅ la cabina con el equipo |
| `facial.jpg` | Galería, pieza alta | Vertical | ✅ la mascarilla |
| `masaje.jpg` | Galería | Horizontal | ❌ falta |
| `detalle.jpg` | Galería | Horizontal | ❌ falta |
| `equipo.jpg` | Galería, pieza ancha | Horizontal | ❌ falta |

Para activarlas, en `assets/js/config.js` debe estar `fotosReales: true` (ya lo está).

### La galería se esconde sola

Una foto suelta entre marcadores de color se ve a medio hacer, así que **la sección
«Galería» solo aparece cuando hay al menos 3 fotos suyas**. Ahora mismo hay una, así
que está oculta y su enlace no sale en el menú. En cuanto guardes dos más
(`masaje.jpg`, `detalle.jpg` o `equipo.jpg`), la sección vuelve sola.

### Consejos al fotografiar

- **La portada (`hero.jpg`)** lleva un velo claro encima y el texto en azul marino.
  Cuanto más luminosa la foto, mejor se lee. La actual da 7,35:1 de contraste en su
  zona más oscura, que es nivel AAA.
- Exporta a **1600–2000 px de ancho** y menos de 400 KB. La de portada admite 2400 px.
- Si sale una clienta reconocible, **pídele permiso por escrito** antes de publicarla.
- Los originales sin recortar están guardados como `*-original.jpg` por si quieres
  otro encuadre.

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
- <http://localhost/alma-de-mar/tienda.html> — tienda
- <http://localhost/alma-de-mar/acceso.html> — acceso a la agenda

Para entrar desde el celular **estando en el mismo WiFi**, mira la IP de tu computadora
(`ipconfig`) y usa `http://192.168.x.x/alma-de-mar/`. Puede que tengas que permitir
Apache en el Firewall de Windows.

---

## Estructura

```
index.html                   Página pública del spa
tienda.html                  Tienda: catálogo, carrito y checkout
gracias.html                 Confirmación tras pagar
acceso.html                  Usuario y contraseña
agenda.html                  Agenda, ya con la sesión iniciada
instalar.php                 Instalador — BÓRRALO tras instalar
instalar-tienda.php          Instalador de la tienda — BÓRRALO también

api/index.php                Toda la API: sesión, citas, servicios, ajustes
api/comun.php                Conexión, sesión, CSRF, freno a la fuerza bruta
api/tienda.php               Catálogo, carrito, pedidos
api/envios.php               Peso facturable y perfiles de empaque
api/entorno.php              Lee el .env
api/stripe.php               Cobro con Stripe, sin SDK
api/webhook-stripe.php       Aviso de pago: la única prueba de que se cobró
api/catalogo.php             Lista de precios inicial
api/config.php               Contraseña de la base — no se sube a GitHub
api/config.ejemplo.php       Plantilla del anterior
.env                         Llaves de Stripe y tarifas — no se sube a GitHub
.env.ejemplo                 Plantilla del anterior, con todo explicado
api/.htaccess                Impide que Apache sirva la configuración
sql/esquema.sql              Las tablas, como referencia

assets/css/landing.css       Estilos de la página pública (fondo crema)
assets/css/estilos.css       Estilos de la agenda (tema azul marino)
assets/css/tienda.css        Estilos de la tienda

assets/js/config.js          Contacto, dirección, horario, fotos
assets/js/api.js             Cliente que habla con el servidor
assets/js/landing.js         Página pública: menú, carta, reserva por WhatsApp
assets/js/auth.js            Acceso y redirecciones entre las dos pantallas
assets/js/app.js             Agenda: citas, vistas, ingresos, WhatsApp, copias
assets/js/tienda.js          Tienda: catálogo, carrito, checkout
assets/js/admin-tienda.js    Panel: pedidos y catálogo

assets/img/logo*.svg         Logo oficial y su versión para fondos oscuros
assets/img/spa/              Fotos del spa (y sus marcadores de color)
assets/img/tienda/           Fotos de los productos, una por categoría
sql/tienda.sql               Tablas de la tienda
```

Al cambiar un `.css` o un `.js`, sube el número de `?v=9` en `index.html`,
`tienda.html`, `gracias.html`, `acceso.html` y `agenda.html`. Así los navegadores de tus clientas cogen la versión nueva en vez de la
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
