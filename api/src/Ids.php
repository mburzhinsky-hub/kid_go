<?php
declare(strict_types=1);

namespace Kg;

final class Ids
{
    private const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'; // без похожих l/o/0/1

    /** Случайный идентификатор из безопасного генератора: не подбирается перебором. */
    public static function random(int $len = 10): string
    {
        $out = '';
        $n = strlen(self::ALPHABET);
        for ($i = 0; $i < $len; $i++) $out .= self::ALPHABET[random_int(0, $n - 1)];
        return $out;
    }

    /** Секретный ключ кабинета: 32 случайных байта в base64url (43 символа). */
    public static function secretKey(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    public static function hashKey(string $key): string
    {
        return hash('sha256', $key);
    }
}
