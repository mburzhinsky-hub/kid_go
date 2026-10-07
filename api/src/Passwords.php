<?php
declare(strict_types=1);

namespace Kg;

final class Passwords
{
    /** Самые частые пароли: отсеиваем, чтобы вход не взламывали подбором за минуту. */
    private const COMMON = [
        '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', 'qwertyui', 'qwerty123', 'qwertyuiop',
        'password', 'password1', 'password123', 'passw0rd', 'iloveyou', 'admin123', 'welcome1', 'abc12345', 'abcd1234',
        '1q2w3e4r', '1qaz2wsx', 'qazwsxedc', 'zaq12wsx', 'asdfghjk', 'zxcvbnm1', 'letmein1', 'monkey123', 'dragon123',
        'qwerty12', 'q1w2e3r4', 'йцукенгш', '12345678q', 'parol123', 'parol1234', 'пароль123', 'qwerty1234', 'kidsgo123',
        'kidsgo1234', 'moskva123', 'moscow123', 'mama1234', 'mamapapa', 'sunshine1', 'football1', 'baseball1', 'superman1',
    ];

    /** Текст ошибки по-русски или null. Длина до 64: bcrypt учитывает только первые 72 байта. */
    public static function validate(string $pw, string $handle = ''): ?string
    {
        $len = mb_strlen($pw);
        if ($len < 8) return 'Пароль — минимум 8 символов';
        if (strlen($pw) > 72 || $len > 64) return 'Пароль — не длиннее 64 символов';
        $lc = mb_strtolower($pw);
        if (in_array($lc, self::COMMON, true)) return 'Слишком простой пароль, придумайте другой';
        if (count(array_unique(mb_str_split($lc))) < 4) return 'Слишком простой пароль, добавьте разных символов';
        if ($handle !== '' && str_contains($lc, $handle)) return 'Пароль не должен содержать ник';
        return null;
    }

    public static function hash(string $pw): string
    {
        return password_hash($pw, PASSWORD_DEFAULT);
    }

    /** Проверка пароля с выравниванием времени: для несуществующего ника тоже считаем хэш. */
    public static function verify(string $pw, ?string $hash): bool
    {
        static $dummy = null;
        $dummy ??= password_hash('kidsgo-dummy-password', PASSWORD_DEFAULT);
        $ok = password_verify($pw, $hash !== null && $hash !== '' ? $hash : $dummy);
        return $ok && $hash !== null && $hash !== '';
    }
}
