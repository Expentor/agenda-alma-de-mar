<?php
/* ══════════════════════════════════════════════════════════
   ALMA DE MAR · API de la agenda
   Todo entra por aquí, así las comprobaciones de seguridad
   se aplican en un solo sitio y no se olvida ninguna.
   ══════════════════════════════════════════════════════════ */

declare(strict_types=1);
require_once __DIR__ . '/comun.php';

$ruta   = (string) ($_GET['r'] ?? '');
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* Rutas abiertas: no piden sesión iniciada.
   `publico/servicios` la usa la página del spa para pintar la carta. */
const RUTAS_ABIERTAS = ['sesion/entrar', 'sesion/estado', 'publico/servicios'];

try {
    if ($metodo === 'POST') {
        // El login todavía no tiene sesión, así que tampoco token que exigir
        if ($ruta !== 'sesion/entrar') exigirCsrf();
    } elseif ($metodo !== 'GET') {
        fallar('Método no permitido.', 405);
    }

    if (!in_array($ruta, RUTAS_ABIERTAS, true)) exigirSesion();

    match ($ruta) {
        'sesion/entrar'      => entrar(),
        'sesion/salir'       => salir(),
        'sesion/estado'      => estado(),
        'sesion/clave'       => cambiarClave(),
        'datos'              => todosLosDatos(),
        'citas/guardar'      => guardarCita(),
        'citas/borrar'       => borrarCita(),
        'servicios/guardar'  => guardarServicio(),
        'servicios/borrar'   => borrarServicio(),
        'terapeutas/guardar' => guardarTerapeuta(),
        'terapeutas/borrar'  => borrarTerapeuta(),
        'ajustes/guardar'    => guardarAjustes(),
        'publico/servicios'  => serviciosPublicos(),
        default              => fallar('Ruta desconocida.', 404),
    };
} catch (Throwable $e) {
    reventar($e);
}

/* ══════════════ Sesión ══════════════ */

function estado(): never {
    $u = usuarioActual();
    responder([
        'ok'          => true,
        'autenticado' => $u !== null,
        'usuario'     => $u,
        'csrf'        => $u !== null ? tokenCsrf() : null,
    ]);
}

function entrar(): never {
    $d       = cuerpoJson();
    $usuario = mb_strtolower(texto($d, 'usuario', 60));
    $clave   = (string) ($d['clave'] ?? '');

    if ($usuario === '' || $clave === '') fallar('Escribe usuario y contraseña.');

    $espera = esperaPorIntentos($usuario);
    if ($espera > 0) {
        fallar(
            'Demasiados intentos fallidos. Espera ' . ceil($espera / 60) . ' minuto(s) y vuelve a probar.',
            429,
            ['esperaSegundos' => $espera]
        );
    }

    $st = bd()->prepare('SELECT id, usuario, clave_hash, nombre, activo FROM usuarios WHERE usuario = ? LIMIT 1');
    $st->execute([$usuario]);
    $fila = $st->fetch();

    /* Se comprueba el hash aunque el usuario no exista: si no, el tiempo de
       respuesta delataría qué usuarios son reales. */
    $hash = $fila['clave_hash'] ?? '$2y$12$invalidoinvalidoinvalidoinvalidoinvalidoinvalidoinvalidoinv';
    $vale = password_verify($clave, $hash) && $fila && (int) $fila['activo'] === 1;

    if (!$vale) {
        anotarIntento($usuario, false);
        fallar('Usuario o contraseña incorrectos.', 401);
    }

    // Si el coste de bcrypt subió desde la última vez, se rehashea al vuelo
    if (password_needs_rehash($fila['clave_hash'], PASSWORD_BCRYPT, ['cost' => COSTE_BCRYPT])) {
        $nuevo = password_hash($clave, PASSWORD_BCRYPT, ['cost' => COSTE_BCRYPT]);
        bd()->prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?')->execute([$nuevo, $fila['id']]);
    }

    anotarIntento($usuario, true);
    limpiarIntentosViejos();
    bd()->prepare('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?')->execute([$fila['id']]);

    abrirSesion($fila);

    responder([
        'ok'      => true,
        'usuario' => ['usuario' => $fila['usuario'], 'nombre' => $fila['nombre']],
        'csrf'    => tokenCsrf(),
    ]);
}

function salir(): never {
    cerrarSesion();
    responder(['ok' => true]);
}

function cambiarClave(): never {
    $u      = exigirSesion();
    $d      = cuerpoJson();
    $actual = (string) ($d['actual'] ?? '');
    $nueva  = (string) ($d['nueva'] ?? '');

    if (mb_strlen($nueva) < MIN_LARGO_CLAVE) {
        fallar('La nueva contraseña debe tener al menos ' . MIN_LARGO_CLAVE . ' caracteres.');
    }
    if ($nueva === $actual) fallar('La contraseña nueva es igual a la actual.');

    $st = bd()->prepare('SELECT clave_hash FROM usuarios WHERE id = ?');
    $st->execute([$u['id']]);
    $hash = (string) $st->fetchColumn();

    if (!password_verify($actual, $hash)) {
        anotarIntento($u['usuario'], false);
        fallar('La contraseña actual no es correcta.', 401);
    }

    bd()->prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?')
        ->execute([password_hash($nueva, PASSWORD_BCRYPT, ['cost' => COSTE_BCRYPT]), $u['id']]);

    /* Cambiar la contraseña renueva la sesión: si alguien la tenía robada,
       con esto se queda fuera. */
    session_regenerate_id(true);
    $_SESSION['csrf'] = bin2hex(random_bytes(32));

    responder(['ok' => true, 'csrf' => tokenCsrf()]);
}

