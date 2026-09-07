<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Cálculo de envíos a la república
   ──────────────────────────────────────────────────────────
   El costo se calcula por PESO FACTURABLE, que es como cobra
   la paquetería: se compara el peso real del paquete contra
   su peso volumétrico y manda el mayor de los dos. Con cosas
   ligeras pero voluminosas —seis velas, una caja de brisas—
   casi siempre gana el volumétrico, así que las medidas
   importan tanto como la báscula.

   Los números están puestos con tarifas públicas de guía
   prepagada terrestre. Cuando tengas tu cotización, NO los
   cambies aquí: ponlos en el `.env` de la raíz. Este archivo
   se actualiza con `git pull` y se llevaría tus cambios por
   delante; el `.env` no, porque git ni lo ve.

   Los pesos y medidas por categoría (`perfiles`) sí viven
   aquí, porque son del producto y no del servidor. Cuando
   peses una pieza real, corrígela en el panel: Tienda →
   Editar → Peso y medidas, que manda sobre el perfil.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);

require_once __DIR__ . '/entorno.php';

/* Todos los números salen del .env de la raíz, con estos valores por defecto.
   Se pone en el .env y no aquí porque el sitio se actualiza con `git pull`:
   lo que edites dentro de este archivo se pierde en la siguiente subida. */
function configEnvios(): array {
    return [

        /* Escalones de peso facturable → precio. Se cobra el primer escalón
           cuyo límite alcance el peso del paquete. */
        'escalones' => [
            ['hasta_kg' => 1,  'precio' => entorno('ENVIO_TARIFA_1KG',  145.0)],
            ['hasta_kg' => 3,  'precio' => entorno('ENVIO_TARIFA_3KG',  155.0)],
            ['hasta_kg' => 5,  'precio' => entorno('ENVIO_TARIFA_5KG',  160.0)],
            ['hasta_kg' => 10, 'precio' => entorno('ENVIO_TARIFA_10KG', 172.0)],
            ['hasta_kg' => 15, 'precio' => entorno('ENVIO_TARIFA_15KG', 180.0)],
            ['hasta_kg' => 25, 'precio' => entorno('ENVIO_TARIFA_25KG', 202.0)],
            ['hasta_kg' => 35, 'precio' => entorno('ENVIO_TARIFA_35KG', 220.0)],
        ],

        /* Arriba del último escalón: el precio de ese escalón más un cargo
           por cada kilo extra. Evita cotizar de menos un pedido enorme. */
        'sobre_maximo_por_kg' => entorno('ENVIO_POR_KG_EXTRA', 12.0),

        /* Divisor del peso volumétrico. La paquetería terrestre en México
           usa 5000: (largo × ancho × alto en cm) / 5000. */
        'divisor_volumetrico' => entorno('ENVIO_DIVISOR_VOLUMETRICO', 5000.0),

        /* Los frascos no se acomodan perfecto en la caja: hay paredes,
           burbuja y huecos. El volumen sumado se infla por este factor. */
        'factor_empaque' => entorno('ENVIO_FACTOR_EMPAQUE', 1.35),

        /* Peso de la caja, burbuja y relleno, en gramos. */
        'tara_gramos' => entorno('ENVIO_TARA_GRAMOS', 150),

        /* Perfiles por categoría: peso y medidas de UNA pieza ya empacada.
           Un producto solo necesita medidas propias si se sale del molde.

           ¡OJO! Son ESTIMADAS. Pesa y mide unas cuantas piezas reales de
           cada tipo y corrige: de aquí sale el cobro de todos tus envíos. */
        'perfiles' => [
            'aceites'     => ['gramos' => 60,  'l' => 3.0, 'w' => 3.0, 'h' => 9.0],
            'sinergias'   => ['gramos' => 70,  'l' => 3.5, 'w' => 3.5, 'h' => 9.5],
            'inhaladores' => ['gramos' => 15,  'l' => 2.0, 'w' => 2.0, 'h' => 8.0],
            'brisas'      => ['gramos' => 180, 'l' => 5.0, 'w' => 5.0, 'h' => 16.0],
            'masaje'      => ['gramos' => 320, 'l' => 6.5, 'w' => 6.5, 'h' => 17.0],
            'vehiculares' => ['gramos' => 300, 'l' => 6.5, 'w' => 6.5, 'h' => 17.0],
            'velas8'      => ['gramos' => 450, 'l' => 9.0, 'w' => 9.0, 'h' => 10.0],
            'velas4'      => ['gramos' => 250, 'l' => 7.0, 'w' => 7.0, 'h' => 8.0],
        ],

        /* Para lo que no tenga perfil ni medidas propias. Deliberadamente
           generoso: mejor cotizar de más que perder dinero en la guía. */
        'perfil_por_defecto' => ['gramos' => 300, 'l' => 7.0, 'w' => 7.0, 'h' => 15.0],

        /* Destinos que la paquetería cobra aparte. Se compara por PREFIJO de
           código postal, así que '97' cubre todo Yucatán. Déjalo en 0 si tu
           tarifa acaba siendo plana a todo el país. */
        'sobrecargo_zona_extendida' => entorno('ENVIO_SOBRECARGO_ZONA', 131.40),
        'prefijos_zona_extendida'   => array_filter(array_map('trim', explode(',',
            entorno('ENVIO_PREFIJOS_ZONA', '97,98,77,24,29,30,23,22,21,88,87')))),

        /* Porcentaje que la paquetería suma cada mes sobre la tarifa. Ponlo
           en 0 si tu tarifa ya lo trae incluido. */
        'sobrecargo_combustible_pct' => entorno('ENVIO_COMBUSTIBLE_PCT', 0.0),

        /* Días hábiles estimados de entrega. Se le enseña a la clienta. */
        'dias_entrega' => ['min' => entorno('ENVIO_DIAS_MIN', 3), 'max' => entorno('ENVIO_DIAS_MAX', 7)],

        /* Recoger en el spa, sin costo. */
        'recoger_activo'    => entorno('RECOGER_ACTIVO', true),
        'recoger_direccion' => entorno('RECOGER_DIRECCION',
            'Av. Fiestas de Mayo #18, Condominios Torres del Mar, Dep. 10F'),
    ];
}

