<?php
declare(strict_types=1);

// Документы синхронизации и подборки. Подключается из run.php после auth.php (берёт оттуда api()), когда есть база.
use Kg\App;
use Kg\Db;
use Kg\Places;
use Kg\Request;
use Kg\Response;

$pdo = Db::pdo();

/** Создаёт кабинет и возвращает id и токен. Каждому — свой IP, чтобы не упереться в лимит регистраций. */
function kg_user(string $handle, string $ip): array
{
    [$s, $j] = api('POST', '/api/v1/accounts', [
        'handle' => $handle, 'password' => 'Zontik-2026', 'display_name' => "Автор $handle", 'avatar' => '🦊', 'tint' => '#FFE4F1', 'consent' => true,
    ], null, $ip);
    if ($s !== 201) throw new RuntimeException("Не удалось создать кабинет $handle: " . json_encode($j, JSON_UNESCAPED_UNICODE));
    return ['id' => $j['user']['id'], 'token' => $j['token'], 'handle' => $handle];
}

/** Запрос с готовым телом-строкой и доступом к «сырому» ответу (нужно, чтобы отличать {} от []). */
function kg_raw(string $method, string $path, ?string $token = null, ?string $rawBody = null, array $query = []): Response
{
    $headers = ['user-agent' => 'tests'];
    if ($rawBody !== null) $headers['content-type'] = 'application/json';
    if ($token !== null) $headers['authorization'] = "Bearer $token";
    return App::router()->dispatch(new Request($method, $path, $query, $headers, $rawBody ?? '', '192.0.2.250'));
}

function kg_dbg(mixed $j): string
{
    return substr(json_encode($j, JSON_UNESCAPED_UNICODE) ?: '', 0, 300);
}

function kg_reset_create_limit(PDO $pdo): void
{
    $pdo->exec("DELETE FROM rate_limits WHERE bucket LIKE 'coll:create:%'");
}

// ───────────────────────────────────────────── документы синхронизации
echo "\nДокументы синхронизации\n";
if (time() % 60 >= 56) sleep(5); // не попасть на границу минутного окна лимита
$D1 = kg_user('docs_alpha', '192.0.2.11');
$D2 = kg_user('docs_beta', '192.0.2.12');
$putDoc = static function (?string $tok, string $name, string|int $base, string $bodyJson): array {
    $res = kg_raw('PUT', "/api/v1/me/docs/$name", $tok, '{"base_version":' . $base . ',"body":' . $bodyJson . '}');
    return [$res->status, json_decode($res->body, true), $res];
};
$getDocs = static fn (?string $tok): Response => kg_raw('GET', '/api/v1/me/docs', $tok);

check('docs: без токена GET → 401', $getDocs(null)->status === 401);
[$s] = $putDoc(null, 'intents', 0, '{}');
check('docs: без токена PUT → 401', $s === 401);
$res = $getDocs($D1['token']);
check('docs: пока документов нет — {"docs":{}}', $res->status === 200 && $res->body === '{"docs":{}}', $res->body);

