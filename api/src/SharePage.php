<?php
declare(strict_types=1);

namespace Kg;

use PDO;

/**
 * Страница подборки по короткой ссылке /c/<id>/ с превью для мессенджеров.
 * Берём готовую статическую оболочку сайта (c/index.html) и подставляем в неё название, описание и картинку подборки:
 * Telegram, WhatsApp и поисковики не запускают JavaScript, им нужны теги в самом HTML.
 * Саму подборку человеку рисует приложение (читает её по API), здесь только метки.
 */
final class SharePage
{
    public const ID_RE = '/^[a-z0-9]{10}$/D';
    private const SITE_NAME = 'Kids Go';

    /** @var array<string,array{n:string,p:?string}>|null */
    private static ?array $index = null;
    private static ?string $indexFile = null;

    /** Для тестов: другой файл индекса мест. */
    public static function useIndex(?string $path): void
    {
        self::$indexFile = $path;
        self::$index = null;
    }

    /** @return array<string,array{n:string,p:?string}> */
    private static function index(): array
    {
        if (self::$index !== null) return self::$index;
        $file = self::$indexFile ?? dirname(__DIR__) . '/data/place-index.json';
        $data = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        return self::$index = is_array($data) ? $data : [];
    }

    /**
     * @return array{0:int,1:string,2:string} HTTP-статус, HTML, значение Cache-Control
     */
    public static function render(PDO $db, string $id, string $shell, string $site): array
    {
        $site = rtrim($site, '/');
        $row = null;
        if (preg_match(self::ID_RE, $id)) {
            $st = $db->prepare("SELECT c.title, c.description, c.cover_kind, c.cover_slug, c.visibility, c.status, c.items, u.handle, u.display_name, u.status AS ustatus
                                FROM collections c JOIN users u ON u.id = c.user_id WHERE c.id = ?");
            $st->execute([$id]);
            $row = $st->fetch() ?: null;
        }
        $open = $row && $row['status'] === 'PUBLISHED' && $row['ustatus'] === 'ACTIVE' && in_array($row['visibility'], ['PUBLIC', 'UNLISTED'], true);
        if (!$open) {
            // нет такой подборки или она закрыта: оболочка остаётся, но поисковикам и превью отдавать нечего
            return [404, self::apply($shell, [
                'robots' => 'noindex, nofollow',
                'title' => 'Подборка не найдена',
                'description' => 'Эта подборка недоступна: возможно, автор её удалил или спрятал.',
            ]), 'no-store'];
        }

        $items = json_decode((string) ($row['items'] ?? '[]'), true);
        $items = is_array($items) ? $items : [];
        $slugs = array_values(array_filter(array_map(static fn ($i) => is_array($i) ? (string) ($i['place_id'] ?? '') : '', $items)));
        $index = self::index();

        $author = trim((string) $row['display_name']) !== '' ? trim((string) $row['display_name']) : '@' . $row['handle'];
        $n = count($slugs);
        $names = [];
        foreach ($slugs as $s) if (isset($index[$s]['n'])) $names[] = (string) $index[$s]['n'];
        $desc = trim((string) $row['description']);
        if ($desc === '') {
            $desc = $n . ' ' . self::plural($n, 'место', 'места', 'мест') . ' для детей' . ($names ? ': ' . implode(', ', array_slice($names, 0, 3)) . ($n > 3 ? ' и другие' : '') : '');
        }
        $desc = self::clip($desc, 180);
        if (!preg_match('/[.!?…]$/u', $desc)) $desc .= '.';
        $desc .= ' Подборка от ' . $author . '.';

        // картинка: обложка-место, иначе первое место с фото
        $photo = null;
        $order = ($row['cover_kind'] === 'place' && $row['cover_slug']) ? array_merge([(string) $row['cover_slug']], $slugs) : $slugs;
        foreach ($order as $s) {
            if (!empty($index[$s]['p'])) { $photo = (string) $index[$s]['p']; break; }
        }
        $image = $photo !== null ? "$site/photos/$photo-og.jpg" : "$site/icons/icon-512.png";

        $public = $row['visibility'] === 'PUBLIC';
        return [200, self::apply($shell, [
            'title' => (string) $row['title'],
            'description' => $desc,
            'image' => $image,
            'url' => "$site/c/$id/",
            'robots' => $public ? null : 'noindex, nofollow',
        ]), $public ? 'public, max-age=60' : 'private, max-age=60'];
    }

    /** Подставляет метки в HTML оболочки. Всё, что попадает в разметку, экранируется. */
    public static function apply(string $html, array $m): string
    {
        $e = static fn (string $s): string => htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $title = (string) ($m['title'] ?? '');
        $desc = (string) ($m['description'] ?? '');
        $rep = static function (string $re, string $to) use (&$html): void {
            $out = preg_replace_callback($re, static fn () => $to, $html, 1);
            if ($out !== null) $html = $out;
        };
        if ($title !== '') {
            $rep('~<title>.*?</title>~su', '<title>' . $e($title) . ' · ' . self::SITE_NAME . '</title>');
            $rep('~<meta property="og:title" content="[^"]*"\s*/?>~u', '<meta property="og:title" content="' . $e($title) . '"/>');
            $rep('~<meta name="twitter:title" content="[^"]*"\s*/?>~u', '<meta name="twitter:title" content="' . $e($title) . '"/>');
        }
        if ($desc !== '') {
            $rep('~<meta name="description" content="[^"]*"\s*/?>~u', '<meta name="description" content="' . $e($desc) . '"/>');
            $rep('~<meta property="og:description" content="[^"]*"\s*/?>~u', '<meta property="og:description" content="' . $e($desc) . '"/>');
            $rep('~<meta name="twitter:description" content="[^"]*"\s*/?>~u', '<meta name="twitter:description" content="' . $e($desc) . '"/>');
        }
        if (array_key_exists('robots', $m)) {
            $rep('~<meta name="robots" content="[^"]*"\s*/?>~u', $m['robots'] === null ? '' : '<meta name="robots" content="' . $e((string) $m['robots']) . '"/>');
        }
        $extra = '';
        if (!empty($m['image'])) {
            $rep('~<meta name="twitter:card" content="[^"]*"\s*/?>~u', '<meta name="twitter:card" content="summary_large_image"/>');
            $extra .= '<meta property="og:image" content="' . $e((string) $m['image']) . '"/>'
                . '<meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/>'
                . '<meta name="twitter:image" content="' . $e((string) $m['image']) . '"/>';
        }
        if (!empty($m['url'])) {
            $extra .= '<meta property="og:url" content="' . $e((string) $m['url']) . '"/><link rel="canonical" href="' . $e((string) $m['url']) . '"/>';
        }
        if ($extra !== '') {
            $pos = stripos($html, '</head>');
            if ($pos !== false) $html = substr($html, 0, $pos) . $extra . substr($html, $pos);
        }
        return $html;
    }

    private static function clip(string $s, int $max): string
    {
        $s = trim(preg_replace('/\s+/u', ' ', $s) ?? $s);
        if (mb_strlen($s) <= $max) return $s;
        return rtrim(mb_substr($s, 0, $max - 1), " .,;:") . '…';
    }

    private static function plural(int $n, string $one, string $few, string $many): string
    {
        $a = $n % 100;
        $b = $n % 10;
        return ($a >= 11 && $a <= 14) ? $many : ($b === 1 ? $one : ($b >= 2 && $b <= 4 ? $few : $many));
    }
}
