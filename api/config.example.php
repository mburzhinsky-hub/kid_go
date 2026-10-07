<?php
// Скопируйте в config.php НА ХОСТИНГЕ и впишите значения. Файл config.php в репозиторий не попадает.
return [
    'env' => 'production',            // production | development
    'site_url' => 'https://kids-go.fun',
    'db' => [
        'host' => '127.0.0.1',
        'port' => 3306,
        'name' => 'u0000000_default',
        'user' => 'u0000000_default',
        'pass' => 'ПАРОЛЬ_БАЗЫ',
    ],
    // Секрет для подписи служебных значений (длинная случайная строка, 48+ символов)
    'app_secret' => 'СЛУЧАЙНАЯ_СТРОКА',
    // Токен для запуска миграций по HTTP и входа в модерацию (хранится как SHA-256 от настоящего токена)
    'admin_token_sha256' => 'SHA256_ТОКЕНА',
    'uploads_dir' => __DIR__ . '/uploads',
];
