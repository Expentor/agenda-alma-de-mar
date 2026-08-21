/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Agenda de citas
   Todo se guarda en el navegador (localStorage). Sin servidor.
   ══════════════════════════════════════════════════════════ */

const CLAVE = 'almademar.agenda.v1';

const SERVICIOS_INICIALES = [
  { id: 's1', nombre: 'Limpieza facial profunda',  duracion: 60, precio: 850 },
  { id: 's2', nombre: 'Facial hidratante',          duracion: 50, precio: 750 },
  { id: 's3', nombre: 'Peeling químico',            duracion: 45, precio: 1100 },
  { id: 's4', nombre: 'Radiofrecuencia facial',     duracion: 40, precio: 950 },
  { id: 's5', nombre: 'Masaje relajante',           duracion: 60, precio: 800 },
  { id: 's6', nombre: 'Masaje descontracturante',   duracion: 60, precio: 900 },
  { id: 's7', nombre: 'Ritual Alma de Mar',         duracion: 90, precio: 1500 },
];

const CONFIG_INICIAL = {
  spa: 'Alma de Mar',
  apertura: '09:00',
  cierre: '19:00',
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

/* ───────────── Estado ───────────── */
let datos = cargar();
let fechaActiva = hoyISO();
let inicioSemana = lunesDe(hoyISO());
let vistaActiva = 'dia';

function cargar() {
  try {
    const bruto = localStorage.getItem(CLAVE);
    if (bruto) {
      const d = JSON.parse(bruto);
      return {
        citas: d.citas || [],
        servicios: d.servicios || SERVICIOS_INICIALES,
        terapeutas: d.terapeutas || [],
        config: { ...CONFIG_INICIAL, ...(d.config || {}) },
      };
    }
  } catch (e) {
    console.error('No se pudo leer la agenda guardada', e);
  }
  return { citas: [], servicios: [...SERVICIOS_INICIALES], terapeutas: [], config: { ...CONFIG_INICIAL } };
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch (e) {
    aviso('⚠️ No se pudo guardar. Revisa el espacio del navegador.');
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

/* ───────────── Avisos ───────────── */
function aviso(texto) {
  const cont = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso';
  el.textContent = texto;
  cont.appendChild(el);
  setTimeout(() => el.remove(), 3200);
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
  let ini = aMinutos(datos.config.apertura);
  let fin = aMinutos(datos.config.cierre);
  citas.forEach(c => {                       // amplía el rango si hay citas fuera de horario
    ini = Math.min(ini, aMinutos(c.hora));
    fin = Math.max(fin, aMinutos(c.hora) + Number(c.duracion));
  });
  ini = Math.floor(ini / paso) * paso;

  const cont = document.getElementById('agenda-dia');
  cont.innerHTML = '';

  for (let m = ini; m < fin; m += paso) {
    const franja = document.createElement('div');
    franja.className = 'franja' + (m % 60 === 0 ? ' franja--hora-en-punto' : '');
    franja.innerHTML = `<div class="franja__hora">${aHora(m)}</div>`;

    const cuerpo = document.createElement('div');
    cuerpo.className = 'franja__contenido';

    const empiezan = citas.filter(c => { const s = aMinutos(c.hora); return s >= m && s < m + paso; });
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
    col.className = 'dia-col' + (iso === hoyISO() ? ' dia-col--hoy' : '');
    col.innerHTML = `<div class="dia-col__cabecera">
        <div class="dia-col__nombre">${aDate(iso).toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', '')}</div>
        <div class="dia-col__numero">${aDate(iso).getDate()}</div>
      </div>` +
      (citas.length
        ? citas.map(c => `<div class="mini-cita mini-cita--${c.estado}">${c.hora} · ${escapar(c.cliente)}</div>`).join('')
        : '<div class="dia-col__vacio">Sin citas</div>');

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

/* ───────────── Vista: AJUSTES ───────────── */
function pintarAjustes() {
  const cfg = datos.config;
  document.getElementById('cfg-apertura').value  = cfg.apertura;
  document.getElementById('cfg-cierre').value    = cfg.cierre;
  document.getElementById('cfg-intervalo').value = cfg.intervalo;
  document.getElementById('cfg-prefijo').value   = cfg.prefijo;
  document.getElementById('cfg-plantilla').value = cfg.plantilla;

  const ls = document.getElementById('lista-servicios');
  ls.innerHTML = '';
  datos.servicios.forEach(s => {
    const fila = document.createElement('div');
    fila.className = 'fila';
    fila.innerHTML = `<span class="fila__nombre">${escapar(s.nombre)}</span>
      <span class="fila__meta">${s.duracion} min · ${dinero(s.precio)}</span>
      <button class="quitar" title="Eliminar servicio">×</button>`;
    fila.querySelector('.quitar').addEventListener('click', () => {
      if (!confirm(`¿Eliminar el servicio "${s.nombre}"? Las citas ya creadas no se modifican.`)) return;
      datos.servicios = datos.servicios.filter(x => x.id !== s.id);
      guardar(); pintarAjustes(); aviso('Servicio eliminado');
    });
    ls.appendChild(fila);
  });

  const lt = document.getElementById('lista-terapeutas');
  lt.innerHTML = datos.terapeutas.length ? '' : '<p class="ayuda" style="margin:0">Aún no has añadido terapeutas.</p>';
  datos.terapeutas.forEach(t => {
    const et = document.createElement('span');
    et.className = 'etiqueta';
    et.innerHTML = `${escapar(t)}<button class="quitar" title="Quitar">×</button>`;
    et.querySelector('.quitar').addEventListener('click', () => {
      datos.terapeutas = datos.terapeutas.filter(x => x !== t);
      guardar(); pintarAjustes(); aviso('Terapeuta eliminada');
    });
    lt.appendChild(et);
  });
}

/* ───────────── Modal: alta y edición ───────────── */
const dlgCita  = document.getElementById('dlg-cita');
const formCita = document.getElementById('form-cita');

function rellenarSelectores(servicioId, terapeuta) {
  const ss = document.getElementById('select-servicio');
  ss.innerHTML = datos.servicios.map(s => `<option value="${s.id}">${escapar(s.nombre)} · ${s.duracion} min</option>`).join('');
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
  f.hora.value      = cita?.hora || previo.hora || datos.config.apertura;
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

formCita.addEventListener('submit', (e) => {
  if (e.submitter && e.submitter.value === 'cancelar') return;
  const f = formCita.elements;
  const serv = servicioPorId(f.servicioId.value);
  const cita = {
    id: f.id.value || 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
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

  const choque = conflictoDe(cita);
  if (choque && !formCita.dataset.conflictoAceptado) {
    e.preventDefault();
    const el = document.getElementById('aviso-conflicto');
    el.textContent = `Se cruza con ${choque.cliente} (${choque.hora}, ${choque.servicioNombre}${choque.terapeuta ? ', ' + choque.terapeuta : ''}). Pulsa «Guardar cita» otra vez para agendarla igualmente.`;
    el.hidden = false;
    formCita.dataset.conflictoAceptado = '1';
    return;
  }

  const i = datos.citas.findIndex(c => c.id === cita.id);
  if (i >= 0) datos.citas[i] = cita; else datos.citas.push(cita);
  guardar();
  fechaActiva = cita.fecha;
  refrescar();
  aviso(i >= 0 ? 'Cita actualizada' : 'Cita agendada ✨');
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

function accionDetalle(accion, c) {
  if (accion === 'cerrar')   { dlgDetalle.close(); return; }
  if (accion === 'whatsapp') { abrirWhatsApp(c); return; }
  if (accion === 'editar')   { dlgDetalle.close(); abrirCita(c.id); return; }

  if (accion === 'eliminar') {
    if (!confirm(`¿Eliminar la cita de ${c.cliente} del ${fechaLarga(c.fecha)}?`)) return;
    datos.citas = datos.citas.filter(x => x.id !== c.id);
    guardar(); dlgDetalle.close(); refrescar(); aviso('Cita eliminada');
    return;
  }
  if (accion === 'confirmar' || accion === 'completar') {
    c.estado = accion === 'confirmar' ? 'confirmada' : 'completada';
    guardar(); dlgDetalle.close(); refrescar();
    aviso(accion === 'confirmar' ? 'Cita confirmada' : 'Cita completada');
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

/* ───────────── Copia de seguridad ───────────── */
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
  lector.onload = () => {
    try {
      const d = JSON.parse(lector.result);
      if (!Array.isArray(d.citas)) throw new Error('formato');
      if (!confirm(`Se restaurarán ${d.citas.length} citas y se reemplazará la agenda actual. ¿Continuar?`)) return;
      datos = {
        citas: d.citas,
        servicios: d.servicios || SERVICIOS_INICIALES,
        terapeutas: d.terapeutas || [],
        config: { ...CONFIG_INICIAL, ...(d.config || {}) },
      };
      guardar(); refrescar(); pintarAjustes(); aviso('Agenda restaurada');
    } catch (e) {
      aviso('El archivo no es una copia válida');
    }
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
  else if (vistaActiva === 'ajustes') pintarAjustes();
}

function escapar(t) {
  return String(t ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/* ───────────── Arranque ───────────── */
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

['apertura', 'cierre', 'intervalo', 'prefijo', 'plantilla'].forEach(k => {
  document.getElementById('cfg-' + k).addEventListener('change', (e) => {
    datos.config[k] = k === 'intervalo' ? Number(e.target.value) : e.target.value;
    guardar(); aviso('Ajuste guardado');
  });
});

document.getElementById('form-servicio').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target.elements;
  datos.servicios.push({
    id: 's' + Date.now().toString(36),
    nombre: f.nombre.value.trim(),
    duracion: Number(f.duracion.value),
    precio: Number(f.precio.value),
  });
  guardar(); e.target.reset(); pintarAjustes(); aviso('Servicio añadido');
});

document.getElementById('form-terapeuta').addEventListener('submit', (e) => {
  e.preventDefault();
  const nombre = e.target.elements.nombre.value.trim();
  if (nombre && !datos.terapeutas.includes(nombre)) datos.terapeutas.push(nombre);
  guardar(); e.target.reset(); pintarAjustes(); aviso('Terapeuta añadida');
});

document.getElementById('btn-exportar').addEventListener('click', exportar);
document.getElementById('btn-importar').addEventListener('click', () => document.getElementById('archivo-importar').click());
document.getElementById('archivo-importar').addEventListener('change', (e) => {
  if (e.target.files[0]) importar(e.target.files[0]);
  e.target.value = '';
});
document.getElementById('btn-borrar').addEventListener('click', () => {
  if (!confirm('Se borrarán TODAS las citas, servicios y ajustes de este navegador. ¿Seguro?')) return;
  if (!confirm('Última confirmación: esta acción no se puede deshacer. ¿Borrar todo?')) return;
  localStorage.removeItem(CLAVE);
  datos = cargar();
  refrescar(); pintarAjustes(); aviso('Agenda vaciada');
});

pintarAjustes();
cambiarVista('dia');
