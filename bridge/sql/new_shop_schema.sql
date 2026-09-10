-- ---------------------------------------------------------------------------
-- Techno Forma: schema for the NEW site's own database.
--
-- Run this in the freshly created database (e.g. masteraf_shop) ONLY.
-- It must never be executed against masteraf_new: the old shop's customers,
-- orders and catalog stay untouched and are read-only for the new site.
-- ---------------------------------------------------------------------------

SET NAMES utf8mb4;

-- Customers of the new site. Fully independent from oc_customer.
CREATE TABLE IF NOT EXISTS tf_user (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email           VARCHAR(190) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  first_name      VARCHAR(60)  NOT NULL DEFAULT '',
  last_name       VARCHAR(60)  NOT NULL DEFAULT '',
  phone           VARCHAR(20)  NULL,
  phone_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  email_verified  TINYINT(1)   NOT NULL DEFAULT 0,
  role            ENUM('user','manager','admin') NOT NULL DEFAULT 'user',
  lang            ENUM('ru','uk') NOT NULL DEFAULT 'ru',
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tf_user_email (email),
  UNIQUE KEY uq_tf_user_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Server-side sessions (opaque token hash in the cookie).
CREATE TABLE IF NOT EXISTS tf_session (
  id          CHAR(64) NOT NULL,           -- sha256 of the session token
  user_id     BIGINT UNSIGNED NOT NULL,
  user_agent  VARCHAR(255) NOT NULL DEFAULT '',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_tf_session_user (user_id),
  CONSTRAINT fk_tf_session_user FOREIGN KEY (user_id) REFERENCES tf_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One-time codes: e-mail confirmation, password reset, phone OTP.
CREATE TABLE IF NOT EXISTS tf_verification (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  kind        ENUM('email','password_reset','phone') NOT NULL,
  target      VARCHAR(190) NOT NULL,       -- e-mail or phone the code was sent to
  code_hash   CHAR(64) NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_tf_verification_lookup (kind, target, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders placed on the new site. Catalog data is snapshotted per line so an
-- order never depends on the old database staying unchanged.
CREATE TABLE IF NOT EXISTS tf_order (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no              VARCHAR(20) NOT NULL,
  user_id               BIGINT UNSIGNED NULL,   -- NULL = guest checkout
  status                VARCHAR(40) NOT NULL DEFAULT 'new',
  first_name            VARCHAR(60) NOT NULL,
  last_name             VARCHAR(60) NOT NULL,
  phone                 VARCHAR(20) NOT NULL,
  email                 VARCHAR(190) NULL,
  lang                  ENUM('ru','uk') NOT NULL DEFAULT 'ru',
  delivery              VARCHAR(40) NOT NULL DEFAULT 'novaposhta',
  np_city               VARCHAR(120) NULL,
  np_warehouse          VARCHAR(160) NULL,
  np_warehouse_address  VARCHAR(255) NULL,
  comment               TEXT NULL,
  total                 DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount              DECIMAL(12,2) NOT NULL DEFAULT 0,
  tracking_number       VARCHAR(40) NULL,
  salesdrive_order_id   VARCHAR(40) NULL,
  salesdrive_status_id  VARCHAR(40) NULL,
  salesdrive_synced_at  DATETIME NULL,
  salesdrive_error      TEXT NULL,
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tf_order_no (order_no),
  KEY ix_tf_order_user (user_id, created_at),
  CONSTRAINT fk_tf_order_user FOREIGN KEY (user_id) REFERENCES tf_user (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tf_order_item (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id            BIGINT UNSIGNED NOT NULL,
  catalog_product_id  INT UNSIGNED NULL,      -- product_id in masteraf_new (reference only)
  product_sku         VARCHAR(64) NULL,
  product_name        VARCHAR(255) NOT NULL,
  variant_label       VARCHAR(120) NULL,
  unit_price          DECIMAL(12,2) NOT NULL,
  quantity            INT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY ix_tf_order_item_order (order_id),
  CONSTRAINT fk_tf_order_item_order FOREIGN KEY (order_id) REFERENCES tf_order (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Persistent cart for signed-in customers (guests keep it in the browser).
CREATE TABLE IF NOT EXISTS tf_cart_item (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id             BIGINT UNSIGNED NOT NULL,
  catalog_product_id  INT UNSIGNED NOT NULL,
  variant_label       VARCHAR(120) NULL,
  quantity            INT UNSIGNED NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tf_cart_line (user_id, catalog_product_id, variant_label),
  CONSTRAINT fk_tf_cart_user FOREIGN KEY (user_id) REFERENCES tf_user (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Callback requests from the site forms.
CREATE TABLE IF NOT EXISTS tf_callback_request (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(20)  NOT NULL,
  comment     TEXT NULL,
  handled     TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
