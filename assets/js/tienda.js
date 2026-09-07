/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Tienda
   ──────────────────────────────────────────────────────────
   El carrito vive en el navegador, pero solo guarda ids y
   cantidades. Los precios, el envío y las existencias los
   decide SIEMPRE el servidor: aquí no se calcula nada que
   luego se cobre. Si alguien edita este archivo en su propio
   navegador, lo único que consigue es ver mal su pantalla.
   ══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const LLAVE_CARRITO = 'alma-carrito';
  const RUTA_FOTOS = 'assets/img/tienda/';

  let catalogo   = { categorias: [], productos: [], envio: {}, pagoListo: false };
  let carrito    = leerCarrito();      // { id: cantidad }
  let filtro     = 'todo';
  let cotizacion = null;               // última respuesta de tienda/cotizar
  let entrega    = 'envio';

  /* ───────────── Utilidades ───────────── */
  const dinero = (n) => new Intl.NumberFormat('es-MX',
    { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);

  const escapar = (t) => String(t ?? '').replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

  const productoPorId = (id) => catalogo.productos.find((p) => p.id === id);

  /* La foto propia del producto manda; si no tiene, la de su categoría; y si
     tampoco hay, un marcador con los colores de la marca en vez de un hueco. */
  function fotoDe(p) {
    if (p.imagen) return RUTA_FOTOS + p.imagen;
    const cat = catalogo.categorias.find((c) => c.id === p.categoria);
    return cat && cat.imagen ? RUTA_FOTOS + cat.imagen : '';
  }

  function aviso(texto) {
    const el = document.createElement('div');
    el.className = 'aviso-tienda';
    el.textContent = texto;
    $('#avisos').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ───────────── Carrito en el navegador ─────────────
     Si el navegador bloquea el almacenamiento (modo privado, ajustes
     estrictos), la tienda sigue funcionando: el carrito solo dura lo que
     dure la pestaña. Vale más eso que una página rota. */
  function leerCarrito() {
    try {
      const guardado = JSON.parse(localStorage.getItem(LLAVE_CARRITO) || '{}');
      return guardado && typeof guardado === 'object' ? guardado : {};
    } catch { return {}; }
  }

  function guardarCarrito() {
    try { localStorage.setItem(LLAVE_CARRITO, JSON.stringify(carrito)); } catch { /* da igual */ }
  }

  const piezasEnCarrito = () => Object.values(carrito).reduce((t, n) => t + n, 0);

  const itemsParaApi = () =>
    Object.entries(carrito).map(([id, cantidad]) => ({ id, cantidad }));

  function ponerEnCarrito(id, delta) {
    const n = (carrito[id] || 0) + delta;
    if (n <= 0) delete carrito[id]; else carrito[id] = Math.min(99, n);
    guardarCarrito();
    pintarCuenta();
    pintarCarrito();
    pintarCatalogo();
  }

  /* ───────────── Catálogo ───────────── */
  function pintarFiltros() {
    const conProductos = catalogo.categorias.filter(
      (c) => catalogo.productos.some((p) => p.categoria === c.id));

    $('#filtros').innerHTML =
      `<button class="filtro${filtro === 'todo' ? ' filtro--activo' : ''}" data-cat="todo">Todo</button>` +
      conProductos.map((c) => `
        <button class="filtro${filtro === c.id ? ' filtro--activo' : ''}" data-cat="${escapar(c.id)}">
          ${escapar(c.titulo)}${c.nota ? ` <span>${escapar(c.nota)}</span>` : ''}
        </button>`).join('');

    $$('#filtros .filtro').forEach((b) => b.addEventListener('click', () => {
      filtro = b.dataset.cat;
      pintarFiltros();
      pintarCatalogo();
    }));
  }

  function tarjetaProducto(p) {
    const foto = fotoDe(p);
    const enCarrito = carrito[p.id] || 0;
    const agotado = p.stock !== null && p.stock < 1;

    return `
      <article class="producto${agotado ? ' producto--agotado' : ''}">
        <div class="producto__foto">
          ${foto
            ? `<img src="${escapar(foto)}" alt="${escapar(p.nombre)}" loading="lazy">`
            : '<span class="producto__marcador" aria-hidden="true"></span>'}
          ${agotado ? '<span class="producto__etiqueta">Agotado</span>' : ''}
        </div>
        <div class="producto__cuerpo">
          <h3 class="producto__nombre">${escapar(p.nombre)}</h3>
          ${p.presentacion ? `<p class="producto__presentacion">${escapar(p.presentacion)}</p>` : ''}
          ${p.descripcion ? `<p class="producto__desc">${escapar(p.descripcion)}</p>` : ''}
          <div class="producto__pie">
            <span class="producto__precio">${dinero(p.precio)}</span>
            ${agotado ? '' : enCarrito
              ? `<div class="contador">
                   <button class="contador__btn" data-menos="${escapar(p.id)}" aria-label="Quitar uno">−</button>
                   <span class="contador__n">${enCarrito}</span>
                   <button class="contador__btn" data-mas="${escapar(p.id)}" aria-label="Añadir uno">+</button>
                 </div>`
              : `<button class="btn btn--fino" data-mas="${escapar(p.id)}">Añadir</button>`}
          </div>
        </div>
      </article>`;
  }

  function pintarCatalogo() {
    const cont = $('#lista-productos');
    const grupos = catalogo.categorias
      .filter((c) => filtro === 'todo' || c.id === filtro)
      .map((c) => ({ cat: c, suyos: catalogo.productos.filter((p) => p.categoria === c.id) }))
      .filter((g) => g.suyos.length);

    /* Un producto con una categoría que no está en la lista no puede
       desaparecer sin más: cae en «Otros», igual que en la carta del spa. */
    const conocidas = new Set(catalogo.categorias.map((c) => c.id));
    const sueltos = catalogo.productos.filter((p) => !conocidas.has(p.categoria));
    if (sueltos.length && filtro === 'todo') {
      grupos.push({ cat: { titulo: 'Otros', nota: '' }, suyos: sueltos });
    }

    if (!grupos.length) {
      cont.innerHTML = '<p class="nota-centro">Estamos actualizando el catálogo. Escríbenos por WhatsApp.</p>';
      return;
    }

    cont.innerHTML = grupos.map((g) => `
      <section class="grupo-tienda">
        <header class="grupo-tienda__cabecera">
          <h3 class="grupo-tienda__titulo">${escapar(g.cat.titulo)}</h3>
          ${g.cat.nota ? `<span class="grupo-tienda__nota">${escapar(g.cat.nota)}</span>` : ''}
        </header>
        <div class="productos">${g.suyos.map(tarjetaProducto).join('')}</div>
      </section>`).join('');

    $$('[data-mas]').forEach((b)  => b.addEventListener('click', () => ponerEnCarrito(b.dataset.mas, 1)));
    $$('[data-menos]').forEach((b) => b.addEventListener('click', () => ponerEnCarrito(b.dataset.menos, -1)));
  }

  /* ───────────── Panel del carrito ───────────── */
  function pintarCuenta() {
    const n = piezasEnCarrito();
    const chip = $('#cuenta-carrito');
    chip.textContent = n;
    chip.hidden = n === 0;
  }

  function pintarCarrito() {
    const cuerpo = $('#carrito-cuerpo');
    const ids = Object.keys(carrito);

    if (!ids.length) {
      cuerpo.innerHTML = '<p class="carrito__vacio">Todavía no has añadido nada.</p>';
      $('#carrito-pie').hidden = true;
      return;
    }

    let subtotal = 0;
    cuerpo.innerHTML = ids.map((id) => {
      const p = productoPorId(id);
      if (!p) return '';
      subtotal += p.precio * carrito[id];
      const foto = fotoDe(p);
      return `
        <div class="carrito__item">
          <div class="carrito__foto">${foto ? `<img src="${escapar(foto)}" alt="">` : ''}</div>
          <div class="carrito__datos">
            <p class="carrito__nombre">${escapar(p.nombre)}</p>
            <p class="carrito__pres">${escapar(p.presentacion)} · ${dinero(p.precio)}</p>
            <div class="contador">
              <button class="contador__btn" data-menos="${escapar(id)}" aria-label="Quitar uno">−</button>
              <span class="contador__n">${carrito[id]}</span>
              <button class="contador__btn" data-mas="${escapar(id)}" aria-label="Añadir uno">+</button>
            </div>
          </div>
          <div class="carrito__importe">${dinero(p.precio * carrito[id])}</div>
        </div>`;
    }).join('');

    $('#carrito-subtotal').textContent = dinero(subtotal);
    $('#carrito-pie').hidden = false;

    cuerpo.querySelectorAll('[data-mas]').forEach((b)   => b.addEventListener('click', () => ponerEnCarrito(b.dataset.mas, 1)));
    cuerpo.querySelectorAll('[data-menos]').forEach((b) => b.addEventListener('click', () => ponerEnCarrito(b.dataset.menos, -1)));
  }

  const abrirCarrito = () => { $('#carrito').hidden = false; $('#velo').hidden = false; };
  const cerrarCarrito = () => { $('#carrito').hidden = true; if ($('#checkout').hidden) $('#velo').hidden = true; };

  /* ───────────── Checkout ───────────── */
  function abrirCheckout() {
    if (!piezasEnCarrito()) { aviso('Tu carrito está vacío'); return; }
    cerrarCarrito();
    $('#checkout').hidden = false;
    $('#velo').hidden = false;
    pintarOpcionesEntrega();
    cotizar();
  }

  function cerrarCheckout() {
    $('#checkout').hidden = true;
    $('#velo').hidden = true;
  }

  function pintarOpcionesEntrega() {
    const opciones = cotizacion?.opciones || [
      { id: 'envio', titulo: 'Envío a domicilio', detalle: 'Escribe tu código postal para cotizar', precio: null },
    ];

    $('#opciones-entrega').innerHTML = opciones.map((o) => `
      <label class="entrega${entrega === o.id ? ' entrega--activa' : ''}">
        <input type="radio" name="entrega" value="${escapar(o.id)}"${entrega === o.id ? ' checked' : ''}>
        <span class="entrega__texto">
          <strong>${escapar(o.titulo)}</strong>
          <span>${escapar(o.detalle)}</span>
        </span>
        <span class="entrega__precio">${o.precio === null ? '—' : (o.precio === 0 ? 'Sin costo' : dinero(o.precio))}</span>
      </label>`).join('');

    $$('#opciones-entrega input[name="entrega"]').forEach((r) =>
      r.addEventListener('change', () => {
        entrega = r.value;
        $('#bloque-direccion').hidden = entrega === 'recoger';
        $$('#bloque-direccion input[required]').forEach((i) => { i.disabled = entrega === 'recoger'; });
        pintarOpcionesEntrega();
        pintarResumen();
      }));
  }

  function pintarResumen() {
    if (!cotizacion) { $('#resumen-compra').innerHTML = ''; return; }

    const opcion = cotizacion.opciones.find((o) => o.id === entrega);
    const costoEnvio = opcion ? opcion.precio : 0;
    const total = cotizacion.subtotal + costoEnvio;

    $('#resumen-compra').innerHTML = `
      <div class="resumen-compra__linea"><span>Productos</span><span>${dinero(cotizacion.subtotal)}</span></div>
      <div class="resumen-compra__linea"><span>${entrega === 'recoger' ? 'Recoger en el spa' : 'Envío'}</span>
        <span>${costoEnvio === 0 ? 'Sin costo' : dinero(costoEnvio)}</span></div>
      ${cotizacion.zonaExtendida && entrega === 'envio'
        ? `<p class="resumen-compra__nota">Tu código postal está en zona extendida: la paquetería
             suma ${dinero(cotizacion.sobrecargoZona)}, ya incluidos arriba.</p>`
        : ''}
      <div class="resumen-compra__linea resumen-compra__linea--total"><span>Total</span><strong>${dinero(total)}</strong></div>`;
  }

  /* Se le pregunta al servidor cuánto cuesta el envío. Nunca se calcula aquí. */
  async function cotizar() {
    const cp = ($('#form-checkout').elements.cp.value || '').replace(/\D/g, '');
    try {
      cotizacion = await API.cotizarTienda(itemsParaApi(), cp);
    } catch (e) {
      cotizacion = null;
      mostrarError(e.message);
      return;
    }

    /* Si algo se agotó mientras la clienta compraba, se le dice y se corrige
       el carrito antes de que llegue a pagar. */
    if (cotizacion.descartados?.length) {
      cotizacion.descartados.forEach((d) => {
        aviso(`${d.nombre || 'Un producto'}: ${d.motivo}`);
        if (d.motivo === 'agotado' || d.motivo === 'ya no está disponible') delete carrito[d.id];
      });
      guardarCarrito();
      pintarCuenta();
      pintarCarrito();
    }

    mostrarError('');
    pintarOpcionesEntrega();
    pintarResumen();
  }

  function mostrarError(texto) {
    const el = $('#checkout-error');
    el.textContent = texto;
    el.hidden = !texto;
  }

  async function pagar(e) {
    e.preventDefault();
    const f = $('#form-checkout').elements;
    const boton = $('#btn-pagar');

    mostrarError('');
    boton.disabled = true;
    boton.textContent = 'Preparando el pago…';

    try {
      const r = await API.checkoutTienda({
        items: itemsParaApi(),
        entrega,
        nombre: f.nombre.value.trim(),
        email: f.email.value.trim(),
        telefono: f.telefono.value.trim(),
        cp: (f.cp.value || '').replace(/\D/g, ''),
        calle: f.calle.value.trim(),
        colonia: f.colonia.value.trim(),
        ciudad: f.ciudad.value.trim(),
        estado: f.estado.value.trim(),
        referencias: f.referencias.value.trim(),
      });

      /* El carrito se vacía al VOLVER pagando, no aquí: si la clienta se
         arrepiente en la pantalla de Stripe, su carrito la está esperando. */
      if (r.url) { location.href = r.url; return; }
      mostrarError('Stripe no devolvió una dirección de pago. Inténtalo de nuevo.');
    } catch (err) {
      mostrarError(err.message);
    } finally {
      boton.disabled = false;
      boton.textContent = 'Pagar';
    }
  }

  /* La barra de arriba es transparente sobre la portada y se vuelve sólida al
     bajar. En la página pública lo hace landing.js, que aquí no se carga. */
  const barra = $('#barra');
  const fijarBarra = () => barra.classList.toggle('barra--fija', window.scrollY > 40);
  addEventListener('scroll', fijarBarra, { passive: true });
  fijarBarra();

  /* ───────────── Cableado ───────────── */
  $('#btn-carrito').addEventListener('click', abrirCarrito);
  $('#cerrar-carrito').addEventListener('click', cerrarCarrito);
  $('#cerrar-checkout').addEventListener('click', cerrarCheckout);
  $('#velo').addEventListener('click', () => { cerrarCarrito(); cerrarCheckout(); });
  $('#btn-ir-checkout').addEventListener('click', abrirCheckout);
  $('#form-checkout').addEventListener('submit', pagar);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { cerrarCarrito(); cerrarCheckout(); }
  });

  /* Se cotiza al terminar de escribir el CP, no en cada tecla. */
  let reloj = null;
  $('#form-checkout').elements.cp.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    clearTimeout(reloj);
    if (e.target.value.length === 5) reloj = setTimeout(cotizar, 350);
  });

  /* ───────────── Arranque ───────────── */
  (async () => {
    try {
      catalogo = await API.tiendaPublica();
    } catch (e) {
      $('#lista-productos').innerHTML =
        `<p class="nota-centro">No pudimos cargar el catálogo en este momento.
          Escríbenos por WhatsApp y te atendemos con mucho gusto.</p>`;
      return;
    }

    /* Lo que se guardó otro día puede haberse archivado desde entonces. */
    const vivos = new Set(catalogo.productos.map((p) => p.id));
    Object.keys(carrito).forEach((id) => { if (!vivos.has(id)) delete carrito[id]; });
    guardarCarrito();

    if (new URLSearchParams(location.search).get('pago') === 'cancelado') {
      aviso('No se completó el pago. Tu carrito sigue aquí.');
    }

    $('#cargando-tienda')?.remove();
    pintarFiltros();
    pintarCatalogo();
    pintarCuenta();
    pintarCarrito();
  })();
})();