[$s, $j] = $putDoc($D1['token'], 'intents', 0, '{"want":{"moskovsky-zoopark":{"at":1}},"emptyObj":{},"emptyArr":[],"ru":"Привет","n":1.5}');
check('docs: создание (base_version 0) → 200, version 1, updated_at в ISO с Z',
    $s === 200 && ($j['version'] ?? 0) === 1 && preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', (string) ($j['updated_at'] ?? '')) === 1, kg_dbg($j));
$res = $getDocs($D1['token']);
$j = json_decode($res->body, true);
check('docs: GET отдаёт version, body и updated_at; {} и [] не путаются, кириллица не экранируется',
    $res->status === 200 && array_keys($j['docs']) === ['intents'] && $j['docs']['intents']['version'] === 1
    && str_contains($res->body, '"emptyObj":{}') && str_contains($res->body, '"emptyArr":[]') && str_contains($res->body, '"ru":"Привет"')
    && $j['docs']['intents']['body']['n'] === 1.5 && isset($j['docs']['intents']['updated_at']), $res->body);

[$s, $j] = $putDoc($D1['token'], 'intents', 0, '{"x":1}');
check('docs: повторное создание с base_version 0 → 409 conflict с current',
    $s === 409 && ($j['error']['code'] ?? '') === 'conflict' && ($j['error']['message'] ?? '') !== ''
    && ($j['current']['version'] ?? 0) === 1 && ($j['current']['body']['ru'] ?? '') === 'Привет', kg_dbg($j));
[$s, $j] = $putDoc($D1['token'], 'saves', 3, '{"x":1}');
check('docs: base_version 3 для несуществующего документа → 409, current.version 0 и body null',
    $s === 409 && ($j['current']['version'] ?? -1) === 0 && array_key_exists('body', $j['current']) && $j['current']['body'] === null, kg_dbg($j));
check('docs: после неудачных записей ничего не создано', (int) $pdo->query("SELECT COUNT(*) FROM user_docs WHERE name='saves'")->fetchColumn() === 0);

[$s, $j] = $putDoc($D1['token'], 'intents', 1, '{"v":2}');
check('docs: запись с актуальной версией → 200, version 2', $s === 200 && $j['version'] === 2, kg_dbg($j));
[$s, $j] = $putDoc($D1['token'], 'intents', 2, '{"v":2}');
check('docs: те же данные ещё раз — не ошибка, версия растёт (rowCount надёжен)', $s === 200 && $j['version'] === 3, kg_dbg($j));
[$s, $j] = $putDoc($D1['token'], 'intents', 1, '{"v":"stale"}');
check('docs: устаревшая версия → 409, current — свежий документ',
    $s === 409 && $j['current']['version'] === 3 && $j['current']['body'] === ['v' => 2], kg_dbg($j));
check('docs: в базе версия 3 и тело последней успешной записи',
    $pdo->query("SELECT CONCAT(version, ':', body) FROM user_docs WHERE name='intents'")->fetchColumn() === '3:{"v":2}');

foreach (['children', 'child', 'family', 'kids', 'childName', 'child_name', 'birthday', 'Children', 'BIRTHDAY'] as $k) {
    [$s, $j] = $putDoc($D1['token'], 'trips', 0, '{"a":[{"b":{"' . $k . '":"x"}}]}');
    check("docs: запрещённый ключ «{$k}» на глубине → 422", $s === 422 && ($j['error']['code'] ?? '') === 'children_forbidden' && str_contains($j['error']['message'], 'детях'), kg_dbg($j));
}
[$s, $j] = $putDoc($D1['token'], 'trips', 0, '[{"family":1}]');
check('docs: запрещённый ключ внутри массива верхнего уровня → 422', $s === 422);
check('docs: отклонённое тело не сохранилось', (int) $pdo->query("SELECT COUNT(*) FROM user_docs WHERE name='trips'")->fetchColumn() === 0);
[$s, $j] = $putDoc($D1['token'], 'trips', 0, '{"title":"children museum","childhood":1,"kidsy":[],"familyRoom":true}');
check('docs: похожие слова в значениях и в других ключах разрешены', $s === 200, kg_dbg($j));

[$s, $j] = $putDoc($D1['token'], 'children', 0, '{}');
check('docs: неизвестное имя → 404', $s === 404 && ($j['error']['code'] ?? '') === 'not_found', kg_dbg($j));
[$s] = $putDoc($D1['token'], 'Intents', 0, '{}');
check('docs: имя чувствительно к регистру → 404', $s === 404);
foreach (['intents', 'trips', 'plans', 'saves', 'follows', 'prefs'] as $n) {
    [$s] = $putDoc($D2['token'], $n, 0, '[]');
    if ($s !== 200) break;
}
check('docs: все 6 допустимых имён принимаются (и пустой массив [])', $s === 200 && (int) $pdo->query("SELECT COUNT(*) FROM user_docs WHERE user_id='{$D2['id']}'")->fetchColumn() === 6);
$res = $getDocs($D2['token']);
$j = json_decode($res->body, true);
check('docs: GET отдаёт все 6 в порядке списка, у каждого версия 1', array_keys($j['docs']) === ['intents', 'trips', 'plans', 'saves', 'follows', 'prefs']
    && count(array_filter($j['docs'], fn ($d) => $d['version'] === 1 && $d['body'] === [])) === 6);
$j = json_decode($getDocs($D1['token'])->body, true);
check('docs: чужие документы не видны', array_keys($j['docs']) === ['intents', 'trips'] && $j['docs']['intents']['version'] === 3);

foreach ([['"1"', 'строка'], ['-1', 'отрицательная'], ['1.5', 'дробная'], ['null', 'null'], ['true', 'bool']] as [$bad, $what]) {
    [$s, $j] = $putDoc($D1['token'], 'prefs', $bad, '{}');
    check("docs: base_version — $what → 422", $s === 422 && ($j['error']['code'] ?? '') === 'bad_base_version', kg_dbg($j));
}
foreach (['"текст"', '5', 'null', 'true'] as $bad) {
    [$s, $j] = $putDoc($D1['token'], 'prefs', 0, $bad);
    check("docs: body = $bad (не объект и не массив) → 422", $s === 422 && ($j['error']['code'] ?? '') === 'bad_body', kg_dbg($j));
}
$res = kg_raw('PUT', '/api/v1/me/docs/prefs', $D1['token'], '{"base_version":0}');
check('docs: нет поля body → 422', $res->status === 422);
$res = kg_raw('PUT', '/api/v1/me/docs/prefs', $D1['token'], '{oops');
check('docs: невалидный JSON → 422 bad_json', $res->status === 422 && (json_decode($res->body, true)['error']['code'] ?? '') === 'bad_json', $res->body);
$res = kg_raw('PUT', '/api/v1/me/docs/prefs', $D1['token'], '[1,2]');
check('docs: запрос-массив вместо объекта → 422', $res->status === 422);
[$s, $j] = $putDoc($D1['token'], 'plans', 0, '{"s":"' . str_repeat('a', 262136) . '"}');
check('docs: ровно 256 КБ после кодирования проходит', $s === 200, kg_dbg($j));
[$s, $j] = $putDoc($D1['token'], 'follows', 0, '{"s":"' . str_repeat('a', 262137) . '"}');
check('docs: на байт больше 256 КБ → 413', $s === 413 && ($j['error']['code'] ?? '') === 'too_large', kg_dbg($j));

// лимит 120 записей в минуту на пользователя (считаем от заранее выставленного счётчика, чтобы не зависеть от границы окна)
$win = intdiv(time(), 60) * 60;
$pdo->prepare('INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 119) ON DUPLICATE KEY UPDATE hits = 119')->execute(["docs:put:{$D2['id']}", $win]);
[$s1] = $putDoc($D2['token'], 'intents', 1, '{"n":120}');
[$s2, $j2, $r2] = $putDoc($D2['token'], 'intents', 2, '{"n":121}');
check('docs: 120-я запись за минуту проходит, 121-я → 429 с Retry-After', $s1 === 200 && $s2 === 429 && ctype_digit($r2->headers['Retry-After'] ?? ''), kg_dbg($j2));
[$s] = $putDoc($D1['token'], 'prefs', 0, '{"ok":true}');
check('docs: лимит у каждого пользователя свой', $s === 200);

// ───────────────────────────────────────────── подборки
echo "\nПодборки\n";
$A = kg_user('kolya_a', '192.0.2.21');
$B = kg_user('lena_b', '192.0.2.22');
$tA = $A['token'];
$tB = $B['token'];
$col = static fn (string $id) => "/api/v1/collections/$id";
$post = static fn (array $b, ?string $tok = null) => api('POST', '/api/v1/collections', $b, $tok ?? $GLOBALS['tA']);
$put = static fn (string $id, array $b, ?string $tok = null) => api('PUT', "/api/v1/collections/$id", $b, $tok ?? $GLOBALS['tA']);

[$s] = api('POST', '/api/v1/collections', ['title' => 'x', 'items' => []]);
check('без токена POST /collections → 401', $s === 401);
[$s] = api('PUT', '/api/v1/collections/abcdefghij', ['title' => 'x']);
check('без токена PUT → 401', $s === 401);
[$s] = api('DELETE', '/api/v1/collections/abcdefghij');
check('без токена DELETE → 401', $s === 401);
[$s] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['mine' => '1']);
check('без токена GET ?mine=1 → 401', $s === 401);
[$s, $j] = api('GET', '/api/v1/collections');
check('GET /collections без mine/public → 400', $s === 400 && $j['error']['code'] === 'bad_query');

