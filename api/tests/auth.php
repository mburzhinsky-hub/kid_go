<?php
declare(strict_types=1);

// Кабинет по нику и паролю. Подключается из run.php, когда есть база.
use Kg\App;
use Kg\Db;
use Kg\Request;

echo "\nКабинет: ник и пароль\n";

/** @return array{0:int,1:mixed,2:array<string,string>} */
function api(string $method, string $path, ?array $body = null, ?string $token = null, string $ip = '198.51.100.1', array $query = []): array
{
    $headers = ['user-agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1'];
    if ($body !== null) $headers['content-type'] = 'application/json';
    if ($token !== null) $headers['authorization'] = "Bearer $token";
    $res = App::router()->dispatch(new Request($method, $path, $query, $headers, $body !== null ? json_encode($body, JSON_UNESCAPED_UNICODE) : '', $ip));
    return [$res->status, $res->body === '' ? null : json_decode($res->body, true), $res->headers];
}
$reg = static fn (array $over = [], string $ip = '198.51.100.10') => api('POST', '/api/v1/accounts', $over + [
    'handle' => 'mama_masha', 'password' => 'Zontik-2026', 'display_name' => 'Мама Маша', 'avatar' => '🦊', 'tint' => '#FFE4F1', 'consent' => true,
], null, $ip);

// ── ник
[$s, $j] = api('GET', '/api/v1/handles/check', null, null, '198.51.100.2', ['h' => 'ab']);
check('ник из 2 символов отклонён', $s === 200 && $j['available'] === false);
[$s, $j] = api('GET', '/api/v1/handles/check', null, null, '198.51.100.2', ['h' => 'Admin']);
check('служебный ник занят', $j['available'] === false && $j['reason'] === 'Этот ник занят');
[$s, $j] = api('GET', '/api/v1/handles/check', null, null, '198.51.100.2', ['h' => '@Mama_Masha']);
check('ник нормализуется (@ и регистр), свободный — доступен', $j['available'] === true && $j['handle'] === 'mama_masha');
[$s, $j] = api('GET', '/api/v1/handles/check', null, null, '198.51.100.2', ['h' => 'мама']);
check('кириллица в нике не проходит', $j['available'] === false);

// ── регистрация
[$s, $j] = $reg(['consent' => false]);
check('без согласия — 400', $s === 400 && $j['error']['code'] === 'consent_required');
[$s, $j] = $reg(['password' => '12345678']);
check('простой пароль — 400', $s === 400 && $j['error']['code'] === 'bad_password');
[$s, $j] = $reg(['password' => 'short']);
check('короткий пароль — 400', $s === 400);
[$s, $j] = $reg(['password' => 'mama_masha-123']);
check('пароль с ником — 400', $s === 400);
[$s, $j] = $reg(['website' => 'http://spam']);
check('ловушка для ботов срабатывает', $s === 400 && $j['error']['code'] === 'rejected');
[$s, $j] = $reg(['avatar' => '<b>x</b>']);
check('аватар не-эмодзи отклонён', $s === 400 && $j['error']['code'] === 'bad_avatar');
[$s, $j, $h] = $reg();
check('регистрация — 201, токен и cookie', $s === 201 && strlen($j['token'] ?? '') === 43 && str_contains($h['Set-Cookie'] ?? '', 'HttpOnly'));
check('в ответе нет пароля и хэшей', !isset($j['user']['password_hash']) && !str_contains(json_encode($j), 'password'));
$tokA = $j['token'];
$pdo = Db::pdo();
$hash = (string) $pdo->query("SELECT password_hash FROM users WHERE handle_lc='mama_masha'")->fetchColumn();
check('пароль в базе — только хэш', str_starts_with($hash, '$') && !str_contains($hash, 'Zontik'));
[$s, $j] = $reg(['handle' => 'Mama_Masha']);
check('тот же ник в другом регистре — 409', $s === 409 && $j['error']['code'] === 'handle_taken');

// ── профиль и вход
[$s, $j] = api('GET', '/api/v1/me');
check('без токена /me — 401', $s === 401);
[$s] = api('GET', '/api/v1/me', null, 'x' . str_repeat('a', 42));
check('чужой токен /me — 401', $s === 401);
[$s, $j] = api('GET', '/api/v1/me', null, $tokA);
check('/me по токену', $s === 200 && $j['user']['handle'] === 'mama_masha' && $j['user']['avatar']['value'] === '🦊');
[$s, $j] = api('PATCH', '/api/v1/me', ['display_name' => 'Маша', 'avatar' => '🐼', 'bio' => 'Люблю парки'], $tokA);
check('правка профиля', $s === 200 && $j['user']['display_name'] === 'Маша' && $j['user']['avatar']['value'] === '🐼' && $j['user']['bio'] === 'Люблю парки');
[$s, $j] = api('PATCH', '/api/v1/me', ['tint' => 'red'], $tokA);
check('кривой цвет — 400', $s === 400);

[$s, $j1] = api('POST', '/api/v1/sessions', ['handle' => 'Mama_Masha', 'password' => 'Wrong-pass-1'], null, '198.51.100.20');
[$s2, $j2] = api('POST', '/api/v1/sessions', ['handle' => 'nobody_here', 'password' => 'Wrong-pass-1'], null, '198.51.100.21');
check('неверный пароль и несуществующий ник отвечают одинаково', $s === 401 && $s2 === 401 && $j1['error']['message'] === $j2['error']['message']);
[$s, $j, $h] = api('POST', '/api/v1/sessions', ['handle' => '@Mama_Masha', 'password' => 'Zontik-2026'], null, '198.51.100.22');
check('вход по нику и паролю (ник без учёта регистра)', $s === 200 && strlen($j['token']) === 43 && $j['token'] !== $tokA);
$tokB = $j['token'];
[$s, $j] = api('GET', '/api/v1/me/sessions', null, $tokB);
check('список входов: 2 устройства, текущее отмечено', $s === 200 && count($j['sessions']) === 2 && count(array_filter($j['sessions'], fn ($x) => $x['current'])) === 1 && $j['sessions'][0]['device'] === 'iPhone · Safari');

