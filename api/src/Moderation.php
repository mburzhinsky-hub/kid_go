<?php
declare(strict_types=1);

namespace Kg;

use PDO;
use PDOException;

/**
 * Жалобы на подборки и действия модератора.
 *
 * Жалоба — одна строка в reports на пару (кто, на что). «Кто» — короткий хэш: id кабинета, если человек вошёл, иначе его IP
 * (с секретом сервера, поэтому по хэшу личность не восстановить). Когда на подборку накопилось THRESHOLD жалоб от разных людей,
 * она скрывается сама (status = HIDDEN) до проверки. Модератор после проверки либо возвращает её (и тогда автоскрытие для неё
 * больше не включается), либо оставляет скрытой, либо блокирует автора. Каждое действие пишется в admin_actions.
 */
final class Moderation
{
    public const THRESHOLD = 3;
    public const REASONS = ['inappropriate', 'impersonation', 'spam', 'children', 'other'];
    public const MAX_NOTE = 300;
    private const REPORTS_PER_DAY = 20;
    private const REPORTS_PER_IP_DAY = 40;
    private const QUEUE_LIMIT = 100;

    /** Кто жалуется: 16 символов HMAC от id кабинета или IP. */
    public static function reporterHash(?array $user, string $ip): string
    {
        $who = $user !== null ? 'u:' . $user['id'] : 'ip:' . $ip;
        return substr(hash_hmac('sha256', 'report|' . $who, (string) Config::get('app_secret', '')), 0, 16);
    }

