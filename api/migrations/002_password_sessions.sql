-- Вход по нику и паролю: пароль хранится только хэшем, входы по устройствам — в sessions.

ALTER TABLE users
  DROP INDEX uq_users_key_hash,
  DROP COLUMN key_hash,
  DROP COLUMN key_rotated_at,
  ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER tint,
  ADD COLUMN password_changed_at DATETIME NULL AFTER handle_changed_at;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash   CHAR(64)     NOT NULL,
  user_id      CHAR(12)     NOT NULL,
  device       VARCHAR(80)  NOT NULL DEFAULT '',
  created_at   DATETIME     NOT NULL,
  last_used_at DATETIME     NOT NULL,
  expires_at   DATETIME     NOT NULL,
  PRIMARY KEY (token_hash),
  KEY ix_sessions_user (user_id, last_used_at),
  KEY ix_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
