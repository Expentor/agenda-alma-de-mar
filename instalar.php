<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Instalador
   Crea la base de datos, las tablas, la carta de tratamientos
   y tu usuario de administración. Se ejecuta UNA vez.
   Al terminar, borra este archivo del servidor.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0');

const RUTA_CONFIG = __DIR__ . '/api/config.php';
const MIN_CLAVE   = 10;

$yaInstalado = file_exists(RUTA_CONFIG);
$errores = [];
$hecho   = false;
$resumen = [];

/* ───────────── La carta de tratamientos que se siembra ───────────── */
function cartaInicial(): array {
    return [
        ['m1', 'Marea de Calma',    'Masaje relajante',            'corporal',  50,  600, 'Un masaje suave inspirado en el vaivén de las olas, creado para liberar tensión & regalar al cuerpo una sensación profunda de calma.', '', 10],
        ['m2', 'Oleaje Profundo',   'Masaje descontracturante',    'corporal',  50,  700, 'Maniobras de mayor intensidad que recorren el cuerpo como un oleaje profundo, ayudando a liberar tensión & cansancio muscular.', '', 20],
        ['m3', 'Piedra de Mar',     'Piedras calientes',           'corporal',  90,  800, 'El calor de las piedras se fusiona con movimientos envolventes para relajar la musculatura y crear una sensación de descanso profundo.', '', 30],
        ['m4', 'Raíces de Mangle',  'Drenaje linfático',           'corporal',  90,  900, 'Inspirado en las raíces del manglar que se entrelazan y sostienen la vida junto al mar. Un ritual de movimientos suaves & rítmicos que recorren el cuerpo.', '', 40],
        ['f1', 'Brisa Marina',      'Limpieza profunda',           'facial',    90,  750, 'Purifica la piel, elimina impurezas & ayuda a restaurar su equilibrio natural para una apariencia fresca & saludable.', '', 50],
        ['f2', 'Perla del Caribe',  'Hidratación',                 'facial',    70,  850, 'Recupera hidratación, suavidad & luminosidad.', '', 60],
        ['f3', 'Calma de Manglar',  'Piel sensible',               'facial',    90,  450, 'Calma, descongestiona & aporta confort a la piel.', '', 70],
        ['f4', 'Nácar de Luna',     'Despigmentante',              'facial',    70,  450, 'Enfocado en manchas e irregularidades de pigmentación.', '', 80],
        ['f5', 'Cenote de Luz',     'Facial iluminador',           'facial',    75,  350, 'Aporta luminosidad & mejora el aspecto apagado de la piel.', '', 90],
        ['f6', 'Herencia del Mar',  'Antiedad / reafirmante',      'facial',    90,  500, 'Cuidado enfocado en firmeza, elasticidad & signos de envejecimiento.', '', 100],
        ['f7', 'Alma Premium',      'Facial personalizado premium', 'facial',  120,  850, 'Purifica la piel, elimina impurezas & ayuda a restaurar su equilibrio natural para una apariencia fresca & saludable.', 'El más completo', 110],
    ];
}