// ── создание
$note = 'Нужен "самокат" 🛴 \\ / <b>x</b>';
[$s, $j, $h] = $post([
    'title' => "  Парки  Москвы \n",
    'description' => "Куда сходить\nс малышами\x07",
    'items' => [
        ['place_id' => 'moskovsky-zoopark', 'creator_note' => "  $note  "],
        ['place_id' => 'park-gorkogo'],
        ['place_id' => 'moskovsky-zoopark', 'creator_note' => 'повтор'],
    ],
    'status' => 'PUBLISHED', 'user_id' => 'uhacker00001', 'id' => 'HACK-hack', 'slug' => 'hack', 'published_at' => '2020-01-01 00:00:00',
]);
$c = $j['collection'] ?? [];
$cid = $c['id'] ?? '';
check('создание → 201, id из 10 символов [a-z0-9]', $s === 201 && preg_match('/^[a-z0-9]{10}$/', $cid) === 1 && $cid !== 'HACK-hack', kg_dbg($j));
check('ответ — ровно та форма, что у клиентского типа Collection (без published_at у черновика)',
    array_keys($c) === ['id', 'user_id', 'title', 'slug', 'description', 'cover', 'city', 'visibility', 'status', 'age_min', 'age_max', 'created_at', 'updated_at', 'items'], kg_dbg(array_keys($c)));
check('значения по умолчанию: PRIVATE, DRAFT, collage, Москва, 0–12; чужие поля из тела игнорируются',
    $c['visibility'] === 'PRIVATE' && $c['status'] === 'DRAFT' && $c['cover'] === ['kind' => 'collage'] && $c['city'] === 'Москва'
    && $c['age_min'] === 0 && $c['age_max'] === 12 && $c['user_id'] === $A['id'] && $c['slug'] === 'parki-moskvy', kg_dbg($c));
check('строки очищены: пробелы по краям, перевод строки → пробел, управляющие символы удалены',
    $c['title'] === 'Парки  Москвы' && $c['description'] === 'Куда сходить с малышами', kg_dbg([$c['title'], $c['description']]));
