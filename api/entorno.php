<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Archivo .env
   ──────────────────────────────────────────────────────────
   Los ajustes que cambian de un servidor a otro —las llaves
   de Stripe, las tarifas de tu paquetería— van en un `.env`
   en la raíz del sitio, fuera de git.

   Por qué, y no dentro del código: el sitio se actualiza con
   `git pull`. Cualquier número que edites dentro de un `.php`
   se pierde en la siguiente actualización. Lo que vive en el
   `.env` sobrevive, porque git ni lo ve.

   Formato, una línea por ajuste:

     STRIPE_SECRETO=sk_live_51H...
     ENVIO_TARIFA_1KG=139

   Las líneas en blanco y las que empiezan por # se ignoran.
   Las comillas alrededor del valor son opcionales.

   ¿Dónde ponerlo? Se busca en dos sitios, en este orden:

     1. UN NIVEL ARRIBA de la raíz del sitio. En Hostinger, si
        el sitio está en /home/uXXXX/public_html, el archivo va
        en /home/uXXXX/.env. Es el sitio SEGURO: está fuera de
        lo que el servidor web puede servir, pase lo que pase.

     2. En la raíz del sitio, junto a index.html. Más cómodo,
        pero ahí solo lo protege el .htaccess. Si un día el
        servidor deja de leerlo, las llaves quedan a la vista.

   Si puedes, usa el 1. Si usas el 2, comprueba de vez en cuando
   que https://tudominio.com/.env da 403 o 404, nunca el texto.

   (En XAMPP local no apliques el 1: ahí el nivel de arriba es
   `htdocs`, que Apache sí sirve. En local, el de la raíz.)
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);

/* Se lee una sola vez por petición y se queda en memoria. */
function entornoTodo(): array {
    static $valores = null;
    if ($valores !== null) return $valores;

    $valores = [];

    $raiz = dirname(__DIR__);
    $ruta = null;
    foreach ([dirname($raiz) . '/.env', $raiz . '/.env'] as $candidata) {
        if (is_readable($candidata)) { $ruta = $candidata; break; }
    }
    if ($ruta === null) return $valores;

    foreach (file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $linea) {
        $linea = trim($linea);
        if ($linea === '' || str_starts_with($linea, '#')) continue;

        $partes = explode('=', $linea, 2);
        if (count($partes) !== 2) continue;

        $clave = trim($partes[0]);
        $valor = trim($partes[1]);

        /* Comillas opcionales: STRIPE_SECRETO="sk_..." y sk_... valen igual. */
        if (strlen($valor) >= 2
            && ($valor[0] === '"' || $valor[0] === "'")
            && $valor[-1] === $valor[0]) {
            $valor = substr($valor, 1, -1);
        }

        if ($clave !== '') $valores[$clave] = $valor;
    }
    return $valores;
}

/* Un ajuste suelto, con su valor por defecto si no está en el .env.
   El tipo del valor por defecto manda: si pones 145 (entero), lo que salga
   del .env se convierte a número; si pones true, a booleano. */
function entorno(string $clave, mixed $porDefecto = null): mixed {
    $valores = entornoTodo();
    if (!array_key_exists($clave, $valores) || $valores[$clave] === '') return $porDefecto;

    $v = $valores[$clave];

    if (is_bool($porDefecto)) {
        return in_array(mb_strtolower($v), ['1', 'true', 'si', 'sí', 'yes', 'on'], true);
    }
    if (is_int($porDefecto))   return (int) $v;
    if (is_float($porDefecto)) return (float) $v;
    return $v;
}

/* Las llaves y direcciones se usan como constantes por el resto del código.
   Solo se definen las que el .env traiga y que no estén ya en config.php:
   así, si alguien las tiene puestas a mano en config.php, siguen mandando y
   no hay dos sitios peleándose por el mismo valor. */
function cargarEntorno(): void {
    foreach (['STRIPE_SECRETO', 'STRIPE_WEBHOOK', 'SITIO_URL'] as $clave) {
        $v = entorno($clave, '');
        if ($v !== '' && !defined($clave)) define($clave, $v);
    }
}
