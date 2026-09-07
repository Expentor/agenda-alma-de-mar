<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Instalador de la tienda
   ──────────────────────────────────────────────────────────
   Crea las tablas de la tienda y siembra el catálogo de la
   lista de precios. Se puede volver a ejecutar sin miedo:

     · Las tablas son CREATE TABLE IF NOT EXISTS.
     · Los productos se insertan con ON DUPLICATE KEY UPDATE
       solo sobre nombre, categoría, presentación y precio.
       Lo que hayas editado en el panel —descripción, foto,
       peso, medidas, existencias— NO se pisa.
     · Los pedidos no se tocan nunca.

   El usuario de la aplicación solo puede leer y escribir, no
   crear tablas: es a propósito, así una inyección de SQL no
   podría rehacer la base. Por eso, si hace falta crear las
   tablas, se piden credenciales de administrador de MySQL.
   Solo se usan en ese momento y no quedan guardadas.

   BÓRRALO del servidor cuando termines.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);

require_once __DIR__ . '/api/comun.php';
require_once __DIR__ . '/api/catalogo.php';
require_once __DIR__ . '/api/stripe.php';

$resumen   = [];
$errores   = [];
$pideAdmin = false;
$hecho     = false;

/* ¿Existen ya las tres tablas? */
function tablasListas(PDO $bd): bool {
    $n = (int) $bd->query(
        "SELECT COUNT(*) FROM information_schema.tables
          WHERE table_schema = DATABASE()
            AND table_name IN ('productos','pedidos','pedido_items')"
    )->fetchColumn();
    return $n === 3;
}

function crearTablas(PDO $bd): void {
    $sql = file_get_contents(__DIR__ . '/sql/tienda.sql');
    if ($sql === false) throw new RuntimeException('No se encontró sql/tienda.sql');

    /* Fuera los comentarios antes de partir por «;»: si no, una línea «--»
       se pega a la sentencia siguiente y la rompe. */
    $limpio = implode("\n", array_filter(
        array_map('rtrim', explode("\n", $sql)),
        fn($l) => !str_starts_with(ltrim($l), '--')
    ));
    foreach (explode(';', $limpio) as $sentencia) {
        $sentencia = trim($sentencia);
        if ($sentencia !== '') $bd->exec($sentencia);
    }
}

try {
    $bd = bd();

    // ── 1. Tablas ──
    if (tablasListas($bd)) {
        $resumen[] = 'Las tablas de la tienda ya existían.';
    } else {
        try {
            // En muchos hostings el usuario de la app sí puede crear tablas
            crearTablas($bd);
            $resumen[] = 'Tablas creadas: productos, pedidos, pedido_items.';
        } catch (PDOException $sinPermiso) {
            $usuario = trim((string) ($_POST['bd_usuario'] ?? ''));
            $clave   = (string) ($_POST['bd_clave'] ?? '');

            if ($usuario === '') {
                $pideAdmin = true;
                throw new RuntimeException('permisos');
            }

            $raiz = new PDO(
                sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', BD_HOST, BD_PUERTO, BD_NOMBRE),
                $usuario, $clave,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
            );
            crearTablas($raiz);
            $resumen[] = "Tablas creadas con el usuario «{$usuario}»: productos, pedidos, pedido_items.";
        }
    }

    if (!$pideAdmin) {
        // ── 2. Catálogo ──
        $st = $bd->prepare(
            'INSERT INTO productos (id, nombre, categoria, presentacion, precio, descripcion, orden)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               nombre = VALUES(nombre), categoria = VALUES(categoria),
               presentacion = VALUES(presentacion), precio = VALUES(precio)'
        );

        $antes = (int) $bd->query('SELECT COUNT(*) FROM productos')->fetchColumn();
        foreach (catalogoInicial() as $p) $st->execute($p);
        $despues = (int) $bd->query('SELECT COUNT(*) FROM productos')->fetchColumn();

        $nuevos = $despues - $antes;
        $resumen[] = count(catalogoInicial()) . ' productos de la lista de precios procesados: '
                   . "$nuevos nuevos, " . (count(catalogoInicial()) - $nuevos) . ' actualizados.';

        // ── 3. Fotos de categoría ──
        $faltan = [];
        foreach (categoriasTienda() as $c) {
            if ($c['imagen'] === '')                                            { $faltan[] = trim($c['titulo'] . ' ' . $c['nota']); continue; }
            if (!is_file(__DIR__ . '/assets/img/tienda/' . $c['imagen']))        { $faltan[] = $c['imagen']; }
        }
        $resumen[] = $faltan
            ? 'Sin foto todavía: ' . implode(' · ', $faltan) . '. Se muestra un marcador con los colores de la marca.'
            : 'Todas las categorías tienen foto.';

        // ── 4. Stripe ──
        $resumen[] = stripeListo()
            ? 'Stripe configurado: la tienda ya puede cobrar.'
            : 'Falta STRIPE_SECRETO en api/config.php. El catálogo y el carrito funcionan; el botón de pagar avisa de que no está listo.';

        $hecho = true;
    }

} catch (Throwable $e) {
    if (!$pideAdmin) $errores[] = $e->getMessage();
}