/* ───────────── Procesar el formulario ───────────── */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$yaInstalado) {

    $bdUsuarioForm = trim((string) ($_POST['raiz_usuario'] ?? 'root'));
    $bdClaveForm   = (string) ($_POST['raiz_clave'] ?? '');
    $host        = trim((string) ($_POST['host'] ?? 'localhost')) ?: 'localhost';
    $baseNombre  = preg_replace('/[^a-zA-Z0-9_]/', '', (string) ($_POST['base'] ?? 'alma_de_mar')) ?: 'alma_de_mar';

    $admUsuario  = mb_strtolower(trim((string) ($_POST['adm_usuario'] ?? '')));
    $admNombre   = trim((string) ($_POST['adm_nombre'] ?? ''));
    $admClave    = (string) ($_POST['adm_clave'] ?? '');
    $admClave2   = (string) ($_POST['adm_clave2'] ?? '');

    if (!preg_match('/^[a-z0-9._-]{3,60}$/', $admUsuario)) {
        $errores[] = 'El usuario solo puede llevar letras, números, punto, guion y guion bajo (mínimo 3).';
    }
    if (mb_strlen($admClave) < MIN_CLAVE) {
        $errores[] = 'La contraseña debe tener al menos ' . MIN_CLAVE . ' caracteres.';
    }
    if ($admClave !== $admClave2) {
        $errores[] = 'Las dos contraseñas no coinciden.';
    }
    if (mb_strtolower($admClave) === $admUsuario) {
        $errores[] = 'La contraseña no puede ser igual al usuario.';
    }

    if (!$errores) {
        try {
            $opcionesPDO = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ];

            /* Hay dos escenarios y el instalador se adapta solo:

               a) HOSTING COMPARTIDO (Hostinger y similares). La base y el
                  usuario ya los creaste en el panel, y ese usuario NO tiene
                  permiso para crear bases ni usuarios. Si conectamos directo
                  a la base, es este caso: se usa tal cual y no se toca nada
                  de administración.

               b) LOCAL (XAMPP con root). No existe la base todavía, así que
                  se crea, y con ella un usuario propio de la aplicación con
                  contraseña aleatoria, para no andar usando root a diario. */

            try {
                $raiz = new PDO(
                    "mysql:host={$host};dbname={$baseNombre};charset=utf8mb4",
                    $bdUsuarioForm, $bdClaveForm, $opcionesPDO
                );
                $bdUsuario = $bdUsuarioForm;
                $bdClave   = $bdClaveForm;
                $resumen[] = "Conectado a la base «{$baseNombre}» con el usuario «{$bdUsuario}».";
            } catch (PDOException $noExiste) {
                // No se pudo entrar a esa base: probamos como administrador
                $raiz = new PDO("mysql:host={$host};charset=utf8mb4", $bdUsuarioForm, $bdClaveForm, $opcionesPDO);

                $raiz->exec("CREATE DATABASE IF NOT EXISTS `{$baseNombre}`
                             CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                $resumen[] = "Base de datos «{$baseNombre}» creada.";

                $bdUsuario = 'alma_agenda';
                $bdClave   = bin2hex(random_bytes(18));
                $raiz->exec("CREATE USER IF NOT EXISTS '{$bdUsuario}'@'{$host}' IDENTIFIED BY " . $raiz->quote($bdClave));
                $raiz->exec("ALTER USER '{$bdUsuario}'@'{$host}' IDENTIFIED BY " . $raiz->quote($bdClave));
                $raiz->exec("GRANT SELECT, INSERT, UPDATE, DELETE ON `{$baseNombre}`.* TO '{$bdUsuario}'@'{$host}'");
                $raiz->exec('FLUSH PRIVILEGES');
                $resumen[] = "Usuario de base de datos «{$bdUsuario}» creado con contraseña aleatoria.";

                $raiz->exec("USE `{$baseNombre}`");
            }
            $sql = file_get_contents(__DIR__ . '/sql/esquema.sql');
            if ($sql === false) throw new RuntimeException('No se encontró sql/esquema.sql');

            /* Primero fuera los comentarios: si se parte por «;» sin quitarlos,
               las líneas «--» se quedan pegadas a la sentencia siguiente. */
            $limpio = implode("\n", array_filter(
                array_map('rtrim', explode("\n", $sql)),
                fn($linea) => !str_starts_with(ltrim($linea), '--')
            ));

            foreach (explode(';', $limpio) as $sentencia) {
                $sentencia = trim($sentencia);
                if ($sentencia === '') continue;
                $raiz->exec($sentencia);
            }
            $resumen[] = 'Tablas creadas (usuarios, citas, servicios, terapeutas, ajustes).';

            // 4. Carta de tratamientos
            $st = $raiz->prepare('INSERT INTO servicios (id, nombre, tipo, categoria, duracion, precio, descripcion, insignia, orden)
                                  VALUES (?,?,?,?,?,?,?,?,?)
                                  ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)');
            foreach (cartaInicial() as $s) $st->execute($s);
            $resumen[] = count(cartaInicial()) . ' tratamientos cargados.';

            // 5. Ajustes por defecto
            $st = $raiz->prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?)
                                  ON DUPLICATE KEY UPDATE valor = valor');
            $st->execute(['intervalo', '30']);
            $st->execute(['prefijo', '52']);
            $st->execute(['plantilla', 'Hola {cliente} ✨ Te confirmamos tu cita en {spa}: {servicio}, el {fecha} a las {hora}. ¡Te esperamos!']);
            $resumen[] = 'Ajustes iniciales guardados.';

            // 6. Tu usuario
            $st = $raiz->prepare('INSERT INTO usuarios (usuario, clave_hash, nombre) VALUES (?, ?, ?)
                                  ON DUPLICATE KEY UPDATE clave_hash = VALUES(clave_hash), nombre = VALUES(nombre)');
            $st->execute([$admUsuario, password_hash($admClave, PASSWORD_BCRYPT, ['cost' => 12]), $admNombre]);
            $resumen[] = "Usuario de administración «{$admUsuario}» creado.";

            // 7. api/config.php
            $config = "<?php\n"
                . "/* Generado por instalar.php. NO subir a GitHub: lleva la contraseña de la base de datos. */\n\n"
                . "declare(strict_types=1);\n\n"
                . "const BD_HOST    = " . var_export($host, true) . ";\n"
                . "const BD_PUERTO  = 3306;\n"
                . "const BD_NOMBRE  = " . var_export($baseNombre, true) . ";\n"
                . "const BD_USUARIO = " . var_export($bdUsuario, true) . ";\n"
                . "const BD_CLAVE   = " . var_export($bdClave, true) . ";\n\n"
                . "const MINUTOS_SESION = 120;\n\n"
                . "const COSTE_BCRYPT    = 12;\n"
                . "const MIN_LARGO_CLAVE = " . MIN_CLAVE . ";\n\n"
                . "const MAX_INTENTOS     = 6;\n"
                . "const VENTANA_INTENTOS = 900;\n"
                . "const BLOQUEO_SEGUNDOS = 900;\n";

            if (@file_put_contents(RUTA_CONFIG, $config) === false) {
                throw new RuntimeException('No se pudo escribir api/config.php. Revisa los permisos de la carpeta api/.');
            }
            $resumen[] = 'Archivo api/config.php escrito.';

            $hecho = true;
        } catch (Throwable $e) {
            $errores[] = 'Error: ' . $e->getMessage();
        }
    }
}
?>
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Instalar · Agenda Alma de Mar</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@200;300;400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/css/estilos.css?v=3">
<style>
  .instalador{ max-width:640px; margin:0 auto; padding:3rem 1.2rem 5rem; }
  .instalador h1{ font-size:2rem; letter-spacing:.14em; text-transform:uppercase; text-align:center; margin-bottom:.4rem; }
  .instalador__lema{ text-align:center; color:var(--agua-media); font-family:var(--display);
    letter-spacing:.2em; text-transform:uppercase; font-size:.74rem; margin:0 0 2.5rem; }
  .instalador__sello{ height:76px; margin:0 auto 1.4rem; display:block; }
  .paso{ font-family:var(--display); font-size:.72rem; letter-spacing:.2em; text-transform:uppercase;
    color:var(--oro); margin-bottom:.9rem; }
  .lista-ok{ list-style:none; padding:0; margin:0 0 1.4rem; }
  .lista-ok li{ padding:.45rem 0 .45rem 1.7rem; position:relative; border-bottom:1px solid var(--borde-suave); }
  .lista-ok li::before{ content:"✓"; position:absolute; left:0; color:var(--verde); }
