<?php
declare(strict_types=1);

// Жалобы и модерация. Подключается из run.php после share.php: берёт оттуда kg_user(), kg_dbg() и api().
use Kg\Config;
use Kg\Db;
use Kg\Moderation;

$pdo = Db::pdo();
echo "\nЖалобы и модерация\n";

$adminToken = 'moderator-token-' . bin2hex(random_bytes(8));
putenv('KG_ADMIN_TOKEN_SHA256=' . hash('sha256', $adminToken));
Config::load('/nonexistent-config.php'); // перечитать настройки: служебный токен теперь известен тестам

/** Запрос к служебным адресам /admin/… с токеном модератора (или с чужим). */
$adm = static fn (string $method, string $path, ?array $body = null, ?string $token = null, string $ip = '198.18.9.1'): array
    => api($method, "/api/v1/admin$path", $body, $token ?? $adminToken, $ip);
/** Жалоба на подборку: возвращает [статус, тело]. */
$rep = static function (string $id, array $body, ?string $token = null, string $ip = '198.18.0.1'): array {
    [$s, $j] = api('POST', "/api/v1/collections/$id/report", $body, $token, $ip);
    return [$s, $j];
};
/** Строка подборки из базы. */
$col = static function (string $id) use ($pdo): array {
    $st = $pdo->prepare('SELECT status, hidden_by, hidden_at, reviewed_at FROM collections WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: [];
};
$openReports = static function (string $id) use ($pdo): int {
    $st = $pdo->prepare("SELECT COUNT(*) FROM reports WHERE target_type = 'collection' AND target_id = ? AND status = 'NEW'");
    $st->execute([$id]);
    return (int) $st->fetchColumn();
};
$G = static fn (int $n): string => "198.18.0.$n"; // «посторонние» устройства: у каждого свой адрес

$O = kg_user('mod_owner', '192.0.2.71');
$R1 = kg_user('mod_rep1', '192.0.2.72');
$mk = static function (string $title, string $vis, bool $publish) use ($O): string {
    [$s, $j] = api('POST', '/api/v1/collections', [
        'title' => $title, 'visibility' => $vis, 'publish' => $publish,
        'items' => [['place_id' => 'moskovsky-zoopark', 'creator_note' => "Заметка: $title"]],
    ], $O['token'], '192.0.2.71');
    if ($s !== 201) throw new RuntimeException('Не создалась подборка: ' . kg_dbg($j));
    return $j['collection']['id'];
};
$pub = $mk('Публичная для жалоб', 'PUBLIC', true);
$unl = $mk('По ссылке для жалоб', 'UNLISTED', true);
$prv = $mk('Приватная для жалоб', 'PRIVATE', true);
$drf = $mk('Черновик для жалоб', 'PUBLIC', false);

// ── служебный вход
[$s] = $adm('GET', '/reports', null, 'ne-tot-token-ne-tot-token');
check('очередь жалоб: чужой токен → 403', $s === 403);
[$s] = api('GET', '/api/v1/admin/reports', null, null, '198.18.9.1');
check('очередь жалоб: без токена → 403', $s === 403);
[$s] = $adm('GET', '/reports', null, $R1['token']);
check('токен пользователя не открывает служебные адреса', $s === 403);
[$s, $j] = $adm('GET', '/reports');
check('очередь жалоб: пока пустая', $s === 200 && $j['status'] === 'NEW' && $j['items'] === [], kg_dbg($j));
[$s] = $adm('GET', '/reports', null, null, '198.18.9.1');
check('очередь жалоб: статус по умолчанию NEW', $s === 200);
[$s, $j] = api('GET', '/api/v1/admin/reports', null, $adminToken, '198.18.9.1', ['status' => 'BAD']);
check('очередь жалоб: неверный статус → 400', $s === 400 && $j['error']['code'] === 'bad_query');

// ── приём жалобы: проверки
[$s, $j] = $rep($pub, ['reason' => 'nonsense']);
check('жалоба: неизвестная причина → 422 bad_reason', $s === 422 && $j['error']['code'] === 'bad_reason', kg_dbg($j));
[$s, $j] = $rep($pub, []);
check('жалоба: без причины → 422', $s === 422 && $j['error']['code'] === 'bad_reason');
[$s, $j] = $rep($pub, ['reason' => 'spam', 'note' => str_repeat('я', 301)]);
check('жалоба: комментарий длиннее 300 → 422 bad_note', $s === 422 && $j['error']['code'] === 'bad_note', kg_dbg($j));
[$s, $j] = $rep($pub, ['reason' => 'spam', 'note' => ['x']]);
check('жалоба: комментарий не строкой → 422', $s === 422);
[$s] = $rep('zzzzzzzzzz', ['reason' => 'spam']);
check('жалоба на несуществующую подборку → 404', $s === 404);
[$s] = $rep('../../etc', ['reason' => 'spam']);
check('жалоба с кривым id → 404', $s === 404);
[$s] = $rep($prv, ['reason' => 'spam']);
check('жалоба на приватную подборку → 404 (её не видно)', $s === 404);
[$s] = $rep($drf, ['reason' => 'spam']);
check('жалоба на черновик → 404', $s === 404);
[$s, $j] = $rep($pub, ['reason' => 'spam'], $O['token'], '192.0.2.71');
check('жалоба на свою подборку → 403', $s === 403 && $j['error']['code'] === 'forbidden', kg_dbg($j));
check('отклонённые жалобы ничего не записали', (int) $pdo->query('SELECT COUNT(*) FROM reports')->fetchColumn() === 0);

// ── приём жалобы и автоскрытие после 3 разных людей
[$s, $j] = $rep($pub, ['reason' => 'spam', 'note' => '  Реклама  в описании  '], null, $G(1));
check('жалоба от гостя → 200 {"ok":true}', $s === 200 && $j === ['ok' => true], kg_dbg($j));
$row = $pdo->query("SELECT * FROM reports WHERE target_id = '$pub'")->fetch();
check('жалоба записана: статус NEW, причина и комментарий без пробелов по краям', $row['status'] === 'NEW' && $row['reason'] === 'spam'
    && $row['note'] === 'Реклама  в описании', kg_dbg($row));
check('в жалобе нет IP и данных кабинета: только короткий хэш', preg_match('/^[0-9a-f]{16}$/', (string) $row['reporter_hash']) === 1
    && !str_contains(json_encode($row), '198.18.') && !str_contains(json_encode($row), $R1['id']));
[$s] = $rep($pub, ['reason' => 'other'], null, $G(1));
check('повторная жалоба с того же устройства → 200, но не засчитывается', $s === 200 && $openReports($pub) === 1);
[$s] = $rep($pub, ['reason' => 'inappropriate', 'note' => 'Неприличные слова'], null, $G(2));
check('вторая жалоба от другого устройства → 200, подборка пока видна', $s === 200 && $openReports($pub) === 2 && $col($pub)['status'] === 'PUBLISHED');
[$s, $j] = api('GET', "/api/v1/collections/$pub", null, null, '198.18.0.50');
check('до третьей жалобы подборку по-прежнему открывают', $s === 200);
[$s] = $rep($pub, ['reason' => 'children'], $R1['token'], $G(3));
$c = $col($pub);
check('третья жалоба (от вошедшего пользователя) → подборка скрыта автоматически', $s === 200 && $c['status'] === 'HIDDEN' && $c['hidden_by'] === 'AUTO' && $c['hidden_at'] !== null && $c['reviewed_at'] === null, kg_dbg($c));
check('автоскрытие записано в журнал', (int) $pdo->query("SELECT COUNT(*) FROM admin_actions WHERE action = 'auto_hide' AND target_id = '$pub'")->fetchColumn() === 1);
[$s, $j] = api('GET', "/api/v1/collections/$pub", null, null, '198.18.0.50');
check('скрытая подборка для посторонних → 404', $s === 404);
[$s, $j] = api('GET', "/api/v1/collections/$pub", null, $O['token'], '192.0.2.71');
check('автор видит свою скрытую подборку со статусом HIDDEN', $s === 200 && $j['collection']['status'] === 'HIDDEN' && $j['mine'] === true, kg_dbg($j));
[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.18.0.50', ['public' => '1', 'limit' => '50']);
check('скрытой подборки нет в каталоге', $s === 200 && !in_array($pub, array_column($j['collections'], 'id'), true));
[$s] = $rep($pub, ['reason' => 'spam'], $R1['token'], $G(4));
check('на скрытую подборку жаловаться уже нельзя → 404', $s === 404);
[$s, $j] = api('PUT', "/api/v1/collections/$pub", ['publish' => true], $O['token'], '192.0.2.71');
check('автор не может сам вернуть скрытую подборку → 403', $s === 403, kg_dbg($j));

// один человек = одна жалоба, даже если у него несколько устройств
[$s] = $rep($unl, ['reason' => 'spam'], $R1['token'], $G(3));
[$s2] = $rep($unl, ['reason' => 'other'], $R1['token'], $G(4));
check('вошедший пользователь с двух адресов — одна жалоба', $s === 200 && $s2 === 200 && $openReports($unl) === 1);
[$s] = $rep($unl, ['reason' => 'spam'], null, $G(1));
check('подборка «по ссылке» принимает жалобы; 2 из 3 — ещё видна', $s === 200 && $openReports($unl) === 2 && $col($unl)['status'] === 'PUBLISHED');
check('хэш зависит от человека, а не от адреса вошедшего',
    Moderation::reporterHash(['id' => 'u1'], '1.1.1.1') === Moderation::reporterHash(['id' => 'u1'], '2.2.2.2')
    && Moderation::reporterHash(null, '1.1.1.1') !== Moderation::reporterHash(null, '2.2.2.2')
    && Moderation::reporterHash(['id' => 'u1'], '1.1.1.1') !== Moderation::reporterHash(null, '1.1.1.1'));

// ── очередь и карточка для модератора
[$s, $j] = $adm('GET', '/reports');
$item = null;
foreach ($j['items'] ?? [] as $it) if ($it['collection']['id'] === $pub) $item = $it;
check('очередь: скрытая подборка с тремя жалобами', $s === 200 && $item !== null && $item['reports']['count'] === 3 && $item['collection']['status'] === 'HIDDEN'
    && $item['collection']['hidden_by'] === 'AUTO' && $item['collection']['reviewed'] === false, kg_dbg($j));
check('очередь: причины по числу, комментарии, автор и адрес',
    $item !== null && $item['reports']['reasons'] == ['spam' => 1, 'inappropriate' => 1, 'children' => 1]
    && count($item['reports']['notes']) === 2 && $item['author']['handle'] === 'mod_owner' && $item['author']['status'] === 'ACTIVE'
    && $item['collection']['path'] === "/c/$pub/" && $item['collection']['items'][0]['place_id'] === 'moskovsky-zoopark'
    && str_contains($item['collection']['items'][0]['note'], 'Публичная для жалоб'), kg_dbg($item));
check('очередь: подборка с двумя жалобами тоже видна модератору', count($j['items']) === 2);
[$s, $j] = $adm('GET', "/collections/$prv");
check('карточка приватной подборки открывается модератору', $s === 200 && $j['collection']['visibility'] === 'PRIVATE' && $j['reports']['count'] === 0);
[$s] = $adm('GET', '/collections/zzzzzzzzzz');
check('карточка несуществующей подборки → 404', $s === 404);

// ── действия модератора над подборкой
[$s, $j] = $adm('POST', "/collections/$drf/hide", ['note' => 'тест']);
check('скрыть черновик нельзя → 409 not_published', $s === 409 && $j['error']['code'] === 'not_published', kg_dbg($j));
[$s] = $adm('POST', '/collections/zzzzzzzzzz/hide', []);
check('скрыть несуществующую → 404', $s === 404);
[$s, $j] = $adm('POST', "/collections/$unl/restore", []);
check('вернуть нескрытую подборку → 409 not_hidden', $s === 409 && $j['error']['code'] === 'not_hidden');
[$s, $j] = $adm('POST', "/collections/$unl/hide", ['note' => str_repeat('я', 301)]);
check('заметка длиннее 300 → 422', $s === 422 && $j['error']['code'] === 'bad_note');
[$s] = $adm('POST', "/collections/$pub/restore", ['note' => 'всё в порядке'], 'ne-tot-token-ne-tot-token');
check('действия модератора без верного токена → 403', $s === 403 && $col($pub)['status'] === 'HIDDEN');

[$s, $j] = $adm('POST', "/collections/$pub/restore", ['note' => 'всё в порядке']);
$c = $col($pub);
check('вернуть подборку → PUBLISHED, пометка «проверена», жалобы закрыты',
    $s === 200 && $c['status'] === 'PUBLISHED' && $c['hidden_by'] === null && $c['hidden_at'] === null && $c['reviewed_at'] !== null
    && $openReports($pub) === 0 && $j['collection']['reviewed'] === true && $j['reports']['count'] === 0, kg_dbg($j));
[$s] = api('GET', "/api/v1/collections/$pub", null, null, '198.18.0.50');
check('после возврата подборка снова открывается', $s === 200);
[$s, $j] = $adm('GET', '/reports');
check('очередь: возвращённой подборки больше нет, вторая осталась', !in_array($pub, array_map(static fn ($i) => $i['collection']['id'], $j['items']), true) && count($j['items']) === 1);
[$s, $j] = api('GET', '/api/v1/admin/reports', null, $adminToken, '198.18.9.1', ['status' => 'DONE']);
check('история: разобранные жалобы (3) на возвращённую подборку', $s === 200 && count($j['items']) === 1 && $j['items'][0]['reports']['count'] === 3 && $j['items'][0]['collection']['id'] === $pub, kg_dbg($j));
$act = $pdo->query("SELECT note FROM admin_actions WHERE action = 'restore' AND target_id = '$pub'")->fetchColumn();
check('возврат записан в журнал с заметкой модератора', $act === 'всё в порядке');

// после проверки модератором автоскрытие по жалобам для подборки не включается
foreach ([5, 6, 7] as $n) $rep($pub, ['reason' => 'spam'], null, $G($n));
check('проверенная подборка не скрывается автоматически от новых жалоб', $openReports($pub) === 3 && $col($pub)['status'] === 'PUBLISHED');
[$s, $j] = $adm('POST', "/collections/$pub/hide", ['note' => 'скрываю вручную']);
$c = $col($pub);
check('модератор может скрыть вручную → HIDDEN, hidden_by ADMIN', $s === 200 && $c['status'] === 'HIDDEN' && $c['hidden_by'] === 'ADMIN' && $j['collection']['status'] === 'HIDDEN', kg_dbg($j));
[$s] = $adm('POST', "/collections/$pub/hide", []);
check('повторное скрытие — без ошибки', $s === 200);
[$s] = api('GET', "/api/v1/collections/$pub", null, null, '198.18.0.50');
check('скрытая вручную — 404 для посторонних', $s === 404);
[$s] = $adm('POST', "/collections/$pub/restore", []);
check('и снова возвращается', $s === 200 && $col($pub)['status'] === 'PUBLISHED' && $openReports($pub) === 0);

// отклонить жалобы
[$s, $j] = $adm('POST', "/collections/$unl/dismiss", ['note' => 'жалобы необоснованны']);
$c = $col($unl);
check('отклонить жалобы: закрыты, подборка видна, проверена', $s === 200 && $c['status'] === 'PUBLISHED' && $c['reviewed_at'] !== null && $openReports($unl) === 0 && $j['reports']['count'] === 0, kg_dbg($j));
foreach ([2, 5, 6] as $n) $rep($unl, ['reason' => 'spam'], null, $G($n));
check('после «отклонить» новые жалобы подборку не скрывают', $openReports($unl) === 3 && $col($unl)['status'] === 'PUBLISHED');
[$s] = $adm('POST', '/collections/zzzzzzzzzz/dismiss', []);
check('отклонить жалобы на несуществующую → 404', $s === 404);

// ── блокировка автора
[$s, $j] = $adm('GET', '/authors/@Mod_Owner');
check('автор в админке: ник без учёта регистра, его подборки с числом открытых жалоб',
    $s === 200 && $j['author']['handle'] === 'mod_owner' && $j['author']['status'] === 'ACTIVE' && count($j['collections']) === 4
    && array_sum(array_column($j['collections'], 'open_reports')) === 3, kg_dbg($j));
[$s] = $adm('GET', '/authors/nobody_here');
check('несуществующий автор → 404', $s === 404);
[$s, $j] = $adm('POST', '/authors/mod_owner/suspend', ['note' => 'нарушения']);
check('заблокировать автора → SUSPENDED', $s === 200 && $j['author']['status'] === 'SUSPENDED', kg_dbg($j));
[$s] = api('GET', '/api/v1/me', null, $O['token'], '192.0.2.71');
check('у заблокированного слетает вход на всех устройствах', $s === 401);
[$s, $j] = api('POST', '/api/v1/sessions', ['handle' => 'mod_owner', 'password' => 'Zontik-2026'], null, '192.0.2.71');
check('заблокированный не может войти заново', $s === 401 && $j['error']['code'] === 'bad_credentials');
[$s] = api('GET', "/api/v1/collections/$pub", null, null, '198.18.0.50');
check('подборки заблокированного автора не видны', $s === 404);
[$s, $j] = api('GET', '/api/v1/collections', null, null, '198.18.0.50', ['public' => '1', 'limit' => '50']);
check('и пропали из каталога', !in_array($pub, array_column($j['collections'], 'id'), true));
[$s] = $rep($pub, ['reason' => 'spam'], null, $G(60));
check('на подборки заблокированного жаловаться уже нельзя → 404', $s === 404);
[$s, $j] = $adm('POST', '/authors/mod_owner/unsuspend', ['note' => 'разобрались']);
check('разблокировать → ACTIVE', $s === 200 && $j['author']['status'] === 'ACTIVE');
[$s, $j] = api('POST', '/api/v1/sessions', ['handle' => 'mod_owner', 'password' => 'Zontik-2026'], null, '192.0.2.71');
check('после разблокировки автор входит с прежним паролем', $s === 200 && isset($j['token']));
[$s] = api('GET', "/api/v1/collections/$pub", null, null, '198.18.0.50');
check('и его подборки снова видны', $s === 200);
[$s] = $adm('POST', '/authors/nobody_here/suspend', []);
check('заблокировать несуществующего → 404', $s === 404);

check('все действия попали в журнал', (int) $pdo->query("SELECT COUNT(DISTINCT action) FROM admin_actions WHERE action IN ('auto_hide','restore','hide','dismiss','suspend','unsuspend')")->fetchColumn() === 6);

// ── лимиты
$ipLimit = '198.18.8.8';
$last = 0;
for ($i = 1; $i <= 21; $i++) [$last] = $rep($pub, ['reason' => 'spam'], null, $ipLimit);
check('21-я жалоба за сутки с одного устройства → 429', $last === 429);
$bad = [];
for ($i = 1; $i <= 20; $i++) [$bad[]] = $adm('GET', '/reports', null, 'ne-tot-token-ne-tot-token', '198.18.7.7');
[$sOk] = $adm('GET', '/reports', null, null, '198.18.7.7');
[$sOther] = $adm('GET', '/reports', null, null, '198.18.7.8');
check('подбор служебного токена: 20 неудач → дальше 429 даже с верным токеном, другой адрес не затронут',
    count(array_unique($bad)) === 1 && $bad[0] === 403 && $sOk === 429 && $sOther === 200);

$hashes = $pdo->query('SELECT reporter_hash FROM reports')->fetchAll(PDO::FETCH_COLUMN);
check('во всех жалобах только хэши, без адресов', $hashes !== [] && count(array_filter($hashes, static fn ($h) => preg_match('/^[0-9a-f]{16}$/', (string) $h) !== 1)) === 0);
