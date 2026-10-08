<?php
declare(strict_types=1);

namespace Kg;

/**
 * Список допустимых мест (slug) из api/data/places.json — массив строк.
 * Файла нет или он пустой/испорченный — места не фильтруются, проверяется только формат.
 */
final class Places
{
    /** Формат slug места: латиница, цифры и дефис, до 80 символов. */
    public const PATTERN = '/^[a-z0-9][a-z0-9-]{0,79}$/D';

    private static ?string $file = null;
    /** @var array<string,true>|false|null null — ещё не читали, false — фильтра нет */
    private static array|false|null $cache = null;

    /** Для тестов: другой файл списка (null — вернуть стандартный). */
    public static function useFile(?string $path): void
    {
        self::$file = $path;
        self::$cache = null;
    }

    public static function known(string $slug): bool
    {
        $all = self::load();
        return $all === false || isset($all[$slug]);
    }

    /** @return array<string,true>|false */
    private static function load(): array|false
    {
        if (self::$cache !== null) return self::$cache;
        $file = self::$file ?? dirname(__DIR__) . '/data/places.json';
        self::$cache = false;
        if (!is_file($file)) return self::$cache;
        $list = json_decode((string) file_get_contents($file), true);
        if (!is_array($list)) {
            error_log('[kidsgo-api] places.json: ожидался массив slug, фильтр мест отключён');
            return self::$cache;
        }
        $set = [];
        foreach ($list as $slug) if (is_string($slug)) $set[$slug] = true;
        if ($set) self::$cache = $set;
        return self::$cache;
    }
}
