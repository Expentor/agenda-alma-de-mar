/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Cliente de la API
   Todo lo que la página le pide al servidor pasa por aquí.
   ══════════════════════════════════════════════════════════ */

window.API = (() => {
  'use strict';

  const BASE = 'api/index.php?r=';

  /* El token CSRF lo entrega el servidor al iniciar sesión y viaja en una
     cabecera. Así, aunque otra web haga que tu navegador llame a la API con
     tu cookie, no puede añadir esta cabecera y la petición se rechaza. */
  let csrf = null;

  class ErrorAPI extends Error {
    constructor(mensaje, codigo, extra = {}) {
      super(mensaje);
      this.name = 'ErrorAPI';
      this.codigo = codigo;
      Object.assign(this, extra);
    }
  }

  async function pedir(ruta, cuerpo = null) {
    const opciones = {
      method: cuerpo === null ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: {},
    };

    if (cuerpo !== null) {
      opciones.headers['Content-Type'] = 'application/json';
      if (csrf) opciones.headers['X-CSRF'] = csrf;
      opciones.body = JSON.stringify(cuerpo);
    }

    let respuesta;
    try {
      respuesta = await fetch(BASE + ruta, opciones);
    } catch {
      throw new ErrorAPI('No hay conexión con el servidor. Revisa tu internet.', 0);
    }

    let datos = {};
    try {
      datos = await respuesta.json();
    } catch {
      throw new ErrorAPI('El servidor respondió algo inesperado.', respuesta.status);
    }

    if (!respuesta.ok || datos.ok === false) {
      throw new ErrorAPI(datos.error || 'No se pudo completar la operación.', respuesta.status, datos);
    }
    return datos;
  }

  return {
    ErrorAPI,

    /* ── Sesión ── */
    async estado() {
      const r = await pedir('sesion/estado');
      csrf = r.csrf;
      return r;
    },
    async entrar(usuario, clave) {
      const r = await pedir('sesion/entrar', { usuario, clave });
      csrf = r.csrf;
      return r;
    },
    async salir() {
      const r = await pedir('sesion/salir', {});
      csrf = null;
      return r;
    },
    async cambiarClave(actual, nueva) {
      const r = await pedir('sesion/clave', { actual, nueva });
      if (r.csrf) csrf = r.csrf;
      return r;
    },

    /* ── Datos ── */
    datos:              ()      => pedir('datos'),
    guardarCita:        (cita)  => pedir('citas/guardar', cita),
    borrarCita:         (id)    => pedir('citas/borrar', { id }),
    guardarServicio:    (s)     => pedir('servicios/guardar', s),
    borrarServicio:     (id)    => pedir('servicios/borrar', { id }),
    guardarTerapeuta:   (nombre) => pedir('terapeutas/guardar', { nombre }),
    borrarTerapeuta:    (nombre) => pedir('terapeutas/borrar', { nombre }),
    guardarAjustes:     (a)     => pedir('ajustes/guardar', a),

    /* ── Página pública (sin sesión) ── */
    serviciosPublicos:  ()      => pedir('publico/servicios'),
  };
})();
