<?php
declare(strict_types=1);

// Простой автозагрузчик: Kg\Foo\Bar → src/Foo/Bar.php (без Composer — на хостинге его нет)
spl_autoload_register(static function (string $class): void {
    if (strncmp($class, 'Kg\\', 3) !== 0) return;
    $file = __DIR__ . '/' . str_replace('\\', '/', substr($class, 3)) . '.php';
    if (is_file($file)) require $file;
});

mb_internal_encoding('UTF-8');
date_default_timezone_set('UTC');
