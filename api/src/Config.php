<?php
declare(strict_types=1);

namespace Kg;

/** Настройки: из api/config.php на хостинге, а в тестах и CI — из переменных окружения KG_*. */
final class Config
{
    /** @var array<string,mixed> */
    private static array $data = [];

    public static function load(?string $file = null): void
    {
        $file ??= dirname(__DIR__) . '/config.php';
        if (is_file($file)) {
            /** @var array<string,mixed> $cfg */
            $cfg = require $file;
            self::$data = $cfg;
            return;
        }
        $env = static fn (string $k, string $d = ''): string => (string) (getenv($k) !== false ? getenv($k) : $d);
        self::$data = [
            'env' => $env('KG_ENV', 'development'),
            'site_url' => $env('KG_SITE_URL', 'http://localhost'),
            'db' => [
                'host' => $env('KG_DB_HOST', '127.0.0.1'),
                'port' => (int) $env('KG_DB_PORT', '3306'),
                'name' => $env('KG_DB_NAME', 'kidsgo'),
                'user' => $env('KG_DB_USER', 'root'),
                'pass' => $env('KG_DB_PASS', ''),
            ],
            'app_secret' => $env('KG_APP_SECRET', 'dev-secret-change-me-dev-secret-change-me-0000'),
            'admin_token_sha256' => $env('KG_ADMIN_TOKEN_SHA256', ''),
            'uploads_dir' => $env('KG_UPLOADS_DIR', dirname(__DIR__) . '/uploads'),
        ];
    }

    public static function set(array $data): void
    {
        self::$data = $data;
    }

    public static function get(string $path, mixed $default = null): mixed
    {
        $v = self::$data;
        foreach (explode('.', $path) as $part) {
            if (!is_array($v) || !array_key_exists($part, $v)) return $default;
            $v = $v[$part];
        }
        return $v;
    }

    public static function isProduction(): bool
    {
        return self::get('env') === 'production';
    }
}
