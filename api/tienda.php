<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Tienda en línea
   ──────────────────────────────────────────────────────────
   Regla de oro de todo este archivo: **los precios salen de la
   base de datos, nunca del navegador**. El carrito viaja como
   una lista de ids y cantidades; lo que cuesta cada cosa y lo
   que cuesta el envío se calcula aquí de cero en cada paso.
   Si no fuera así, bastaría con editar el JavaScript para
   comprar un aceite de $1200 por un peso.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);

require_once __DIR__ . '/envios.php';
require_once __DIR__ . '/stripe.php';
require_once __DIR__ . '/catalogo.php';

const ESTADOS_PEDIDO = ['pendiente_pago', 'pagado', 'preparando', 'enviado', 'entregado', 'cancelado'];

/* ───────────── Lectura del catálogo ───────────── */

function filaProducto(array $f): array {
    return [
        'id'           => $f['id'],
        'nombre'       => $f['nombre'],
        'categoria'    => $f['categoria'],
        'presentacion' => $f['presentacion'],
        'precio'       => (float) $f['precio'],
        'descripcion'  => $f['descripcion'] ?? '',
        'imagen'       => $f['imagen'] ?? '',
        'stock'        => $f['stock'] === null ? null : (int) $f['stock'],
        'destacado'    => (int) $f['destacado'] === 1,
        'activo'       => (int) $f['activo'] === 1,
        'orden'        => (int) $f['orden'],
        'gramos'       => (int) $f['gramos'],
        'largo_cm'     => (float) $f['largo_cm'],
        'ancho_cm'     => (float) $f['ancho_cm'],
        'alto_cm'      => (float) $f['alto_cm'],
    ];
}

function leerProductos(bool $soloActivos = true): array {
    $sql = 'SELECT * FROM productos' . ($soloActivos ? ' WHERE activo = 1' : '') . ' ORDER BY categoria, orden, nombre';
    return array_map('filaProducto', bd()->query($sql)->fetchAll());
}

/* Lo que consume la página de la tienda: catálogo + cómo se agrupa. */
function tiendaPublica(): never {
    $cfg = configEnvios();
    responder([
        'ok'          => true,
        'categorias'  => categoriasTienda(),
        'productos'   => leerProductos(true),
        'envio'       => [
            'diasMin'          => $cfg['dias_entrega']['min'],
            'diasMax'          => $cfg['dias_entrega']['max'],
            'recogerActivo'    => $cfg['recoger_activo'],
            'recogerDireccion' => $cfg['recoger_direccion'],
        ],
        'pagoListo'   => stripeListo(),
    ]);
}

/* ───────────── El carrito, revisado contra la base ─────────────
   Entra [{id, cantidad}] y sale la misma lista pero con el producto real
   pegado. Lo que no exista, esté archivado o sin existencias, se descarta
   y se reporta para poder decírselo a la clienta. */
function carritoValidado(array $entrada): array {
    $pedidas = [];
    foreach ($entrada as $it) {
        if (!is_array($it)) continue;
        $id = mb_substr(trim((string) ($it['id'] ?? '')), 0, 24);
        $n  = (int) ($it['cantidad'] ?? 0);
        if ($id === '' || $n < 1) continue;
        // Un tope sano: nadie compra 500 velas por accidente
        $pedidas[$id] = min(99, ($pedidas[$id] ?? 0) + $n);
    }
    if (!$pedidas) return ['items' => [], 'descartados' => [], 'subtotal' => 0.0];

    $marcas = implode(',', array_fill(0, count($pedidas), '?'));
    $st = bd()->prepare("SELECT * FROM productos WHERE id IN ($marcas)");
    $st->execute(array_keys($pedidas));

    $encontrados = [];
    foreach ($st->fetchAll() as $fila) $encontrados[$fila['id']] = filaProducto($fila);

    $items = [];
    $descartados = [];
    $subtotal = 0.0;

    foreach ($pedidas as $id => $n) {
        $p = $encontrados[$id] ?? null;

        if ($p === null || !$p['activo']) {
            $descartados[] = ['id' => $id, 'motivo' => 'ya no está disponible'];
            continue;
        }
        if ($p['stock'] !== null && $p['stock'] < 1) {
            $descartados[] = ['id' => $id, 'nombre' => $p['nombre'], 'motivo' => 'agotado'];
            continue;
        }
        // Hay existencias, pero no tantas: se recorta en vez de fallar entero
        if ($p['stock'] !== null && $n > $p['stock']) {
            $descartados[] = ['id' => $id, 'nombre' => $p['nombre'],
                              'motivo' => "solo quedan {$p['stock']}"];
            $n = $p['stock'];
        }

        $items[] = ['producto' => $p, 'cantidad' => $n];
        $subtotal += $p['precio'] * $n;
    }

    return ['items' => $items, 'descartados' => $descartados, 'subtotal' => round($subtotal, 2)];
}