?><!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instalar la tienda · Alma de Mar</title>
<meta name="robots" content="noindex, nofollow">
<link rel="stylesheet" href="assets/css/estilos.css?v=9">
</head>
<body style="padding:2rem 1.2rem; max-width:760px; margin:0 auto">

<h1 class="acceso__titulo" style="font-size:1.6rem; text-align:center">Tienda</h1>
<p class="acceso__lema" style="text-align:center">Alma de Mar · Facial &amp; Wellness</p>

<?php if ($pideAdmin): ?>
  <div class="panel">
    <h2 class="titulo-seccion">Hacen falta permisos para crear las tablas</h2>
    <p class="ayuda">
      El usuario <code><?= htmlspecialchars(BD_USUARIO, ENT_QUOTES, 'UTF-8') ?></code> puede leer y
      escribir, pero no crear tablas — es a propósito. Escribe un usuario de MySQL que sí pueda,
      <strong>solo para este paso</strong>. No se guarda en ningún lado.
    </p>
    <p class="ayuda">En XAMPP suele ser <code>root</code> con la contraseña vacía.</p>
    <form method="post" class="rejilla-campos">
      <label class="campo-grupo">Usuario de MySQL
        <input class="campo" name="bd_usuario" value="root" required autocapitalize="none" spellcheck="false"></label>
      <label class="campo-grupo">Contraseña
        <input class="campo" type="password" name="bd_clave" autocomplete="off"></label>
      <div class="campo-grupo campo-grupo--ancho">
        <button class="boton boton--oro" type="submit" style="align-self:flex-start">Crear las tablas</button>
      </div>
    </form>
  </div>

<?php elseif ($errores): ?>
  <div class="panel" style="border-color:rgba(224,140,130,.5)">
    <h2 class="titulo-seccion" style="color:var(--rojo)">No se pudo instalar</h2>
    <?php foreach ($errores as $e): ?>
      <p class="ayuda" style="margin-bottom:.4rem"><?= htmlspecialchars($e, ENT_QUOTES, 'UTF-8') ?></p>
    <?php endforeach; ?>
    <p class="ayuda">Revisa que <code>api/config.php</code> exista y que MySQL esté encendido.</p>
  </div>

<?php elseif ($hecho): ?>
  <div class="panel">
    <h2 class="titulo-seccion">Listo</h2>
    <ul style="line-height:1.9; padding-left:1.2rem; color:var(--tinta-suave)">
      <?php foreach ($resumen as $r): ?>
        <li><?= htmlspecialchars($r, ENT_QUOTES, 'UTF-8') ?></li>
      <?php endforeach; ?>
    </ul>
  </div>

  <div class="panel panel--aviso">
    <h2 class="titulo-seccion">Falta un paso, y es importante</h2>
    <p class="ayuda">
      <strong>Borra ahora <code>instalar-tienda.php</code></strong> del servidor.
      Mientras siga ahí, cualquiera que dé con la dirección puede volver a sembrar el catálogo.
    </p>
    <div class="fila-alta">
      <a class="boton boton--oro" href="tienda.html">Ver la tienda</a>
      <a class="boton boton--fino" href="acceso.html">Ir al panel</a>
    </div>
  </div>
<?php endif; ?>

</body>
</html>
