<?php
declare(strict_types=1);

namespace Kg;

use PDO;

/** Применяет migrations/NNN_*.sql по порядку, каждый файл один раз (журнал — таблица schema_migrations). */
final class Migrator
{
    /** @return list<string> имена применённых сейчас файлов */
    public static function run(PDO $db, ?string $dir = null): array
    {
        $dir ??= dirname(__DIR__) . '/migrations';
        $db->exec('CREATE TABLE IF NOT EXISTS schema_migrations (
            filename VARCHAR(120) NOT NULL PRIMARY KEY,
            applied_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
        $done = $db->query('SELECT filename FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN);
        $files = glob($dir . '/[0-9][0-9][0-9]_*.sql') ?: [];
        sort($files, SORT_STRING);
        $applied = [];
        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $done, true)) continue;
            foreach (self::statements((string) file_get_contents($file)) as $sql) $db->exec($sql);
            $db->prepare('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, UTC_TIMESTAMP())')->execute([$name]);
            $applied[] = $name;
        }
        return $applied;
    }

    /** Делим файл на запросы по «;» в конце строки; строки-комментарии «-- …» отбрасываем. */
    public static function statements(string $sql): array
    {
        $lines = array_filter(explode("\n", $sql), static fn ($l) => !preg_match('/^\s*--/', $l));
        $parts = preg_split('/;\s*(?:\n|$)/', implode("\n", $lines)) ?: [];
        return array_values(array_filter(array_map('trim', $parts), static fn ($s) => $s !== ''));
    }
}
