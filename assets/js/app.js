/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Agenda de citas
   Los datos viven en la base de datos del servidor, así que
   son los mismos desde el celular y desde la computadora.
   ══════════════════════════════════════════════════════════ */

/* Valores de respaldo por si la tabla de ajustes viniera incompleta. */
const CONFIG_INICIAL = {
  spa: window.ALMA.nombre,
  intervalo: 30,
  prefijo: '52',
  plantilla: 'Hola {cliente} ✨ Te confirmamos tu cita en {spa}: {servicio}, el {fecha} a las {hora}. ¡Te esperamos!',
};

const ESTADOS = {
  pendiente:  'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada:  'Cancelada',
  ausente:    'No asistió',
};

/* ───────────── Estado en memoria ─────────────
   Es una copia de lo que hay en el servidor, para poder pintar sin ir a
   la red en cada scroll. Cada cambio se manda primero y solo se refleja
   aquí cuando el servidor lo confirma. */
let datos = { citas: [], servicios: [], terapeutas: [], config: { ...CONFIG_INICIAL } };
let fechaActiva = hoyISO();
let inicioSemana = lunesDe(hoyISO());
let vistaActiva = 'dia';

/* Rango de la vista de Ingresos. Arranca en el mes en curso. */
let ingDesde = `${hoyISO().slice(0, 7)}-01`;
let ingHasta = ultimoDiaDeMes(hoyISO().slice(0, 7));

async function traerDatos() {
  const r = await API.datos();
  datos = {
    citas: r.citas,
    servicios: r.servicios,
    terapeutas: r.terapeutas,
    config: { ...CONFIG_INICIAL, ...r.ajustes },
  };
}

/* Envoltura de toda llamada que cambia algo: traduce los fallos del
   servidor a un aviso entendible y saca al usuario si la sesión venció. */
async function pedir(accion, exito) {
  try {
    const r = await accion();
    if (exito) aviso(exito);
    return r;
  } catch (e) {
    if (e.sesion === false) { Acceso.sesionCaducada(); return null; }
    aviso('⚠️ ' + e.message);
    return null;
  }
}