/* ══════════════ Lectura ══════════════ */

function filaServicio(array $f): array {
    return [
        'id'          => $f['id'],
        'nombre'      => $f['nombre'],
        'tipo'        => $f['tipo'],
        'categoria'   => $f['categoria'],
        'duracion'    => (int) $f['duracion'],
        'precio'      => (float) $f['precio'],
        'descripcion' => $f['descripcion'] ?? '',
        'insignia'    => $f['insignia'] ?? '',
        'orden'       => (int) $f['orden'],
    ];
}

function filaCita(array $f): array {
    return [
        'id'             => $f['id'],
        'fecha'          => $f['fecha'],
        'hora'           => substr((string) $f['hora'], 0, 5),   // TIME viene como HH:MM:SS
        'duracion'       => (int) $f['duracion'],
        'precio'         => (float) $f['precio'],
        'cliente'        => $f['cliente'],
        'telefono'       => $f['telefono'],
        'servicioId'     => $f['servicio_id'],
        'servicioNombre' => $f['servicio_nombre'],
        'terapeuta'      => $f['terapeuta'],
        'notas'          => $f['notas'] ?? '',
        'estado'         => $f['estado'],
    ];
}

function leerServicios(): array {
    $st = bd()->query('SELECT * FROM servicios WHERE activo = 1 ORDER BY orden, nombre');
    return array_map('filaServicio', $st->fetchAll());
}

function leerAjustes(): array {
    $st = bd()->query('SELECT clave, valor FROM ajustes');
    $out = [];
    foreach ($st->fetchAll() as $f) $out[$f['clave']] = $f['valor'];
    if (isset($out['intervalo'])) $out['intervalo'] = (int) $out['intervalo'];
    return $out;
}

function todosLosDatos(): never {
    exigirSesion();
    $st = bd()->query('SELECT * FROM citas ORDER BY fecha, hora');
    responder([
        'ok'         => true,
        'citas'      => array_map('filaCita', $st->fetchAll()),
        'servicios'  => leerServicios(),
        'terapeutas' => bd()->query('SELECT nombre FROM terapeutas WHERE activo = 1 ORDER BY nombre')
                            ->fetchAll(PDO::FETCH_COLUMN),
        'ajustes'    => leerAjustes(),
    ]);
}

function serviciosPublicos(): never {
    responder(['ok' => true, 'servicios' => leerServicios()]);
}

/* ══════════════ Citas ══════════════ */

function guardarCita(): never {
    exigirSesion();
    $d = cuerpoJson();

    $id      = texto($d, 'id', 32);
    $fecha   = texto($d, 'fecha', 10);
    $hora    = texto($d, 'hora', 5);
    $cliente = texto($d, 'cliente', 160);

    if (!esFecha($fecha)) fallar('La fecha no es válida.');
    if (!esHora($hora))   fallar('La hora no es válida.');
    if ($cliente === '')  fallar('Falta el nombre de la clienta.');

    $estados = ['pendiente', 'confirmada', 'completada', 'cancelada', 'ausente'];
    $estado  = texto($d, 'estado', 20);
    if (!in_array($estado, $estados, true)) $estado = 'pendiente';

    $servicioId = texto($d, 'servicioId', 24);
    if ($servicioId !== '') {
        $st = bd()->prepare('SELECT nombre FROM servicios WHERE id = ?');
        $st->execute([$servicioId]);
        $nombreServicio = (string) $st->fetchColumn();
        if ($nombreServicio === '') { $servicioId = null; $nombreServicio = texto($d, 'servicioNombre', 160); }
    } else {
        $servicioId = null;
        $nombreServicio = texto($d, 'servicioNombre', 160);
    }

    $cita = [
        'id'              => $id !== '' ? $id : ('c' . bin2hex(random_bytes(10))),
        'fecha'           => $fecha,
        'hora'            => $hora,
        'duracion'        => entero($d, 'duracion', 5, 600, 60),
        'precio'          => decimal($d, 'precio'),
        'cliente'         => $cliente,
        'telefono'        => texto($d, 'telefono', 40),
        'servicio_id'     => $servicioId,
        'servicio_nombre' => $nombreServicio,
        'terapeuta'       => texto($d, 'terapeuta', 120),
        'notas'           => texto($d, 'notas', 2000),
        'estado'          => $estado,
    ];

    $sql = 'INSERT INTO citas
              (id, fecha, hora, duracion, precio, cliente, telefono, servicio_id, servicio_nombre, terapeuta, notas, estado)
            VALUES (:id, :fecha, :hora, :duracion, :precio, :cliente, :telefono, :servicio_id, :servicio_nombre, :terapeuta, :notas, :estado)
            ON DUPLICATE KEY UPDATE
              fecha = VALUES(fecha), hora = VALUES(hora), duracion = VALUES(duracion),
              precio = VALUES(precio), cliente = VALUES(cliente), telefono = VALUES(telefono),
              servicio_id = VALUES(servicio_id), servicio_nombre = VALUES(servicio_nombre),
              terapeuta = VALUES(terapeuta), notas = VALUES(notas), estado = VALUES(estado)';
    bd()->prepare($sql)->execute($cita);

    $st = bd()->prepare('SELECT * FROM citas WHERE id = ?');
    $st->execute([$cita['id']]);
    responder(['ok' => true, 'cita' => filaCita($st->fetch())]);
}

