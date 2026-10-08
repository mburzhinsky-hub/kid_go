<?php
declare(strict_types=1);

// Превью ссылок на подборки (SharePage). Подключается из run.php после collections.php: берёт оттуда kg_user() и api().
use Kg\Db;
use Kg\SharePage;

$pdo = Db::pdo();
echo "\nСтраница подборки и превью ссылок\n";

$tmp = sys_get_temp_dir() . '/kg-place-index-' . getmypid() . '.json';
file_put_contents($tmp, json_encode([
    'park-gorkogo' => ['n' => 'Парк Горького', 'p' => 'photo-aaa111'],
    'moskovsky-zoopark' => ['n' => 'Московский зоопарк', 'p' => null],
    'vdnh' => ['n' => 'ВДНХ', 'p' => 'photo-bbb222'],
    'sokolniki' => ['n' => 'Сокольники', 'p' => null],
], JSON_UNESCAPED_UNICODE));
SharePage::useIndex($tmp);
Kg\Places::useFile('/nonexistent/places.json'); // список мест не фильтрует: тестовые slug нужны только для превью

$shell = '<!DOCTYPE html><html lang="ru"><head><title>Подборка мест для детей · Kids Go</title>'
    . '<meta name="description" content="Подборка мест для детей от родителей"/><meta name="robots" content="noindex, nofollow"/>'
    . '<meta property="og:title" content="Kids Go — куда пойти"/><meta property="og:description" content="Выберите настроение"/>'
    . '<meta name="twitter:card" content="summary"/><meta name="twitter:title" content="Kids Go — куда пойти"/><meta name="twitter:description" content="Выберите настроение"/>'
    . '</head><body><div id="root"></div></body></html>';
$site = 'https://kids-go.fun';

$S = kg_user('share_author', '192.0.2.61');
$mk = static function (array $b) use ($S): string {
    [$s, $j] = api('POST', '/api/v1/collections', $b, $S['token']);
    if ($s !== 201) throw new RuntimeException('создание подборки: ' . json_encode($j, JSON_UNESCAPED_UNICODE));
    return $j['collection']['id'];
};
$pdo->exec("DELETE FROM rate_limits WHERE bucket LIKE 'coll:create:%'");

$evil = 'Лето "в городе" <script>alert(1)</script> & парки';
$pub = $mk(['title' => $evil, 'description' => '', 'visibility' => 'PUBLIC', 'publish' => true, 'cover' => ['kind' => 'place', 'slug' => 'vdnh'],
    'items' => [['place_id' => 'moskovsky-zoopark'], ['place_id' => 'park-gorkogo'], ['place_id' => 'vdnh'], ['place_id' => 'sokolniki']]]);
[$st, $html, $cache] = SharePage::render($pdo, $pub, $shell, $site);
check('публичная подборка → 200', $st === 200 && str_contains($cache, 'public'));
check('название и автор в <title> и og:title, всё экранировано', str_contains($html, '<title>Лето &quot;в городе&quot; &lt;script&gt;alert(1)&lt;/script&gt; &amp; парки · Kids Go</title>') && !str_contains($html, '<script>alert'));
check('без описания автора — «4 места для детей: …» и подпись автора', str_contains($html, '4 места для детей: Московский зоопарк, Парк Горького, ВДНХ и другие. Автор: Автор share_author.'), substr($html, 0, 600));
check('картинка — фото обложки-места (photo-bbb222), JPEG 1200×630', str_contains($html, 'og:image" content="https://kids-go.fun/photos/photo-bbb222-og.jpg"') && str_contains($html, 'og:image:width" content="1200"'));
check('og:url и canonical на красивый адрес /c/<id>/', str_contains($html, 'og:url" content="https://kids-go.fun/c/' . $pub . '/"') && str_contains($html, 'rel="canonical" href="https://kids-go.fun/c/' . $pub . '/"'));
check('крупная карточка twitter:card и тег noindex у публичной убран', str_contains($html, 'twitter:card" content="summary_large_image"') && !str_contains($html, 'name="robots"'));
check('прежних общих тегов сайта не осталось', substr_count($html, 'Kids Go — куда пойти') === 0 && substr_count($html, '<title>') === 1);

$unl = $mk(['title' => 'По ссылке', 'description' => 'Только для своих', 'visibility' => 'UNLISTED', 'publish' => true,
    'items' => [['place_id' => 'sokolniki'], ['place_id' => 'moskovsky-zoopark']]]);
[$st, $html] = SharePage::render($pdo, $unl, $shell, $site);
check('по ссылке → 200, но noindex', $st === 200 && str_contains($html, 'name="robots" content="noindex, nofollow"'));
check('нет фото ни у одного места → картинка по умолчанию', str_contains($html, 'https://kids-go.fun/icons/icon-512.png'));
check('описание автора используется как есть', str_contains($html, 'Только для своих. Автор: Автор share_author.'));

$priv = $mk(['title' => 'Приватная', 'visibility' => 'PRIVATE', 'publish' => true, 'items' => [['place_id' => 'vdnh']]]);
$draft = $mk(['title' => 'Черновик', 'visibility' => 'PUBLIC', 'items' => [['place_id' => 'vdnh']]]);
foreach (['приватная' => $priv, 'черновик' => $draft, 'несуществующая' => 'zzzzzzzzzz', 'кривой id' => 'a/../b'] as $name => $id) {
    [$st, $html, $cache] = SharePage::render($pdo, $id, $shell, $site);
    check("$name → 404, noindex, без названия подборки", $st === 404 && str_contains($html, 'noindex') && !str_contains($html, 'Приватная') && !str_contains($html, 'Черновик') && $cache === 'no-store');
}
$pdo->prepare("UPDATE users SET status='SUSPENDED' WHERE id = ?")->execute([$S['id']]);
[$st] = SharePage::render($pdo, $pub, $shell, $site);
check('подборка заблокированного автора → 404', $st === 404);
$pdo->prepare("UPDATE users SET status='ACTIVE' WHERE id = ?")->execute([$S['id']]);
$pdo->prepare("UPDATE collections SET status='HIDDEN' WHERE id = ?")->execute([$pub]);
[$st] = SharePage::render($pdo, $pub, $shell, $site);
check('скрытая модерацией подборка → 404', $st === 404);

SharePage::useIndex('/nonexistent/place-index.json');
[$st, $html] = SharePage::render($pdo, $unl, $shell, $site);
check('нет индекса мест — страница всё равно работает (картинка по умолчанию, описание автора)', $st === 200 && str_contains($html, 'icon-512.png'));
@unlink($tmp);
SharePage::useIndex(null);
Kg\Places::useFile(null);
