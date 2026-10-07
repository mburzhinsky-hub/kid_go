<?php
declare(strict_types=1);

// Проверки API: php api/tests/run.php
// Без базы (нет KG_DB_NAME) выполняются только проверки маршрутизации; с базой — полный набор (CI поднимает MySQL 8.0).
require dirname(__DIR__) . '/src/bootstrap.php';

use Kg\Config;
use Kg\Db;
use Kg\Migrator;
use Kg\RateLimit;
use Kg\Request;
use Kg\Router;
use Kg\Ids;
use Kg\App;

putenv('KG_ENV=development');
Config::load('/nonexistent-config.php'); // берём настройки из окружения

$fail = 0; $pass = 0;
function check(string $name, bool $ok, string $info = ''): void
{
    global $fail, $pass;
    if ($ok) { $pass++; echo "  ok   $name\n"; } else { $fail++; echo "  FAIL $name $info\n"; }
}
function call(string $method, string $path, array $query = [], array $headers = [], string $body = '', string $ip = '203.0.113.7'): array
{
    $res = App::router()->dispatch(new Request($method, $path, $query, $headers, $body, $ip));
    return [$res->status, json_decode($res->body, true), $res->headers];
}

echo "Маршрутизация\n";
[$s, $j] = call('GET', '/api/v1/health');
check('health отвечает 200', $s === 200 && ($j['ok'] ?? false) === true);
[$s, $j] = call('GET', '/api/v1/nope');
check('неизвестный адрес → 404 с кодом', $s === 404 && ($j['error']['code'] ?? '') === 'not_found');
[$s, $j, $h] = call('POST', '/api/v1/health');
check('неверный метод → 405 и Allow', $s === 405 && ($h['Allow'] ?? '') === 'GET');
[$s] = call('GET', '/other/path');
check('чужой префикс → 404', $s === 404);
[$s] = call('GET', '/v1/health');
check('адрес без /api тоже понимается (хостинг в подпапке)', $s === 200);
$r = new Request('POST', '/x', [], ['content-type' => 'application/json'], '{bad');
try { $r->json(); check('кривой JSON → ошибка', false); } catch (Kg\ApiException $e) { check('кривой JSON → ошибка', $e->errorCode === 'bad_json'); }
$r = new Request('POST', '/x', [], ['content-type' => 'text/plain'], 'hi');
try { $r->json(); check('не-JSON тип → ошибка', false); } catch (Kg\ApiException $e) { check('не-JSON тип → ошибка', $e->errorCode === 'bad_content_type'); }
$r = new Request('GET', '/x', [], ['authorization' => 'Bearer abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG']);
check('ключ из Authorization читается', $r->bearerKey() === 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG');
$r = new Request('GET', '/x', [], ['authorization' => 'Bearer short']);
check('короткий ключ отвергается', $r->bearerKey() === null);
check('случайные id не повторяются и нужной длины', strlen(Ids::random(10)) === 10 && Ids::random(12) !== Ids::random(12));
check('ключ кабинета 43 символа base64url', (bool) preg_match('/^[A-Za-z0-9_-]{43}$/', Ids::secretKey()));
check('миграция делится на запросы', count(Migrator::statements("-- c\nCREATE TABLE a (x INT);\nCREATE TABLE b (y INT);\n")) === 2);
[$s] = call('POST', '/api/v1/admin/migrate');
check('служебный вход без токена закрыт', $s === 403);

if (getenv('KG_DB_NAME') === false || getenv('KG_DB_NAME') === '') {
    echo "\nБаза не настроена — пропускаем проверки с MySQL\n";
    echo "\nИтого: $pass ок, $fail ошибок\n";
    exit($fail ? 1 : 0);
}

echo "\nБаза данных\n";
$db = Db::pdo();
$db->exec('SET FOREIGN_KEY_CHECKS=0');
foreach ($db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $t) $db->exec("DROP TABLE IF EXISTS `$t`");
$db->exec('SET FOREIGN_KEY_CHECKS=1');
$first = Migrator::run($db);
check('миграции применились', count($first) >= 1 && $first[0] === '001_init.sql');
check('повторный запуск ничего не меняет (идемпотентность)', Migrator::run($db) === []);
$tables = $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
foreach (['users', 'collections', 'collection_items', 'collection_saves', 'place_intents', 'events', 'reports', 'rate_limits', 'admin_actions', 'handle_holds'] as $t) {
    check("таблица $t есть", in_array($t, $tables, true));
}
[$s, $j] = call('GET', '/api/v1/health', ['deep' => '1']);
check('health?deep=1 видит базу', $s === 200 && ($j['db'] ?? false) === true);

$db->prepare("INSERT INTO users (id, handle, handle_lc, key_hash, created_at, updated_at) VALUES ('u00000000001','Mama','mama',?,UTC_TIMESTAMP(),UTC_TIMESTAMP())")->execute([str_repeat('a', 64)]);
$db->prepare("INSERT INTO collections (id, user_id, title, slug, created_at, updated_at) VALUES ('c000000001','u00000000001','Тест','test',UTC_TIMESTAMP(),UTC_TIMESTAMP())")->execute();
$db->exec("INSERT INTO collection_items (collection_id, place_id, position) VALUES ('c000000001','moskovsky-zoopark',0)");
try { $db->prepare("INSERT INTO users (id, handle, handle_lc, key_hash, created_at, updated_at) VALUES ('u00000000002','MAMA','mama',?,UTC_TIMESTAMP(),UTC_TIMESTAMP())")->execute([str_repeat('b', 64)]); check('ник уникален без учёта регистра', false); }
catch (PDOException) { check('ник уникален без учёта регистра', true); }
$db->exec("DELETE FROM users WHERE id='u00000000001'");
check('удаление кабинета каскадом убирает подборки и места',
    (int) $db->query('SELECT COUNT(*) FROM collections')->fetchColumn() === 0 && (int) $db->query('SELECT COUNT(*) FROM collection_items')->fetchColumn() === 0);

echo "\nЛимиты\n";
$code = 0;
for ($i = 1; $i <= 4; $i++) {
    try { RateLimit::hit($db, 'test:limit', 3, 60); } catch (Kg\ApiException $e) { $code = $e->status; $retry = $e->headers['Retry-After'] ?? ''; }
}
check('4-й запрос при лимите 3 → 429 с Retry-After', $code === 429 && ctype_digit((string) ($retry ?? '')));
try { RateLimit::hit($db, 'test:other', 3, 60); check('другой ключ считается отдельно', true); } catch (Kg\ApiException) { check('другой ключ считается отдельно', false); }

require __DIR__ . '/auth.php';

echo "\nИтого: $pass ок, $fail ошибок\n";
exit($fail ? 1 : 0);
