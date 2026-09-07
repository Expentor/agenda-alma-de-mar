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
     Cada hueco arranca con su marcador de marca. Si config.js dice que ya
     hay fotos, se cambian por las reales; y si una falta, esa vuelve sola
     a su marcador. */
  const GALERIA_MINIMA = 3;   // menos fotos que esto y la galería no luce

  function existeFoto(url) {
    return new Promise((listo) => {
      const prueba = new Image();
      prueba.onload  = () => listo(true);
      prueba.onerror = () => listo(false);
      prueba.src = url;
    });
  }

  async function colocarFotos() {
    if (!cfg.fotosReales) return;
    const ext = (cfg.formatoFotos || 'jpg').replace(/^\./, '');

    const huecos = [...document.querySelectorAll('[data-foto]')];
    const hay = await Promise.all(
      huecos.map((img) => existeFoto(`assets/img/spa/${img.dataset.foto}.${ext}`))
    );

    huecos.forEach((img, i) => {
      if (hay[i]) img.src = `assets/img/spa/${img.dataset.foto}.${ext}`;
    });

    /* La galería solo se sostiene con varias fotos reales. Con una suelta
       entre marcadores de color se ve a medio hacer, así que se esconde
       entera hasta que haya suficientes. Vuelve sola al añadirlas. */
    const galeria = document.getElementById('espacio');
    if (!galeria) return;
    const enGaleria = huecos
      .map((img, i) => (galeria.contains(img) ? hay[i] : false))
      .filter(Boolean).length;

    if (enGaleria < GALERIA_MINIMA) {
      galeria.hidden = true;
      document.querySelectorAll('a[href="#espacio"]').forEach((a) => a.remove());
    }
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

  /* Los grupos de la carta salen de config.js. Pero un servicio dado de alta
     desde la agenda puede llegar sin categoría, y antes esos no encajaban en
     ningún grupo: desaparecían de la página sin decir nada, y si NINGUNO
     tenía categoría la carta entera salía vacía. Ahora los que sobran caen
     en «Otros tratamientos». Más vale un grupo genérico que una carta a la
     que le faltan cosas. */
  function gruposDeCarta() {
    const conocidas = new Set(cfg.categorias.map((c) => c.id));

    const grupos = cfg.categorias.map((cat) => ({
      titulo: cat.titulo,
      nota: cat.nota,
      suyos: servicios.filter((s) => s.categoria === cat.id),
    }));

    const sueltos = servicios.filter((s) => !conocidas.has(s.categoria));
    if (sueltos.length) grupos.push({ titulo: 'Otros tratamientos', nota: '', suyos: sueltos });

    return grupos.filter((g) => g.suyos.length);
  }

  function pintarCarta() {
    const grupos = gruposDeCarta();

    /* El servidor contestó, pero no hay ni un servicio que enseñar. Es
       distinto de que fallara la red, así que el mensaje también lo es. */
    if (!grupos.length) {
      $('#lista-servicios').innerHTML =
        `<p class="nota-centro">Estamos actualizando la carta.
          Escríbenos por WhatsApp y te contamos los tratamientos disponibles.</p>`;
      return;
    }

    $('#lista-servicios').innerHTML = grupos.map((g) => `
      <section class="carta-grupo">
        <header class="carta-grupo__cabecera revelar">
          <h3 class="carta-grupo__titulo">${escapar(g.titulo)}</h3>
          ${g.nota ? `<span class="carta-grupo__nota">${escapar(g.nota)}</span>` : ''}
        </header>
        <div class="servicios">${g.suyos.map(tarjetaServicio).join('')}</div>
      </section>`).join('');
  }

  function pintarSelectorDeReserva() {
    $('#reserva-servicio').innerHTML = gruposDeCarta().map((g) => {
      const opciones = g.suyos.map((s) =>
        `<option value="${escapar(s.nombre)}">${escapar(s.nombre)} · ${s.duracion} min · ${dinero(s.precio)}</option>`
      ).join('');
      return `<optgroup label="${escapar(g.titulo)}">${opciones}</optgroup>`;
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

  /* Carta y fotos llegan por red: primero se pinta todo, luego se observa
     el scroll, para que el vigía vea también lo que se generó al vuelo. */
  Promise.all([cargarCarta(), colocarFotos()]).finally(activarRevelado);

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