// ── перебор пароля
for ($i = 0; $i < 5; $i++) api('POST', '/api/v1/sessions', ['handle' => 'mama_masha', 'password' => "bad-pass-$i"], null, '198.51.100.30');
[$s, $j, $h] = api('POST', '/api/v1/sessions', ['handle' => 'mama_masha', 'password' => 'Zontik-2026'], null, '198.51.100.31');
check('после 5 неудач вход на ник блокируется даже с верным паролем (429)', $s === 429 && isset($h['Retry-After']));
$pdo->exec("DELETE FROM rate_limits WHERE bucket LIKE 'login:fail:%'");

// ── смена пароля
[$s, $j] = api('POST', '/api/v1/me/password', ['current' => 'nope-nope-1', 'new' => 'Novyj-parol-77'], $tokA);
check('смена пароля с неверным текущим — 403', $s === 403);
[$s, $j] = api('POST', '/api/v1/me/password', ['current' => 'Zontik-2026', 'new' => '12345678'], $tokA);
check('смена на простой пароль — 400', $s === 400);
[$s, $j] = api('POST', '/api/v1/me/password', ['current' => 'Zontik-2026', 'new' => 'Novyj-parol-77'], $tokA);
check('смена пароля — 200', $s === 200);
[$s] = api('GET', '/api/v1/me', null, $tokB);
check('после смены пароля другое устройство вышло', $s === 401);
[$s] = api('GET', '/api/v1/me', null, $tokA);
check('устройство, где меняли пароль, осталось', $s === 200);
[$s] = api('POST', '/api/v1/sessions', ['handle' => 'mama_masha', 'password' => 'Zontik-2026'], null, '198.51.100.40');
check('старый пароль больше не подходит', $s === 401);
[$s, $j] = api('POST', '/api/v1/sessions', ['handle' => 'mama_masha', 'password' => 'Novyj-parol-77'], null, '198.51.100.41');
check('новый пароль подходит', $s === 200);
$tokC = $j['token'];

// ── выход
[$s, , $h] = api('DELETE', '/api/v1/sessions/current', null, $tokC);
check('выход на устройстве — 204 и cookie сброшена', $s === 204 && str_contains($h['Set-Cookie'] ?? '', 'Max-Age=0'));
[$s] = api('GET', '/api/v1/me', null, $tokC);
check('после выхода токен не работает', $s === 401);
[$s, $j] = api('POST', '/api/v1/sessions', ['handle' => 'mama_masha', 'password' => 'Novyj-parol-77'], null, '198.51.100.42');
$tokD = $j['token'];
[$s] = api('DELETE', '/api/v1/sessions', null, $tokD);
[$s1] = api('GET', '/api/v1/me', null, $tokA);
[$s2] = api('GET', '/api/v1/me', null, $tokD);
check('выход на всех устройствах', $s === 204 && $s1 === 401 && $s2 === 401);

// ── удаление
[$s, $j] = api('POST', '/api/v1/sessions', ['handle' => 'mama_masha', 'password' => 'Novyj-parol-77'], null, '198.51.100.43');
$tokE = $j['token'];
$uid = (string) $pdo->query("SELECT id FROM users WHERE handle_lc='mama_masha'")->fetchColumn();
$pdo->prepare("INSERT INTO collections (id, user_id, title, slug, created_at, updated_at) VALUES ('c000000002',?,'Тест','t',UTC_TIMESTAMP(),UTC_TIMESTAMP())")->execute([$uid]);
$pdo->prepare("INSERT INTO events (event_name, user_id, anon_hash, created_at) VALUES ('collection_view', ?, 'abcd', UTC_TIMESTAMP())")->execute([$uid]);
[$s] = api('DELETE', '/api/v1/me', ['password' => 'wrong-wrong-1'], $tokE);
check('удаление с неверным паролем — 403', $s === 403);
[$s] = api('DELETE', '/api/v1/me', ['password' => 'Novyj-parol-77'], $tokE);
check('удаление кабинета — 204', $s === 204);
check('данные удалены: пользователь, подборки, входы', (int) $pdo->query("SELECT COUNT(*) FROM users WHERE id='$uid'")->fetchColumn() === 0
    && (int) $pdo->query("SELECT COUNT(*) FROM collections WHERE user_id='$uid'")->fetchColumn() === 0
    && (int) $pdo->query("SELECT COUNT(*) FROM sessions WHERE user_id='$uid'")->fetchColumn() === 0);
check('события обезличены (user_id пуст)', (int) $pdo->query("SELECT COUNT(*) FROM events WHERE user_id IS NULL AND anon_hash='abcd'")->fetchColumn() === 1);
[$s, $j] = $reg([], '198.51.100.50');
check('после удаления ник снова свободен', $s === 201);

// ── лимит регистраций
$last = 0;
for ($i = 0; $i < 6; $i++) { [$last] = $reg(['handle' => "limit_user_$i"], '198.51.100.99'); }
check('регистраций с одного адреса не больше 5 в сутки (429)', $last === 429);
