<?php
declare(strict_types=1);

namespace Kg\Controllers;

use Kg\ApiException;
use Kg\Auth;
use Kg\Db;
use Kg\Handles;
use Kg\Ids;
use Kg\Places;
use Kg\RateLimit;
use Kg\Request;
use Kg\Response;
use Kg\Text;
use PDO;
use PDOException;

/** Авторские подборки: создание и правка владельцем, просмотр по id, публичный каталог и страница автора. */
final class CollectionsController
{
    public const MAX_PER_USER = 50;
    public const MAX_ITEMS = 30;
    private const CREATES_PER_DAY = 10;
    private const MAX_TITLE = 100;
    private const MAX_DESCRIPTION = 600;
    private const MAX_NOTE = 240;
    private const MAX_CITY = 60;
    private const DEFAULT_CITY = 'Москва';
    private const VISIBILITY = ['PRIVATE', 'UNLISTED', 'PUBLIC'];
    private const ID_RE = '/^[a-z0-9]{10}$/D';

    /** Автор в выборках с JOIN users: колонки a_id, a_handle, a_display_name, a_avatar_value, a_tint, a_bio, a_status. */
    private const AUTHOR_COLS = 'u.id AS a_id, u.handle AS a_handle, u.display_name AS a_display_name, u.avatar_value AS a_avatar_value,
                                 u.tint AS a_tint, u.bio AS a_bio, u.status AS a_status';

    // ───────────────────────── чтение

