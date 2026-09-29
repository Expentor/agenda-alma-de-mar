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

## 7) Actualizar el sitio con `git pull`

El sitio vive en un repositorio, así que actualizarlo es traer los cambios y, si
la actualización trae datos o columnas nuevas, volver a pasar el instalador de
la tienda. Este es el procedimiento completo, en orden.

### Antes de tocar nada: respalda

```bash
mysqldump -u TU_USUARIO -p TU_BASE > ~/respaldo-$(date +%F).sql
```

Déjalo **fuera de `public_html`** (`~/` es un nivel arriba). Un volcado de tu base
en la carpeta pública es un premio demasiado goloso, aunque el `.htaccess` deniegue
los `.sql`.

### 1. Mira si hay cambios locales que estorben

```bash
git status
```

Lo habitual es que salga `deleted: instalar.php` o `deleted: instalar-tienda.php`,
porque los borras después de cada instalación —y haces bien—. **Si la actualización
que viene toca esos archivos, el `git pull` se planta** con *«Your local changes
would be overwritten by merge»*. La salida es devolverlos:

```bash
git restore instalar.php instalar-tienda.php
```

No pierdes nada: los vuelves a borrar al final.

### 2. Trae los cambios

```bash
git pull origin main
```

**Ni `api/config.php` ni el `.env` se tocan**: los dos están en `.gitignore`, así que
tu configuración de producción y tus llaves de Stripe se quedan como están.

### 3. Vuelve a pasar el instalador de la tienda

Abre `https://TU-DOMINIO/instalar-tienda.php`. Hace falta **cada vez que la
actualización traiga productos, precios, textos, fotos o columnas nuevas**; si no
trajo ninguna de esas cosas, puedes saltarte este paso.

Si la actualización añade columnas a la tabla `productos`, el instalador necesita
permiso de `ALTER`. Cuando el usuario de la aplicación no lo tiene, te pide un
usuario de MySQL que sí —solo para ese paso, y no se guarda—.

Lee el resumen que sale: te dice cuántos productos procesó, cuántos tienen foto y
si falta configurar Stripe.

> **Lo que el instalador NO pisa:** descripción, nombre botánico, precauciones y
> foto solo se rellenan cuando están vacíos. Lo que hayas escrito o subido desde el
> panel sobrevive. Nombre, categoría, presentación y precio sí se refrescan siempre,
> porque son los datos de la lista oficial. Los pedidos no se tocan nunca.

### 4. Borra los instaladores

```bash
rm -f instalar-tienda.php instalar.php
```

Mientras sigan ahí, cualquiera que dé con la dirección puede volver a sembrar el
catálogo. Y sí: **cada `git pull` los trae de vuelta**, así que esto se repite en
cada actualización.

### 5. Comprueba

- `https://TU-DOMINIO/` — la carta de tratamientos carga
- `https://TU-DOMINIO/tienda.html` — el catálogo carga y las fotos se ven
- `https://TU-DOMINIO/acceso.html` — entras al panel
- Si dejaste el `.env` en la raíz: `https://TU-DOMINIO/.env` **debe dar 403 o 404**

### Sobre la caché de los navegadores

Los `.css` y `.js` llevan `?v=` en la dirección, y ese número sube en cada
actualización que los cambia. Las clientas cogen la versión nueva solas; no hay
que hacer nada. El HTML no se cachea (`.htaccess`), así que también entra al vuelo.

**No subas archivos por FTP** si el sitio se actualiza con `git pull`: mezclar las
dos cosas deja el repositorio con cambios locales que luego estorban.

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