function borrarCita(): never {
    exigirSesion();
    $id = texto(cuerpoJson(), 'id', 32);
    if ($id === '') fallar('Falta la cita a eliminar.');
    bd()->prepare('DELETE FROM citas WHERE id = ?')->execute([$id]);
    responder(['ok' => true]);
}

/* ══════════════ Servicios ══════════════ */

function guardarServicio(): never {
    exigirSesion();
    $d      = cuerpoJson();
    $nombre = texto($d, 'nombre', 120);
    if ($nombre === '') fallar('Falta el nombre del servicio.');

    $id = texto($d, 'id', 24);
    if ($id === '') $id = 's' . bin2hex(random_bytes(8));

    $sql = 'INSERT INTO servicios (id, nombre, tipo, categoria, duracion, precio, descripcion, insignia, orden)
            VALUES (:id, :nombre, :tipo, :categoria, :duracion, :precio, :descripcion, :insignia, :orden)
            ON DUPLICATE KEY UPDATE
              nombre = VALUES(nombre), tipo = VALUES(tipo), categoria = VALUES(categoria),
              duracion = VALUES(duracion), precio = VALUES(precio),
              descripcion = VALUES(descripcion), insignia = VALUES(insignia), orden = VALUES(orden)';
    bd()->prepare($sql)->execute([
        'id'          => $id,
        'nombre'      => $nombre,
        'tipo'        => texto($d, 'tipo', 120),
        'categoria'   => texto($d, 'categoria', 40),
        'duracion'    => entero($d, 'duracion', 5, 600, 60),
        'precio'      => decimal($d, 'precio'),
        'descripcion' => texto($d, 'descripcion', 2000),
        'insignia'    => texto($d, 'insignia', 60),
        'orden'       => entero($d, 'orden', 0, 9999, 500),
    ]);

    $st = bd()->prepare('SELECT * FROM servicios WHERE id = ?');
    $st->execute([$id]);
    responder(['ok' => true, 'servicio' => filaServicio($st->fetch())]);
}

function borrarServicio(): never {
    exigirSesion();
    $id = texto(cuerpoJson(), 'id', 24);
    if ($id === '') fallar('Falta el servicio a eliminar.');

    /* No se borra: se archiva. Así las citas que ya lo usaron siguen
       enteras y las cuentas de meses pasados no cambian solas. */
    bd()->prepare('UPDATE servicios SET activo = 0 WHERE id = ?')->execute([$id]);
    responder(['ok' => true]);
}

/* ══════════════ Terapeutas ══════════════ */

function guardarTerapeuta(): never {
    exigirSesion();
    $nombre = texto(cuerpoJson(), 'nombre', 120);
    if ($nombre === '') fallar('Falta el nombre.');
    bd()->prepare('INSERT INTO terapeutas (nombre, activo) VALUES (?, 1)
                   ON DUPLICATE KEY UPDATE activo = 1')->execute([$nombre]);
    responder(['ok' => true, 'nombre' => $nombre]);
}

function borrarTerapeuta(): never {
    exigirSesion();
    $nombre = texto(cuerpoJson(), 'nombre', 120);
    if ($nombre === '') fallar('Falta el nombre.');
    bd()->prepare('UPDATE terapeutas SET activo = 0 WHERE nombre = ?')->execute([$nombre]);
    responder(['ok' => true]);
}

/* ══════════════ Ajustes ══════════════ */

function guardarAjustes(): never {
    exigirSesion();
    $d = cuerpoJson();

    $permitidos = [
        'intervalo' => fn($v) => (string) max(5, min(120, (int) $v)),
        'prefijo'   => fn($v) => preg_replace('/\D/', '', mb_substr((string) $v, 0, 6)),
        'plantilla' => fn($v) => mb_substr((string) $v, 0, 1000),
    ];

    $st = bd()->prepare('INSERT INTO ajustes (clave, valor) VALUES (?, ?)
                         ON DUPLICATE KEY UPDATE valor = VALUES(valor)');
    foreach ($permitidos as $clave => $limpiar) {
        if (!array_key_exists($clave, $d)) continue;
        $st->execute([$clave, $limpiar($d[$clave])]);
    }

    responder(['ok' => true, 'ajustes' => leerAjustes()]);
}