</style>
</head>
<body class="con-sesion">
<div class="instalador">

  <img src="assets/img/isotipo-claro.svg" alt="" class="instalador__sello">
  <h1>Instalar la agenda</h1>
  <p class="instalador__lema">Alma de Mar · Facial &amp; Wellness</p>

<?php if ($yaInstalado && !$hecho): ?>

  <div class="panel panel--aviso">
    <h2 class="titulo-seccion">Ya está instalada</h2>
    <p class="ayuda">
      Existe <code>api/config.php</code>, así que la agenda ya está configurada.
      Para no romper nada, el instalador no vuelve a ejecutarse.
    </p>
    <p class="ayuda">
      <strong>Borra este archivo</strong> (<code>instalar.php</code>) del servidor.
      Si necesitas empezar de cero, borra antes <code>api/config.php</code> a mano.
    </p>
    <a class="boton boton--oro" href="agenda.html">Ir a la agenda</a>
  </div>

<?php elseif ($hecho): ?>

  <div class="panel">
    <h2 class="titulo-seccion">Listo</h2>
    <ul class="lista-ok">
      <?php foreach ($resumen as $r): ?>
        <li><?= htmlspecialchars($r, ENT_QUOTES, 'UTF-8') ?></li>
      <?php endforeach; ?>
    </ul>
  </div>

  <div class="panel panel--aviso">
    <h2 class="titulo-seccion">Falta un paso, y es importante</h2>
    <p class="ayuda">
      <strong>Borra ahora el archivo <code>instalar.php</code></strong> de la carpeta del sitio.
      Mientras siga ahí, cualquiera que dé con la dirección podría reinstalar la agenda.
    </p>
    <a class="boton boton--oro" href="agenda.html">Entrar a la agenda</a>
  </div>

