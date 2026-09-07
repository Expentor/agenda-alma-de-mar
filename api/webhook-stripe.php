<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Aviso de pago de Stripe
   ──────────────────────────────────────────────────────────
   Stripe llama aquí cuando un pago se completa. Es la ÚNICA
   fuente de verdad sobre si un pedido está pagado: volver a
   la página de gracias no prueba nada —esa dirección la puede
   abrir cualquiera— y la clienta puede cerrar el navegador
   justo después de pagar.

   Va en su propio archivo, fuera de api/index.php, porque no
   pasa por la sesión ni por el token CSRF: quien llama es un
   servidor de Stripe, no un navegador. Lo que sí se exige es
   la FIRMA, y sin ella no se toca nada.

   Configúralo en el panel de Stripe:
     URL     https://almademar.mx/api/webhook-stripe.php
     Evento  checkout.session.completed
   y copia la clave de firma a api/config.php como STRIPE_WEBHOOK.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);
require_once __DIR__ . '/comun.php';
require_once __DIR__ . '/stripe.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false]);
    exit;
}

$cuerpo   = file_get_contents('php://input') ?: '';
$cabecera = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';

if (!firmaWebhookValida($cuerpo, $cabecera)) {
    error_log('[alma-de-mar] webhook de Stripe con firma inválida');
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'firma']);
    exit;
}

$evento = json_decode($cuerpo, true);
if (!is_array($evento)) {
    http_response_code(400);
    echo json_encode(['ok' => false]);
    exit;
}

/* Cualquier otro evento se acepta con un 200 para que Stripe no reintente
   eternamente algo que no nos interesa. */
if (($evento['type'] ?? '') !== 'checkout.session.completed') {
    echo json_encode(['ok' => true, 'ignorado' => $evento['type'] ?? '']);
    exit;
}

$sesion   = $evento['data']['object'] ?? [];
$pedidoId = (string) ($sesion['client_reference_id'] ?? '');
$pagoId   = (string) ($sesion['payment_intent'] ?? '');
$pagado   = ($sesion['payment_status'] ?? '') === 'paid';

if ($pedidoId === '' || !$pagado) {
    echo json_encode(['ok' => true, 'sin_efecto' => true]);
    exit;
}

try {
    $bd = bd();
    $bd->beginTransaction();

    /* Stripe reintenta si no contestamos rápido, así que el mismo aviso puede
       llegar dos veces. La condición sobre el estado hace que la segunda no
       vuelva a descontar existencias. */
    $st = $bd->prepare(
        "UPDATE pedidos SET estado = 'pagado', stripe_pago = ?, pagado_en = NOW()
         WHERE id = ? AND estado = 'pendiente_pago'"
    );
    $st->execute([$pagoId, $pedidoId]);

    if ($st->rowCount() === 1) {
        // Solo los productos que llevan control de existencias (stock no nulo)
        $bd->prepare(
            'UPDATE productos p
               JOIN pedido_items i ON i.producto_id = p.id
              SET p.stock = GREATEST(0, p.stock - i.cantidad)
            WHERE i.pedido_id = ? AND p.stock IS NOT NULL'
        )->execute([$pedidoId]);
    }

    $bd->commit();
    echo json_encode(['ok' => true]);
} catch (Throwable $e) {
    if (isset($bd) && $bd->inTransaction()) $bd->rollBack();
    error_log('[alma-de-mar] webhook: ' . $e->getMessage());
    // 500 para que Stripe lo reintente: el pago existe y hay que registrarlo
    http_response_code(500);
    echo json_encode(['ok' => false]);
}
