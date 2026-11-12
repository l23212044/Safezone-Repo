-- SafeZone · Esquema MySQL
-- Ejecutar con:  mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS safezone_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE safezone_db;

CREATE TABLE IF NOT EXISTS delegaciones (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  nombre     VARCHAR(80) NOT NULL UNIQUE,
  lat        DECIMAL(10, 7) NOT NULL,
  lng        DECIMAL(10, 7) NOT NULL,
  activa     TINYINT(1) NOT NULL DEFAULT 1,
  creado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tipos_incidente (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  clave       VARCHAR(30) NOT NULL UNIQUE,
  etiqueta    VARCHAR(80) NOT NULL,
  peso        DECIMAL(4, 2) NOT NULL,
  activo      TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios (
  id             INT PRIMARY KEY AUTO_INCREMENT,
  email          VARCHAR(120) NOT NULL UNIQUE,
  nombre         VARCHAR(120) NOT NULL,
  matricula      VARCHAR(30) NULL,
  password_hash  VARCHAR(255) NOT NULL,
  rol            ENUM('ciudadano', 'admin') NOT NULL DEFAULT 'ciudadano',
  estado         ENUM('activo', 'suspendido', 'inactivo') NOT NULL DEFAULT 'activo',
  creado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reportes (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  delegacion_id    INT NOT NULL,
  usuario_id       INT NULL,
  tipo_id          INT NOT NULL,
  peso_capturado   DECIMAL(4, 2) NOT NULL,
  descripcion      TEXT NULL,
  estado           ENUM('activo', 'revisado', 'archivado', 'rechazado') NOT NULL DEFAULT 'activo',
  lat              DECIMAL(10, 7) NULL,
  lng              DECIMAL(10, 7) NULL,
  periodo_inicio   DATE NOT NULL,
  eliminado        TINYINT(1) NOT NULL DEFAULT 0,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_reportes_delegacion_periodo (delegacion_id, periodo_inicio),
  INDEX idx_reportes_estado (estado, eliminado),
  CONSTRAINT fk_reportes_delegacion FOREIGN KEY (delegacion_id) REFERENCES delegaciones(id),
  CONSTRAINT fk_reportes_tipo       FOREIGN KEY (tipo_id)       REFERENCES tipos_incidente(id),
  CONSTRAINT fk_reportes_usuario    FOREIGN KEY (usuario_id)    REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS indice_riesgo (
  id                 INT PRIMARY KEY AUTO_INCREMENT,
  delegacion_id      INT NOT NULL,
  periodo_inicio     DATE NOT NULL,
  puntos_base        DECIMAL(6, 2) NOT NULL DEFAULT 0,
  puntos_acumulados  DECIMAL(6, 2) NOT NULL DEFAULT 0,
  puntos_totales     DECIMAL(6, 2) NOT NULL DEFAULT 0,
  porcentaje         DECIMAL(5, 2) NOT NULL DEFAULT 0,
  nivel_riesgo       ENUM('bajo', 'medio', 'alto') NOT NULL DEFAULT 'bajo',
  total_reportes     INT NOT NULL DEFAULT 0,
  actualizado_en     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_indice_delegacion_periodo (delegacion_id, periodo_inicio),
  CONSTRAINT fk_indice_delegacion FOREIGN KEY (delegacion_id) REFERENCES delegaciones(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS usuarios_bloqueados (
  email   VARCHAR(120) PRIMARY KEY,
  motivo  VARCHAR(255) NULL,
  fecha   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS logs_acceso (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  usuario_id  INT NULL,
  email       VARCHAR(120) NULL,
  evento      VARCHAR(30) NOT NULL,
  ip          VARCHAR(45) NULL,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logs_email_evento (email, evento),
  INDEX idx_logs_fecha (creado_en)
) ENGINE=InnoDB;

-- ─── Datos iniciales ─────────────────────────────────────────────────────────
INSERT IGNORE INTO delegaciones (id, nombre, lat, lng) VALUES
  (1, 'Centro',                    32.5149000, -117.0382000),
  (2, 'La Mesa',                   32.7200000, -117.0200000),
  (3, 'Otay-Centenario',           32.5500000, -116.9200000),
  (4, 'Playas de Tijuana',         32.5300000, -117.1200000),
  (5, 'San Antonio de los Buenos', 32.4950000, -117.0650000),
  (6, 'Sánchez Taboada',           32.5050000, -116.9900000),
  (7, 'Cerro Colorado',            32.5400000, -116.9700000),
  (8, 'La Presa',                  32.5600000, -116.8900000),
  (9, 'La Presa Este',             32.5200000, -116.8600000);

INSERT IGNORE INTO tipos_incidente (id, clave, etiqueta, peso) VALUES
  (1, 'accidente',  'Accidente / choque',   0.50),
  (2, 'sospechoso', 'Actividad sospechosa', 1.00),
  (3, 'robo',       'Robo',                 1.50),
  (4, 'asalto',     'Asalto armado',        2.00),
  (5, 'violencia',  'Robo con violencia',   2.00),
  (6, 'secuestro',  'Secuestro',            3.00),
  (7, 'homicidio',  'Homicidio',            4.00),
  (8, 'otro',       'Otro',                 0.50);

-- Para crear un administrador:
-- 1) regístrate en la app con el correo deseado.
-- 2) mysql> UPDATE usuarios SET rol = 'admin' WHERE email = 'tu-correo@dominio.com';
-- 3) define ADMIN_CODE en safezone-api/.env e ingrésalo en "Acceso administrador".
