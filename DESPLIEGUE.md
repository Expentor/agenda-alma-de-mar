# Publicar el sitio en internet

Con la base de datos, el sitio ya **no puede ir en GitHub Pages**: Pages solo sirve
páginas estáticas y no sabe ejecutar PHP ni guardar nada. Hace falta un hosting normal,
de los que llevan **PHP y MySQL**.

---

## 1) Contratar el hosting

Cualquier hosting compartido con **PHP 8.1+ y MySQL** sirve. En México suele costar
entre **$100 y $200 al mes**, muchas veces con el dominio incluido el primer año.

Lo que tienes que comprobar antes de pagar:

- [ ] PHP 8.1 o superior
- [ ] Bases de datos MySQL o MariaDB (con al menos una incluida)
- [ ] **Certificado SSL gratis (Let's Encrypt)** — esto no es opcional, ver más abajo
- [ ] Acceso por FTP o por el gestor de archivos del panel

Opciones habituales: Hostinger, Banahosting, HostGator México, Neubox, SiteGround.
También sirve un VPS si prefieres, pero para un spa es más trabajo del necesario.

---

## 2) HTTPS: esto es obligatorio

**Sin HTTPS, tu contraseña y los teléfonos de tus clientas viajan en claro por internet**,
y cualquiera en la misma red WiFi puede leerlos. Todos los hostings de la lista dan un
certificado gratis; solo hay que activarlo.

En el panel del hosting:

1. Busca **SSL** o **Certificados** y activa el gratuito para tu dominio.
2. Busca la opción **Forzar HTTPS** (o *Force HTTPS Redirect*) y enciéndela.

Para comprobarlo: entra a tu sitio y mira que la barra del navegador diga `https://`
y no marque «No seguro».

> El código ya está preparado: en cuanto detecta HTTPS, marca la cookie de sesión como
> `Secure`, y así el navegador no la manda nunca por una conexión sin cifrar.

---

## 3) Subir los archivos

Sube **todo el contenido de la carpeta** a la carpeta pública del hosting
(suele llamarse `public_html`, `htdocs` o `www`), **menos** estos dos:

- `api/config.php` — se genera allá, con los datos del hosting
- La carpeta `.git` si existe

---

## 4) Crear la base de datos

En el panel del hosting, sección **Bases de datos MySQL**:

1. Crea una base de datos. Apunta el nombre exacto (suele llevar un prefijo, tipo
   `usuario_almademar`).
2. Crea un usuario y **guarda su contraseña**.
3. Asigna ese usuario a esa base con **todos los permisos**.

---

## 5) Instalar

Abre `https://tudominio.com/instalar.php` y rellena:

- **Servidor**: casi siempre `localhost` (si no, el panel te dice cuál)
- **Usuario y contraseña**: los del paso anterior
- **Nombre de la base**: el del paso anterior
- **Tu usuario de la agenda**: el que usarás para entrar, con contraseña larga

Cuando diga «Listo»:

### ⚠️ Borra `instalar.php`

Entra por FTP o por el gestor de archivos y **bórralo**. Mientras siga ahí, cualquiera
que dé con la dirección podría reinstalar tu agenda encima.

---

## 6) Ponerlo en el celular

Abre `https://tudominio.com/acceso.html` y añádelo a la pantalla de inicio:

- **iPhone (Safari)**: botón *Compartir* → **Añadir a pantalla de inicio**
- **Android (Chrome)**: menú ⋮ → **Instalar aplicación**

Queda con el icono de la concha y abre directo en el acceso. Como las citas están en el
servidor, ves lo mismo que en la computadora.

---

## 7) Actualizar el sitio más adelante

Cuando cambies textos, fotos o estilos: sube por FTP solo los archivos que tocaste.
**No subas nunca `api/config.php`** desde tu computadora: el del hosting tiene otros
datos y lo romperías.

Si cambiaste algún `.css` o `.js`, sube el número de `?v=9` en `index.html`,
`tienda.html`, `acceso.html` y `agenda.html`, o las clientas seguirán viendo la versión vieja
guardada en su navegador.

---

## Copias de seguridad

Ahora los datos están en el servidor del hosting, y los hostings también fallan.

- **Cada mes**: en la agenda, *Ajustes → Copia de seguridad → Descargar copia*.
  Guarda el `.json` en tu Drive.
- **Además**, mira si tu hosting hace copias automáticas y cada cuánto. Casi todos
  las hacen, pero conviene saber si son diarias o semanales.

---

## Si algo va mal

| Síntoma | Qué mirar |
|---|---|
| «El servidor de la agenda no responde» | ¿Está encendido Apache/MySQL? En el hosting, ¿existe `api/config.php`? |
| Página en blanco al entrar a la agenda | Mira el log de errores de PHP en el panel del hosting. |
| «No se pudo completar la operación» | Casi siempre son los datos de la base en `api/config.php`. |
| Entra y a los segundos pide contraseña otra vez | Alguna extensión del navegador bloquea cookies, o el hosting no guarda sesiones. |
| Se quedó bloqueado el acceso | Son los 15 minutos del freno anti fuerza bruta. Espera, o vacía la tabla `intentos_acceso` desde phpMyAdmin. |

---

## Siguientes pasos (cuando haga falta)

| Necesidad | Qué se añade |
|---|---|
| Que tus terapeutas entren con su propio usuario | Ya hay tabla `usuarios`: falta la pantalla para darlas de alta y los permisos por rol |
| Recuperar la contraseña por correo | Envío de un enlace temporal desde el servidor |
| Que las clientas reserven solas | Página de reservas que crea citas pendientes de confirmar |
| Recordatorios automáticos | API de WhatsApp Business o correo programado |
| Ver la agenda sin internet | Guardar en el navegador y sincronizar al volver la conexión |
| Dominio propio (`almademar.mx`) | Se compra y se apunta al hosting |