check('время в ISO 8601 с Z', preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', $c['created_at']) === 1 && $c['created_at'] === $c['updated_at']);
$it = $c['items'];
check('пункты: повтор места убран, порядок и position верны, id = <id подборки>-<номер>',
    count($it) === 2 && $it[0]['id'] === "$cid-1" && $it[0]['collection_id'] === $cid && $it[0]['place_id'] === 'moskovsky-zoopark' && $it[0]['position'] === 0
    && $it[1]['id'] === "$cid-2" && $it[1]['place_id'] === 'park-gorkogo' && $it[1]['position'] === 1, kg_dbg($it));
check('заметка: кавычки, эмодзи, слэши и HTML сохраняются как есть; у места без заметки поля нет',
    ($it[0]['creator_note'] ?? null) === $note && !array_key_exists('creator_note', $it[1]), kg_dbg($it));
// id, выбранный приложением заранее
[$s, $j] = $post(['title' => 'С заданным id', 'items' => [['place_id' => 'park-gorkogo']], 'id' => 'abc123xyz9']);
check('клиентский id из 10 символов принимается', $s === 201 && ($j['collection']['id'] ?? '') === 'abc123xyz9', kg_dbg($j));
[$s, $j] = api('POST', '/api/v1/collections', ['title' => 'Чужая занятая', 'items' => [['place_id' => 'park-gorkogo']], 'id' => 'abc123xyz9'], $GLOBALS['tB']);
check('занятый id → 409 id_taken, подборка первого автора не тронута', $s === 409 && ($j['error']['code'] ?? '') === 'id_taken', kg_dbg($j));
[$s, $j] = api('GET', '/api/v1/collections/abc123xyz9', null, $GLOBALS['tA']);
check('подборка с клиентским id по-прежнему принадлежит первому автору', $s === 200 && ($j['mine'] ?? false) === true);
$pdo->exec("DELETE FROM collections WHERE id = 'abc123xyz9'");
check('автор в ответе: id, name, username, avatar, tint — как в /me',
    $j['author'] === ['id' => $A['id'], 'name' => 'Автор kolya_a', 'username' => 'kolya_a', 'avatar' => '🦊', 'tint' => '#ffe4f1'], kg_dbg($j['author'] ?? null));
check('пункты лежат в JSON-колонке', (int) $pdo->query("SELECT JSON_LENGTH(items) FROM collections WHERE id='$cid'")->fetchColumn() === 2);
$leak = static function (string $body): bool {
    foreach (['password', 'token_hash', 'session_hash', 'key_hash', 'email_hash', 'consent'] as $w) if (stripos($body, $w) !== false) return true;
    return false;
};
$bodies = [json_encode($j)];

// ── кто что видит
[$s] = api('GET', $col($cid));
check('приватная подборка: аноним → 404', $s === 404);
[$s] = api('GET', $col($cid), null, $tB);
check('приватная подборка: другой пользователь → 404', $s === 404);
[$s, $j, $h] = api('GET', $col($cid), null, $tA);
check('приватная подборка: владелец → 200, mine=true, Cache-Control: no-store',
    $s === 200 && $j['mine'] === true && $j['collection']['id'] === $cid && $j['author']['id'] === $A['id'] && ($h['Cache-Control'] ?? '') === 'no-store', kg_dbg($h));
$bodies[] = json_encode($j);
check('ответ GET /collections/:id — ровно collection, author, mine', array_keys($j) === ['collection', 'author', 'mine']);
[$s] = api('GET', '/api/v1/collections/abc');
check('кривой id → 404', $s === 404);
[$s] = api('GET', '/api/v1/collections/zzzzzzzzzz');
check('несуществующий id → 404', $s === 404);

[$s, $j] = $put($cid, ['visibility' => 'UNLISTED']);
check('PUT visibility=UNLISTED → 200, подборка остаётся DRAFT', $s === 200 && $j['collection']['visibility'] === 'UNLISTED' && $j['collection']['status'] === 'DRAFT', kg_dbg($j));
[$s] = api('GET', $col($cid));
check('UNLISTED, но DRAFT: аноним → 404', $s === 404);
[$s] = api('GET', $col($cid), null, $tB);
check('DRAFT чужому не виден → 404', $s === 404);

$before = $c;
[$s, $j] = $put($cid, ['status' => 'HIDDEN', 'user_id' => $B['id'], 'id' => 'HACK-hack', 'slug' => 'hack', 'published_at' => '2020-01-01 00:00:00', 'description' => 'Новое описание']);
$c2 = $j['collection'] ?? [];
check('PUT: служебные поля из тела игнорируются, меняется только присланное (частичное обновление)',
    $s === 200 && $c2['status'] === 'DRAFT' && $c2['user_id'] === $A['id'] && $c2['id'] === $cid && $c2['slug'] === 'parki-moskvy' && !isset($c2['published_at'])
    && $c2['description'] === 'Новое описание' && $c2['title'] === $before['title'] && $c2['items'] === $before['items'] && $c2['visibility'] === 'UNLISTED', kg_dbg($c2));

[$s, $j] = $put($cid, ['publish' => true]);
$c3 = $j['collection'] ?? [];
check('publish:true → PUBLISHED, published_at в ISO с Z',
    $s === 200 && $c3['status'] === 'PUBLISHED' && preg_match('/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/', $c3['published_at'] ?? '') === 1, kg_dbg($c3));
[$s, $j, $h] = api('GET', $col($cid));
check('UNLISTED + PUBLISHED открывается анониму: mine=false, public, max-age=60',
    $s === 200 && $j['mine'] === false && $j['collection']['id'] === $cid && $j['author']['username'] === 'kolya_a' && ($h['Cache-Control'] ?? '') === 'public, max-age=60', kg_dbg($h));
$bodies[] = json_encode($j);
[$s, $j] = api('GET', $col($cid), null, $tB);
check('UNLISTED + PUBLISHED открывается другому пользователю по id', $s === 200 && $j['mine'] === false);
[$s, $j, $h] = api('GET', $col($cid), null, $tA);
check('владелец своей опубликованной видит mine=true и no-store', $j['mine'] === true && ($h['Cache-Control'] ?? '') === 'no-store');

[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1']);
check('каталог не показывает UNLISTED', $s === 200 && !in_array($cid, array_column($j['collections'], 'id'), true) && array_key_exists('next', $j), kg_dbg($j));
[$s, $j] = api('GET', '/api/v1/authors/kolya_a');
check('страница автора не показывает UNLISTED', $s === 200 && $j['collections'] === [], kg_dbg($j));

// ── чужой PUT/DELETE
[$s, $j] = $put($cid, ['title' => 'Взлом'], $tB);
check('чужой PUT → 404 (существование не раскрывается)', $s === 404 && $j['error']['code'] === 'not_found');
[$s] = api('DELETE', $col($cid), null, $tB);
check('чужой DELETE → 404', $s === 404);
[$s] = $put('zzzzzzzzzz', ['title' => 'Нет такой']);
check('PUT несуществующей → 404 (так же, как чужой)', $s === 404);
[$s] = api('DELETE', $col('zzzzzzzzzz'), null, $tA);
check('DELETE несуществующей → 404', $s === 404);
[$s, $j] = api('GET', $col($cid), null, $tA);
check('после чужих попыток подборка цела', $s === 200 && $j['collection']['title'] === 'Парки  Москвы');

// ── публикация, правка опубликованной, возврат в черновик
[$s, $j] = $put($cid, ['visibility' => 'PUBLIC', 'title' => 'Парки Москвы (новое)']);
$c4 = $j['collection'];
check('PUBLIC: slug опубликованной не меняется при смене названия, published_at прежний',
    $s === 200 && $c4['slug'] === 'parki-moskvy' && $c4['title'] === 'Парки Москвы (новое)' && $c4['published_at'] === $c3['published_at'], kg_dbg($c4));
[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1']);
$mine = array_values(array_filter($j['collections'], fn ($x) => $x['id'] === $cid));
check('каталог показывает PUBLIC + PUBLISHED, у записи есть author',
    count($mine) === 1 && $mine[0]['author']['username'] === 'kolya_a' && $mine[0]['items'][0]['place_id'] === 'moskovsky-zoopark' && !isset($j['collections'][0]['author']['bio']), kg_dbg($j));
$bodies[] = json_encode($j);
foreach (['kolya_a', 'KOLYA_A', '@Kolya_A'] as $hh) {
    [$s, $j] = api('GET', '/api/v1/authors/' . $hh);
    check("authors/$hh → 200, подборка автора есть (регистр и @ не важны)",
        $s === 200 && $j['author']['username'] === 'kolya_a' && $j['author']['id'] === $A['id'] && count($j['collections']) === 1 && $j['collections'][0]['id'] === $cid, kg_dbg($j));
}
$bodies[] = json_encode($j);
[$s, $j] = api('GET', '/api/v1/authors/nobody_here');
check('authors/неизвестный → 404', $s === 404);
[$s] = api('GET', '/api/v1/authors/x');
check('authors/слишком короткий ник → 404', $s === 404);
[$s] = api('GET', '/api/v1/authors/' . rawurlencode('мама'));
check('authors/кириллица → 404', $s === 404);
api('PATCH', '/api/v1/me', ['bio' => 'Люблю парки'], $tA);
[$s, $j] = api('GET', '/api/v1/authors/kolya_a');
check('authors: bio появляется, когда заполнено', $j['author']['bio'] === 'Люблю парки' && array_keys($j['author']) === ['id', 'name', 'username', 'avatar', 'tint', 'bio'], kg_dbg($j['author']));

[$s, $j] = $put($cid, ['publish' => false]);
check('publish:false → снова DRAFT без published_at', $s === 200 && $j['collection']['status'] === 'DRAFT' && !array_key_exists('published_at', $j['collection']), kg_dbg($j));
[$s] = api('GET', $col($cid));
check('после возврата в черновик аноним получает 404', $s === 404);
[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1']);
check('и каталог её больше не показывает', !in_array($cid, array_column($j['collections'], 'id'), true));
[$s, $j] = $put($cid, ['title' => 'Парки для малышей']);
check('у черновика slug следует за названием', $s === 200 && $j['collection']['slug'] === 'parki-dlya-malyshey', kg_dbg($j['collection']));
[$s, $j] = $put($cid, ['publish' => true, 'title' => 'Парки для малышей и не только']);
check('в одном запросе: новое название и публикация — slug пересчитан (был черновиком)',
    $s === 200 && $j['collection']['slug'] === 'parki-dlya-malyshey-i-ne-tolko' && $j['collection']['status'] === 'PUBLISHED', kg_dbg($j['collection']));
[$s, $j] = $put($cid, ['items' => [['place_id' => 'park-gorkogo', 'creator_note' => 'Первым'], ['place_id' => 'moskovsky-zoopark']]]);
check('порядок мест меняется заменой items', $s === 200 && array_column($j['collection']['items'], 'place_id') === ['park-gorkogo', 'moskovsky-zoopark']
    && $j['collection']['items'][0]['creator_note'] === 'Первым' && !isset($j['collection']['items'][1]['creator_note']), kg_dbg($j['collection']['items']));

// ── пустую подборку не публикуем
[$s, $j] = $post(['title' => 'Пустая', 'items' => [], 'publish' => true]);
check('POST publish:true без мест → 422', $s === 422 && $j['error']['code'] === 'empty_publish', kg_dbg($j));
[$s, $j] = $post(['title' => 'Пустая']);
$emptyId = $j['collection']['id'] ?? '';
check('черновик без мест создаётся (items не обязателен)', $s === 201 && $j['collection']['items'] === [], kg_dbg($j));
[$s, $j] = $put($emptyId, ['publish' => true]);
check('PUT publish:true для пустого черновика → 422', $s === 422 && $j['error']['code'] === 'empty_publish');
[$s, $j] = $put($cid, ['items' => []]);
check('опубликованную подборку нельзя опустошить → 422', $s === 422 && $j['error']['code'] === 'empty_publish');
[$s, $j] = api('GET', $col($cid), null, $tA);
check('и она осталась с местами', count($j['collection']['items']) === 2);

// ── валидации
$longPlace = str_repeat('a', 81);
$cases = [
    ['нет названия', [], 'bad_title'],
    ['пустое название из пробелов', ['title' => " \n\t "], 'bad_title'],
    ['название не строка', ['title' => 5], 'bad_title'],
    ['название 101 символ', ['title' => str_repeat('я', 101)], 'bad_title'],
    ['описание 601 символ', ['title' => 'T', 'description' => str_repeat('я', 601)], 'bad_description'],
    ['описание не строка', ['title' => 'T', 'description' => ['x']], 'bad_description'],
    ['заметка 241 символ', ['title' => 'T', 'items' => [['place_id' => 'a', 'creator_note' => str_repeat('я', 241)]]], 'bad_note'],
    ['заметка не строка', ['title' => 'T', 'items' => [['place_id' => 'a', 'creator_note' => 5]]], 'bad_note'],
    ['place_id с заглавными и подчёркиванием', ['title' => 'T', 'items' => [['place_id' => 'Bad_ID']]], 'bad_place'],
    ['place_id начинается с дефиса', ['title' => 'T', 'items' => [['place_id' => '-start']]], 'bad_place'],
    ['place_id пустой', ['title' => 'T', 'items' => [['place_id' => '']]], 'bad_place'],
    ['place_id 81 символ', ['title' => 'T', 'items' => [['place_id' => $longPlace]]], 'bad_place'],
    ['place_id с переводом строки в конце', ['title' => 'T', 'items' => [['place_id' => "abc\n"]]], 'bad_place'],
    ['пункт без place_id', ['title' => 'T', 'items' => [['creator_note' => 'x']]], 'bad_place'],
    ['пункт-строка вместо объекта', ['title' => 'T', 'items' => ['moskovsky-zoopark']], 'bad_place'],
    ['items — объект', ['title' => 'T', 'items' => ['a' => ['place_id' => 'a']]], 'bad_items'],
    ['items — строка', ['title' => 'T', 'items' => 'abc'], 'bad_items'],
    ['31 место', ['title' => 'T', 'items' => array_map(fn ($i) => ['place_id' => "mesto-$i"], range(1, 31))], 'too_many_items'],
    ['возраст «от» отрицательный', ['title' => 'T', 'age_min' => -1], 'bad_age'],
    ['возраст «до» 19', ['title' => 'T', 'age_max' => 19], 'bad_age'],
    ['возраст «от» больше «до»', ['title' => 'T', 'age_min' => 10, 'age_max' => 5], 'bad_age'],
    ['возраст не число', ['title' => 'T', 'age_min' => 'abc'], 'bad_age'],
    ['возраст «от» 14 при «до» по умолчанию 12', ['title' => 'T', 'age_min' => 14], 'bad_age'],
    ['неизвестная видимость', ['title' => 'T', 'visibility' => 'SECRET'], 'bad_visibility'],
    ['обложка неизвестного вида', ['title' => 'T', 'cover' => ['kind' => 'video']], 'bad_cover'],
    ['обложка-место без slug', ['title' => 'T', 'cover' => ['kind' => 'place']], 'bad_cover'],
    ['обложка-место с кривым slug', ['title' => 'T', 'cover' => ['kind' => 'place', 'slug' => 'Bad Slug']], 'bad_cover'],
    ['обложка — строка', ['title' => 'T', 'cover' => 'collage'], 'bad_cover'],
    ['город длиннее 60', ['title' => 'T', 'city' => str_repeat('я', 61)], 'bad_city'],
    ['publish не булево', ['title' => 'T', 'items' => [['place_id' => 'a']], 'publish' => 'yes'], 'bad_publish'],
];
foreach ($cases as [$what, $body, $code]) {
    [$s, $j] = $post($body);
    check("валидация: $what → 422 $code", $s === 422 && ($j['error']['code'] ?? '') === $code && ($j['error']['message'] ?? '') !== '', kg_dbg($j));
}
check('ни одна из неудачных попыток подборку не создала', (int) $pdo->query("SELECT COUNT(*) FROM collections WHERE user_id='{$A['id']}'")->fetchColumn() === 2);
[$s, $j] = $put($cid, ['age_min' => 15]);
check('PUT: возраст проверяется вместе с текущим age_max (15 > 12)', $s === 422 && $j['error']['code'] === 'bad_age', kg_dbg($j));
[$s, $j] = $put($cid, ['age_min' => 15, 'age_max' => 18]);
check('PUT: age_min и age_max вместе — ок', $s === 200 && $j['collection']['age_min'] === 15 && $j['collection']['age_max'] === 18);
[$s, $j] = api('PUT', $col($cid), null, $tA);
check('PUT без тела — ничего не меняет, но не падает', $s === 200 && $j['collection']['title'] === 'Парки для малышей и не только', kg_dbg($j));

[$s, $j] = $post(['title' => 'Ровно тридцать', 'items' => array_map(fn ($i) => ['place_id' => "mesto-$i"], range(1, 30)), 'city' => ' Казань ', 'age_min' => 3, 'age_max' => 3, 'visibility' => 'public']);
check('ровно 30 мест, город, возраст от=до и видимость в нижнем регистре принимаются',
    $s === 201 && count($j['collection']['items']) === 30 && $j['collection']['items'][29]['position'] === 29 && $j['collection']['city'] === 'Казань'
    && $j['collection']['age_min'] === 3 && $j['collection']['visibility'] === 'PUBLIC', kg_dbg($j));
[$s, $j] = $post(['title' => 'Дубли', 'items' => array_merge(array_map(fn ($i) => ['place_id' => "mesto-$i"], range(1, 30)), [['place_id' => 'mesto-1'], ['place_id' => 'mesto-2']])]);
check('31 пункт, из которых 2 повтора, — это 30 мест, не ошибка', $s === 201 && count($j['collection']['items']) === 30, kg_dbg($j['error'] ?? null));

// ── обложка и список мест из api/data/places.json
$tmpPlaces = sys_get_temp_dir() . '/kg-places-' . bin2hex(random_bytes(4)) . '.json';
file_put_contents($tmpPlaces, json_encode(['moskovsky-zoopark', 'park-gorkogo']));
Places::useFile($tmpPlaces);
[$s, $j] = $post(['title' => 'Со списком мест', 'cover' => ['kind' => 'place', 'slug' => 'park-gorkogo'],
    'items' => [['place_id' => 'moskovsky-zoopark'], ['place_id' => 'net-takogo-mesta'], ['place_id' => 'park-gorkogo']]]);
check('есть places.json: места не из списка отбрасываются, обложка-место сохраняется',
    $s === 201 && array_column($j['collection']['items'], 'place_id') === ['moskovsky-zoopark', 'park-gorkogo'] && $j['collection']['cover'] === ['kind' => 'place', 'slug' => 'park-gorkogo'], kg_dbg($j));
$coverId = $j['collection']['id'] ?? '';
[$s, $j] = $put($coverId, ['cover' => ['kind' => 'place', 'slug' => 'net-takogo-mesta']]);
check('обложка с неизвестным местом превращается в коллаж', $s === 200 && $j['collection']['cover'] === ['kind' => 'collage'], kg_dbg($j));
[$s, $j] = $put($coverId, ['cover' => ['kind' => 'place', 'slug' => 'moskovsky-zoopark']]);
check('PUT cover → place', $j['collection']['cover'] === ['kind' => 'place', 'slug' => 'moskovsky-zoopark']);
[$s, $j] = $put($coverId, ['cover' => null]);
check('cover:null → коллаж', $j['collection']['cover'] === ['kind' => 'collage']);
[$s, $j] = $post(['title' => 'Только неизвестные', 'items' => [['place_id' => 'net-takogo-mesta']], 'publish' => true]);
check('если после отбора мест не осталось — публиковать нечего (422)', $s === 422 && $j['error']['code'] === 'empty_publish', kg_dbg($j));
Places::useFile(null);
@unlink($tmpPlaces);
[$s, $j] = $post(['title' => 'Без списка мест', 'items' => [['place_id' => 'net-takogo-mesta']]]);
check('нет places.json: проверяется только формат, любое место допустимо', $s === 201 && $j['collection']['items'][0]['place_id'] === 'net-takogo-mesta', kg_dbg($j));

// ── адреса (slug)
kg_reset_create_limit($pdo);
$slugOf = static function (string $title, ?string $tok = null) use ($post): string {
    [$s, $j] = $post(['title' => $title], $tok);
    return $s === 201 ? $j['collection']['slug'] : "ERR $s " . kg_dbg($j);
};
$T = 'Парки для малышей и не только'; // у кабинета A такой адрес уже занят подборкой $cid
check('slug: адрес «parki-dlya-malyshey-i-ne-tolko» уже занят — такая же подборка получает -2', $slugOf($T) === 'parki-dlya-malyshey-i-ne-tolko-2');
check('slug: третья — -3', $slugOf($T) === 'parki-dlya-malyshey-i-ne-tolko-3');
check('slug: у другого пользователя тот же адрес свободен', $slugOf($T, $tB) === 'parki-dlya-malyshey-i-ne-tolko');
check('slug: транслитерация русских букв (щ, ё, ъ, ь)', $slugOf('Щука и Ёж, ъь Съезд') === 'shchuka-i-ezh-sezd');
check('slug: латиница в нижнем регистре, знаки → дефисы', $slugOf('Fun Day #1!') === 'fun-day-1');
check('slug: если после очистки пусто — podborka', $slugOf('!!! ???') === 'podborka');
check('slug: вторая такая же — podborka-2', $slugOf('😀😀') === 'podborka-2');
$long = $slugOf(str_repeat('щ', 100));
$long2 = $slugOf(str_repeat('щ', 100));
check('slug: длинное название режется, коллизия даёт суффикс и укладывается в 120', strlen($long) <= 100 && strlen($long2) <= 120 && str_ends_with($long2, '-2') && $long !== $long2, "$long | $long2");
[$s, $j] = api('GET', '/api/v1/collections', null, $tA, '198.51.100.1', ['mine' => '1']);
$slugs = array_column($j['collections'], 'slug');
check('slug: в пределах кабинета все адреса разные', count($slugs) === count(array_unique($slugs)), implode(',', $slugs));
$third = array_values(array_filter($j['collections'], fn ($x) => $x['slug'] === 'parki-dlya-malyshey-i-ne-tolko-3'))[0]['id'] ?? '';
api('DELETE', $col($third), null, $tA);
check('slug: освободившийся -3 снова доступен', $slugOf($T) === 'parki-dlya-malyshey-i-ne-tolko-3');

// ── «мои подборки»
$ids = $pdo->query("SELECT id FROM collections WHERE user_id='{$A['id']}' ORDER BY id")->fetchAll(PDO::FETCH_COLUMN);
$pdo->prepare('UPDATE collections SET updated_at = ? WHERE id = ?')->execute(['2026-03-01 10:00:00', $ids[0]]);
$pdo->prepare('UPDATE collections SET updated_at = ? WHERE id = ?')->execute(['2026-03-03 10:00:00', $ids[1]]);
$pdo->prepare('UPDATE collections SET updated_at = ? WHERE id = ?')->execute(['2026-03-02 10:00:00', $ids[2]]);
$res = kg_raw('GET', '/api/v1/collections', $tA, null, ['mine' => '1']);
$j = json_decode($res->body, true);
$order = array_values(array_intersect(array_column($j['collections'], 'id'), [$ids[0], $ids[1], $ids[2]]));
check('mine=1: все мои подборки (любой вид), свежие по updated_at сверху',
    $res->status === 200 && count($j['collections']) === count($ids) && $order === [$ids[1], $ids[2], $ids[0]], kg_dbg($order));
check('mine=1: у каждой записи есть author с моим id', count(array_filter($j['collections'], fn ($x) => ($x['author']['id'] ?? '') === $A['id'])) === count($ids));
$bodies[] = $res->body;
$res = kg_raw('GET', '/api/v1/collections', $tB, null, ['mine' => '1']);
check('mine=1 у другого пользователя — только его', count(json_decode($res->body, true)['collections']) === (int) $pdo->query("SELECT COUNT(*) FROM collections WHERE user_id='{$B['id']}'")->fetchColumn());

// ── удаление
[$s] = api('DELETE', $col($emptyId), null, $tA);
check('DELETE владельцем → 204', $s === 204);
[$s] = api('GET', $col($emptyId), null, $tA);
check('после удаления GET → 404', $s === 404);
[$s] = api('DELETE', $col($emptyId), null, $tA);
check('повторный DELETE → 404', $s === 404);

// ── скрытие модерацией
$hid = $cid;
$pdo->prepare("UPDATE collections SET status='HIDDEN', visibility='PUBLIC' WHERE id = ?")->execute([$hid]);
[$s, $j] = $put($hid, ['publish' => true]);
check('HIDDEN: владелец не может опубликовать → 403', $s === 403 && $j['error']['code'] === 'forbidden' && str_contains($j['error']['message'], 'модерац'), kg_dbg($j));
[$s, $j] = $put($hid, ['title' => 'Правка скрытой']);
check('HIDDEN: обычная правка проходит, статус остаётся HIDDEN', $s === 200 && $j['collection']['status'] === 'HIDDEN' && $j['collection']['title'] === 'Правка скрытой', kg_dbg($j));
[$s, $j] = $put($hid, ['publish' => false]);
check('HIDDEN: publish:false ничего не меняет', $s === 200 && $j['collection']['status'] === 'HIDDEN');
[$s] = api('GET', $col($hid), null, $tB);
check('HIDDEN: другим пользователям → 404', $s === 404);
[$s] = api('GET', $col($hid));
check('HIDDEN: анониму → 404', $s === 404);
[$s, $j] = api('GET', $col($hid), null, $tA);
check('HIDDEN: владелец её видит', $s === 200 && $j['collection']['status'] === 'HIDDEN' && $j['mine'] === true);
[$s, $j] = api('GET', '/api/v1/authors/kolya_a');
check('HIDDEN: нет ни на странице автора, ни в каталоге', !in_array($hid, array_column($j['collections'], 'id'), true));
$pdo->prepare("UPDATE collections SET status='DRAFT', visibility='PRIVATE' WHERE id = ?")->execute([$hid]);

// ── лимит 50 подборок
$L = kg_user('limit_one', '192.0.2.31');
$ins = $pdo->prepare('INSERT INTO collections (id, user_id, title, slug, created_at, updated_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())');
for ($i = 0; $i < 50; $i++) $ins->execute([sprintf('lim%07d', $i), $L['id'], "Т$i", "t$i"]);
[$s, $j] = $post(['title' => 'Пятьдесят первая'], $L['token']);
check('лимит: 51-я подборка → 409 limit_reached с понятным сообщением', $s === 409 && $j['error']['code'] === 'limit_reached' && str_contains($j['error']['message'], '50'), kg_dbg($j));
[$s, $j] = api('GET', '/api/v1/collections', null, $L['token'], '198.51.100.1', ['mine' => '1']);
check('лимит: прямые вставки без items читаются (items NULL → пустой список)', $s === 200 && count($j['collections']) === 50 && $j['collections'][0]['items'] === [] && $j['collections'][0]['cover'] === ['kind' => 'collage'], kg_dbg($j['collections'][0] ?? null));
[$s] = api('DELETE', $col('lim0000000'), null, $L['token']);
[$s2, $j] = $post(['title' => 'Пятьдесят первая'], $L['token']);
check('лимит: после удаления одной создать можно', $s === 204 && $s2 === 201, kg_dbg($j));

// ── лимит 10 созданий в сутки
if (time() % 86400 > 86400 - 30) sleep(31);
$R = kg_user('rate_one', '192.0.2.32');
[$s] = $post(['title' => ''], $R['token']);
$okCount = 0;
for ($i = 1; $i <= 10; $i++) { [$s] = $post(['title' => "Подборка $i"], $R['token']); if ($s === 201) $okCount++; }
check('лимит: неудачные попытки не считаются, 10 созданий проходят', $okCount === 10);
[$s, $j, $h] = $post(['title' => 'Одиннадцатая'], $R['token']);
check('лимит: 11-я за сутки → 429 с Retry-After и понятным текстом', $s === 429 && ctype_digit($h['Retry-After'] ?? '') && str_contains($j['error']['message'], '10'), kg_dbg($j));
[$s] = $put((string) $pdo->query("SELECT id FROM collections WHERE user_id='{$R['id']}' LIMIT 1")->fetchColumn(), ['description' => 'Правка'], $R['token']);
check('лимит создания не мешает правкам', $s === 200);
kg_reset_create_limit($pdo);

// ── каталог: порядок, курсор, ничьи по времени, лимиты, скрытые авторы
$P1 = kg_user('pager_one', '192.0.2.41');
$P2 = kg_user('pager_two', '192.0.2.42');
$pub = [];
foreach ([[$P1, 4], [$P2, 3]] as [$u, $n]) {
    for ($i = 1; $i <= $n; $i++) {
        [$s, $j] = $post(['title' => "Каталог $i", 'items' => [['place_id' => 'moskovsky-zoopark']], 'visibility' => 'PUBLIC', 'publish' => true], $u['token']);
        $pub[] = $j['collection']['id'];
    }
}
[$s, $j] = $post(['title' => 'Личная', 'items' => [['place_id' => 'moskovsky-zoopark']], 'visibility' => 'PRIVATE', 'publish' => true], $P1['token']);
$privatePublished = $j['collection']['id'];
[$s, $j] = $post(['title' => 'Черновик публичный', 'items' => [['place_id' => 'moskovsky-zoopark']], 'visibility' => 'PUBLIC'], $P1['token']);
$publicDraft = $j['collection']['id'];
check('PRIVATE + PUBLISHED допустимо (видна только владельцу)', $privatePublished !== '' && api('GET', $col($privatePublished))[0] === 404 && api('GET', $col($privatePublished), null, $P1['token'])[0] === 200);
// детерминированные времена: две подборки с одним и тем же временем проверяют порядок по id
foreach ($pub as $i => $id) {
    $t = $i < 2 ? '2026-02-01 12:00:00' : sprintf('2026-02-01 12:00:%02d', $i);
    $pdo->prepare('UPDATE collections SET published_at = ? WHERE id = ?')->execute([$t, $id]);
}
$expected = $pdo->query("SELECT id FROM collections WHERE visibility='PUBLIC' AND status='PUBLISHED' ORDER BY published_at DESC, id DESC")->fetchAll(PDO::FETCH_COLUMN);
$walk = static function (int|string $limit) use ($pdo): array {
    $ids = []; $cursor = ''; $pages = 0; $maxPage = 0;
    do {
        [$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1', 'limit' => (string) $limit, 'cursor' => $cursor]);
        if ($s !== 200) return [[], $pages, 0, kg_dbg($j)];
        $maxPage = max($maxPage, count($j['collections']));
        foreach ($j['collections'] as $c) $ids[] = $c['id'];
        $cursor = (string) ($j['next'] ?? '');
        $pages++;
    } while ($cursor !== '' && $pages < 60);
    return [$ids, $pages, $maxPage, ''];
};
[$got, $pages, $maxPage, $err] = $walk(2);
check('каталог: страницами по 2 — все PUBLIC+PUBLISHED, без повторов, в порядке published_at↓ и id↓ (включая ничью по времени)',
    $got === $expected && $maxPage === 2 && $pages === (int) ceil(count($expected) / 2), "$err " . count($got) . '/' . count($expected));
check('каталог: приватные, черновики и UNLISTED не попали', !array_intersect($got, [$privatePublished, $publicDraft, $hid]) && count($expected) >= 7);
[$got, $pages] = $walk(50);
check('каталог: limit=50 — одна страница', $got === $expected && $pages === 1);
[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1', 'limit' => '0']);
check('каталог: limit=0 → поднимается до 1', $s === 200 && count($j['collections']) === 1 && $j['next'] !== null);
[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1', 'limit' => '999']);
check('каталог: limit=999 → не больше 50', $s === 200 && count($j['collections']) <= 50);
[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1', 'limit' => 'abc']);
check('каталог: limit=abc → по умолчанию', $s === 200 && count($j['collections']) === min(24, count($expected)));
$last = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1', 'limit' => '50'])[1];
check('каталог: на последней странице next = null', array_key_exists('next', $last) && $last['next'] === null);
[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1', 'limit' => '1']);
check('каталог: курсор — непрозрачная строка из base64url', is_string($j['next']) && preg_match('/^[A-Za-z0-9_-]+$/', $j['next']) === 1
    && str_contains((string) base64_decode(strtr($j['next'], '-_', '+/')), '|'), kg_dbg($j['next']));
foreach (['!!!', rtrim(base64_encode('что-то'), '='), rtrim(base64_encode("2026-02-01 12:00:00|BAD"), '=')] as $bad) {
    [$s, $j] = api('GET', '/api/v1/collections', null, null, '198.51.100.1', ['public' => '1', 'cursor' => $bad]);
    check('каталог: битый курсор → 400 bad_cursor', $s === 400 && $j['error']['code'] === 'bad_cursor', kg_dbg($j));
}
$pdo->prepare("UPDATE users SET status='SUSPENDED' WHERE id = ?")->execute([$P2['id']]);
[$got] = $walk(50);
check('каталог: подборки заблокированного автора пропадают', !array_intersect($got, $pdo->query("SELECT id FROM collections WHERE user_id='{$P2['id']}'")->fetchAll(PDO::FETCH_COLUMN)) && count($got) === count($expected) - 3);
[$s] = api('GET', '/api/v1/authors/pager_two');
check('заблокированный автор → 404 на его странице', $s === 404);
[$s] = api('GET', $col($pub[count($pub) - 1]));
check('подборка заблокированного автора по id → 404', $s === 404);
$pdo->prepare("UPDATE users SET status='ACTIVE' WHERE id = ?")->execute([$P2['id']]);
[$s, $j] = api('GET', '/api/v1/authors/pager_one');
check('страница автора: только его PUBLIC+PUBLISHED, свежие сверху, у каждой есть author',
    $s === 200 && count($j['collections']) === 4 && !in_array($privatePublished, array_column($j['collections'], 'id'), true) && !in_array($publicDraft, array_column($j['collections'], 'id'), true)
    && count(array_filter($j['collections'], fn ($x) => $x['author']['username'] === 'pager_one')) === 4, kg_dbg(array_column($j['collections'] ?? [], 'id')));

// ── ответы не раскрывают служебное
$leaks = array_filter($bodies, $leak);
check('в ответах нет password_hash, token_hash, session_hash и прочих служебных полей', $leaks === [], count($bodies) . ' ответов проверено');

// ── удаление кабинета убирает подборки и документы
$X = kg_user('delete_me_x', '192.0.2.51');
$putDoc($X['token'], 'intents', 0, '{"a":1}');
$putDoc($X['token'], 'prefs', 0, '{"b":2}');
$post(['title' => 'Для удаления', 'items' => [['place_id' => 'moskovsky-zoopark']], 'publish' => true, 'visibility' => 'PUBLIC'], $X['token']);
$post(['title' => 'Для удаления 2'], $X['token']);
$cnt = static fn (string $t) => (int) $pdo->query("SELECT COUNT(*) FROM $t WHERE user_id='{$X['id']}'")->fetchColumn();
check('перед удалением у кабинета есть 2 документа и 2 подборки', $cnt('user_docs') === 2 && $cnt('collections') === 2);
[$s] = api('DELETE', '/api/v1/me', ['password' => 'Zontik-2026'], $X['token']);
check('удаление кабинета → 204', $s === 204);
check('вместе с кабинетом исчезли подборки и документы (каскад)', $cnt('user_docs') === 0 && $cnt('collections') === 0);
[$s] = api('GET', '/api/v1/authors/delete_me_x');
check('и страница автора больше не открывается', $s === 404);
