<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · Cimientos de la API
   Conexión, sesión, seguridad y respuestas JSON.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);

/* ───────────── Errores ─────────────
   Al cliente nunca se le cuenta el detalle: los fallos van al log del
   servidor y el navegador solo recibe «algo falló». Un mensaje de error
   de base de datos le dice a un atacante más de lo que debería. */
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

require_once __DIR__ . '/config.php';

/* El .env de la raíz completa lo que config.php no traiga: llaves de Stripe
   y tarifas de envío. Va después, para que config.php siga mandando sobre
   lo que ya define. */
require_once __DIR__ . '/entorno.php';
cargarEntorno();

/* ───────────── Cabeceras ───────────── */
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

/* ───────────── Respuestas ───────────── */

function responder(array $datos, int $codigo = 200): never {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fallar(string $mensaje, int $codigo = 400, array $extra = []): never {
    responder(['ok' => false, 'error' => $mensaje] + $extra, $codigo);
}

/* Errores internos: al log el detalle, al cliente una frase neutra. */
function reventar(Throwable $e): never {
    error_log('[alma-de-mar] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    fallar('No se pudo completar la operación. Inténtalo de nuevo.', 500);
}

/* ───────────── Base de datos ───────────── */

function bd(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    try {
        $pdo = new PDO(
            sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', BD_HOST, BD_PUERTO, BD_NOMBRE),
            BD_USUARIO,
            BD_CLAVE,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                // Consultas preparadas de verdad, no emuladas: es lo que
                // deja fuera la inyección de SQL.
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    } catch (PDOException $e) {
        reventar($e);
    }
    return $pdo;
}

/* ───────────── Sesión ───────────── */

function arrancarSesion(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $seguro = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');

    session_set_cookie_params([
        'lifetime' => 0,          // se va al cerrar el navegador
        'path'     => '/',
        'httponly' => true,       // el JavaScript no puede leerla: sin robo por XSS
        'secure'   => $seguro,    // por HTTPS, solo viaja cifrada
        'samesite' => 'Lax',      // no se manda desde otros sitios
    ]);
    session_name('alma_sesion');
    session_start();
}

function usuarioActual(): ?array {
    arrancarSesion();
    if (empty($_SESSION['usuario_id'])) return null;

    // Caducidad por inactividad
    $limite = MINUTOS_SESION * 60;
    if (isset($_SESSION['visto']) && (time() - $_SESSION['visto']) > $limite) {
        cerrarSesion();
        return null;
    }
    $_SESSION['visto'] = time();

    return [
        'id'      => (int) $_SESSION['usuario_id'],
        'usuario' => (string) $_SESSION['usuario'],
        'nombre'  => (string) ($_SESSION['nombre'] ?? ''),
    ];
}

function exigirSesion(): array {
    $u = usuarioActual();
    if ($u === null) fallar('Tu sesión expiró. Vuelve a entrar.', 401, ['sesion' => false]);
    return $u;
}

function abrirSesion(array $usuario): void {
    arrancarSesion();
    // Contra la fijación de sesión: el identificador de antes de entrar no vale
    session_regenerate_id(true);
    $_SESSION['usuario_id'] = (int) $usuario['id'];
    $_SESSION['usuario']    = (string) $usuario['usuario'];
    $_SESSION['nombre']     = (string) $usuario['nombre'];
    $_SESSION['visto']      = time();
    $_SESSION['csrf']       = bin2hex(random_bytes(32));
}

function cerrarSesion(): void {
    arrancarSesion();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

/* ───────────── CSRF ─────────────
   Sin esto, otra página abierta en el mismo navegador podría hacer que
   tu sesión borrara citas sin que te enteres. El token viaja en una
   cabecera que solo puede poner nuestro propio JavaScript. */

function tokenCsrf(): string {
    arrancarSesion();
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}

function exigirCsrf(): void {
    arrancarSesion();
    $enviado  = $_SERVER['HTTP_X_CSRF'] ?? '';
    $esperado = $_SESSION['csrf'] ?? '';
    if ($esperado === '' || !is_string($enviado) || !hash_equals($esperado, $enviado)) {
        /* 403 y no 419: Apache no conoce el 419 y lo convierte en un 500,
           que ocultaría el motivo real del rechazo. */
        fallar('Petición no válida. Recarga la página.', 403, ['csrf' => false]);
    }
}

/* ───────────── Freno a los intentos de acceso ───────────── */

function ipBinaria(): ?string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $bin = @inet_pton($ip);
    return $bin === false ? null : $bin;
}

function anotarIntento(string $usuario, bool $exito): void {
    try {
        bd()->prepare('INSERT INTO intentos_acceso (usuario, ip, exito) VALUES (?, ?, ?)')
            ->execute([mb_substr($usuario, 0, 60), ipBinaria(), $exito ? 1 : 0]);
    } catch (Throwable $e) {
        error_log('[alma-de-mar] no se pudo anotar el intento: ' . $e->getMessage());
    }
}

/* Devuelve los segundos que faltan para poder reintentar, o 0 si se puede ya. */
function esperaPorIntentos(string $usuario): int {
    try {
        $sql = 'SELECT COUNT(*) FROM intentos_acceso
                 WHERE exito = 0
                   AND momento > (NOW() - INTERVAL ? SECOND)
                   AND (usuario = ? OR (ip IS NOT NULL AND ip = ?))';
        $st = bd()->prepare($sql);
        $st->execute([VENTANA_INTENTOS, mb_substr($usuario, 0, 60), ipBinaria()]);
        $fallos = (int) $st->fetchColumn();

        if ($fallos < MAX_INTENTOS) return 0;

        // Cuándo fue el último fallo: el bloqueo cuenta desde ahí
        $st = bd()->prepare('SELECT UNIX_TIMESTAMP(MAX(momento)) FROM intentos_acceso
                              WHERE exito = 0 AND (usuario = ? OR (ip IS NOT NULL AND ip = ?))');
        $st->execute([mb_substr($usuario, 0, 60), ipBinaria()]);
        $ultimo = (int) $st->fetchColumn();

        $faltan = ($ultimo + BLOQUEO_SEGUNDOS) - time();
        return max(0, $faltan);
    } catch (Throwable $e) {
        error_log('[alma-de-mar] no se pudo consultar intentos: ' . $e->getMessage());
        return 0;
    }
}

function limpiarIntentosViejos(): void {
    try {
        bd()->exec('DELETE FROM intentos_acceso WHERE momento < (NOW() - INTERVAL 7 DAY)');
    } catch (Throwable $e) { /* no es crítico */ }
}

/* ───────────── Entrada ───────────── */

function cuerpoJson(): array {
    $bruto = file_get_contents('php://input') ?: '';
    if ($bruto === '') return [];
    $datos = json_decode($bruto, true);
    return is_array($datos) ? $datos : [];
}

function texto(array $datos, string $clave, int $max = 255): string {
    $v = $datos[$clave] ?? '';
    if (!is_scalar($v)) return '';
    return mb_substr(trim((string) $v), 0, $max);
}

function entero(array $datos, string $clave, int $min, int $max, int $porDefecto = 0): int {
    $v = filter_var($datos[$clave] ?? null, FILTER_VALIDATE_INT);
    if ($v === false || $v === null) return $porDefecto;
    return max($min, min($max, $v));
}

function decimal(array $datos, string $clave, float $min = 0, float $max = 999999): float {
    $v = filter_var($datos[$clave] ?? null, FILTER_VALIDATE_FLOAT);
    if ($v === false || $v === null) return $min;
    return max($min, min($max, $v));
}

function esFecha(string $v): bool {
    $d = DateTime::createFromFormat('Y-m-d', $v);
    return $d !== false && $d->format('Y-m-d') === $v;
}

function esHora(string $v): bool {
    return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v);
}
