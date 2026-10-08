-- Модерация: пометки у подборки (когда и кем скрыта, смотрел ли модератор) и индекс для очереди жалоб.
-- Таблицы reports и admin_actions уже есть с 001. Шаги повторяемы: если колонка или индекс уже есть, ничего не меняется.

-- hidden_at/hidden_by: подборка скрыта автоматически после жалоб (AUTO) или модератором (ADMIN).
-- reviewed_at: модератор проверил подборку и оставил её; после этого автоскрытие по жалобам для неё не включается,
-- скрыть её может только модератор.
SET @kg_sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE collections ADD COLUMN hidden_at DATETIME NULL, ADD COLUMN hidden_by ENUM(''AUTO'',''ADMIN'') NULL, ADD COLUMN reviewed_at DATETIME NULL',
    'DO 0')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'collections' AND COLUMN_NAME = 'hidden_at'
);
PREPARE kg_alter FROM @kg_sql;
EXECUTE kg_alter;
DEALLOCATE PREPARE kg_alter;

-- Очередь жалоб в админке: по статусу и времени
SET @kg_sql = (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE reports ADD KEY ix_reports_queue (status, created_at)',
    'DO 0')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reports' AND INDEX_NAME = 'ix_reports_queue'
);
PREPARE kg_alter FROM @kg_sql;
EXECUTE kg_alter;
DEALLOCATE PREPARE kg_alter;