/* ───────────── Cotización en vivo ─────────────
   La pide el checkout mientras la clienta escribe su código postal. */
function tiendaCotizar(): never {
    $d  = cuerpoJson();
    $cp = preg_replace('/\D/', '', texto($d, 'cp', 10));
    $carrito = carritoValidado(is_array($d['items'] ?? null) ? $d['items'] : []);

    if (!$carrito['items']) fallar('Tu carrito está vacío.');

    responder([
        'ok'          => true,
        'subtotal'    => $carrito['subtotal'],
        'descartados' => $carrito['descartados'],
    ] + cotizarEnvio($carrito['items'], (string) $cp));
}

/* ───────────── Folio ─────────────
   Corto, legible por teléfono y sin ceros/oes que se confundan. */
function nuevoFolio(): string {
    $alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for ($intento = 0; $intento < 8; $intento++) {
        $cola = '';
        for ($i = 0; $i < 4; $i++) $cola .= $alfabeto[random_int(0, strlen($alfabeto) - 1)];
        $folio = 'AM-' . date('ymd') . '-' . $cola;
        $st = bd()->prepare('SELECT 1 FROM pedidos WHERE folio = ?');
        $st->execute([$folio]);
        if (!$st->fetchColumn()) return $folio;
    }
    throw new RuntimeException('No se pudo generar un folio único.');
}

/* ───────────── Crear el pedido y mandar a pagar ───────────── */
function tiendaCheckout(): never {
    $d = cuerpoJson();

    $carrito = carritoValidado(is_array($d['items'] ?? null) ? $d['items'] : []);
    if (!$carrito['items']) fallar('Tu carrito está vacío o los productos ya no están disponibles.');

    $entrega = texto($d, 'entrega', 12) === 'recoger' ? 'recoger' : 'envio';
    $cp      = (string) preg_replace('/\D/', '', texto($d, 'cp', 10));

    $nombre   = texto($d, 'nombre', 160);
    $email    = mb_strtolower(texto($d, 'email', 190));
    $telefono = texto($d, 'telefono', 40);

    if ($nombre === '')                                   fallar('Escribe tu nombre.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL))       fallar('Escribe un correo válido: ahí te llega la confirmación.');

    $calle = $colonia = $ciudad = $estadoMx = $referencias = '';

    if ($entrega === 'envio') {
        if (!esCodigoPostal($cp)) fallar('El código postal debe tener 5 dígitos.');
        $calle       = texto($d, 'calle', 190);
        $colonia     = texto($d, 'colonia', 120);
        $ciudad      = texto($d, 'ciudad', 120);
        $estadoMx    = texto($d, 'estado', 60);
        $referencias = texto($d, 'referencias', 255);
        if ($calle === '' || $ciudad === '' || $estadoMx === '') {
            fallar('Faltan datos de la dirección de envío.');
        }
    }

    /* El envío se recalcula aquí. Lo que venga del navegador no se usa. */
    $costoEnvio = precioDeEntrega($carrito['items'], $cp, $entrega);
    $peso       = pesoFacturable($carrito['items']);
    $total      = round($carrito['subtotal'] + $costoEnvio, 2);

    if (!stripeListo()) {
        fallar('El cobro con tarjeta todavía no está configurado. Escríbenos por WhatsApp y lo cerramos por ahí.', 503);
    }

    $id    = 'p' . bin2hex(random_bytes(8));
    $folio = nuevoFolio();
    $token = bin2hex(random_bytes(16));

    $bd = bd();
    $bd->beginTransaction();
    try {
        $bd->prepare(
            'INSERT INTO pedidos (id, folio, token, estado, cliente_nombre, cliente_email, cliente_telefono,
                                  entrega, cp, calle, colonia, ciudad, estado_mx, referencias,
                                  subtotal, envio, total, peso_facturable)
             VALUES (:id, :folio, :token, :estado, :nombre, :email, :telefono,
                     :entrega, :cp, :calle, :colonia, :ciudad, :estado_mx, :referencias,
                     :subtotal, :envio, :total, :peso)'
        )->execute([
            'id' => $id, 'folio' => $folio, 'token' => $token, 'estado' => 'pendiente_pago',
            'nombre' => $nombre, 'email' => $email, 'telefono' => $telefono,
            'entrega' => $entrega, 'cp' => $cp, 'calle' => $calle, 'colonia' => $colonia,
            'ciudad' => $ciudad, 'estado_mx' => $estadoMx, 'referencias' => $referencias,
            'subtotal' => $carrito['subtotal'], 'envio' => $costoEnvio, 'total' => $total,
            'peso' => $peso['facturable'],
        ]);

        $stItem = $bd->prepare(
            'INSERT INTO pedido_items (pedido_id, producto_id, nombre, presentacion, precio, cantidad)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($carrito['items'] as $it) {
            $p = $it['producto'];
            $stItem->execute([$id, $p['id'], $p['nombre'], $p['presentacion'], $p['precio'], $it['cantidad']]);
        }
        $bd->commit();
    } catch (Throwable $e) {
        $bd->rollBack();
        throw $e;
    }

    /* Renglones para Stripe, en centavos. El envío va como un renglón más:
       así la clienta ve el desglose completo en la pantalla de pago. */
    $renglones = [];
    foreach ($carrito['items'] as $it) {
        $p = $it['producto'];
        $renglones[] = [
            'nombre'   => $p['nombre'] . ($p['presentacion'] !== '' ? ' · ' . $p['presentacion'] : ''),
            'centavos' => (int) round($p['precio'] * 100),
            'cantidad' => $it['cantidad'],
        ];
    }
    if ($costoEnvio > 0) {
        $renglones[] = ['nombre' => 'Envío a domicilio', 'centavos' => (int) round($costoEnvio * 100), 'cantidad' => 1];
    }

    $sesion = crearSesionStripe($renglones, [
        'id' => $id, 'folio' => $folio, 'token' => $token, 'cliente_email' => $email,
    ]);

    bd()->prepare('UPDATE pedidos SET stripe_session = ? WHERE id = ?')
        ->execute([(string) ($sesion['id'] ?? ''), $id]);

    responder([
        'ok'    => true,
        'folio' => $folio,
        'total' => $total,
        'url'   => $sesion['url'] ?? '',
    ]);
}