/* ───────────── Medidas de una pieza ─────────────
   Manda lo capturado en el producto; si viene en cero, el perfil de su
   categoría; y si tampoco existe, el perfil por defecto. */
function perfilDeProducto(array $p): array {
    $cfg = configEnvios();
    $base = $cfg['perfiles'][$p['categoria'] ?? ''] ?? $cfg['perfil_por_defecto'];

    $gramos = (int) ($p['gramos'] ?? 0);
    $l = (float) ($p['largo_cm'] ?? 0);
    $w = (float) ($p['ancho_cm'] ?? 0);
    $h = (float) ($p['alto_cm'] ?? 0);

    return [
        'gramos' => $gramos > 0 ? $gramos : (int) $base['gramos'],
        'l' => $l > 0 ? $l : (float) $base['l'],
        'w' => $w > 0 ? $w : (float) $base['w'],
        'h' => $h > 0 ? $h : (float) $base['h'],
    ];
}

/* ───────────── Peso facturable ─────────────
   $items: [['producto' => fila de la tabla, 'cantidad' => n], …] */
function pesoFacturable(array $items): array {
    $cfg = configEnvios();

    $gramos = 0;
    $cm3    = 0.0;

    foreach ($items as $it) {
        $perfil = perfilDeProducto($it['producto']);
        $n = max(1, (int) $it['cantidad']);
        $gramos += $perfil['gramos'] * $n;
        $cm3    += $perfil['l'] * $perfil['w'] * $perfil['h'] * $n;
    }

    $gramos += $cfg['tara_gramos'];
    $cm3    *= $cfg['factor_empaque'];

    $real        = $gramos / 1000;
    $volumetrico = $cm3 / $cfg['divisor_volumetrico'];

    return [
        'real'        => round($real, 3),
        'volumetrico' => round($volumetrico, 3),
        'facturable'  => round(max($real, $volumetrico), 3),
        'manda'       => $volumetrico > $real ? 'volumetrico' : 'real',
    ];
}

function esCodigoPostal(string $cp): bool {
    return (bool) preg_match('/^\d{5}$/', $cp);
}

function esZonaExtendida(string $cp): bool {
    if (!esCodigoPostal($cp)) return false;
    $dos = substr($cp, 0, 2);
    return in_array($dos, configEnvios()['prefijos_zona_extendida'], true);
}

/* Precio de la guía para un peso facturable dado. */
function tarifaPorPeso(float $kg): float {
    $cfg = configEnvios();
    foreach ($cfg['escalones'] as $e) {
        if ($kg <= $e['hasta_kg']) return (float) $e['precio'];
    }
    $ultimo = end($cfg['escalones']);
    $extra  = ceil($kg - $ultimo['hasta_kg']);
    return (float) $ultimo['precio'] + $extra * $cfg['sobre_maximo_por_kg'];
}

/* ───────────── Cotización ─────────────
   Devuelve las opciones de entrega para un carrito y un CP. Si el CP todavía
   no se escribió, se cotiza igual con la tarifa base y se avisa de que la
   zona extendida puede sumar. */
function cotizarEnvio(array $items, string $cp): array {
    $cfg  = configEnvios();
    $peso = pesoFacturable($items);

    $tarifa = tarifaPorPeso($peso['facturable']);
    $extendida = esZonaExtendida($cp);
    if ($extendida) $tarifa += $cfg['sobrecargo_zona_extendida'];
    if ($cfg['sobrecargo_combustible_pct'] > 0) {
        $tarifa *= 1 + $cfg['sobrecargo_combustible_pct'] / 100;
    }

    $opciones = [[
        'id'        => 'envio',
        'titulo'    => 'Envío a domicilio',
        'detalle'   => sprintf('%d a %d días hábiles', $cfg['dias_entrega']['min'], $cfg['dias_entrega']['max']),
        'precio'    => round($tarifa, 2),
    ]];

    if ($cfg['recoger_activo']) {
        $opciones[] = [
            'id'      => 'recoger',
            'titulo'  => 'Recoger en el spa',
            'detalle' => $cfg['recoger_direccion'],
            'precio'  => 0.0,
        ];
    }

    return [
        'opciones'       => $opciones,
        'peso'           => $peso,
        'cpValido'       => esCodigoPostal($cp),
        'zonaExtendida'  => $extendida,
        'sobrecargoZona' => $extendida ? $cfg['sobrecargo_zona_extendida'] : 0.0,
    ];
}

/* Precio final de una opción de entrega. Se recalcula SIEMPRE en el
   servidor al cobrar: lo que diga el navegador es una sugerencia. */
function precioDeEntrega(array $items, string $cp, string $entrega): float {
    if ($entrega === 'recoger' && configEnvios()['recoger_activo']) return 0.0;
    $c = cotizarEnvio($items, $cp);
    foreach ($c['opciones'] as $o) {
        if ($o['id'] === 'envio') return (float) $o['precio'];
    }
    return 0.0;
}
