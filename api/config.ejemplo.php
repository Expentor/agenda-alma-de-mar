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
// Las llaves de Stripe y las tarifas de envío NO van aquí: van en el
// archivo `.env` de la raíz del sitio. Copia `.env.ejemplo` como `.env`
// y rellénalo ahí.
//
// El motivo es práctico: este `config.php` lo genera el instalador y es
// distinto en cada servidor, mientras que el `.env` se edita a mano y
// está pensado para eso. Además `git pull` no toca ninguno de los dos.
//
// Si por lo que sea prefieres ponerlas aquí, funciona igual y estas
// mandan sobre el `.env`:
//
// const STRIPE_SECRETO = 'sk_live_...';
// const STRIPE_WEBHOOK = 'whsec_...';
