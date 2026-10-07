<?php
declare(strict_types=1);

// Запуск из консоли на хостинге или в CI: php api/migrate.php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require __DIR__ . '/src/bootstrap.php';

use Kg\Config;
use Kg\Db;
use Kg\Migrator;

Config::load();
$applied = Migrator::run(Db::pdo());
echo $applied ? 'Применено: ' . implode(', ', $applied) . "\n" : "Новых миграций нет\n";
