<?php
declare(strict_types=1);

namespace Kg;

use PDO;

/** Счётчики «не больше N действий за окно» в таблице rate_limits. Окна фиксированные, этого достаточно против спама. */
final class RateLimit
{
    /** Бросает 429, если в текущем окне уже набралось $limit и больше действий (без увеличения счётчика). */
    public static function over(PDO $db, string $bucket, int $limit, int $windowSec): void
    {
        $now = time();
        $start = intdiv($now, $windowSec) * $windowSec;
        $st = $db->prepare('SELECT hits FROM rate_limits WHERE bucket = ? AND window_start = ?');
        $st->execute([substr($bucket, 0, 120), $start]);
        if ((int) $st->fetchColumn() >= $limit) throw ApiException::tooMany($start + $windowSec - $now);
    }

    /** Бросает 429, если лимит исчерпан. $bucket вида "acct:create:ip:1.2.3.4". */
    public static function hit(PDO $db, string $bucket, int $limit, int $windowSec): void
    {
        $now = time();
        $start = intdiv($now, $windowSec) * $windowSec;
        $bucket = substr($bucket, 0, 120);
        $db->prepare('INSERT INTO rate_limits (bucket, window_start, hits) VALUES (?, ?, 1)
                      ON DUPLICATE KEY UPDATE hits = hits + 1')->execute([$bucket, $start]);
        $st = $db->prepare('SELECT hits FROM rate_limits WHERE bucket = ? AND window_start = ?');
        $st->execute([$bucket, $start]);
        $hits = (int) $st->fetchColumn();
        if ($hits > $limit) throw ApiException::tooMany($start + $windowSec - $now);
        // Изредка чистим старые окна (около 1% запросов)
        if (random_int(1, 100) === 1) {
            $db->prepare('DELETE FROM rate_limits WHERE window_start < ?')->execute([$now - 2 * 86400]);
        }
    }
}
