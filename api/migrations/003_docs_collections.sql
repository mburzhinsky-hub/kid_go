-- Облачная копия локального состояния (user_docs) и подборки с пунктами в JSON.
-- Данные детей и семьи сюда не попадают: контроллер отклоняет такие ключи, схема их не знает.

-- Документы синхронизации: по одной строке на (кабинет, имя). version растёт на 1 при каждой записи.
CREATE TABLE IF NOT EXISTS user_docs (
  user_id    CHAR(12)     NOT NULL,
  name       VARCHAR(24)  NOT NULL,
  version    INT UNSIGNED NOT NULL DEFAULT 1,
  body       MEDIUMTEXT   NOT NULL,
  updated_at DATETIME     NOT NULL,
  PRIMARY KEY (user_id, name),
  CONSTRAINT fk_user_docs_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Подборки: таблица collections есть с 001. Здесь она доводится до контракта API одним ALTER (он атомарный):
-- slug до 120, cover_place → cover_slug, city до 60, пункты (до 30 мест с порядком и заметкой) — в колонке items.
-- Проверка по items делает шаг повторяемым: если колонка уже есть, ничего не меняется.
-- Старые таблицы collection_items и collection_saves остаются как есть: API ими не пользуется.
SET @kg_sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE collections MODIFY COLUMN slug VARCHAR(120) NOT NULL, CHANGE COLUMN cover_place cover_slug VARCHAR(80) NULL, MODIFY COLUMN city VARCHAR(60) NOT NULL DEFAULT ''Москва'', ADD COLUMN items JSON NULL AFTER age_max',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND COLUMN_NAME = 'items'
);
PREPARE kg_alter FROM @kg_sql;
EXECUTE kg_alter;
DEALLOCATE PREPARE kg_alter;
