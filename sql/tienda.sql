-- ══════════════════════════════════════════════════════════
--  ALMA DE MAR · Tienda en línea
--  Se instala sobre la misma base que la agenda.
-- ══════════════════════════════════════════════════════════

-- ───────────── Catálogo ─────────────
-- `gramos` y las medidas son de la pieza YA EMPACADA. De ahí sale el cobro
-- del envío, así que vale la pena corregirlas con una báscula y una cinta.
-- Si un producto no las trae, se usa el perfil de su categoría (api/envios.php).
CREATE TABLE IF NOT EXISTS productos (
  id           VARCHAR(24)   NOT NULL PRIMARY KEY,
  nombre       VARCHAR(160)  NOT NULL,
  categoria    VARCHAR(40)   NOT NULL,
  presentacion VARCHAR(40)   NOT NULL DEFAULT '',
  precio       DECIMAL(10,2) NOT NULL DEFAULT 0,
  descripcion  TEXT          NULL,
  imagen       VARCHAR(120)  NOT NULL DEFAULT '',
  gramos       INT           NOT NULL DEFAULT 0,
  largo_cm     DECIMAL(6,1)  NOT NULL DEFAULT 0,
  ancho_cm     DECIMAL(6,1)  NOT NULL DEFAULT 0,
  alto_cm      DECIMAL(6,1)  NOT NULL DEFAULT 0,
  -- NULL = no se lleva control de existencias para este producto
  stock        INT           NULL DEFAULT NULL,
  destacado    TINYINT(1)    NOT NULL DEFAULT 0,
  activo       TINYINT(1)    NOT NULL DEFAULT 1,
  orden        INT           NOT NULL DEFAULT 500,
  creado       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_productos_categoria (categoria, orden),
  INDEX idx_productos_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Pedidos ─────────────
-- El folio es lo que ve la clienta; el id es interno.
-- `token` deja consultar el pedido sin sesión: va en el enlace de "gracias"
-- y no se puede adivinar, así que nadie ve pedidos ajenos cambiando el folio.
CREATE TABLE IF NOT EXISTS pedidos (
  id               VARCHAR(24)   NOT NULL PRIMARY KEY,
  folio            VARCHAR(16)   NOT NULL UNIQUE,
  token            VARCHAR(64)   NOT NULL,
  estado           VARCHAR(20)   NOT NULL DEFAULT 'pendiente_pago',

  cliente_nombre   VARCHAR(160)  NOT NULL DEFAULT '',
  cliente_email    VARCHAR(190)  NOT NULL DEFAULT '',
  cliente_telefono VARCHAR(40)   NOT NULL DEFAULT '',

  -- 'envio' o 'recoger'
  entrega          VARCHAR(12)   NOT NULL DEFAULT 'envio',
  cp               VARCHAR(10)   NOT NULL DEFAULT '',
  calle            VARCHAR(190)  NOT NULL DEFAULT '',
  colonia          VARCHAR(120)  NOT NULL DEFAULT '',
  ciudad           VARCHAR(120)  NOT NULL DEFAULT '',
  estado_mx        VARCHAR(60)   NOT NULL DEFAULT '',
  referencias      VARCHAR(255)  NOT NULL DEFAULT '',

  subtotal         DECIMAL(10,2) NOT NULL DEFAULT 0,
  envio            DECIMAL(10,2) NOT NULL DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL DEFAULT 0,
  peso_facturable  DECIMAL(8,3)  NOT NULL DEFAULT 0,

  stripe_session   VARCHAR(190)  NOT NULL DEFAULT '',
  stripe_pago      VARCHAR(190)  NOT NULL DEFAULT '',
  pagado_en        DATETIME      NULL DEFAULT NULL,
  guia             VARCHAR(80)   NOT NULL DEFAULT '',
  notas            TEXT          NULL,
  creado           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_pedidos_estado (estado, creado),
  INDEX idx_pedidos_sesion (stripe_session)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ───────────── Renglones del pedido ─────────────
-- El nombre y el precio se COPIAN al comprar. Si mañana sube el precio o se
-- archiva el producto, el pedido sigue diciendo lo que se cobró aquel día.
CREATE TABLE IF NOT EXISTS pedido_items (
  id           INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
  pedido_id    VARCHAR(24)   NOT NULL,
  producto_id  VARCHAR(24)   NOT NULL DEFAULT '',
  nombre       VARCHAR(160)  NOT NULL,
  presentacion VARCHAR(40)   NOT NULL DEFAULT '',
  precio       DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidad     INT           NOT NULL DEFAULT 1,
  INDEX idx_items_pedido (pedido_id),
  CONSTRAINT fk_items_pedido FOREIGN KEY (pedido_id)
    REFERENCES pedidos (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
