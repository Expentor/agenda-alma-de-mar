# Publicar la agenda con tu cuenta de GitHub

La agenda es una página estática, así que **GitHub Pages la publica gratis**. Unos 10 minutos.

---

## 1) Crear el repositorio

1. Entra en <https://github.com/new> con tu cuenta.
2. **Repository name**: `agenda-alma-de-mar`
3. Visibilidad: **Public**.
   > GitHub Pages en repositorios privados requiere plan de pago. Que el repositorio sea
   > público significa que se ve *el programa*, **no tus citas**: las citas se guardan en tu
   > navegador y nunca se suben a GitHub. Aun así, cualquiera con la dirección podría abrir
   > la agenda vacía. Si prefieres que nadie más pueda entrar, mira *Siguientes pasos*.
4. **No** marques «Add a README file» (ya hay uno).
5. Clic en **Create repository**.

---

## 2) Subir el código

En la terminal, dentro de `/Users/expentor/alma-de-mar` (cambia `TU-USUARIO`):

```bash
git remote add origin https://github.com/TU-USUARIO/agenda-alma-de-mar.git
```

```bash
git branch -M main && git push -u origin main
```

Si te pide contraseña, usa un **token**: GitHub → *Settings → Developer settings →
Personal access tokens → Tokens (classic) → Generate new token*, con permiso `repo`.
Ese token se pega en lugar de la contraseña.

---

## 3) Activar GitHub Pages

1. En el repositorio: pestaña **Settings**.
2. Menú lateral: **Pages**.
3. *Source*: **Deploy from a branch**.
4. *Branch*: **main**, carpeta **/ (root)** → **Save**.
5. Espera 1–2 minutos y recarga. Aparecerá la dirección:

```
https://TU-USUARIO.github.io/agenda-alma-de-mar/
```

---

## 4) Ponerla en el móvil

- **iPhone (Safari)**: abre la dirección → botón *Compartir* → **Añadir a pantalla de inicio**.
- **Android (Chrome)**: abre la dirección → menú ⋮ → **Instalar aplicación**.

Queda con el icono de la concha, como una app más.

---

## 5) Actualizar la página más adelante

Cada vez que cambie el código:

```bash
git add -A && git commit -m "Cambios en la agenda" && git push
```

GitHub Pages se actualiza solo en un par de minutos.

---

## Rutina recomendada

- **Cada semana**: *Ajustes → Copia de seguridad → Descargar copia*. Guarda el archivo
  `.json` en tu Drive o correo. Es tu red de seguridad.
- Usa **siempre el mismo dispositivo y navegador** para la agenda. Las citas no viajan
  entre dispositivos.
- Para pasar la agenda a otro equipo: descarga la copia en el primero y usa
  *Restaurar copia* en el segundo.

---

## Siguientes pasos (cuando haga falta)

| Necesidad | Qué se añade |
|---|---|
| Entrar con usuario y contraseña, o con GitHub | Desplegar en Vercel o Netlify (también conectado a GitHub) con una función de login |
| Ver la misma agenda desde el móvil y la computadora | Base de datos en la nube (Supabase o Firebase) |
| Que las clientas reserven solas | Página pública de reservas que crea citas pendientes de confirmar |
| Recordatorios automáticos | API de WhatsApp Business o correo programado |

Cualquiera de estos pasos parte de esta misma página: no hay que empezar de cero.