/* ───────────── Consultar un pedido ─────────────
   Con folio + token, que va en el enlace de la pantalla de gracias. Sin el
   token no se devuelve nada: si no, se verían pedidos ajenos probando folios. */
function tiendaPedido(): never {
    $folio = mb_substr(trim((string) ($_GET['folio'] ?? '')), 0, 16);
    $token = mb_substr(trim((string) ($_GET['t'] ?? '')), 0, 64);
    if ($folio === '' || $token === '') fallar('Faltan datos del pedido.', 404);

    $st = bd()->prepare('SELECT * FROM pedidos WHERE folio = ? LIMIT 1');
    $st->execute([$folio]);
    $p = $st->fetch();

    if (!$p || !hash_equals((string) $p['token'], $token)) fallar('No encontramos ese pedido.', 404);

    $stI = bd()->prepare('SELECT nombre, presentacion, precio, cantidad FROM pedido_items WHERE pedido_id = ?');
    $stI->execute([$p['id']]);

    responder([
        'ok'     => true,
        'pedido' => [
            'folio'    => $p['folio'],
            'estado'   => $p['estado'],
            'nombre'   => $p['cliente_nombre'],
            'entrega'  => $p['entrega'],
            'subtotal' => (float) $p['subtotal'],
            'envio'    => (float) $p['envio'],
            'total'    => (float) $p['total'],
            'guia'     => $p['guia'],
            'creado'   => $p['creado'],
            'items'    => array_map(fn($i) => [
                'nombre'       => $i['nombre'],
                'presentacion' => $i['presentacion'],
                'precio'       => (float) $i['precio'],
                'cantidad'     => (int) $i['cantidad'],
            ], $stI->fetchAll()),
        ],
    ]);
}

/* ══════════════ Panel ══════════════ */

function adminProductos(): never {
    exigirSesion();
    responder([
        'ok'         => true,
        'productos'  => leerProductos(false),
        'categorias' => categoriasTienda(),
    ]);
}