    /** GET /collections?mine=1 (нужен вход) или GET /collections?public=1&limit=24&cursor= (каталог). */
    public function index(Request $req): Response
    {
        $db = Db::pdo();
        if (($req->query['mine'] ?? '') === '1') {
            $u = Auth::require($db, $req);
            $st = $db->prepare('SELECT c.*, ' . self::AUTHOR_COLS . ' FROM collections c JOIN users u ON u.id = c.user_id
                                WHERE c.user_id = ? ORDER BY c.updated_at DESC, c.id DESC LIMIT ' . (self::MAX_PER_USER + 10));
            $st->execute([$u['id']]);
            return Response::json(['collections' => array_map(fn (array $r) => $this->withAuthor($r), $st->fetchAll())]);
        }
        if (($req->query['public'] ?? '') === '1') return $this->catalog($db, $req);
        throw ApiException::badRequest('Укажите mine=1 (мои подборки) или public=1 (каталог)', 'bad_query');
    }

    /** Публичный каталог: только PUBLIC + PUBLISHED, свежие сверху; курсор — base64url от «published_at|id». */
    private function catalog(PDO $db, Request $req): Response
    {
        $limitRaw = (string) ($req->query['limit'] ?? '');
        $limit = max(1, min(50, ctype_digit($limitRaw) ? (int) $limitRaw : 24));
        $where = "c.visibility = 'PUBLIC' AND c.status = 'PUBLISHED' AND u.status = 'ACTIVE'";
        $args = [];
        $cursor = (string) ($req->query['cursor'] ?? '');
        if ($cursor !== '') {
            $raw = base64_decode(strtr($cursor, '-_', '+/'), true);
            if ($raw === false || !preg_match('/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\|([a-z0-9]{10})$/D', $raw, $m)) {
                throw ApiException::badRequest('Неверный курсор', 'bad_cursor');
            }
            $where .= ' AND (c.published_at < ? OR (c.published_at = ? AND c.id < ?))';
            $args = [$m[1], $m[1], $m[2]];
        }
        $st = $db->prepare('SELECT c.*, ' . self::AUTHOR_COLS . " FROM collections c JOIN users u ON u.id = c.user_id
                            WHERE $where ORDER BY c.published_at DESC, c.id DESC LIMIT " . ($limit + 1));
        $st->execute($args);
        $rows = $st->fetchAll();
        $next = null;
        if (count($rows) > $limit) {
            $rows = array_slice($rows, 0, $limit);
            $last = $rows[$limit - 1];
            $next = rtrim(strtr(base64_encode($last['published_at'] . '|' . $last['id']), '+/', '-_'), '=');
        }
        return Response::json(['collections' => array_map(fn (array $r) => $this->withAuthor($r), $rows), 'next' => $next]);
    }

    /** GET /collections/:id — владелец видит свою в любом виде; остальные только UNLISTED/PUBLIC в статусе PUBLISHED. */
    public function show(Request $req, array $params): Response
    {
        $db = Db::pdo();
        $me = Auth::user($db, $req);
        $id = (string) ($params['id'] ?? '');
        $row = preg_match(self::ID_RE, $id) ? $this->fetchWithAuthor($db, $id) : null;
        $mine = $row !== null && $me !== null && $row['user_id'] === $me['id'];
        $visible = $row !== null && ($mine || (in_array($row['visibility'], ['UNLISTED', 'PUBLIC'], true)
            && $row['status'] === 'PUBLISHED' && $row['a_status'] === 'ACTIVE'));
        if (!$visible) throw ApiException::notFound('Подборка не найдена');
        // Ответ зависит от того, кто смотрит (поле mine), поэтому общий кэш — только для чужого просмотра
        $headers = $mine ? ['Cache-Control' => 'no-store'] : ['Cache-Control' => 'public, max-age=60', 'Vary' => 'Authorization, Cookie'];
        return Response::json(['collection' => $this->collection($row), 'author' => $this->authorJson($row, 'a_'), 'mine' => $mine], 200, $headers);
    }

    /** GET /authors/:handle — публичный профиль и публичные подборки автора (ник без учёта регистра, можно с @). */
    public function authorPage(Request $req, array $params): Response
    {
        $db = Db::pdo();
        $h = Handles::normalize((string) ($params['handle'] ?? ''));
        $u = null;
        if (preg_match('/^[a-z0-9._-]{3,30}$/D', $h)) {
            $st = $db->prepare("SELECT * FROM users WHERE handle_lc = ? AND status = 'ACTIVE'");
            $st->execute([$h]);
            $u = $st->fetch() ?: null;
        }
        if ($u === null) throw ApiException::notFound('Автор не найден');
        $author = $this->authorJson($u, '');
        if ((string) $u['bio'] !== '') $author['bio'] = (string) $u['bio'];
        $st = $db->prepare('SELECT c.*, ' . self::AUTHOR_COLS . " FROM collections c JOIN users u ON u.id = c.user_id
                            WHERE c.user_id = ? AND c.visibility = 'PUBLIC' AND c.status = 'PUBLISHED'
                            ORDER BY c.published_at DESC, c.id DESC LIMIT " . self::MAX_PER_USER);
        $st->execute([$u['id']]);
        return Response::json(['author' => $author, 'collections' => array_map(fn (array $r) => $this->withAuthor($r), $st->fetchAll())]);
    }

    // ───────────────────────── запись

    /** POST /collections */
    public function create(Request $req): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $bucket = 'coll:create:' . $u['id'];
        try {
            RateLimit::over($db, $bucket, self::CREATES_PER_DAY, 86400); // считаем только созданные подборки
        } catch (ApiException $e) {
            throw new ApiException(429, 'rate_limited', 'Можно создавать не больше 10 подборок в сутки. Попробуйте завтра.', $e->headers);
        }
        $b = $req->json();
        $f = $this->parse($b, true);
        $publish = $this->publishFlag($b) === true;
        $this->checkAges($f['age_min'], $f['age_max']);
        if ($publish && !$f['items']) throw $this->emptyPublish();

        $now = gmdate('Y-m-d H:i:s');
        // Приложение может задать id заранее (случайные 10 символов): так подборка, созданная до входа, переезжает на сервер под тем же адресом
        $wantId = isset($b['id']) && is_string($b['id']) && preg_match(self::ID_RE, $b['id']) ? $b['id'] : null;
        $id = $this->insert($db, $u['id'], $f, $publish, $now, $wantId);
        RateLimit::hit($db, $bucket, 1000, 86400);
        $row = $this->fetchWithAuthor($db, $id) ?? throw new \RuntimeException('Созданная подборка не найдена');
        return Response::json(['collection' => $this->collection($row), 'author' => $this->authorJson($row, 'a_')], 201);
    }

    /** PUT /collections/:id — частичное обновление; чужая и несуществующая подборки одинаково дают 404. */
    public function update(Request $req, array $params): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $id = (string) ($params['id'] ?? '');
        if (!preg_match(self::ID_RE, $id)) throw ApiException::notFound('Подборка не найдена');
        $b = $req->json();
        $f = $this->parse($b, false);
        $publish = $this->publishFlag($b);
        $now = gmdate('Y-m-d H:i:s');

        $db->beginTransaction();
        try {
            $st = $db->prepare('SELECT * FROM collections WHERE id = ? AND user_id = ? FOR UPDATE');
            $st->execute([$id, $u['id']]);
            $cur = $st->fetch();
            if (!$cur) throw ApiException::notFound('Подборка не найдена');

            $items = $f['items'] ?? $this->itemsOf($cur);
            $ageMin = $f['age_min'] ?? (int) $cur['age_min'];
            $ageMax = $f['age_max'] ?? (int) $cur['age_max'];
            $this->checkAges($ageMin, $ageMax);
            $title = $f['title'] ?? (string) $cur['title'];
            // Адрес меняется вместе с названием только пока подборка — черновик; у опубликованной ссылка остаётся прежней
            $slug = (string) $cur['slug'];
            if ($cur['status'] === 'DRAFT' && isset($f['title']) && $f['title'] !== $cur['title']) {
                $slug = $this->uniqueSlug($db, $u['id'], $title, $id);
            }
            [$coverKind, $coverSlug] = $f['cover'] ?? [(string) $cur['cover_kind'], $cur['cover_slug']];

            $status = (string) $cur['status'];
            $publishedAt = $cur['published_at'];
            if ($publish === true) {
                if ($status === 'HIDDEN') {
                    throw ApiException::forbidden('Подборка скрыта модерацией, опубликовать её нельзя. Если это ошибка, напишите в поддержку.');
                }
                if ($status !== 'PUBLISHED') { $status = 'PUBLISHED'; $publishedAt = $now; }
            } elseif ($publish === false && $status === 'PUBLISHED') {
                $status = 'DRAFT';
                $publishedAt = null;
            }
            if ($status === 'PUBLISHED' && !$items) throw $this->emptyPublish();

            $db->prepare('UPDATE collections SET title = ?, slug = ?, description = ?, cover_kind = ?, cover_slug = ?, city = ?, visibility = ?,
                          status = ?, age_min = ?, age_max = ?, items = ?, updated_at = ?, published_at = ? WHERE id = ? AND user_id = ?')
                ->execute([
                    $title, $slug, $f['description'] ?? $cur['description'], $coverKind, $coverSlug, $f['city'] ?? $cur['city'],
                    $f['visibility'] ?? $cur['visibility'], $status, $ageMin, $ageMax, $this->itemsJson($items), $now, $publishedAt, $id, $u['id'],
                ]);
            $db->commit();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
        $row = $this->fetchWithAuthor($db, $id) ?? throw new \RuntimeException('Подборка пропала после обновления');
        return Response::json(['collection' => $this->collection($row), 'author' => $this->authorJson($row, 'a_')]);
    }

    /** DELETE /collections/:id */
    public function delete(Request $req, array $params): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $id = (string) ($params['id'] ?? '');
        if (!preg_match(self::ID_RE, $id)) throw ApiException::notFound('Подборка не найдена');
        $st = $db->prepare('DELETE FROM collections WHERE id = ? AND user_id = ?');
        $st->execute([$id, $u['id']]);
        if ($st->rowCount() === 0) throw ApiException::notFound('Подборка не найдена');
        return Response::noContent();
    }

    /**
     * Вставка под блокировкой строки пользователя: два одновременных запроса не обойдут лимит 50 и не займут один адрес.
     * @param array<string,mixed> $f
     */
    private function insert(PDO $db, string $uid, array $f, bool $publish, string $now, ?string $wantId = null): string
    {
        $db->beginTransaction();
        try {
            $lock = $db->prepare('SELECT id FROM users WHERE id = ? FOR UPDATE');
            $lock->execute([$uid]);
            if ($lock->fetchColumn() === false) throw ApiException::unauthorized();
            $cnt = $db->prepare('SELECT COUNT(*) FROM collections WHERE user_id = ?');
            $cnt->execute([$uid]);
            if ((int) $cnt->fetchColumn() >= self::MAX_PER_USER) {
                throw ApiException::conflict('Можно хранить не больше 50 подборок. Удалите ненужные, чтобы создать новую.', 'limit_reached');
            }
            $slug = $this->uniqueSlug($db, $uid, $f['title'], null);
            [$coverKind, $coverSlug] = $f['cover'];
            $ins = $db->prepare('INSERT INTO collections (id, user_id, title, slug, description, cover_kind, cover_slug, city, visibility, status,
                                 age_min, age_max, items, created_at, updated_at, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            for ($try = 0;; $try++) {
                $id = $wantId ?? Ids::random(10);
                try {
                    $ins->execute([
                        $id, $uid, $f['title'], $slug, $f['description'], $coverKind, $coverSlug, $f['city'], $f['visibility'],
                        $publish ? 'PUBLISHED' : 'DRAFT', $f['age_min'], $f['age_max'], $this->itemsJson($f['items']), $now, $now, $publish ? $now : null,
                    ]);
                    break;
                } catch (PDOException $e) {
                    if ($e->getCode() === '23000' && $wantId !== null) throw ApiException::conflict('Этот идентификатор уже занят', 'id_taken');
                    if ($e->getCode() !== '23000' || $try >= 4) throw $e; // редкое совпадение случайного id — пробуем другой
                }
            }
            $db->commit();
            return $id;
        } catch (\Throwable $e) {
            if ($db->inTransaction()) $db->rollBack();
            throw $e;
        }
    }

    /** Свободный в пределах кабинета адрес: из названия, при совпадении -2, -3… */
    private function uniqueSlug(PDO $db, string $uid, string $title, ?string $exceptId): string
    {
        $st = $db->prepare('SELECT slug FROM collections WHERE user_id = ? AND id <> ?');
        $st->execute([$uid, $exceptId ?? '']);
        $taken = array_flip(array_map('strval', $st->fetchAll(PDO::FETCH_COLUMN)));
        $base = Text::slug($title);
        $slug = $base;
        for ($n = 2; isset($taken[$slug]); $n++) {
            $suffix = '-' . $n;
            $slug = substr($base, 0, 120 - strlen($suffix)) . $suffix;
        }
        return $slug;
    }

    // ───────────────────────── разбор тела запроса

    /**
     * Проверенные и очищенные поля. При создании подставляются значения по умолчанию, при правке — только присланные.
     * @param array<string,mixed> $b
     * @return array<string,mixed>
     */
    private function parse(array $b, bool $create): array
    {
        $f = [];
        if ($create || array_key_exists('title', $b)) $f['title'] = $this->title($b['title'] ?? null);
        if (array_key_exists('description', $b)) $f['description'] = $this->text($b['description'], self::MAX_DESCRIPTION, 'Описание', 'bad_description');
        elseif ($create) $f['description'] = '';
        if (array_key_exists('cover', $b)) $f['cover'] = $this->cover($b['cover']);
        elseif ($create) $f['cover'] = ['collage', null];
        if (array_key_exists('city', $b)) {
            $city = $this->text($b['city'], self::MAX_CITY, 'Город', 'bad_city');
            $f['city'] = $city === '' ? self::DEFAULT_CITY : $city;
        } elseif ($create) {
            $f['city'] = self::DEFAULT_CITY;
        }
        if (array_key_exists('visibility', $b)) $f['visibility'] = $this->visibility($b['visibility']);
        elseif ($create) $f['visibility'] = 'PRIVATE';
        if (array_key_exists('age_min', $b)) $f['age_min'] = $this->age($b['age_min'], 'age_min');
        elseif ($create) $f['age_min'] = 0;
        if (array_key_exists('age_max', $b)) $f['age_max'] = $this->age($b['age_max'], 'age_max');
        elseif ($create) $f['age_max'] = 12;
        if (array_key_exists('items', $b)) $f['items'] = $this->items($b['items']);
        elseif ($create) $f['items'] = [];
        return $f;
    }

    private function title(mixed $v): string
    {
        $s = is_string($v) ? Text::clean($v) : '';
        $n = mb_strlen($s);
        if ($n < 1 || $n > self::MAX_TITLE) throw ApiException::unprocessable('Название — от 1 до 100 символов', 'bad_title');
        return $s;
    }

    private function text(mixed $v, int $max, string $label, string $code): string
    {
        if ($v === null) return '';
        if (!is_string($v)) throw ApiException::unprocessable("$label — текст", $code);
        $s = Text::clean($v);
        if (mb_strlen($s) > $max) throw ApiException::unprocessable("$label — не длиннее $max символов", $code);
        return $s;
    }

    /** @return array{0:string,1:?string} вид обложки и slug места */
    private function cover(mixed $v): array
    {
        if ($v === null) return ['collage', null];
        $kind = is_array($v) ? ($v['kind'] ?? null) : null;
        if ($kind === 'collage') return ['collage', null];
        if ($kind === 'place') {
            $slug = $v['slug'] ?? null;
            if (!is_string($slug) || !preg_match(Places::PATTERN, $slug)) throw ApiException::unprocessable('Обложка: неверный адрес места', 'bad_cover');
            return Places::known($slug) ? ['place', $slug] : ['collage', null]; // неизвестное место — автоколлаж
        }
        throw ApiException::unprocessable('Обложка — {"kind":"place","slug":"…"} или {"kind":"collage"}', 'bad_cover');
    }

    private function visibility(mixed $v): string
    {
        $s = is_string($v) ? strtoupper(trim($v)) : '';
        if (!in_array($s, self::VISIBILITY, true)) throw ApiException::unprocessable('Видимость — PRIVATE, UNLISTED или PUBLIC', 'bad_visibility');
        return $s;
    }

    private function age(mixed $v, string $field): int
    {
        if (is_string($v) && ctype_digit($v)) $v = (int) $v;
        if (!is_int($v) || $v < 0 || $v > 18) throw ApiException::unprocessable("$field — целое число от 0 до 18", 'bad_age');
        return $v;
    }

    private function checkAges(int $min, int $max): void
    {
        if ($min > $max) throw ApiException::unprocessable('Возраст «от» не может быть больше возраста «до»', 'bad_age');
    }

    /**
     * Пункты подборки: порядок сохраняется, повторы мест убираются, места не из списка api/data/places.json отбрасываются.
     * @return list<array{place_id:string,creator_note?:string}>
     */
    private function items(mixed $v): array
    {
        if ($v === null) return [];
        if (!is_array($v) || !array_is_list($v)) throw ApiException::unprocessable('items — список мест', 'bad_items');
        $out = [];
        $seen = [];
        foreach ($v as $it) {
            $pid = is_array($it) ? ($it['place_id'] ?? null) : null;
            if (!is_string($pid) || !preg_match(Places::PATTERN, $pid)) {
                throw ApiException::unprocessable('Неверный place_id: латиница, цифры и дефис, до 80 символов', 'bad_place');
            }
            $note = $it['creator_note'] ?? null;
            if ($note !== null && !is_string($note)) throw ApiException::unprocessable('Заметка — текст', 'bad_note');
            $note = $note === null ? '' : Text::clean($note);
            if (mb_strlen($note) > self::MAX_NOTE) throw ApiException::unprocessable('Заметка — не длиннее 240 символов', 'bad_note');
            if (isset($seen[$pid]) || !Places::known($pid)) continue;
            $seen[$pid] = true;
            $out[] = $note === '' ? ['place_id' => $pid] : ['place_id' => $pid, 'creator_note' => $note];
        }
        if (count($out) > self::MAX_ITEMS) throw ApiException::unprocessable('В подборке не больше 30 мест', 'too_many_items');
        return $out;
    }

    /** @param array<string,mixed> $b */
    private function publishFlag(array $b): ?bool
    {
        $p = $b['publish'] ?? null;
        if ($p !== null && !is_bool($p)) throw ApiException::unprocessable('publish — true или false', 'bad_publish');
        return $p;
    }

    private function emptyPublish(): ApiException
    {
        return ApiException::unprocessable('Чтобы опубликовать подборку, добавьте в неё хотя бы одно место', 'empty_publish');
    }

    // ───────────────────────── ответы

    /** @param list<array<string,string>> $items */
    private function itemsJson(array $items): string
    {
        return json_encode($items, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    /** @param array<string,mixed> $row @return list<array<string,string>> */
    private function itemsOf(array $row): array
    {
        $list = json_decode((string) ($row['items'] ?? '[]'), true);
        return is_array($list) ? array_values($list) : [];
    }

    private function fetchWithAuthor(PDO $db, string $id): ?array
    {
        $st = $db->prepare('SELECT c.*, ' . self::AUTHOR_COLS . ' FROM collections c JOIN users u ON u.id = c.user_id WHERE c.id = ?');
        $st->execute([$id]);
        return $st->fetch() ?: null;
    }

    /** Подборка в форме клиентского типа Collection (без автора). @param array<string,mixed> $r */
    private function collection(array $r): array
    {
        $id = (string) $r['id'];
        $items = [];
        foreach ($this->itemsOf($r) as $i => $it) {
            $o = ['id' => $id . '-' . ($i + 1), 'collection_id' => $id, 'place_id' => (string) $it['place_id'], 'position' => $i];
            if (isset($it['creator_note']) && $it['creator_note'] !== '') $o['creator_note'] = (string) $it['creator_note'];
            $items[] = $o;
        }
        $out = [
            'id' => $id,
            'user_id' => $r['user_id'],
            'title' => $r['title'],
            'slug' => $r['slug'],
            'description' => $r['description'],
            'cover' => $r['cover_kind'] === 'place' && $r['cover_slug'] !== null ? ['kind' => 'place', 'slug' => $r['cover_slug']] : ['kind' => 'collage'],
            'city' => $r['city'],
            'visibility' => $r['visibility'],
            'status' => $r['status'],
            'age_min' => (int) $r['age_min'],
            'age_max' => (int) $r['age_max'],
            'created_at' => Text::iso($r['created_at']),
            'updated_at' => Text::iso($r['updated_at']),
        ];
        if ($r['published_at'] !== null) $out['published_at'] = Text::iso($r['published_at']);
        $out['items'] = $items;
        return $out;
    }

    /** Подборка вместе с автором — для списков. */
    private function withAuthor(array $r): array
    {
        return $this->collection($r) + ['author' => $this->authorJson($r, 'a_')];
    }

    /**
     * Публичные поля автора. $p — приставка колонок: '' для строки из users, 'a_' для строки из JOIN.
     * Без имени показываем ник, чтобы подпись не была пустой. Хэши и служебные поля сюда не попадают.
     * @param array<string,mixed> $r
     */
    private function authorJson(array $r, string $p): array
    {
        $name = (string) $r[$p . 'display_name'];
        return [
            'id' => $r[$p . 'id'],
            'name' => $name !== '' ? $name : $r[$p . 'handle'],
            'username' => $r[$p . 'handle'],
            'avatar' => $r[$p . 'avatar_value'],
            'tint' => $r[$p . 'tint'],
        ];
    }
}