/* ───────────── Utilidades de fecha ───────────── */
function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function aDate(iso) { return new Date(`${iso}T00:00:00`); }
function sumarDias(iso, n) { const d = aDate(iso); d.setDate(d.getDate() + n); return hoyISO(d); }
function lunesDe(iso) { const d = aDate(iso); const dw = (d.getDay() + 6) % 7; return sumarDias(iso, -dw); }
function mayus(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
function fechaLargaMin(iso) {   // sin mayúscula inicial: para mensajes ("… el viernes, 21 de agosto")
  return aDate(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function fechaLarga(iso) {
  return mayus(aDate(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
}
function fechaCorta(iso) {
  return mayus(aDate(iso).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }));
}
function aMinutos(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
function aHora(min) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }
function dinero(n) { return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0); }

/* ───────────── Consultas ───────────── */
const citasDe = (iso) => datos.citas.filter(c => c.fecha === iso).sort((a, b) => a.hora.localeCompare(b.hora));
const servicioPorId = (id) => datos.servicios.find(s => s.id === id);
const cuentanParaIngresos = (c) => c.estado !== 'cancelada' && c.estado !== 'ausente';

function conflictoDe(cita) {
  const ini = aMinutos(cita.hora), fin = ini + Number(cita.duracion);
  return datos.citas.find(o => {
    if (o.id === cita.id || o.fecha !== cita.fecha) return false;
    if (o.estado === 'cancelada' || o.estado === 'ausente') return false;
    if (cita.terapeuta && o.terapeuta && cita.terapeuta !== o.terapeuta) return false;
    const oi = aMinutos(o.hora), of = oi + Number(o.duracion);
    return ini < of && oi < fin;
  });
}

/* ───────────── Horario de atención ─────────────
   Los turnos de config.js mandan: fuera de ellos no se agenda.
   getDay() da 0 para el domingo; la lista de config.js empieza en lunes. */

const filaHorario = (iso) => window.ALMA.horario[(aDate(iso).getDay() + 6) % 7];

function turnosDe(iso) {
  const turnos = filaHorario(iso)?.turnos || [];
  return turnos.map(([de, a]) => ({ ini: aMinutos(de), fin: aMinutos(a) }));
}

const abiertoEl = (iso) => turnosDe(iso).length > 0;
const nombreDia = (iso) => (filaHorario(iso)?.dia || 'ese día').toLowerCase();

/* «los lunes» pero «los domingos»: de lunes a viernes el plural no cambia. */
function diaEnPlural(iso) {
  const dia = nombreDia(iso);
  return dia.endsWith('s') ? dia : `${dia}s`;
}

/* Una cita vale si cabe ENTERA en un turno: empezar dentro no basta si se sale. */
function huecoDeHorario(fecha, hora, duracion) {
  const ini = aMinutos(hora), fin = ini + Number(duracion);
  return turnosDe(fecha).find(t => ini >= t.ini && fin <= t.fin) || null;
}

/* Devuelve null si la cita cabe; si no, la explicación para la clienta. */
function motivoFueraDeHorario(fecha, hora, duracion) {
  const turnos = turnosDe(fecha);
  const dia = nombreDia(fecha);

  if (!turnos.length) return `El spa cierra los ${diaEnPlural(fecha)}. Elige otro día.`;
  if (huecoDeHorario(fecha, hora, duracion)) return null;

  const texto = turnos.map(t => `${aHora(t.ini)}–${aHora(t.fin)}`).join(' y ');
  const ini = aMinutos(hora), fin = ini + Number(duracion);
  const empiezaDentro = turnos.some(t => ini >= t.ini && ini < t.fin);

  return empiezaDentro
    ? `La cita terminaría a las ${aHora(fin)} y para entonces el turno ya cerró. El ${dia} se atiende de ${texto}.`
    : `Las ${hora} quedan fuera de horario. El ${dia} se atiende de ${texto}.`;
}

/* Primera hora libre para una cita nueva en ese día. */
function horaPorDefecto(iso) {
  const turnos = turnosDe(iso);
  return turnos.length ? aHora(turnos[0].ini) : '11:00';
}

/* ───────────── Avisos ───────────── */
function aviso(texto) {
  const cont = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.textContent = texto;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

/* ───────────── Vista: DÍA ───────────── */
function pintarDia() {
  document.getElementById('fecha-dia').value = fechaActiva;
  document.getElementById('titulo-dia').textContent = fechaLarga(fechaActiva);

  const citas = citasDe(fechaActiva);
  const activas = citas.filter(cuentanParaIngresos);
  const ingresos = activas.reduce((t, c) => t + Number(c.precio || 0), 0);
  const minutos = activas.reduce((t, c) => t + Number(c.duracion || 0), 0);
  document.getElementById('resumen-dia').innerHTML =
    `<div><strong>${activas.length}</strong> cita${activas.length === 1 ? '' : 's'}</div>
     <div><strong>${dinero(ingresos)}</strong> estimado</div>
     <div><strong>${Math.floor(minutos / 60)}h ${minutos % 60}m</strong> en cabina</div>`;

  const paso = Number(datos.config.intervalo);
  const turnos = turnosDe(fechaActiva);
  const cont = document.getElementById('agenda-dia');
  cont.innerHTML = '';

  /* Citas que no caben en ningún turno: normalmente son de antes de fijar el
     horario. No se pierden de vista, pero se muestran aparte y señaladas. */
  const dentro = citas.filter(c => huecoDeHorario(fechaActiva, c.hora, c.duracion));
  const fuera  = citas.filter(c => !huecoDeHorario(fechaActiva, c.hora, c.duracion));

  if (!turnos.length) {
    cont.insertAdjacentHTML('beforeend',
      `<p class="dia-cerrado">Cerrado los ${diaEnPlural(fechaActiva)}<span>No se pueden agendar citas este día</span></p>`);
  }

  turnos.forEach((turno, i) => {
    // Entre turno y turno, el descanso se ve como tal en vez de desaparecer
    if (i > 0) {
      cont.insertAdjacentHTML('beforeend',
        `<div class="descanso">Cerrado · ${aHora(turnos[i - 1].fin)} – ${aHora(turno.ini)}</div>`);
    }

    for (let m = turno.ini; m < turno.fin; m += paso) {
      const franja = document.createElement('div');
      franja.className = 'franja' + (m % 60 === 0 ? ' franja--hora-en-punto' : '');
      franja.innerHTML = `<div class="franja__hora">${aHora(m)}</div>`;

      const cuerpo = document.createElement('div');
      cuerpo.className = 'franja__contenido';

      const empiezan = dentro.filter(c => { const s = aMinutos(c.hora); return s >= m && s < m + paso; });
      const siguen = citas.filter(c => { const s = aMinutos(c.hora); return s < m && s + Number(c.duracion) > m; });

      empiezan.forEach(c => cuerpo.appendChild(tarjetaCita(c)));
      siguen.forEach(c => {
        const p = document.createElement('p');
        p.className = 'continua';
        p.textContent = `… continúa: ${c.cliente}`;
        cuerpo.appendChild(p);
      });

      if (!empiezan.length && !siguen.length) {
        const btn = document.createElement('button');
        btn.className = 'libre';
        btn.textContent = 'Libre · agendar aquí';
        btn.addEventListener('click', () => abrirCita(null, { fecha: fechaActiva, hora: aHora(m) }));
        cuerpo.appendChild(btn);
      }
      franja.appendChild(cuerpo);
      cont.appendChild(franja);
    }
  });

  if (fuera.length) {
    const bloque = document.createElement('div');
    bloque.className = 'fuera-horario';
    bloque.innerHTML = `<p class="fuera-horario__titulo">Fuera del horario de atención</p>`;
    fuera.forEach(c => bloque.appendChild(tarjetaCita(c)));
    cont.appendChild(bloque);
  }
}

function tarjetaCita(c) {
  const b = document.createElement('button');
  b.className = `cita cita--${c.estado}`;
  b.innerHTML = `
    <div class="cita__datos">
      <div class="cita__cliente">${escapar(c.cliente)}</div>
      <div class="cita__servicio">${escapar(c.servicioNombre)}</div>
      <div class="cita__meta">${c.hora}–${aHora(aMinutos(c.hora) + Number(c.duracion))} · ${c.duracion} min${c.terapeuta ? ' · ' + escapar(c.terapeuta) : ''}${c.telefono ? ' · ' + escapar(c.telefono) : ''}</div>
      <span class="estado estado--${c.estado}">${ESTADOS[c.estado]}</span>
    </div>
    <div class="cita__precio">${dinero(c.precio)}</div>`;
  b.addEventListener('click', () => verDetalle(c.id));
  return b;
}

/* ───────────── Vista: SEMANA ───────────── */
function pintarSemana() {
  const fin = sumarDias(inicioSemana, 6);
  document.getElementById('titulo-semana').textContent =
    `${mayus(aDate(inicioSemana).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }))} – ${aDate(fin).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`;

  const rejilla = document.getElementById('rejilla-semana');
  rejilla.innerHTML = '';
  let total = 0, ingresos = 0;

  for (let i = 0; i < 7; i++) {
    const iso = sumarDias(inicioSemana, i);
    const citas = citasDe(iso);
    const activas = citas.filter(cuentanParaIngresos);
    total += activas.length;
    ingresos += activas.reduce((t, c) => t + Number(c.precio || 0), 0);

    const col = document.createElement('div');
    const abierto = abiertoEl(iso);
    col.className = 'dia-col'
      + (iso === hoyISO() ? ' dia-col--hoy' : '')
      + (abierto ? '' : ' dia-col--cerrado');
    col.innerHTML = `<div class="dia-col__cabecera">
        <div class="dia-col__nombre">${aDate(iso).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</div>
        <div class="dia-col__numero">${aDate(iso).getDate()}</div>
      </div>` +
      (citas.length
        ? citas.map(c => `<div class="mini-cita mini-cita--${c.estado}">${c.hora} · ${escapar(c.cliente)}</div>`).join('')
        : `<div class="dia-col__vacio">${abierto ? 'Sin citas' : 'Cerrado'}</div>`);

    col.addEventListener('click', () => { fechaActiva = iso; cambiarVista('dia'); });
    rejilla.appendChild(col);
  }

  document.getElementById('resumen-semana').innerHTML =
    `<div><strong>${total}</strong> citas en la semana</div><div><strong>${dinero(ingresos)}</strong> estimado</div>`;
}

/* ───────────── Vista: CLIENTES ───────────── */
function pintarClientes() {
  const q = document.getElementById('buscador').value.trim().toLowerCase();
  const mapa = new Map();

  datos.citas.forEach(c => {
    const clave = (c.telefono || c.cliente).toLowerCase().trim();
    if (!mapa.has(clave)) mapa.set(clave, { nombre: c.cliente, telefono: c.telefono, citas: [] });
    mapa.get(clave).citas.push(c);
  });

  let lista = [...mapa.values()].filter(cl => {
    if (!q) return true;
    return (cl.nombre + ' ' + (cl.telefono || '') + ' ' + cl.citas.map(c => c.servicioNombre).join(' ')).toLowerCase().includes(q);
  });

  lista.forEach(cl => cl.citas.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora)));
  lista.sort((a, b) => (b.citas[0].fecha).localeCompare(a.citas[0].fecha));

  const cont = document.getElementById('lista-clientes');
  if (!lista.length) {
    cont.innerHTML = `<p class="vacio">${datos.citas.length ? 'Sin resultados para esa búsqueda' : 'Todavía no hay clientas registradas'}</p>`;
    return;
  }

  cont.innerHTML = '';
  lista.forEach(cl => {
    const gasto = cl.citas.filter(cuentanParaIngresos).reduce((t, c) => t + Number(c.precio || 0), 0);
    const el = document.createElement('article');
    el.className = 'tarjeta';
    el.innerHTML = `
      <div class="tarjeta__nombre">${escapar(cl.nombre)}</div>
      <div class="tarjeta__meta">${cl.telefono ? escapar(cl.telefono) + ' · ' : ''}${cl.citas.length} visita${cl.citas.length === 1 ? '' : 's'} · ${dinero(gasto)}</div>
      <div class="tarjeta__historial"></div>`;
    const hist = el.querySelector('.tarjeta__historial');
    cl.citas.slice(0, 5).forEach(c => {
      const linea = document.createElement('div');
      linea.className = 'historial-item';
      linea.textContent = `${fechaCorta(c.fecha)} · ${c.hora} · ${c.servicioNombre}`;
      linea.addEventListener('click', () => verDetalle(c.id));
      hist.appendChild(linea);
    });
    cont.appendChild(el);
  });
}

/* ───────────── Vista: INGRESOS ─────────────
   Cuánto se ha cobrado en un mes, o entre dos fechas cualesquiera.

   «Cobrado» es solo lo que está marcado como **completada**. Lo pendiente y
   lo confirmado todavía no ha entrado en caja, así que se cuenta aparte: una
   previsión y el dinero real no pueden salir en la misma cifra.

   Todo se calcula aquí con las citas que ya están en memoria — la API las
   manda todas —, así que cambiar el rango no cuesta ni una ida al servidor. */

const ESTADOS_COBRADOS  = ['completada'];
const ESTADOS_PREVISTOS = ['pendiente', 'confirmada'];
const ESTADOS_PERDIDOS  = ['cancelada', 'ausente'];

/* Un mes es «YYYY-MM», el mismo formato que usa <input type="month">. */
const mesDe = (iso) => iso.slice(0, 7);

function ultimoDiaDeMes(ym) {
  const [anio, mes] = ym.split('-').map(Number);
  return hoyISO(new Date(anio, mes, 0));   // día 0 del mes siguiente = último de este
}

function sumarMeses(ym, n) {
  const [anio, mes] = ym.split('-').map(Number);
  const d = new Date(anio, mes - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const rangoDeMes = (ym) => ({ desde: `${ym}-01`, hasta: ultimoDiaDeMes(ym) });

/* Si el rango es justo un mes natural devuelve ese mes; si no, cadena vacía.
   Es lo que mantiene sincronizados el selector de mes y las dos fechas. */
function mesCompleto(desde, hasta) {
  const ym = mesDe(desde);
  return (desde === `${ym}-01` && hasta === ultimoDiaDeMes(ym)) ? ym : '';
}

function tituloRango(desde, hasta) {
  const ym = mesCompleto(desde, hasta);
  if (ym) return mayus(aDate(desde).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }));
  if (desde === hasta) return fechaLarga(desde);
  const opciones = { day: 'numeric', month: 'long', year: 'numeric' };
  return `${aDate(desde).toLocaleDateString('es-MX', opciones)} – ${aDate(hasta).toLocaleDateString('es-MX', opciones)}`;
}

function diasDelRango(desde, hasta) {
  return Math.round((aDate(hasta) - aDate(desde)) / 86400000) + 1;
}

/* Los dos extremos entran. Comparar cadenas ISO ya ordena bien las fechas. */
const citasEntre = (desde, hasta) =>
  datos.citas.filter(c => c.fecha >= desde && c.fecha <= hasta);

const sumaPrecios = (citas) => citas.reduce((t, c) => t + Number(c.precio || 0), 0);

/* Agrupa por lo que devuelva `clave`; las claves vacías se descartan. */
function agrupar(citas, clave) {
  const grupos = new Map();
  citas.forEach(c => {
    const k = clave(c);
    if (k === null || k === undefined || k === '') return;
    if (!grupos.has(k)) grupos.set(k, { clave: k, nombre: String(k), n: 0, total: 0 });
    const g = grupos.get(k);
    g.n += 1;
    g.total += Number(c.precio || 0);
  });
  return [...grupos.values()];
}

/* Lista con barra proporcional. La barra solo ayuda a comparar de un vistazo:
   la cifra exacta va siempre escrita al lado. */
function pintarDesglose(contenedor, filas, vacio) {
  if (!filas.length) {
    contenedor.innerHTML = `<p class="rango-vacio">${escapar(vacio)}</p>`;
    return;
  }
  const tope = Math.max(...filas.map(f => f.total), 1);
  contenedor.innerHTML = filas.map(f => `
    <div class="fila fila--dato">
      <span class="fila__nombre">${escapar(f.nombre)}
        <span class="fila__meta">· ${f.n} servicio${f.n === 1 ? '' : 's'}</span></span>
      <span class="fila__cifra">${dinero(f.total)}</span>
      <span class="barra"><span class="barra__relleno" style="width:${Math.max(2, Math.round(f.total / tope * 100))}%"></span></span>
    </div>`).join('');
}

function pintarIngresos() {
  /* Los controles siempre reflejan el rango que se está mostrando. */
  document.getElementById('ing-desde').value = ingDesde;
  document.getElementById('ing-hasta').value = ingHasta;
  document.getElementById('ing-mes').value   = mesCompleto(ingDesde, ingHasta);
  document.getElementById('titulo-ingresos').textContent = tituloRango(ingDesde, ingHasta);

  const enRango   = citasEntre(ingDesde, ingHasta);
  const cobradas  = enRango.filter(c => ESTADOS_COBRADOS.includes(c.estado));
  const previstas = enRango.filter(c => ESTADOS_PREVISTOS.includes(c.estado));
  const perdidas  = enRango.filter(c => ESTADOS_PERDIDOS.includes(c.estado));

  const cobrado  = sumaPrecios(cobradas);
  const previsto = sumaPrecios(previstas);
  const perdido  = sumaPrecios(perdidas);
  const dias     = diasDelRango(ingDesde, ingHasta);

  document.getElementById('resumen-ingresos').innerHTML =
    `<div><strong>${dias}</strong> día${dias === 1 ? '' : 's'} en el rango</div>
     <div><strong>${enRango.length}</strong> cita${enRango.length === 1 ? '' : 's'} en total</div>`;

  const canceladas = perdidas.filter(c => c.estado === 'cancelada').length;
  const ausentes   = perdidas.filter(c => c.estado === 'ausente').length;
  const plural = (n) => (n === 1 ? '' : 's');

  document.getElementById('ing-cifras').innerHTML = `
    <div class="cifra cifra--principal">
      <p class="cifra__etiqueta">Cobrado</p>
      <div class="cifra__valor">${dinero(cobrado)}</div>
      <p class="cifra__nota">${cobradas.length} servicio${plural(cobradas.length)} completado${plural(cobradas.length)}</p>
    </div>
    <div class="cifra">
      <p class="cifra__etiqueta">Por cobrar</p>
      <div class="cifra__valor">${dinero(previsto)}</div>
      <p class="cifra__nota">${previstas.length} cita${plural(previstas.length)} pendiente${plural(previstas.length)} o confirmada${plural(previstas.length)}</p>
    </div>
    <div class="cifra">
      <p class="cifra__etiqueta">Ticket medio</p>
      <div class="cifra__valor">${dinero(cobradas.length ? cobrado / cobradas.length : 0)}</div>
      <p class="cifra__nota">Por servicio cobrado</p>
    </div>
    <div class="cifra">
      <p class="cifra__etiqueta">No se cobró</p>
      <div class="cifra__valor">${dinero(perdido)}</div>
      <p class="cifra__nota">${canceladas} cancelada${plural(canceladas)} · ${ausentes} no asistió</p>
    </div>`;

  const porTotal = (a, b) => b.total - a.total;

  pintarDesglose(
    document.getElementById('ing-servicios'),
    agrupar(cobradas, c => c.servicioNombre || 'Sin servicio').sort(porTotal),
    'No hay servicios cobrados en este rango.'
  );

  /* El desglose por terapeuta solo tiene sentido si alguien las tiene asignadas. */
  const porTerapeuta = agrupar(cobradas, c => c.terapeuta).sort(porTotal);
  document.getElementById('panel-terapeutas').hidden = !porTerapeuta.length;
  if (porTerapeuta.length) pintarDesglose(document.getElementById('ing-terapeutas'), porTerapeuta, '');

  const porDia = agrupar(cobradas, c => c.fecha)
    .sort((a, b) => a.clave.localeCompare(b.clave))
    .map(g => ({ ...g, nombre: fechaCorta(g.clave) }));

  pintarDesglose(
    document.getElementById('ing-dias'),
    porDia,
    'Ningún día del rango tiene servicios cobrados.'
  );
}

/* Cambiar el rango pasa siempre por aquí, para que los controles y lo pintado
   no puedan acabar diciendo cosas distintas. */
function fijarRango(desde, hasta) {
  ingDesde = desde;
  ingHasta = hasta;
  pintarIngresos();
}

/* ───────────── Vista: AJUSTES ─────────────
   El horario se muestra, no se edita: se cambia en config.js para que
   la agenda y la página pública no puedan contradecirse. */
function pintarHorario() {
  const hoyIdx = (new Date().getDay() + 6) % 7;
  document.getElementById('horario-agenda').innerHTML = window.ALMA.horario.map((h, i) => {
    const turnos = h.turnos || [];
    const texto = turnos.length
      ? turnos.map(([de, a]) => `${de} – ${a}`).join('  ·  ')
      : 'Cerrado';
    return `<div class="fila-horario${i === hoyIdx ? ' fila-horario--hoy' : ''}${turnos.length ? '' : ' fila-horario--cerrado'}">
      <span>${escapar(h.dia)}</span><span>${escapar(texto)}</span>
    </div>`;
  }).join('');
}

function pintarAjustes() {
  const cfg = datos.config;
  pintarHorario();
  document.getElementById('cfg-intervalo').value = cfg.intervalo;
  document.getElementById('cfg-prefijo').value   = cfg.prefijo;
  document.getElementById('cfg-plantilla').value = cfg.plantilla;

  /* El selector de categoría se rellena una sola vez: si se repintara en cada
     refresco, borraría lo que estuvieras eligiendo a mitad de una edición. */
  const selCat = document.getElementById('select-categoria');
  if (!selCat.options.length) limpiarFormServicio();

  const ls = document.getElementById('lista-servicios');
  ls.innerHTML = '';
  datos.servicios.forEach(s => {
    const cat = categoriaPorId(s.categoria);
    const fila = document.createElement('div');
    fila.className = 'fila fila--servicio' + (cat ? '' : ' fila--sin-categoria');
    fila.innerHTML = `<span class="fila__nombre">${escapar(s.nombre)}${s.tipo ? ` <em class="fila__tipo">${escapar(s.tipo)}</em>` : ''}
        <span class="fila__categoria">${cat ? escapar(cat.titulo) : 'Sin categoría · sale en «Otros tratamientos»'}</span></span>
      <span class="fila__meta">${s.duracion} min · ${dinero(s.precio)}</span>
      <button class="editar" title="Editar servicio">Editar</button>
      <button class="quitar" title="Archivar servicio">×</button>`;
    fila.querySelector('.editar').addEventListener('click', () => editarServicio(s));
    fila.querySelector('.quitar').addEventListener('click', async () => {
      if (!confirm(`¿Quitar "${s.nombre}" de la carta? Las citas que ya lo usaron no se modifican.`)) return;
      const r = await pedir(() => API.borrarServicio(s.id), 'Servicio archivado');
      if (!r) return;
      datos.servicios = datos.servicios.filter(x => x.id !== s.id);
      // Si justo era el que estabas editando, el formulario ya no apunta a nada
      if (formServicio.elements.id.value === s.id) limpiarFormServicio();
      pintarAjustes();
    });
    ls.appendChild(fila);
  });

  const lt = document.getElementById('lista-terapeutas');
  lt.innerHTML = datos.terapeutas.length ? '' : '<p class="ayuda" style="margin:0">Aún no has añadido terapeutas.</p>';
  datos.terapeutas.forEach(t => {
    const et = document.createElement('span');
    et.className = 'etiqueta';
    et.innerHTML = `${escapar(t)}<button class="quitar" title="Quitar">×</button>`;
    et.querySelector('.quitar').addEventListener('click', async () => {
      const r = await pedir(() => API.borrarTerapeuta(t), 'Terapeuta eliminada');
      if (!r) return;
      datos.terapeutas = datos.terapeutas.filter(x => x !== t);
      pintarAjustes();
    });
    lt.appendChild(et);
  });
}

/* ───────────── Modal: alta y edición ───────────── */
const dlgCita  = document.getElementById('dlg-cita');
const formCita = document.getElementById('form-cita');

/* Las opciones salen agrupadas por categoría, en el mismo orden que la carta.
   Lo que se añade a mano desde Ajustes cae en un grupo aparte al final. */
function opcionesDeServicio() {
  const etiqueta = (s) =>
    `<option value="${s.id}">${escapar(s.nombre)}${s.tipo ? ' · ' + escapar(s.tipo) : ''} · ${s.duracion} min</option>`;

  const grupos = [];
  const agrupados = new Set();

  window.ALMA.categorias.forEach(cat => {
    const suyos = datos.servicios.filter(s => s.categoria === cat.id);
    if (!suyos.length) return;
    suyos.forEach(s => agrupados.add(s.id));
    grupos.push(`<optgroup label="${escapar(cat.titulo)}">${suyos.map(etiqueta).join('')}</optgroup>`);
  });

  const sueltos = datos.servicios.filter(s => !agrupados.has(s.id));
  if (sueltos.length) grupos.push(`<optgroup label="Otros">${sueltos.map(etiqueta).join('')}</optgroup>`);

  return grupos.join('');
}

function rellenarSelectores(servicioId, terapeuta) {
  const ss = document.getElementById('select-servicio');
  ss.innerHTML = opcionesDeServicio();
  if (servicioId && servicioPorId(servicioId)) ss.value = servicioId;

  const st = document.getElementById('select-terapeuta');
  st.innerHTML = '<option value="">Sin asignar</option>' +
    datos.terapeutas.map(t => `<option value="${escapar(t)}">${escapar(t)}</option>`).join('');
  if (terapeuta) st.value = terapeuta;
}

function abrirCita(id, previo = {}) {
  if (!datos.servicios.length) { aviso('Primero añade un servicio en Ajustes'); cambiarVista('ajustes'); return; }
  const cita = id ? datos.citas.find(c => c.id === id) : null;
  document.getElementById('titulo-modal').textContent = cita ? 'Editar cita' : 'Nueva cita';
  document.getElementById('aviso-conflicto').hidden = true;
  delete formCita.dataset.conflictoAceptado;

  formCita.reset();
  rellenarSelectores(cita?.servicioId || datos.servicios[0].id, cita?.terapeuta);
  const f = formCita.elements;
  f.id.value        = cita?.id || '';
  f.fecha.value     = cita?.fecha || previo.fecha || fechaActiva;
  f.hora.value      = cita?.hora || previo.hora || horaPorDefecto(f.fecha.value);
  f.cliente.value   = cita?.cliente || '';
  f.telefono.value  = cita?.telefono || '';
  f.notas.value     = cita?.notas || '';
  f.estado.value    = cita?.estado || 'pendiente';
  const serv = servicioPorId(cita?.servicioId) || datos.servicios[0];
  f.duracion.value  = cita?.duracion ?? serv.duracion;
  f.precio.value    = cita?.precio ?? serv.precio;

  dlgCita.showModal();
  setTimeout(() => f.cliente.focus(), 60);
}

document.getElementById('select-servicio').addEventListener('change', (e) => {
  const s = servicioPorId(e.target.value);
  if (!s) return;
  formCita.elements.duracion.value = s.duracion;
  formCita.elements.precio.value   = s.precio;
});

formCita.addEventListener('submit', async (e) => {
  if (e.submitter && e.submitter.value === 'cancelar') return;

  /* Se corta el envío del <dialog> siempre: la modal solo se cierra cuando
     el servidor confirma que la cita quedó guardada. */
  e.preventDefault();

  const f = formCita.elements;
  const serv = servicioPorId(f.servicioId.value);
  const cita = {
    id: f.id.value || '',
    fecha: f.fecha.value,
    hora: f.hora.value,
    duracion: Number(f.duracion.value),
    precio: Number(f.precio.value),
    cliente: f.cliente.value.trim(),
    telefono: f.telefono.value.trim(),
    servicioId: f.servicioId.value,
    servicioNombre: serv ? serv.nombre : 'Servicio',
    terapeuta: f.terapeuta.value,
    notas: f.notas.value.trim(),
    estado: f.estado.value,
  };

  const avisoEl = document.getElementById('aviso-conflicto');

  /* El horario de atención no se negocia: aquí no hay «guardar igualmente».
     Si necesitas una excepción, cámbiala en `horario` de assets/js/config.js. */
  const fueraDeHorario = motivoFueraDeHorario(cita.fecha, cita.hora, cita.duracion);
  if (fueraDeHorario) {
    avisoEl.textContent = fueraDeHorario;
    avisoEl.hidden = false;
    return;
  }

  const choque = conflictoDe(cita);
  if (choque && !formCita.dataset.conflictoAceptado) {
    avisoEl.textContent = `Se cruza con ${choque.cliente} (${choque.hora}, ${choque.servicioNombre}${choque.terapeuta ? ', ' + choque.terapeuta : ''}). Pulsa «Guardar cita» otra vez para agendarla igualmente.`;
    avisoEl.hidden = false;
    formCita.dataset.conflictoAceptado = '1';
    return;
  }

  const boton = document.getElementById('btn-guardar-cita');
  boton.disabled = true;
  const editando = Boolean(cita.id);

  const r = await pedir(() => API.guardarCita(cita), editando ? 'Cita actualizada' : 'Cita agendada ✨');
  boton.disabled = false;
  if (!r) return;

  const i = datos.citas.findIndex(c => c.id === r.cita.id);
  if (i >= 0) datos.citas[i] = r.cita; else datos.citas.push(r.cita);

  dlgCita.close();
  fechaActiva = r.cita.fecha;
  refrescar();
});

/* ───────────── Modal: detalle ───────────── */
const dlgDetalle = document.getElementById('dlg-detalle');

function verDetalle(id) {
  const c = datos.citas.find(x => x.id === id);
  if (!c) return;
  const fin = aHora(aMinutos(c.hora) + Number(c.duracion));

  document.getElementById('detalle-cuerpo').innerHTML = `
    <h2 class="titulo-seccion">${escapar(c.cliente)}</h2>
    <div class="detalle__linea"><span>Servicio</span><span>${escapar(c.servicioNombre)}</span></div>
    <div class="detalle__linea"><span>Cuándo</span><span>${fechaLarga(c.fecha)} · ${c.hora}–${fin}</span></div>
    <div class="detalle__linea"><span>Duración</span><span>${c.duracion} min</span></div>
    <div class="detalle__linea"><span>Precio</span><span>${dinero(c.precio)}</span></div>
    ${c.terapeuta ? `<div class="detalle__linea"><span>Terapeuta</span><span>${escapar(c.terapeuta)}</span></div>` : ''}
    ${c.telefono ? `<div class="detalle__linea"><span>Teléfono</span><span>${escapar(c.telefono)}</span></div>` : ''}
    <div class="detalle__linea"><span>Estado</span><span class="estado estado--${c.estado}">${ESTADOS[c.estado]}</span></div>
    ${c.notas ? `<div class="detalle__notas">${escapar(c.notas)}</div>` : ''}
    <div class="modal__pie">
      ${c.telefono ? '<button class="boton boton--wa" data-accion="whatsapp">WhatsApp</button>' : ''}
      ${c.estado === 'pendiente' ? '<button class="boton boton--oro" data-accion="confirmar">Confirmar</button>' : ''}
      ${c.estado === 'confirmada' ? '<button class="boton boton--oro" data-accion="completar">Marcar completada</button>' : ''}
      <button class="boton boton--fino" data-accion="editar">Editar</button>
      <button class="boton boton--fino boton--peligro" data-accion="eliminar">Eliminar</button>
      <button class="boton boton--fino" data-accion="cerrar">Cerrar</button>
    </div>`;

  document.getElementById('detalle-cuerpo').querySelectorAll('[data-accion]').forEach(btn => {
    btn.addEventListener('click', () => accionDetalle(btn.dataset.accion, c));
  });
  dlgDetalle.showModal();
}

async function accionDetalle(accion, c) {
  if (accion === 'cerrar')   { dlgDetalle.close(); return; }
  if (accion === 'whatsapp') { abrirWhatsApp(c); return; }
  if (accion === 'editar')   { dlgDetalle.close(); abrirCita(c.id); return; }

  if (accion === 'eliminar') {
    if (!confirm(`¿Eliminar la cita de ${c.cliente} del ${fechaLarga(c.fecha)}?`)) return;
    const r = await pedir(() => API.borrarCita(c.id), 'Cita eliminada');
    if (!r) return;
    datos.citas = datos.citas.filter(x => x.id !== c.id);
    dlgDetalle.close();
    refrescar();
    return;
  }

  if (accion === 'confirmar' || accion === 'completar') {
    const nuevo = accion === 'confirmar' ? 'confirmada' : 'completada';
    const r = await pedir(
      () => API.guardarCita({ ...c, estado: nuevo }),
      accion === 'confirmar' ? 'Cita confirmada' : 'Cita completada'
    );
    if (!r) return;
    const i = datos.citas.findIndex(x => x.id === c.id);
    if (i >= 0) datos.citas[i] = r.cita;
    dlgDetalle.close();
    refrescar();
  }
}

/* ───────────── WhatsApp ───────────── */
function abrirWhatsApp(c) {
  const mensaje = datos.config.plantilla
    .replaceAll('{cliente}', c.cliente)
    .replaceAll('{servicio}', c.servicioNombre)
    .replaceAll('{fecha}', fechaLargaMin(c.fecha))
    .replaceAll('{hora}', c.hora)
    .replaceAll('{spa}', datos.config.spa);

  let tel = (c.telefono || '').replace(/\D/g, '');
  const prefijo = (datos.config.prefijo || '').replace(/\D/g, '');
  if (prefijo && !tel.startsWith(prefijo)) tel = prefijo + tel;
  if (!tel) { aviso('Esta cita no tiene teléfono'); return; }

  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener');
}

/* ───────────── Copia de seguridad ─────────────
   Ahora los datos están en el servidor, así que esto ya no es la única red
   de seguridad: es la copia que te llevas fuera por si el servidor falla. */
function exportar() {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `agenda-alma-de-mar-${hoyISO()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  aviso('Copia descargada');
}

function importar(archivo) {
  const lector = new FileReader();
  lector.onload = async () => {
    let d;
    try {
      d = JSON.parse(lector.result);
      if (!Array.isArray(d.citas)) throw new Error('formato');
    } catch {
      aviso('El archivo no es una copia válida');
      return;
    }

    if (!confirm(`Se añadirán ${d.citas.length} citas a la agenda. Las que ya existan se actualizarán. ¿Continuar?`)) return;

    let bien = 0, mal = 0;
    for (const cita of d.citas) {
      try { await API.guardarCita(cita); bien++; } catch { mal++; }
    }
    await traerDatos();
    refrescar();
    pintarAjustes();
    aviso(mal ? `Restauradas ${bien} citas · ${mal} con error` : `Restauradas ${bien} citas`);
  };
  lector.readAsText(archivo);
}

/* ───────────── Navegación ───────────── */
function cambiarVista(v) {
  vistaActiva = v;
  document.querySelectorAll('.vista').forEach(s => s.hidden = s.id !== 'vista-' + v);
  document.querySelectorAll('.pestana').forEach(b => {
    if (b.dataset.vista === v) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  refrescar();
}

function refrescar() {
  if (vistaActiva === 'dia') pintarDia();
  else if (vistaActiva === 'semana') pintarSemana();
  else if (vistaActiva === 'clientes') pintarClientes();
  else if (vistaActiva === 'ingresos') pintarIngresos();
  else if (vistaActiva === 'ajustes') pintarAjustes();
}

function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/* ───────────── Cableado de la interfaz ───────────── */
document.querySelectorAll('.pestana').forEach(b =>
  b.addEventListener('click', () => cambiarVista(b.dataset.vista)));

document.getElementById('btn-nueva').addEventListener('click', () => abrirCita(null));
document.getElementById('dia-anterior').addEventListener('click', () => { fechaActiva = sumarDias(fechaActiva, -1); pintarDia(); });
document.getElementById('dia-siguiente').addEventListener('click', () => { fechaActiva = sumarDias(fechaActiva, 1); pintarDia(); });
document.getElementById('btn-hoy').addEventListener('click', () => { fechaActiva = hoyISO(); pintarDia(); });
document.getElementById('fecha-dia').addEventListener('change', (e) => { if (e.target.value) { fechaActiva = e.target.value; pintarDia(); } });
document.getElementById('semana-anterior').addEventListener('click', () => { inicioSemana = sumarDias(inicioSemana, -7); pintarSemana(); });
document.getElementById('semana-siguiente').addEventListener('click', () => { inicioSemana = sumarDias(inicioSemana, 7); pintarSemana(); });
document.getElementById('btn-semana-actual').addEventListener('click', () => { inicioSemana = lunesDe(hoyISO()); pintarSemana(); });
document.getElementById('buscador').addEventListener('input', pintarClientes);

/* ── Ingresos: el mes de arriba y las dos fechas de abajo son lo mismo ── */
document.getElementById('ing-mes').addEventListener('change', (e) => {
  if (!e.target.value) { pintarIngresos(); return; }   // vaciarlo no cambia el rango
  const r = rangoDeMes(e.target.value);
  fijarRango(r.desde, r.hasta);
});

function saltarMes(n) {
  const base = mesCompleto(ingDesde, ingHasta) || mesDe(ingDesde);
  const r = rangoDeMes(sumarMeses(base, n));
  fijarRango(r.desde, r.hasta);
}
document.getElementById('mes-anterior').addEventListener('click', () => saltarMes(-1));
document.getElementById('mes-siguiente').addEventListener('click', () => saltarMes(1));
document.getElementById('btn-mes-actual').addEventListener('click', () => {
  const r = rangoDeMes(mesDe(hoyISO()));
  fijarRango(r.desde, r.hasta);
});

/* Si el rango se cruza, se arrastra el otro extremo en vez de dar un error:
   nadie quiere leer un aviso por poner las fechas al revés. */
document.getElementById('ing-desde').addEventListener('change', (e) => {
  const v = e.target.value;
  if (!v) { pintarIngresos(); return; }
  fijarRango(v, v > ingHasta ? v : ingHasta);
});
document.getElementById('ing-hasta').addEventListener('change', (e) => {
  const v = e.target.value;
  if (!v) { pintarIngresos(); return; }
  fijarRango(v < ingDesde ? v : ingDesde, v);
});

document.querySelectorAll('#panel-rango [data-atajo]').forEach(btn => {
  btn.addEventListener('click', () => {
    const mesHoy = mesDe(hoyISO());
    const anio = mesHoy.slice(0, 4);
    if (btn.dataset.atajo === 'mes')        { const r = rangoDeMes(mesHoy); fijarRango(r.desde, r.hasta); }
    if (btn.dataset.atajo === 'mes-pasado') { const r = rangoDeMes(sumarMeses(mesHoy, -1)); fijarRango(r.desde, r.hasta); }
    if (btn.dataset.atajo === 'trimestre')  { fijarRango(`${sumarMeses(mesHoy, -2)}-01`, ultimoDiaDeMes(mesHoy)); }
    if (btn.dataset.atajo === 'anio')       { fijarRango(`${anio}-01-01`, `${anio}-12-31`); }
  });
});

['intervalo', 'prefijo', 'plantilla'].forEach(k => {
  document.getElementById('cfg-' + k).addEventListener('change', async (e) => {
    const valor = k === 'intervalo' ? Number(e.target.value) : e.target.value;
    const r = await pedir(() => API.guardarAjustes({ [k]: valor }), 'Ajuste guardado');
    if (!r) return;
    datos.config = { ...CONFIG_INICIAL, ...r.ajustes };
    if (k === 'intervalo') refrescar();
  });
});

/* ───────────── Servicios ─────────────
   El mismo formulario da de alta y edita: con `id` vacío crea, con `id` puesto
   actualiza. La categoría importa más de lo que parece — es la que decide en
   qué grupo aparece el servicio en la página pública. */
const formServicio = document.getElementById('form-servicio');

const categoriaPorId = (id) => window.ALMA.categorias.find(c => c.id === id);

function opcionesDeCategoria(elegida) {
  const marcada = (v) => (v === elegida ? ' selected' : '');
  return window.ALMA.categorias
      .map(c => `<option value="${escapar(c.id)}"${marcada(c.id)}>${escapar(c.titulo)}</option>`)
      .join('')
    + `<option value=""${marcada('')}>Otros tratamientos</option>`;
}

function limpiarFormServicio() {
  formServicio.reset();
  formServicio.elements.id.value = '';
  /* Por defecto, la primera categoría real: así lo que se da de alta cae en un
     grupo de la carta en vez de quedarse suelto. */
  document.getElementById('select-categoria').innerHTML =
    opcionesDeCategoria(window.ALMA.categorias[0]?.id ?? '');
  document.getElementById('btn-servicio').textContent = 'Añadir servicio';
  document.getElementById('btn-cancelar-servicio').hidden = true;
}

function editarServicio(s) {
  const f = formServicio.elements;
  f.id.value          = s.id;
  f.nombre.value      = s.nombre;
  f.tipo.value        = s.tipo || '';
  f.duracion.value    = s.duracion;
  f.precio.value      = s.precio;
  f.descripcion.value = s.descripcion || '';
  document.getElementById('select-categoria').innerHTML = opcionesDeCategoria(s.categoria || '');
  document.getElementById('btn-servicio').textContent = 'Guardar cambios';
  document.getElementById('btn-cancelar-servicio').hidden = false;
  formServicio.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => f.nombre.focus(), 200);
}

document.getElementById('btn-cancelar-servicio').addEventListener('click', limpiarFormServicio);

formServicio.addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const editando = Boolean(f.id.value);

  const r = await pedir(() => API.guardarServicio({
    id: f.id.value,
    nombre: f.nombre.value.trim(),
    tipo: f.tipo.value.trim(),
    categoria: f.categoria.value,
    duracion: Number(f.duracion.value),
    precio: Number(f.precio.value),
    descripcion: f.descripcion.value.trim(),
  }), editando ? 'Servicio actualizado' : 'Servicio añadido');
  if (!r) return;

  const i = datos.servicios.findIndex(x => x.id === r.servicio.id);
  if (i >= 0) datos.servicios[i] = r.servicio; else datos.servicios.push(r.servicio);

  limpiarFormServicio();
  pintarAjustes();
});

document.getElementById('form-terapeuta').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nombre = e.target.elements.nombre.value.trim();
  if (!nombre) return;
  const r = await pedir(() => API.guardarTerapeuta(nombre), 'Terapeuta añadida');
  if (!r) return;
  if (!datos.terapeutas.includes(nombre)) datos.terapeutas.push(nombre);
  e.target.reset();
  pintarAjustes();
});

document.getElementById('btn-exportar').addEventListener('click', exportar);
document.getElementById('btn-importar').addEventListener('click', () => document.getElementById('archivo-importar').click());
document.getElementById('archivo-importar').addEventListener('change', (e) => {
  if (e.target.files[0]) importar(e.target.files[0]);
  e.target.value = '';
});

/* ───────────── Sesión ───────────── */
document.getElementById('btn-salir').addEventListener('click', () => {
  if (confirm('¿Cerrar sesión?')) Acceso.cerrarSesion();
});

document.getElementById('form-clave').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const salida = document.getElementById('clave-resultado');

  const decir = (texto, ok) => {
    salida.className = 'clave-resultado clave-resultado--' + (ok ? 'ok' : 'error');
    salida.textContent = texto;
    salida.hidden = false;
  };

  if (f.nueva.value !== f.repite.value) return decir('Las dos contraseñas nuevas no coinciden.', false);

  try {
    await Acceso.cambiarClave(f.actual.value, f.nueva.value);
    e.target.reset();
    decir('Contraseña cambiada. La próxima vez que entres, en cualquier dispositivo, usa la nueva.', true);
    aviso('Contraseña cambiada');
  } catch (err) {
    if (err.sesion === false) { Acceso.sesionCaducada(); return; }
    decir(err.message, false);
  }
});

/* ───────────── Volver a la pestaña ─────────────
   Ahora la agenda se comparte entre dispositivos: si agendaste algo desde el
   celular, al volver a la computadora lo que hay en pantalla ya está viejo.
   Al recuperar el foco se vuelve a preguntar al servidor. */
let refrescando = false;

document.addEventListener('visibilitychange', async () => {
  if (document.hidden || refrescando) return;
  if (document.getElementById('app').hidden) return;   // aún sin sesión
  // Con una modal abierta no se toca nada: sería tirarle el formulario encima
  if (dlgCita.open || dlgDetalle.open) return;

  refrescando = true;
  try {
    await traerDatos();
    refrescar();
  } catch (e) {
    if (e.sesion === false) Acceso.sesionCaducada();
  } finally {
    refrescando = false;
  }
});

/* ───────────── Arranque ─────────────
   Lo llama auth.js cuando el servidor confirma que hay sesión. */
window.iniciarAgenda = async function iniciarAgenda() {
  try {
    await traerDatos();
  } catch (e) {
    if (e.sesion === false) { Acceso.sesionCaducada(); return; }
    aviso('⚠️ No se pudieron cargar los datos: ' + e.message);
    return;
  }
  pintarAjustes();
  cambiarVista('dia');
};