function guardarProducto(): never {
    exigirSesion();
    $d = cuerpoJson();

    $nombre = texto($d, 'nombre', 160);
    if ($nombre === '') fallar('Falta el nombre del producto.');

    $id = texto($d, 'id', 24);
    if ($id === '') $id = 'p' . bin2hex(random_bytes(8));

    // NULL = sin control de existencias; 0 = agotado. Son cosas distintas.
    $stock = array_key_exists('stock', $d) && $d['stock'] !== null && $d['stock'] !== ''
        ? entero($d, 'stock', 0, 99999, 0)
        : null;

    bd()->prepare(
        'INSERT INTO productos (id, nombre, categoria, presentacion, precio, descripcion, imagen,
                                gramos, largo_cm, ancho_cm, alto_cm, stock, destacado, activo, orden)
         VALUES (:id, :nombre, :categoria, :presentacion, :precio, :descripcion, :imagen,
                 :gramos, :largo, :ancho, :alto, :stock, :destacado, :activo, :orden)
         ON DUPLICATE KEY UPDATE
           nombre = VALUES(nombre), categoria = VALUES(categoria), presentacion = VALUES(presentacion),
           precio = VALUES(precio), descripcion = VALUES(descripcion), imagen = VALUES(imagen),
           gramos = VALUES(gramos), largo_cm = VALUES(largo_cm), ancho_cm = VALUES(ancho_cm),
           alto_cm = VALUES(alto_cm), stock = VALUES(stock), destacado = VALUES(destacado),
           activo = VALUES(activo), orden = VALUES(orden)'
    )->execute([
        'id' => $id, 'nombre' => $nombre,
        'categoria'    => texto($d, 'categoria', 40),
        'presentacion' => texto($d, 'presentacion', 40),
        'precio'       => decimal($d, 'precio'),
        'descripcion'  => texto($d, 'descripcion', 2000),
        'imagen'       => texto($d, 'imagen', 120),
        'gramos'       => entero($d, 'gramos', 0, 100000, 0),
        'largo'        => decimal($d, 'largo_cm', 0, 300),
        'ancho'        => decimal($d, 'ancho_cm', 0, 300),
        'alto'         => decimal($d, 'alto_cm', 0, 300),
        'stock'        => $stock,
        'destacado'    => entero($d, 'destacado', 0, 1, 0),
        'activo'       => entero($d, 'activo', 0, 1, 1),
        'orden'        => entero($d, 'orden', 0, 9999, 500),
    ]);

    $st = bd()->prepare('SELECT * FROM productos WHERE id = ?');
    $st->execute([$id]);
    responder(['ok' => true, 'producto' => filaProducto($st->fetch())]);
}

/* No se borra: se archiva. Los pedidos viejos siguen nombrándolo. */
function borrarProducto(): never {
    exigirSesion();
    $id = texto(cuerpoJson(), 'id', 24);
    bd()->prepare('UPDATE productos SET activo = 0 WHERE id = ?')->execute([$id]);
    responder(['ok' => true]);
}

function adminPedidos(): never {
    exigirSesion();

    $st = bd()->query('SELECT * FROM pedidos ORDER BY creado DESC LIMIT 300');
    $pedidos = $st->fetchAll();
    if (!$pedidos) responder(['ok' => true, 'pedidos' => []]);

    $ids = array_column($pedidos, 'id');
    $marcas = implode(',', array_fill(0, count($ids), '?'));
    $stI = bd()->prepare("SELECT * FROM pedido_items WHERE pedido_id IN ($marcas)");
    $stI->execute($ids);

    $porPedido = [];
    foreach ($stI->fetchAll() as $i) {
        $porPedido[$i['pedido_id']][] = [
            'nombre'       => $i['nombre'],
            'presentacion' => $i['presentacion'],
            'precio'       => (float) $i['precio'],
            'cantidad'     => (int) $i['cantidad'],
        ];
    }

    responder(['ok' => true, 'pedidos' => array_map(fn($p) => [
        'id'        => $p['id'],
        'folio'     => $p['folio'],
        'estado'    => $p['estado'],
        'nombre'    => $p['cliente_nombre'],
        'email'     => $p['cliente_email'],
        'telefono'  => $p['cliente_telefono'],
        'entrega'   => $p['entrega'],
        'direccion' => trim(implode(', ', array_filter([
            $p['calle'], $p['colonia'], $p['ciudad'], $p['estado_mx'],
            $p['cp'] !== '' ? 'CP ' . $p['cp'] : '',
        ]))),
        'referencias' => $p['referencias'],
        'subtotal'  => (float) $p['subtotal'],
        'envio'     => (float) $p['envio'],
        'total'     => (float) $p['total'],
        'peso'      => (float) $p['peso_facturable'],
        'guia'      => $p['guia'],
        'notas'     => $p['notas'] ?? '',
        'pagado'    => $p['pagado_en'],
        'creado'    => $p['creado'],
        'items'     => $porPedido[$p['id']] ?? [],
    ], $pedidos)]);
}

function actualizarPedido(): never {
    exigirSesion();
    $d  = cuerpoJson();
    $id = texto($d, 'id', 24);

    $estado = texto($d, 'estado', 20);
    if (!in_array($estado, ESTADOS_PEDIDO, true)) fallar('Ese estado no existe.');

    bd()->prepare('UPDATE pedidos SET estado = ?, guia = ?, notas = ? WHERE id = ?')
        ->execute([$estado, texto($d, 'guia', 80), texto($d, 'notas', 2000), $id]);

    responder(['ok' => true]);
}
