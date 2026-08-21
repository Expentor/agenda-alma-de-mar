-- ══════════════════════════════════════════════════════════
--  ALMA DE MAR · Base de datos de la agenda
--  MariaDB / MySQL · utf8mb4
--  Lo crea todo `instalar.php`; este archivo es la referencia.
-- ══════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ───────────── Usuarios que pueden entrar a la agenda ─────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  usuario        VARCHAR(60)   NOT NULL,
  -- Hash bcrypt de PHP (password_hash). Nunca la contraseña en claro.
  clave_hash     VARCHAR(255)  NOT NULL,
  nombre         VARCHAR(120)  NOT NULL DEFAULT '',
  activo         TINYINT(1)    NOT NULL DEFAULT 1,
  creado_en      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso  DATETIME      NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Intentos de acceso (freno a la fuerza bruta) ─────────────
CREATE TABLE IF NOT EXISTS intentos_acceso (
  id        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario   VARCHAR(60)     NOT NULL,
  ip        VARBINARY(16)   NULL,
  exito     TINYINT(1)      NOT NULL DEFAULT 0,
  momento   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_usuario_momento (usuario, momento),
  KEY idx_ip_momento (ip, momento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Carta de tratamientos ─────────────
CREATE TABLE IF NOT EXISTS servicios (
  id           VARCHAR(24)   NOT NULL,
  nombre       VARCHAR(120)  NOT NULL,
  tipo         VARCHAR(120)  NOT NULL DEFAULT '',
  categoria    VARCHAR(40)   NOT NULL DEFAULT '',
  duracion     SMALLINT UNSIGNED NOT NULL,
  precio       DECIMAL(10,2) NOT NULL DEFAULT 0,
  descripcion  TEXT          NULL,
  insignia     VARCHAR(60)   NULL,
  orden        SMALLINT      NOT NULL DEFAULT 0,
  -- 0 = archivado: no se ofrece en citas nuevas, pero las citas viejas
  -- que lo usaban siguen enteras.
  activo       TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_orden (activo, orden)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Terapeutas / cabinas ─────────────
CREATE TABLE IF NOT EXISTS terapeutas (
  id      INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre  VARCHAR(120) NOT NULL,
  activo  TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Citas ─────────────
CREATE TABLE IF NOT EXISTS citas (
  id              VARCHAR(32)   NOT NULL,
  fecha           DATE          NOT NULL,
  hora            TIME          NOT NULL,
  duracion        SMALLINT UNSIGNED NOT NULL,
  precio          DECIMAL(10,2) NOT NULL DEFAULT 0,
  cliente         VARCHAR(160)  NOT NULL,
  telefono        VARCHAR(40)   NOT NULL DEFAULT '',
  servicio_id     VARCHAR(24)   NULL,
  -- El nombre se copia aquí a propósito: si mañana cambias o borras el
  -- servicio, la cita de hace un año sigue diciendo lo que se hizo.
  servicio_nombre VARCHAR(160)  NOT NULL DEFAULT '',
  terapeuta       VARCHAR(120)  NOT NULL DEFAULT '',
  notas           TEXT          NULL,
  estado          ENUM('pendiente','confirmada','completada','cancelada','ausente')
                                NOT NULL DEFAULT 'pendiente',
  creada_en       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizada_en  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_fecha (fecha, hora),
  KEY idx_cliente (cliente),
  KEY idx_telefono (telefono),
  CONSTRAINT fk_cita_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Ajustes sueltos de la agenda ─────────────
CREATE TABLE IF NOT EXISTS ajustes (
  clave  VARCHAR(60)  NOT NULL,
  valor  TEXT         NOT NULL,
  PRIMARY KEY (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
