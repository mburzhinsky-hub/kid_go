<?php
declare(strict_types=1);

namespace Kg;

final class Handles
{
    /** Ники демо-авторов сайта и служебные слова: занять их нельзя. */
    private const RESERVED = [
        'weekend-parents',
        'admin', 'administrator', 'root', 'api', 'support', 'help', 'moderator', 'mod', 'staff', 'team', 'official',
        'kidsgo', 'kids-go', 'kidgo', 'kids_go', 'kidsgo-app', 'app', 'www', 'mail', 'ftp', 'login', 'logout', 'register',
        'signup', 'signin', 'me', 'my', 'new', 'edit', 'c', 'collections', 'places', 'adventures', 'map', 'search', 'planner',
        'profile', 'favorites', 'import', 'scenarios', 'day', 'nearby', 'onboarding', 'privacy', 'rules', 'terms', 'about',
        'null', 'undefined', 'none', 'anonymous', 'system',
    ];

    public static function normalize(string $raw): string
    {
        $v = trim($raw);
        if (str_starts_with($v, '@')) $v = substr($v, 1);
        return strtolower($v);
    }

    /** Текст ошибки по-русски или null, если ник подходит по форме. Занятость проверяет БД отдельно. */
    public static function validate(string $handle): ?string
    {
        if (strlen($handle) < 3) return 'Минимум 3 символа';
        if (strlen($handle) > 30) return 'Не длиннее 30 символов';
        if (!preg_match('/^[a-z0-9._-]+$/', $handle)) return 'Только латиница, цифры, точка, дефис и подчёркивание';
        if (!preg_match('/^[a-z0-9].*[a-z0-9]$/', $handle)) return 'Ник должен начинаться и заканчиваться буквой или цифрой';
        if (preg_match('/[._-]{2,}/', $handle)) return 'Без повторяющихся знаков подряд';
        if (in_array($handle, self::RESERVED, true)) return 'Этот ник занят';
        return null;
    }
}
