<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Configuración del servidor
   ──────────────────────────────────────────────────────────
   Este archivo es la PLANTILLA. El de verdad (`config.php`)
   lo escribe `instalar.php` con tus datos, y NO se sube a
   GitHub: lleva la contraseña de la base de datos.

   Si alguna vez tienes que crearlo a mano, copia este archivo
   como `config.php` y rellena los valores.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);

/* ── Base de datos ───────────────────────────────────────── */
const BD_HOST    = 'localhost';
const BD_PUERTO  = 3306;
const BD_NOMBRE  = 'alma_de_mar';
const BD_USUARIO = 'alma_agenda';
const BD_CLAVE   = 'PON-AQUI-LA-CONTRASEÑA';

/* ── Sesión ──────────────────────────────────────────────── */
// Minutos de inactividad antes de cerrar la sesión sola.
const MINUTOS_SESION = 120;

/* ── Contraseñas ─────────────────────────────────────────── */
// Coste de bcrypt: a más alto, más lento de romper por fuerza bruta.
// 12 tarda ~0,25 s por comprobación, que es lo que se busca.
const COSTE_BCRYPT    = 12;
const MIN_LARGO_CLAVE = 10;

/* ── Freno a los intentos de acceso ──────────────────────── */
// Tras MAX_INTENTOS fallos dentro de VENTANA_INTENTOS segundos,
// se bloquea ese usuario y esa IP durante BLOQUEO_SEGUNDOS.
const MAX_INTENTOS     = 6;
const VENTANA_INTENTOS = 900;   // 15 minutos
const BLOQUEO_SEGUNDOS = 900;   // 15 minutos

/* ── Tienda: cobro con Stripe ────────────────────────────── */
// Las dos llaves salen del panel de Stripe. Mientras no estén, la tienda
// se ve y el carrito funciona, pero el botón de pagar avisa de que falta
// configurarlo — no se rompe nada.
//
//   STRIPE_SECRETO  Desarrolladores → Claves de API → «Clave secreta».
//                   Empieza por sk_test_ mientras pruebas y sk_live_ cuando
//                   ya cobres de verdad. NO es la clave publicable.
//
//   STRIPE_WEBHOOK  Desarrolladores → Webhooks → añade el endpoint
//                     https://TU-DOMINIO/api/webhook-stripe.php
//                   con el evento  checkout.session.completed
//                   y copia aquí su «Clave de firma» (whsec_…).
//
// El webhook es lo que marca un pedido como pagado. Sin él los pagos entran
// en Stripe pero los pedidos se quedan en «sin pagar».
//
// const STRIPE_SECRETO = 'sk_live_...';
// const STRIPE_WEBHOOK = 'whsec_...';

// Dirección pública del sitio. Solo hace falta si Stripe vuelve a una
// dirección equivocada (por ejemplo detrás de un proxy raro).
// const SITIO_URL = 'https://almademar.mx';
