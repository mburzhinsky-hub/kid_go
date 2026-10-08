<?php
declare(strict_types=1);

// /c/<id>/ → оболочка страницы подборки с превью для мессенджеров (правило в корневом .htaccess).
require __DIR__ . '/src/bootstrap.php';

use Kg\Config;
use Kg\Db;
use Kg\SharePage;

ini_set('display_errors', '0');
Config::load();

$shellFile = dirname(__DIR__) . '/c/index.html';
$shell = is_file($shellFile) ? file_get_contents($shellFile) : false;
if ($shell === false) {
    http_response_code(404);
    exit;
}

$id = (string) ($_GET['id'] ?? '');
$status = 200;
$html = $shell;
$cache = 'no-store';
try {
    [$status, $html, $cache] = SharePage::render(Db::pdo(), $id, $shell, (string) Config::get('site_url', 'https://kids-go.fun'));
} catch (\Throwable $e) {
    // база недоступна — отдаём обычную оболочку: приложение само прочитает подборку и покажет ошибку
    $status = 200;
    $html = $shell;
}

http_response_code($status);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: ' . $cache);
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
echo $html;
