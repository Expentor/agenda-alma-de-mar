/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Tienda, desde el panel
   ──────────────────────────────────────────────────────────
   Dos secciones: los pedidos que entran por la web y el
   catálogo que los alimenta.

   Se apoya en lo que app.js ya define —`pedir`, `aviso`,
   `dinero`, `escapar`— para no repetir la envoltura de
   errores ni el manejo de sesión caducada.
   ══════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  const ESTADOS_PEDIDO = {
    pendiente_pago: 'Sin pagar',
    pagado:         'Pagado',
    preparando:     'Preparando',
    enviado:        'Enviado',
    entregado:      'Entregado',
    cancelado:      'Cancelado',
  };

  let pedidos    = [];
  let productos  = [];
  let categorias = [];
  let cargados   = { pedidos: false, productos: false };

  const $ = (s) => document.querySelector(s);

  const fecha = (iso) => {
    if (!iso) return '';
    const d = new Date(iso.replace(' ', 'T'));
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
         + ' · ' + d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  };

  /* ══════════════ Pedidos ══════════════ */

  function pintarPedidos() {
    const filtro = $('#filtro-pedidos').value;
    const lista  = filtro ? pedidos.filter(p => p.estado === filtro) : pedidos;

    /* Lo cobrado son los pedidos que Stripe confirmó. Los que siguen en
       «sin pagar» son carritos abandonados a medio camino: no son dinero. */
    const cobrados = pedidos.filter(p => p.estado !== 'pendiente_pago' && p.estado !== 'cancelado');
    const ingreso  = cobrados.reduce((t, p) => t + Number(p.total || 0), 0);
    const porPreparar = pedidos.filter(p => p.estado === 'pagado').length;

    $('#resumen-pedidos').innerHTML =
      `<div><strong>${cobrados.length}</strong> pedido${cobrados.length === 1 ? '' : 's'} pagado${cobrados.length === 1 ? '' : 's'}</div>
       <div><strong>${dinero(ingreso)}</strong> vendido</div>
       <div><strong>${porPreparar}</strong> por preparar</div>`;

    const cont = $('#lista-pedidos');
    if (!lista.length) {
      cont.innerHTML = `<p class="vacio">${pedidos.length ? 'Ningún pedido con ese estado' : 'Todavía no hay pedidos'}</p>`;
      return;
    }

    cont.innerHTML = '';
    lista.forEach(p => {
      const el = document.createElement('article');
      el.className = 'panel pedido';
      el.innerHTML = `
        <div class="pedido__cabecera">
          <div>
            <span class="pedido__folio">${escapar(p.folio)}</span>
            <span class="estado estado--${escapar(p.estado)}">${escapar(ESTADOS_PEDIDO[p.estado] || p.estado)}</span>
          </div>
          <span class="pedido__total">${dinero(p.total)}</span>
        </div>

        <div class="pedido__meta">
          ${escapar(p.nombre)} · ${escapar(p.email)}${p.telefono ? ' · ' + escapar(p.telefono) : ''}<br>
          ${p.entrega === 'recoger'
            ? 'Recoge en el spa'
            : escapar(p.direccion) + (p.referencias ? ` <em>(${escapar(p.referencias)})</em>` : '')}<br>
          <span class="pedido__fecha">Pedido el ${escapar(fecha(p.creado))}${p.pagado ? ' · pagado el ' + escapar(fecha(p.pagado)) : ''} · ${p.peso} kg facturables</span>
        </div>

        <div class="pedido__items">
          ${p.items.map(i => `<div class="pedido__item">
              <span>${escapar(i.nombre)}${i.presentacion ? ' · ' + escapar(i.presentacion) : ''} × ${i.cantidad}</span>
              <span>${dinero(i.precio * i.cantidad)}</span>
            </div>`).join('')}
          <div class="pedido__item pedido__item--envio">
            <span>${p.entrega === 'recoger' ? 'Recoger en el spa' : 'Envío'}</span>
            <span>${p.envio === 0 ? 'Sin costo' : dinero(p.envio)}</span>
          </div>
        </div>

        <form class="pedido__acciones">
          <label class="campo-grupo">Estado
            <select class="campo" name="estado">
              ${Object.entries(ESTADOS_PEDIDO).map(([v, t]) =>
                `<option value="${v}"${v === p.estado ? ' selected' : ''}>${t}</option>`).join('')}
            </select></label>
          <label class="campo-grupo">Número de guía
            <input class="campo" name="guia" value="${escapar(p.guia)}" placeholder="Estafeta, DHL…"></label>
          <label class="campo-grupo campo-grupo--ancho">Notas internas
            <input class="campo" name="notas" value="${escapar(p.notas)}"></label>
          <div class="campo-grupo campo-grupo--ancho">
            <button class="boton boton--fino" type="submit" style="align-self:flex-start">Guardar cambios</button>
          </div>
        </form>`;

      el.querySelector('.pedido__acciones').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target.elements;
        const r = await pedir(() => API.actualizarPedido({
          id: p.id, estado: f.estado.value, guia: f.guia.value.trim(), notas: f.notas.value.trim(),
        }), 'Pedido actualizado');
        if (!r) return;
        Object.assign(p, { estado: f.estado.value, guia: f.guia.value.trim(), notas: f.notas.value.trim() });
        pintarPedidos();
      });

      cont.appendChild(el);
    });
  }

  async function cargarPedidos() {
    const r = await pedir(() => API.pedidos());
    if (!r) return;
    pedidos = r.pedidos;
    cargados.pedidos = true;
    pintarPedidos();
  }

  /* ══════════════ Productos ══════════════ */

  const categoriaPorId = (id) => categorias.find(c => c.id === id);
  const nombreCategoria = (c) => c ? (c.titulo + (c.nota ? ' · ' + c.nota : '')) : 'Sin categoría';

  function opcionesCategoria(elegida) {
    return categorias.map(c =>
      `<option value="${escapar(c.id)}"${c.id === elegida ? ' selected' : ''}>${escapar(nombreCategoria(c))}</option>`
    ).join('') + `<option value=""${!elegida ? ' selected' : ''}>Sin categoría</option>`;
  }

  function pintarProductos() {
    if (!$('#select-cat-producto').options.length) limpiarFormProducto();

    const filtroSel = $('#filtro-productos');
    if (!filtroSel.options.length) {
      filtroSel.innerHTML = '<option value="">Todas las categorías</option>' +
        categorias.map(c => `<option value="${escapar(c.id)}">${escapar(nombreCategoria(c))}</option>`).join('');
    }

    const cat = filtroSel.value;
    const q   = $('#buscar-producto').value.trim().toLowerCase();

    const lista = productos.filter(p =>
      (!cat || p.categoria === cat) &&
      (!q || p.nombre.toLowerCase().includes(q)));

    const visibles = productos.filter(p => p.activo).length;
    const agotados = productos.filter(p => p.activo && p.stock !== null && p.stock < 1).length;
    $('#resumen-productos').innerHTML =
      `<div><strong>${visibles}</strong> en la tienda</div>
       <div><strong>${productos.length - visibles}</strong> archivado${productos.length - visibles === 1 ? '' : 's'}</div>
       ${agotados ? `<div><strong>${agotados}</strong> agotado${agotados === 1 ? '' : 's'}</div>` : ''}`;

    const cont = $('#lista-productos-admin');
    if (!lista.length) {
      cont.innerHTML = '<p class="vacio">Ningún producto con ese filtro</p>';
      return;
    }

    cont.innerHTML = '';
    lista.forEach(p => {
      const fila = document.createElement('div');
      const agotado = p.stock !== null && p.stock < 1;
      fila.className = 'fila fila--servicio' + (p.activo ? '' : ' fila--archivada');
      fila.innerHTML = `
        <span class="fila__nombre">${escapar(p.nombre)}${p.presentacion ? ` <em class="fila__tipo">${escapar(p.presentacion)}</em>` : ''}
          <span class="fila__categoria">${escapar(nombreCategoria(categoriaPorId(p.categoria)))}${
            p.stock === null ? '' : ` · ${agotado ? 'AGOTADO' : p.stock + ' en existencia'}`}${
            p.activo ? '' : ' · archivado'}</span></span>
        <span class="fila__meta">${dinero(p.precio)}</span>
        <button class="editar" type="button">Editar</button>
        ${p.activo ? '<button class="quitar" type="button" title="Archivar">×</button>' : ''}`;

      fila.querySelector('.editar').addEventListener('click', () => editarProducto(p));
      fila.querySelector('.quitar')?.addEventListener('click', async () => {
        if (!confirm(`¿Quitar "${p.nombre}" de la tienda? Los pedidos que ya lo llevan no cambian.`)) return;
        const r = await pedir(() => API.borrarProducto(p.id), 'Producto archivado');
        if (!r) return;
        p.activo = false;
        pintarProductos();
      });
      cont.appendChild(fila);
    });
  }

  function limpiarFormProducto() {
    const form = $('#form-producto');
    form.reset();
    form.elements.id.value = '';
    $('#select-cat-producto').innerHTML = opcionesCategoria(categorias[0]?.id ?? '');
    form.elements.activo.checked = true;
    $('#titulo-producto').textContent = 'Nuevo producto';
  }

  function editarProducto(p) {
    const f = $('#form-producto').elements;
    f.id.value           = p.id;
    f.nombre.value       = p.nombre;
    f.presentacion.value = p.presentacion;
    f.precio.value       = p.precio;
    f.descripcion.value  = p.descripcion;
    f.imagen.value       = p.imagen;
    f.stock.value        = p.stock === null ? '' : p.stock;
    f.gramos.value       = p.gramos   || '';
    f.largo_cm.value     = p.largo_cm || '';
    f.ancho_cm.value     = p.ancho_cm || '';
    f.alto_cm.value      = p.alto_cm  || '';
    f.activo.checked     = p.activo;
    f.destacado.checked  = p.destacado;
    $('#select-cat-producto').innerHTML = opcionesCategoria(p.categoria);
    $('#titulo-producto').textContent = 'Editar · ' + p.nombre;
    $('#panel-producto').hidden = false;
    $('#panel-producto').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function cargarProductos() {
    const r = await pedir(() => API.productos());
    if (!r) return;
    productos  = r.productos;
    categorias = r.categorias;
    cargados.productos = true;
    pintarProductos();
  }

  /* ══════════════ Cableado ══════════════ */

  $('#filtro-pedidos').addEventListener('change', pintarPedidos);
  $('#btn-recargar-pedidos').addEventListener('click', cargarPedidos);

  $('#filtro-productos').addEventListener('change', pintarProductos);
  $('#buscar-producto').addEventListener('input', pintarProductos);

  $('#btn-nuevo-producto').addEventListener('click', () => {
    limpiarFormProducto();
    $('#panel-producto').hidden = false;
    $('#form-producto').elements.nombre.focus();
  });

  $('#btn-cancelar-producto').addEventListener('click', () => {
    limpiarFormProducto();
    $('#panel-producto').hidden = true;
  });

  $('#form-producto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    const editando = Boolean(f.id.value);

    const r = await pedir(() => API.guardarProducto({
      id: f.id.value,
      nombre: f.nombre.value.trim(),
      categoria: f.categoria.value,
      presentacion: f.presentacion.value.trim(),
      precio: Number(f.precio.value),
      descripcion: f.descripcion.value.trim(),
      imagen: f.imagen.value.trim(),
      // Vacío no es cero: uno significa «no llevo control», el otro «agotado».
      stock: f.stock.value === '' ? null : Number(f.stock.value),
      gramos: Number(f.gramos.value || 0),
      largo_cm: Number(f.largo_cm.value || 0),
      ancho_cm: Number(f.ancho_cm.value || 0),
      alto_cm: Number(f.alto_cm.value || 0),
      activo: f.activo.checked ? 1 : 0,
      destacado: f.destacado.checked ? 1 : 0,
    }), editando ? 'Producto actualizado' : 'Producto añadido');
    if (!r) return;

    const i = productos.findIndex(x => x.id === r.producto.id);
    if (i >= 0) productos[i] = r.producto; else productos.push(r.producto);

    limpiarFormProducto();
    $('#panel-producto').hidden = true;
    pintarProductos();
  });

  /* Las dos secciones se cargan la primera vez que se abren, no al entrar:
     quien solo viene a ver la agenda del día no espera por la tienda. */
  window.pintarPedidos = () => {
    if (!cargados.pedidos) cargarPedidos(); else pintarPedidos();
  };
  window.pintarProductos = () => {
    if (!cargados.productos) cargarProductos(); else pintarProductos();
  };
})();
