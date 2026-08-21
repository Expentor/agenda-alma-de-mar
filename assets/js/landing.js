/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Página pública
   Lee los datos del spa de assets/js/config.js
   ══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const cfg = window.ALMA;
  const $  = (sel) => document.querySelector(sel);

  // Marca que el JS arrancó: solo entonces el CSS oculta lo que aparece al scroll
  document.documentElement.classList.add('js');

  const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  const dinero = (n) => new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  }).format(n || 0);

  const enlaceWA = (texto) =>
    `https://wa.me/${cfg.whatsapp.replace(/\D/g, '')}` +
    (texto ? `?text=${encodeURIComponent(texto)}` : '');

  /* ───────────── Barra: fijado y menú móvil ───────────── */
  const barra = $('#barra');
  const menu  = $('#menu');
  const btnMenu = $('#btn-menu');

  const alScroll = () => barra.classList.toggle('barra--fija', window.scrollY > 40);
  alScroll();
  addEventListener('scroll', alScroll, { passive: true });

  btnMenu.addEventListener('click', () => {
    const abierto = menu.classList.toggle('abierto');
    btnMenu.setAttribute('aria-expanded', String(abierto));
    btnMenu.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
  });

  // Al elegir una sección el menú se cierra solo
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    menu.classList.remove('abierto');
    btnMenu.setAttribute('aria-expanded', 'false');
  }));

  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('abierto')) btnMenu.click();
  });

  /* ───────────── Fotos del spa ─────────────
     Cada hueco arranca con su marcador de marca. Si config.js
     dice que ya hay fotos, se cambian por las reales; y si una
     falta, esa vuelve sola a su marcador. */
  if (cfg.fotosReales) {
    const ext = (cfg.formatoFotos || 'jpg').replace(/^\./, '');
    document.querySelectorAll('[data-foto]').forEach((img) => {
      const marcador = img.src;
      img.addEventListener('error', function alFallar() {
        img.removeEventListener('error', alFallar);
        img.src = marcador;
      });
      img.src = `assets/img/spa/${img.dataset.foto}.${ext}`;
    });
  }

  /* ───────────── Carta de servicios ─────────────
     Se pide al servidor, que la lee de la base de datos: así los precios
     de la página y los de la agenda son siempre los mismos. */
  const tarjetaServicio = (s) => `
    <article class="servicio${s.insignia ? ' servicio--destacado' : ''}">
      ${s.insignia ? `<span class="servicio__insignia">${escapar(s.insignia)}</span>` : ''}
      <h4 class="servicio__nombre">${escapar(s.nombre)}</h4>
      ${s.tipo ? `<p class="servicio__tipo">${escapar(s.tipo)}</p>` : ''}
      <p class="servicio__desc">${escapar(s.descripcion || '')}</p>
      <div class="servicio__pie">
        <span class="servicio__precio">${dinero(s.precio)}</span>
        <span class="servicio__duracion">${s.duracion} min</span>
      </div>
    </article>`;

  let servicios = [];

  function pintarCarta() {
    $('#lista-servicios').innerHTML = cfg.categorias.map((cat) => {
      const suyos = servicios.filter((s) => s.categoria === cat.id);
      if (!suyos.length) return '';
      return `
        <section class="carta-grupo">
          <header class="carta-grupo__cabecera revelar">
            <h3 class="carta-grupo__titulo">${escapar(cat.titulo)}</h3>
            ${cat.nota ? `<span class="carta-grupo__nota">${escapar(cat.nota)}</span>` : ''}
          </header>
          <div class="servicios">${suyos.map(tarjetaServicio).join('')}</div>
        </section>`;
    }).join('');
  }

  function pintarSelectorDeReserva() {
    const sel = $('#reserva-servicio');
    sel.innerHTML = cfg.categorias.map((cat) => {
      const suyos = servicios.filter((s) => s.categoria === cat.id);
      if (!suyos.length) return '';
      const opciones = suyos.map((s) =>
        `<option value="${escapar(s.nombre)}">${escapar(s.nombre)} · ${s.duracion} min · ${dinero(s.precio)}</option>`
      ).join('');
      return `<optgroup label="${escapar(cat.titulo)}">${opciones}</optgroup>`;
    }).join('') + '<option value="Aún no lo sé, necesito orientación">Aún no lo sé, necesito orientación</option>';
  }

  /* Si el servidor no contesta, la página sigue en pie: se avisa de que la
     carta no cargó y el botón de WhatsApp sigue funcionando. */
  async function cargarCarta() {
    try {
      const r = await API.serviciosPublicos();
      servicios = r.servicios || [];
    } catch {
      servicios = [];
      $('#lista-servicios').innerHTML =
        `<p class="nota-centro">No pudimos cargar la carta en este momento.
          Escríbenos por WhatsApp y te la pasamos con mucho gusto.</p>`;
      return;
    }
    pintarCarta();
    pintarSelectorDeReserva();
  }

  /* ───────────── Horario ───────────── */
  // getDay(): 0 = domingo. La tabla empieza en lunes.
  const hoyIdx = (new Date().getDay() + 6) % 7;

  $('#horario').innerHTML = cfg.horario.map((h, i) => {
    const turnos = h.turnos || [];
    const cerrado = turnos.length === 0;
    const clases = [i === hoyIdx ? 'hoy' : '', cerrado ? 'cerrado' : ''].filter(Boolean).join(' ');
    // Los turnos partidos se apilan, para que en el móvil no se corten
    const texto = cerrado
      ? 'Cerrado'
      : turnos.map(([de, a]) => `<span>${escapar(de)} – ${escapar(a)}</span>`).join('');
    return `<div class="${clases}">
      <dt>${escapar(h.dia)}${i === hoyIdx ? ' · hoy' : ''}</dt>
      <dd>${texto}</dd>
    </div>`;
  }).join('');

  /* ───────────── Dirección, redes y enlaces ───────────── */
  const d = cfg.direccion;
  // Las líneas vacías se saltan: así una dirección incompleta no deja huecos
  const lineas = [d.linea1, d.linea2, d.ciudad].filter(Boolean).map(escapar).join('<br>');
  $('#direccion').innerHTML = `
    ${lineas}<br><br>
    <a href="tel:+${cfg.whatsapp.replace(/\D/g, '')}">${escapar(cfg.telefonoVisible)}</a><br>
    <a href="mailto:${escapar(cfg.correo)}">${escapar(cfg.correo)}</a>`;

  $('#redes').innerHTML = cfg.redes.map((r) =>
    `<a href="${escapar(r.url)}" target="_blank" rel="noopener">${escapar(r.nombre)}</a>`).join('');

  $('#btn-mapa').href = d.mapa;
  $('#btn-llamar').href = `tel:+${cfg.whatsapp.replace(/\D/g, '')}`;

  const saludo = `Hola, escribo desde la página de ${cfg.nombre}. Me gustaría más información.`;
  $('#btn-wa').href = enlaceWA(saludo);
  $('#wa-flotante').href = enlaceWA(saludo);

  $('#anio').textContent = new Date().getFullYear();

  /* ───────────── Formulario de reserva ───────────── */
  const form  = $('#form-reserva');
  const avisoEl = $('#reserva-aviso');

  const mostrarAviso = (texto) => {
    avisoEl.textContent = texto;
    avisoEl.hidden = !texto;
  };

  // El día preferido no puede estar en el pasado
  const campoFecha = form.elements.fecha;
  const hoy = new Date();
  campoFecha.min = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = form.elements;
    const nombre = f.nombre.value.trim();

    if (!nombre) {
      mostrarAviso('Escribe tu nombre para preparar el mensaje.');
      f.nombre.focus();
      return;
    }

    const fecha = f.fecha.value
      ? new Date(`${f.fecha.value}T00:00:00`).toLocaleDateString('es-MX',
          { weekday: 'long', day: 'numeric', month: 'long' })
      : 'lo antes posible';

    const notas = f.notas.value.trim() ? `\n• Notas: ${f.notas.value.trim()}` : '';

    const mensaje = cfg.plantillaReserva
      .replaceAll('{spa}', cfg.nombre)
      .replaceAll('{nombre}', nombre)
      .replaceAll('{servicio}', f.servicio.value)
      .replaceAll('{fecha}', fecha)
      .replaceAll('{franja}', f.franja.value)
      .replaceAll('{notas}', notas);

    mostrarAviso('Abrimos WhatsApp con tu mensaje listo. Si no se abre, revisa el bloqueo de ventanas emergentes.');
    window.open(enlaceWA(mensaje), '_blank', 'noopener');
  });

  form.addEventListener('input', () => mostrarAviso(''));

  /* La carta llega por red: primero se pinta, luego se observa el scroll. */
  cargarCarta().finally(activarRevelado);

  function activarRevelado() {
    const piezas = document.querySelectorAll('.revelar');
    const revelarTodo = () => piezas.forEach((p) => p.classList.add('visible'));

    if ('IntersectionObserver' in window) {
      const vigia = new IntersectionObserver((entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add('visible');
          vigia.unobserve(e.target);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
      piezas.forEach((p) => vigia.observe(p));

      // Red de seguridad: pase lo que pase, a los 3 s no queda nada oculto
      setTimeout(revelarTodo, 3000);
    } else {
      revelarTodo();
    }
  }
})();
