<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Cobro con Stripe
   ──────────────────────────────────────────────────────────
   Se usa Stripe Checkout: la clienta se va a pagar A STRIPE y
   vuelve. Los datos de la tarjeta NO pasan por este servidor
   ni un instante, que es justo lo que uno quiere — no hay
   nada que se pueda filtrar de aquí.

   No hace falta el SDK de Stripe (ni Composer): la API es
   HTTP normal y la firma del webhook es un HMAC-SHA256.

   Las llaves van en api/config.php, que está en .gitignore:

     const STRIPE_SECRETO = 'sk_live_…';   // Clave secreta
     const STRIPE_WEBHOOK = 'whsec_…';     // Firma del webhook

   Mientras no estén, la tienda se ve y el carrito funciona,
   pero el botón de pagar avisa de que falta configurarlo.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);

function stripeSecreto(): string {
    return defined('STRIPE_SECRETO') ? (string) constant('STRIPE_SECRETO') : '';
}

function stripeWebhookSecreto(): string {
    return defined('STRIPE_WEBHOOK') ? (string) constant('STRIPE_WEBHOOK') : '';
}

function stripeListo(): bool {
    return stripeSecreto() !== '';
}

/* Dirección pública del sitio, para armar las URLs de vuelta.
   Se deduce de la petición para no tener que configurarla a mano. */
function urlBase(): string {
    if (defined('SITIO_URL') && constant('SITIO_URL') !== '') {
        return rtrim((string) constant('SITIO_URL'), '/');
    }
    $https  = (($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off')
           || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
    // …/api/index.php → …
    $raiz   = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')), '/');
    return ($https ? 'https://' : 'http://') . $host . $raiz;
}

/* ───────────── Llamada a la API de Stripe ─────────────
   Stripe recibe formularios, no JSON, y anida con corchetes:
   line_items[0][price_data][currency]=mxn */
function stripePedir(string $ruta, array $datos): array {
    $secreto = stripeSecreto();
    if ($secreto === '') throw new RuntimeException('Falta STRIPE_SECRETO en api/config.php');

    $ch = curl_init('https://api.stripe.com/v1/' . ltrim($ruta, '/'));
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($datos, '', '&', PHP_QUERY_RFC3986),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $secreto,
            'Content-Type: application/x-www-form-urlencoded',
            'Stripe-Version: 2024-06-20',
        ],
    ]);

    $cuerpo = curl_exec($ch);
    $codigo = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $fallo  = curl_error($ch);
    curl_close($ch);

    if ($cuerpo === false) throw new RuntimeException('No se pudo hablar con Stripe: ' . $fallo);

    $json = json_decode((string) $cuerpo, true);
    if (!is_array($json)) throw new RuntimeException('Stripe respondió algo inesperado.');

    if ($codigo >= 400) {
        $msg = $json['error']['message'] ?? 'Stripe rechazó la operación.';
        throw new RuntimeException('Stripe: ' . $msg);
    }
    return $json;
}

/* ───────────── Sesión de pago ─────────────
   $renglones: [['nombre' => …, 'centavos' => int, 'cantidad' => int], …]
   Los importes van en CENTAVOS y en entero: nunca en flotante, que redondea
   donde no debe cuando se trata de dinero. */
function crearSesionStripe(array $renglones, array $pedido): array {
    $datos = [
        'mode'                 => 'payment',
        'success_url'          => urlBase() . '/gracias.html?folio=' . rawurlencode($pedido['folio'])
                                             . '&t=' . rawurlencode($pedido['token']),
        'cancel_url'           => urlBase() . '/tienda.html?pago=cancelado',
        'client_reference_id'  => $pedido['id'],
        'metadata[folio]'      => $pedido['folio'],
        'metadata[pedido_id]'  => $pedido['id'],
        'locale'               => 'es',
    ];

    if ($pedido['cliente_email'] !== '') $datos['customer_email'] = $pedido['cliente_email'];

    foreach (array_values($renglones) as $i => $r) {
        $datos["line_items[$i][price_data][currency]"]              = 'mxn';
        $datos["line_items[$i][price_data][product_data][name]"]    = $r['nombre'];
        $datos["line_items[$i][price_data][unit_amount]"]           = (int) $r['centavos'];
        $datos["line_items[$i][quantity]"]                          = (int) $r['cantidad'];
    }

    return stripePedir('checkout/sessions', $datos);
}

/* ───────────── Firma del webhook ─────────────
   Sin esto, cualquiera que conozca la dirección del webhook podría avisarnos
   de un pago que nunca ocurrió y llevarse el pedido gratis. */
function firmaWebhookValida(string $cuerpo, string $cabecera, int $tolerancia = 300): bool {
    $secreto = stripeWebhookSecreto();
    if ($secreto === '' || $cabecera === '') return false;

    $t = null;
    $firmas = [];
    foreach (explode(',', $cabecera) as $parte) {
        $trozos = explode('=', trim($parte), 2);
        if (count($trozos) !== 2) continue;
        if ($trozos[0] === 't')  $t = $trozos[1];
        if ($trozos[0] === 'v1') $firmas[] = $trozos[1];
    }
    if ($t === null || !$firmas) return false;

    // Una firma vieja podría reenviarse tal cual; la marca de tiempo lo corta.
    if (abs(time() - (int) $t) > $tolerancia) return false;

    $esperada = hash_hmac('sha256', $t . '.' . $cuerpo, $secreto);
    foreach ($firmas as $f) {
        if (hash_equals($esperada, $f)) return true;
    }
    return false;
}
