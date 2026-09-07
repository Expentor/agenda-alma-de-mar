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

   Son dos páginas, no una:
     acceso.html  → el formulario. Si ya hay sesión, redirige.
     agenda.html  → la agenda. Si NO hay sesión, redirige.
   Antes las dos vivían en el mismo archivo y se escondían la
   una a la otra; bastaba que un `display` de CSS le ganara al
   atributo `hidden` para acabar viendo las dos a la vez.
   ══════════════════════════════════════════════════════════ */

window.Acceso = (() => {
  'use strict';

  const PAGINA_ACCESO = 'acceso.html';
  const PAGINA_AGENDA = 'agenda.html';

  /* `replace` y no `href`: así el botón «atrás» del navegador no devuelve a
     una pantalla que ya no corresponde. */
  const irA = (destino) => location.replace(destino);

  /* ══════════════ acceso.html ══════════════ */
  function montarLogin() {
    const pantalla = document.getElementById('acceso');
    const form     = document.getElementById('form-acceso');
    const error    = document.getElementById('acceso-error');

    function mostrarError(texto) {
      error.textContent = texto;
      error.hidden = !texto;
    }

    function mostrarFormulario(mensaje) {
      pantalla.hidden = false;
      if (mensaje) mostrarError(mensaje);
      setTimeout(() => form.elements.usuario.focus(), 80);
    }

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
        irA(PAGINA_AGENDA);
      } catch (err) {
        mostrarError(err.message);
        f.clave.value = '';
        f.clave.focus();
        boton.disabled = false;
        boton.textContent = 'Entrar';
      }
    });

    /* Si ya hay sesión no se enseña el formulario: se va derecho a la agenda. */
    (async () => {
      /* `?expirada` lo pone la propia agenda al caducar la sesión. */
      const motivo = new URLSearchParams(location.search).get('expirada')
        ? 'Tu sesión expiró por inactividad. Vuelve a entrar.'
        : '';

      try {
        const r = await API.estado();
        if (r.autenticado) { irA(PAGINA_AGENDA); return; }
        mostrarFormulario(motivo);
      } catch (err) {
        mostrarFormulario(
          err.codigo === 0
            ? 'No hay conexión con el servidor de la agenda.'
            : 'El servidor de la agenda no responde. ¿Está encendido Apache?'
        );
      }
    })();
  }

  /* ══════════════ agenda.html ══════════════ */
  function montarAgenda() {
    const aplicacion = document.getElementById('app');

    (async () => {
      try {
        const r = await API.estado();
        if (!r.autenticado) { irA(PAGINA_ACCESO); return; }
        aplicacion.hidden = false;
        document.body.classList.add('con-sesion');
        await window.iniciarAgenda();
      } catch {
        /* Sin servidor no hay agenda que pintar, y en la pantalla de acceso
           el aviso sale explicado. */
        irA(PAGINA_ACCESO);
      }
    })();
  }

  /* La llama app.js cuando el servidor responde que la sesión ya no vale. */
  function sesionCaducada() {
    irA(PAGINA_ACCESO + '?expirada=1');
  }

  async function cerrarSesion() {
    try { await API.salir(); } catch { /* si no hay red, igual se sale */ }
    irA(PAGINA_ACCESO);
  }

  if (document.getElementById('form-acceso')) montarLogin();
  else if (document.getElementById('app'))    montarAgenda();

  return { cerrarSesion, sesionCaducada, cambiarClave: (a, n) => API.cambiarClave(a, n) };
})();