<?php else: ?>

  <?php if ($errores): ?>
    <div class="panel" style="border-color:rgba(224,140,130,.5)">
      <h2 class="titulo-seccion" style="color:var(--rojo)">No se pudo instalar</h2>
      <?php foreach ($errores as $e): ?>
        <p class="ayuda" style="margin-bottom:.4rem"><?= htmlspecialchars($e, ENT_QUOTES, 'UTF-8') ?></p>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>

  <form method="post" autocomplete="off">

    <div class="panel">
      <p class="paso">Paso 1 de 2</p>
      <h2 class="titulo-seccion">Base de datos</h2>
      <p class="ayuda">
        <strong>Si estás en un hosting</strong> (Hostinger y similares): pon aquí los datos
        de la base que creaste en el panel, tal cual, con su prefijo
        (<code>u123456789_almademar</code>). El servidor es <code>localhost</code>.
      </p>
      <p class="ayuda">
        <strong>Si estás en tu computadora con XAMPP</strong>: usuario <code>root</code>,
        contraseña vacía, y el nombre que quieras para la base. Se creará sola.
      </p>
      <div class="rejilla-campos">
        <label class="campo-grupo">Servidor
          <input class="campo" name="host" value="localhost"></label>
        <label class="campo-grupo">Nombre de la base
          <input class="campo" name="base" value="alma_de_mar"></label>
        <label class="campo-grupo">Usuario de la base
          <input class="campo" name="raiz_usuario" value="root" autocapitalize="none" spellcheck="false"></label>
        <label class="campo-grupo">Contraseña de la base
          <input class="campo" name="raiz_clave" type="password" placeholder="(vacía en XAMPP)"></label>
      </div>
    </div>

    <div class="panel">
      <p class="paso">Paso 2 de 2</p>
      <h2 class="titulo-seccion">Tu usuario de la agenda</h2>
      <p class="ayuda">
        Con esto entrarás a la agenda desde cualquier dispositivo.
        <strong>Usa una contraseña larga</strong>: cuatro palabras sueltas
        (<code>concha-dorada-martes-91</code>) es mucho más segura y más fácil de recordar
        que una palabra corta con símbolos. Mínimo <?= MIN_CLAVE ?> caracteres.
      </p>
      <div class="rejilla-campos">
        <label class="campo-grupo">Usuario
          <input class="campo" name="adm_usuario" value="admin" required
                 pattern="[a-zA-Z0-9._-]{3,60}" autocapitalize="none" spellcheck="false"></label>
        <label class="campo-grupo">Tu nombre
          <input class="campo" name="adm_nombre" placeholder="Nombre y apellido"></label>
        <label class="campo-grupo">Contraseña
          <input class="campo" name="adm_clave" type="password" required minlength="<?= MIN_CLAVE ?>"></label>
        <label class="campo-grupo">Repite la contraseña
          <input class="campo" name="adm_clave2" type="password" required minlength="<?= MIN_CLAVE ?>"></label>
      </div>
    </div>

    <button class="boton boton--oro boton--bloque" type="submit">Instalar</button>
  </form>

<?php endif; ?>

</div>
</body>
</html>
