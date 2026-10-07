-- Kids Go: начальная схема (MySQL 8.0, utf8mb4). Данные детей и семей здесь не хранятся — только кабинеты и подборки.

CREATE TABLE IF NOT EXISTS users (
  id              CHAR(12)     NOT NULL,
  handle          VARCHAR(30)  NOT NULL,
  handle_lc       VARCHAR(30)  NOT NULL,
  display_name    VARCHAR(60)  NOT NULL DEFAULT '',
  bio             VARCHAR(200) NOT NULL DEFAULT '',
  avatar_kind     ENUM('emoji','photo') NOT NULL DEFAULT 'emoji',
  avatar_value    VARCHAR(255) NOT NULL DEFAULT '🙂',
  tint            VARCHAR(16)  NOT NULL DEFAULT '#ffe9f3',
  key_hash        CHAR(64)     NOT NULL,
  email_hash      CHAR(64)     NULL,
  status          ENUM('ACTIVE','SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  consent_version VARCHAR(16)  NOT NULL DEFAULT '',
  consent_at      DATETIME     NULL,
  handle_changed_at DATETIME   NULL,
  key_rotated_at  DATETIME     NULL,
  created_at      DATETIME     NOT NULL,
  updated_at      DATETIME     NOT NULL,
  last_seen_at    DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_handle_lc (handle_lc),
  UNIQUE KEY uq_users_key_hash (key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS handle_holds (
  handle_lc  VARCHAR(30) NOT NULL,
  release_at DATETIME    NOT NULL,
  PRIMARY KEY (handle_lc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collections (
  id           CHAR(10)     NOT NULL,
  user_id      CHAR(12)     NOT NULL,
  title        VARCHAR(100) NOT NULL,
  slug         VARCHAR(80)  NOT NULL,
  description  VARCHAR(600) NOT NULL DEFAULT '',
  cover_kind   ENUM('place','collage') NOT NULL DEFAULT 'collage',
  cover_place  VARCHAR(80)  NULL,
  city         VARCHAR(40)  NOT NULL DEFAULT 'Москва',
  visibility   ENUM('PUBLIC','UNLISTED','PRIVATE') NOT NULL DEFAULT 'PRIVATE',
  status       ENUM('DRAFT','PUBLISHED','HIDDEN') NOT NULL DEFAULT 'DRAFT',
  age_min      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  age_max      TINYINT UNSIGNED NOT NULL DEFAULT 12,
  created_at   DATETIME     NOT NULL,
  updated_at   DATETIME     NOT NULL,
  published_at DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_collections_user_slug (user_id, slug),
  KEY ix_collections_user (user_id, updated_at),
  KEY ix_collections_public (visibility, status, published_at),
  CONSTRAINT fk_collections_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collection_items (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection_id CHAR(10)     NOT NULL,
  place_id      VARCHAR(80)  NOT NULL,
  position      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  creator_note  VARCHAR(240) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  UNIQUE KEY uq_items_collection_place (collection_id, place_id),
  KEY ix_items_position (collection_id, position),
  CONSTRAINT fk_items_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS collection_saves (
  user_id       CHAR(12) NOT NULL,
  collection_id CHAR(10) NOT NULL,
  created_at    DATETIME NOT NULL,
  PRIMARY KEY (user_id, collection_id),
  KEY ix_saves_collection (collection_id),
  CONSTRAINT fk_saves_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_saves_collection FOREIGN KEY (collection_id) REFERENCES collections (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS place_intents (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       CHAR(12)    NOT NULL,
  place_id      VARCHAR(80) NOT NULL,
  status        ENUM('WANT_TO_GO','VISITED','REMOVED') NOT NULL,
  source_type   VARCHAR(16) NOT NULL DEFAULT 'PLACE',
  source_id     VARCHAR(80) NULL,
  creator_id    CHAR(12)    NULL,
  collection_id CHAR(10)    NULL,
  feedback      ENUM('LIKE','OK','DISLIKE') NULL,
  created_at    DATETIME    NOT NULL,
  updated_at    DATETIME    NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_intents_user_place (user_id, place_id),
  KEY ix_intents_collection (collection_id),
  CONSTRAINT fk_intents_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Аналитика без персональных данных: анонимный id хранится только в виде короткого хэша
CREATE TABLE IF NOT EXISTS events (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_name    VARCHAR(40) NOT NULL,
  user_id       CHAR(12)    NULL,
  anon_hash     CHAR(16)    NOT NULL,
  creator_id    CHAR(12)    NULL,
  collection_id CHAR(10)    NULL,
  place_id      VARCHAR(80) NULL,
  props         JSON        NULL,
  created_at    DATETIME    NOT NULL,
  PRIMARY KEY (id),
  KEY ix_events_collection (collection_id, event_name, created_at),
  KEY ix_events_creator (creator_id, created_at),
  KEY ix_events_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reports (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter_hash CHAR(16)    NOT NULL,
  target_type   ENUM('collection','author') NOT NULL,
  target_id     VARCHAR(16) NOT NULL,
  reason        ENUM('inappropriate','impersonation','spam','children','other') NOT NULL,
  note          VARCHAR(300) NOT NULL DEFAULT '',
  status        ENUM('NEW','DONE') NOT NULL DEFAULT 'NEW',
  created_at    DATETIME    NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reports_once (reporter_hash, target_type, target_id),
  KEY ix_reports_target (target_type, target_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       VARCHAR(120) NOT NULL,
  window_start INT UNSIGNED NOT NULL,
  hits         INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start),
  KEY ix_rate_window (window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_actions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  action      VARCHAR(40) NOT NULL,
  target_type VARCHAR(16) NOT NULL,
  target_id   VARCHAR(16) NOT NULL,
  note        VARCHAR(300) NOT NULL DEFAULT '',
  created_at  DATETIME    NOT NULL,
  PRIMARY KEY (id),
  KEY ix_admin_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