    /**
     * Принять жалобу на подборку. Повторная жалоба того же человека молча считается принятой, но не засчитывается второй раз.
     * @return array{hidden:bool} скрылась ли подборка этой жалобой (клиенту не показываем, нужно тестам и журналу)
     */
    public static function report(PDO $db, string $collectionId, ?array $user, string $ip, string $reason, string $note): array
    {
        $hash = self::reporterHash($user, $ip);
        RateLimit::hit($db, 'report:' . $hash, self::REPORTS_PER_DAY, 86400);
        RateLimit::hit($db, 'report:ip:' . $ip, self::REPORTS_PER_IP_DAY, 86400);

        $now = gmdate('Y-m-d H:i:s');
        try {
            $db->prepare("INSERT INTO reports (reporter_hash, target_type, target_id, reason, note, status, created_at) VALUES (?, 'collection', ?, ?, ?, 'NEW', ?)")
                ->execute([$hash, $collectionId, $reason, $note, $now]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') return ['hidden' => false]; // уже жаловались на эту подборку
            throw $e;
        }

        $cnt = $db->prepare("SELECT COUNT(*) FROM reports WHERE target_type = 'collection' AND target_id = ? AND status = 'NEW'");
        $cnt->execute([$collectionId]);
        if ((int) $cnt->fetchColumn() < self::THRESHOLD) return ['hidden' => false];

        // Скрываем только опубликованную подборку, которую модератор ещё не проверял
        $up = $db->prepare("UPDATE collections SET status = 'HIDDEN', hidden_at = ?, hidden_by = 'AUTO'
                            WHERE id = ? AND status = 'PUBLISHED' AND reviewed_at IS NULL");
        $up->execute([$now, $collectionId]);
        if ($up->rowCount() === 0) return ['hidden' => false];
        self::log($db, 'auto_hide', 'collection', $collectionId, 'жалоб: ' . self::THRESHOLD . '+');
        return ['hidden' => true];
    }

    // ───────────────────────── очередь и карточки для модератора

    /**
     * Подборки с жалобами в нужном статусе (NEW — очередь, DONE — разобранные), свежие жалобы сверху.
     * @return list<array<string,mixed>>
     */
    public static function queue(PDO $db, string $status): array
    {
        $st = $db->prepare("SELECT target_id, MAX(created_at) AS last_at FROM reports WHERE target_type = 'collection' AND status = ?
                            GROUP BY target_id ORDER BY last_at DESC LIMIT " . self::QUEUE_LIMIT);
        $st->execute([$status]);
        $out = [];
        foreach ($st->fetchAll() as $g) {
            $card = self::card($db, (string) $g['target_id'], $status);
            if ($card !== null) $out[] = $card; // жалобы на удалённые подборки в очередь не попадают
        }
        return $out;
    }

    /**
     * Карточка подборки для модератора: содержимое, автор, жалобы. Видит и скрытые, и приватные.
     * @return array<string,mixed>|null
     */
    public static function card(PDO $db, string $id, string $reportStatus = 'NEW'): ?array
    {
        $st = $db->prepare('SELECT c.*, u.handle AS a_handle, u.display_name AS a_display_name, u.status AS a_status, u.id AS a_id
                            FROM collections c JOIN users u ON u.id = c.user_id WHERE c.id = ?');
        $st->execute([$id]);
        $c = $st->fetch();
        if (!$c) return null;

        $rs = $db->prepare("SELECT reason, COUNT(*) AS n FROM reports WHERE target_type = 'collection' AND target_id = ? AND status = ? GROUP BY reason");
        $rs->execute([$id, $reportStatus]);
        $reasons = [];
        $total = 0;
        foreach ($rs->fetchAll() as $r) {
            $reasons[(string) $r['reason']] = (int) $r['n'];
            $total += (int) $r['n'];
        }
        $ns = $db->prepare("SELECT reason, note, created_at FROM reports WHERE target_type = 'collection' AND target_id = ? AND status = ? AND note <> ''
                            ORDER BY id DESC LIMIT 5");
        $ns->execute([$id, $reportStatus]);
        $notes = array_map(static fn (array $r) => ['reason' => $r['reason'], 'note' => $r['note'], 'at' => Text::iso((string) $r['created_at'])], $ns->fetchAll());
        $last = $db->prepare("SELECT MAX(created_at) FROM reports WHERE target_type = 'collection' AND target_id = ? AND status = ?");
        $last->execute([$id, $reportStatus]);
        $lastAt = $last->fetchColumn();

        $items = json_decode((string) ($c['items'] ?? '[]'), true);
        $items = is_array($items) ? array_values($items) : [];
        $name = (string) $c['a_display_name'];
        return [
            'collection' => [
                'id' => $c['id'],
                'title' => $c['title'],
                'description' => $c['description'],
                'status' => $c['status'],
                'visibility' => $c['visibility'],
                'city' => $c['city'],
                'items' => array_map(static fn ($i) => ['place_id' => (string) ($i['place_id'] ?? ''), 'note' => (string) ($i['creator_note'] ?? '')], $items),
                'published_at' => $c['published_at'] !== null ? Text::iso((string) $c['published_at']) : null,
                'hidden_by' => $c['hidden_by'],
                'hidden_at' => $c['hidden_at'] !== null ? Text::iso((string) $c['hidden_at']) : null,
                'reviewed' => $c['reviewed_at'] !== null,
                'path' => '/c/' . $c['id'] . '/',
            ],
            'author' => [
                'id' => $c['a_id'],
                'handle' => $c['a_handle'],
                'name' => $name !== '' ? $name : $c['a_handle'],
                'status' => $c['a_status'],
            ],
            'reports' => [
                'count' => $total,
                'reasons' => (object) $reasons,
                'notes' => $notes,
                'last_at' => $lastAt ? Text::iso((string) $lastAt) : null,
            ],
        ];
    }

    // ───────────────────────── действия модератора

    /** Скрыть опубликованную подборку. */
    public static function hide(PDO $db, string $id, string $note): void
    {
        $now = gmdate('Y-m-d H:i:s');
        $st = $db->prepare("UPDATE collections SET status = 'HIDDEN', hidden_at = ?, hidden_by = 'ADMIN' WHERE id = ? AND status = 'PUBLISHED'");
        $st->execute([$now, $id]);
        if ($st->rowCount() === 0) {
            $cur = self::status($db, $id);
            if ($cur === null) throw ApiException::notFound('Подборка не найдена');
            if ($cur === 'HIDDEN') return; // уже скрыта
            throw ApiException::conflict('Скрыть можно только опубликованную подборку', 'not_published');
        }
        self::log($db, 'hide', 'collection', $id, $note);
    }

    /** Вернуть скрытую подборку: жалобы закрываются, автоскрытие для неё больше не срабатывает. */
    public static function restore(PDO $db, string $id, string $note): void
    {
        $now = gmdate('Y-m-d H:i:s');
        $st = $db->prepare("UPDATE collections SET status = 'PUBLISHED', hidden_at = NULL, hidden_by = NULL, reviewed_at = ? WHERE id = ? AND status = 'HIDDEN'");
        $st->execute([$now, $id]);
        if ($st->rowCount() === 0) {
            $cur = self::status($db, $id);
            if ($cur === null) throw ApiException::notFound('Подборка не найдена');
            throw ApiException::conflict('Эта подборка не скрыта', 'not_hidden');
        }
        self::closeReports($db, $id);
        self::log($db, 'restore', 'collection', $id, $note);
    }

    /** Жалобы признаны необоснованными: закрываем их, подборка остаётся как есть, автоскрытие для неё отключается. */
    public static function dismiss(PDO $db, string $id, string $note): void
    {
        if (self::status($db, $id) === null) throw ApiException::notFound('Подборка не найдена');
        $db->prepare('UPDATE collections SET reviewed_at = ? WHERE id = ?')->execute([gmdate('Y-m-d H:i:s'), $id]);
        self::closeReports($db, $id);
        self::log($db, 'dismiss', 'collection', $id, $note);
    }

    /** Заблокировать кабинет: входить нельзя, подборки не видны другим. Выходы на всех устройствах закрываются сразу. */
    public static function suspend(PDO $db, string $handle, string $note): array
    {
        $u = self::userByHandle($db, $handle);
        $db->prepare("UPDATE users SET status = 'SUSPENDED', updated_at = UTC_TIMESTAMP() WHERE id = ?")->execute([$u['id']]);
        $db->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$u['id']]);
        self::log($db, 'suspend', 'user', (string) $u['id'], $note);
        return self::author($db, (string) $u['handle']);
    }

    public static function unsuspend(PDO $db, string $handle, string $note): array
    {
        $u = self::userByHandle($db, $handle);
        $db->prepare("UPDATE users SET status = 'ACTIVE', updated_at = UTC_TIMESTAMP() WHERE id = ?")->execute([$u['id']]);
        self::log($db, 'unsuspend', 'user', (string) $u['id'], $note);
        return self::author($db, (string) $u['handle']);
    }

    /** Автор и его подборки (все, включая скрытые) с числом открытых жалоб. */
    public static function author(PDO $db, string $handle): array
    {
        $u = self::userByHandle($db, $handle);
        $st = $db->prepare("SELECT c.id, c.title, c.status, c.visibility,
                                   (SELECT COUNT(*) FROM reports r WHERE r.target_type = 'collection' AND r.target_id = c.id AND r.status = 'NEW') AS open_reports
                            FROM collections c WHERE c.user_id = ? ORDER BY c.updated_at DESC LIMIT 100");
        $st->execute([$u['id']]);
        $name = (string) $u['display_name'];
        return [
            'author' => ['id' => $u['id'], 'handle' => $u['handle'], 'name' => $name !== '' ? $name : $u['handle'], 'status' => $u['status']],
            'collections' => array_map(static fn (array $c) => [
                'id' => $c['id'], 'title' => $c['title'], 'status' => $c['status'], 'visibility' => $c['visibility'], 'open_reports' => (int) $c['open_reports'],
            ], $st->fetchAll()),
        ];
    }

    // ───────────────────────── служебное

    private static function status(PDO $db, string $id): ?string
    {
        $st = $db->prepare('SELECT status FROM collections WHERE id = ?');
        $st->execute([$id]);
        $v = $st->fetchColumn();
        return $v === false ? null : (string) $v;
    }

    /** @return array<string,mixed> */
    private static function userByHandle(PDO $db, string $handle): array
    {
        $h = Handles::normalize($handle);
        $st = $db->prepare('SELECT * FROM users WHERE handle_lc = ?');
        $st->execute([$h]);
        return $st->fetch() ?: throw ApiException::notFound('Автор не найден');
    }

    private static function closeReports(PDO $db, string $id): void
    {
        $db->prepare("UPDATE reports SET status = 'DONE' WHERE target_type = 'collection' AND target_id = ? AND status = 'NEW'")->execute([$id]);
    }

    public static function log(PDO $db, string $action, string $targetType, string $targetId, string $note = ''): void
    {
        $db->prepare('INSERT INTO admin_actions (action, target_type, target_id, note, created_at) VALUES (?,?,?,?,?)')
            ->execute([$action, $targetType, $targetId, mb_substr($note, 0, 300), gmdate('Y-m-d H:i:s')]);
    }
}
