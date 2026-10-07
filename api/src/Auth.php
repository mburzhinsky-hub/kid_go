<?php
declare(strict_types=1);

namespace Kg;

use PDO;

/** Входы по устройствам: токен показывается клиенту один раз, на сервере лежит только его SHA-256. */
final class Auth
{
    public const SESSION_DAYS = 400;
    public const MAX_SESSIONS = 10;

    /** Создаёт вход для устройства, возвращает токен. */
    public static function createSession(PDO $db, string $userId, string $device): string
    {
        $token = Ids::secretKey();
        $now = gmdate('Y-m-d H:i:s');
        $exp = gmdate('Y-m-d H:i:s', time() + self::SESSION_DAYS * 86400);
        $db->prepare('INSERT INTO sessions (token_hash, user_id, device, created_at, last_used_at, expires_at) VALUES (?,?,?,?,?,?)')
            ->execute([Ids::hashKey($token), $userId, mb_substr($device, 0, 80), $now, $now, $exp]);
        // Держим не больше MAX_SESSIONS входов: самые старые по использованию отпадают
        $st = $db->prepare('SELECT token_hash FROM sessions WHERE user_id = ? ORDER BY last_used_at DESC LIMIT 100 OFFSET ' . self::MAX_SESSIONS);
        $st->execute([$userId]);
        foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $old) $db->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([$old]);
        return $token;
    }

    /** Пользователь по токену из запроса или null. Подставляет 'session_hash' для выхода. */
    public static function user(PDO $db, Request $req): ?array
    {
        $token = $req->bearerKey();
        if ($token === null) return null;
        $hash = Ids::hashKey($token);
        $st = $db->prepare('SELECT u.*, s.last_used_at AS s_last FROM sessions s JOIN users u ON u.id = s.user_id
                            WHERE s.token_hash = ? AND s.expires_at > UTC_TIMESTAMP() AND u.status = \'ACTIVE\'');
        $st->execute([$hash]);
        $row = $st->fetch();
        if (!$row) return null;
        // Продлеваем вход, но не чаще раза в час, чтобы не писать в базу на каждый запрос
        if (strtotime($row['s_last'] . ' UTC') < time() - 3600) {
            $db->prepare('UPDATE sessions SET last_used_at = UTC_TIMESTAMP(), expires_at = ? WHERE token_hash = ?')
                ->execute([gmdate('Y-m-d H:i:s', time() + self::SESSION_DAYS * 86400), $hash]);
            $db->prepare('UPDATE users SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$row['id']]);
        }
        $row['session_hash'] = $hash;
        unset($row['s_last']);
        return $row;
    }

    public static function require(PDO $db, Request $req): array
    {
        return self::user($db, $req) ?? throw ApiException::unauthorized();
    }

    /** Публичный вид своего профиля: без хэшей и служебных полей. */
    public static function publicMe(array $u): array
    {
        return [
            'id' => $u['id'],
            'handle' => $u['handle'],
            'display_name' => $u['display_name'],
            'bio' => $u['bio'],
            'avatar' => ['kind' => $u['avatar_kind'], 'value' => $u['avatar_value']],
            'tint' => $u['tint'],
            'created_at' => gmdate('c', strtotime($u['created_at'] . ' UTC')),
        ];
    }
}
