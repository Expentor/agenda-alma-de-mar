/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Acceso a la agenda
   ──────────────────────────────────────────────────────────
   La contraseña se comprueba en el SERVIDOR, contra un hash
   bcrypt guardado en la base de datos. En el navegador no hay
   nada que saltarse: sin sesión válida, la API no devuelve ni
   una cita.

   La sesión viaja en una cookie httpOnly, que el JavaScript
   de la página no puede leer, así que tampoco puede robarla
   un script inyectado.
   ══════════════════════════════════════════════════════════ */

window.Acceso = (() => {
  'use strict';

  const pantalla   = document.getElementById('acceso');
  const aplicacion = document.getElementById('app');
  const form       = document.getElementById('form-acceso');
  const error      = document.getElementById('acceso-error');

  let dentro = false;

  function mostrarError(texto) {
    error.textContent = texto;
    error.hidden = !texto;
  }

  function mostrarAcceso() {
    dentro = false;
    pantalla.hidden = false;
    aplicacion.hidden = true;
    document.body.classList.remove('con-sesion');
    setTimeout(() => form.elements.usuario.focus(), 80);
  }

  async function mostrarApp() {
    pantalla.hidden = true;
    aplicacion.hidden = false;
    document.body.classList.add('con-sesion');
    if (!dentro) {
      dentro = true;
      await window.iniciarAgenda();
    }
  }

  /* La llama app.js cuando el servidor responde que la sesión ya no vale. */
  function sesionCaducada() {
    dentro = false;
    mostrarAcceso();
    mostrarError('Tu sesión expiró por inactividad. Vuelve a entrar.');
  }

  async function cerrarSesion() {
    try { await API.salir(); } catch { /* si no hay red, igual se sale */ }
    location.reload();
  }

  /* ───────────── Formulario ───────────── */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = form.elements;
    const boton = f.entrar;

    boton.disabled = true;
    boton.textContent = 'Comprobando…';
    mostrarError('');

    try {
      await API.entrar(f.usuario.value.trim(), f.clave.value);
      form.reset();
      await mostrarApp();
    } catch (err) {
      mostrarError(err.message);
      f.clave.value = '';
      f.clave.focus();
    } finally {
      boton.disabled = false;
      boton.textContent = 'Entrar';
    }
  });

  /* ───────────── Arranque ───────────── */
  (async () => {
    try {
      const r = await API.estado();
      if (r.autenticado) await mostrarApp(); else mostrarAcceso();
    } catch (err) {
      mostrarAcceso();
      mostrarError(
        err.codigo === 0
          ? 'No hay conexión con el servidor de la agenda.'
          : 'El servidor de la agenda no responde. ¿Está encendido Apache?'
      );
    }
  })();

  return { cerrarSesion, sesionCaducada, cambiarClave: (a, n) => API.cambiarClave(a, n) };
})();
