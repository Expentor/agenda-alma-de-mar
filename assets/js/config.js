/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Datos del spa
   ──────────────────────────────────────────────────────────
   Este es el ÚNICO archivo que necesitas tocar para cambiar
   teléfono, dirección, horario, redes o la carta de servicios.
   Lo usan tanto la página pública como la agenda.
   ══════════════════════════════════════════════════════════ */

window.ALMA = {

  /* ── Identidad ───────────────────────────────────────── */
  nombre:  'Alma de Mar',
  lema:    'Facial & Wellness',

  /* ── Contacto ────────────────────────────────────────── */
  // Teléfono en formato internacional, solo dígitos (52 = México).
  whatsapp: '523143580022',
  // Cómo se muestra escrito en la página.
  telefonoVisible: '+52 314 358 0022',
  correo: 'hola@almademar.mx',

  direccion: {
    linea1: 'Av. Fiestas de Mayo #18',
    linea2: 'Condominios Torres del Mar, Dep. 10F',
    // ⚠️ FALTA: escribe aquí la ciudad y el estado (p. ej. 'Manzanillo, Colima').
    // Si se queda vacío, la línea simplemente no sale en la página.
    ciudad: '',
    mapa: 'https://maps.app.goo.gl/5LSWm8vKw7xzeB6k9',
  },

  redes: [
    { nombre: 'Instagram', url: 'https://instagram.com/almademarfacial' },
    // Facebook y TikTok estaban puestos de ejemplo y apuntaban a cuentas que no
    // son tuyas, así que los dejo apagados. Para encenderlos, quita las dos
    // barras del principio y pon el usuario real:
    // { nombre: 'Facebook', url: 'https://facebook.com/TU-USUARIO' },
    // { nombre: 'TikTok',   url: 'https://tiktok.com/@TU-USUARIO' },
  ],

  /* ── Fotos del spa ───────────────────────────────────────
     Mientras no haya fotos, la página usa los marcadores con
     los colores de la marca que están en assets/img/spa/*.svg

     Cuando tengas las fotos reales:
       1. Guárdalas en assets/img/spa/ con ESTOS nombres exactos
          y la extensión que pongas abajo en `formatoFotos`:
            hero · recepcion · cabina · facial
            masaje · producto · detalle · equipo
       2. Cambia `fotosReales` a true.
     Si alguna falta, esa sola vuelve al marcador de color.
     ────────────────────────────────────────────────────── */
  fotosReales: true,
  formatoFotos: 'jpg',

  /* ── Horario de atención ─────────────────────────────────
     Manda en los dos sitios a la vez: es lo que ven las
     clientas en la página Y las horas en las que la agenda
     deja poner citas. Fuera de estos turnos no se puede
     agendar: la agenda ni siquiera ofrece esos huecos.

     Cada día lleva su lista de turnos [entrada, salida] en
     formato 24 h. Un día sin turnos (`[]`) está cerrado.
     El lunes es el primero de la lista.
     ────────────────────────────────────────────────────── */
  horario: [
    { dia: 'Lunes',      turnos: [['11:00', '14:00'], ['16:00', '20:00']] },
    { dia: 'Martes',     turnos: [['11:00', '14:00'], ['16:00', '20:00']] },
    { dia: 'Miércoles',  turnos: [['11:00', '14:00'], ['16:00', '20:00']] },
    { dia: 'Jueves',     turnos: [['11:00', '14:00'], ['16:00', '20:00']] },
    { dia: 'Viernes',    turnos: [['11:00', '14:00'], ['16:00', '20:00']] },
    { dia: 'Sábado',     turnos: [['12:00', '17:00']] },
    { dia: 'Domingo',    turnos: [] },
  ],

  /* ── Carta de servicios ──────────────────────────────────
     Los tratamientos y sus precios YA NO están aquí: viven en
     la base de datos, y se editan desde la agenda (Ajustes →
     Servicios). La página pública los pide al servidor, así
     que en cuanto cambies un precio en la agenda, cambia solo
     en la página de las clientas.

     Aquí quedan únicamente los títulos de las dos secciones
     en las que se agrupan.
     ────────────────────────────────────────────────────── */
  categorias: [
    { id: 'corporal', titulo: 'Ritual corporal · Masajes', nota: 'De 50 a 90 minutos' },
    { id: 'facial',   titulo: 'Rituales faciales',         nota: 'De 70 a 120 minutos' },
  ],

  /* ── Mensaje de WhatsApp de la página pública ────────── */
  plantillaReserva:
    'Hola, me gustaría agendar una cita en {spa}.\n\n' +
    '• Nombre: {nombre}\n' +
    '• Tratamiento: {servicio}\n' +
    '• Día: {fecha}\n' +
    '• Horario: {franja}{notas}\n\n' +
    '¿Tienen disponibilidad? ¡Gracias!',

  /* ── Acceso a la agenda ──────────────────────────────────
     Ya no hay nada de esto aquí. El usuario y la contraseña
     viven en la base de datos (hash bcrypt) y los comprueba el
     servidor. La contraseña se cambia desde la propia agenda,
     en Ajustes → Contraseña de acceso.
     ────────────────────────────────────────────────────── */
};
