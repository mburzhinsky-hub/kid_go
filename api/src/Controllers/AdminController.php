<?php
declare(strict_types=1);

namespace Kg\Controllers;

use Kg\ApiException;
use Kg\Config;
use Kg\Db;
use Kg\Migrator;
use Kg\Request;
use Kg\Response;

final class AdminController
{
    /** Служебный вход: токен в заголовке Authorization: Bearer …; на сервере хранится только SHA-256 токена. */
    public static function requireAdmin(Request $req): void
    {
        $expected = (string) Config::get('admin_token_sha256', '');
        $h = (string) $req->header('authorization');
        $token = preg_match('/^Bearer\s+(.{16,200})$/', $h, $m) ? $m[1] : '';
        if ($expected === '' || $token === '' || !hash_equals($expected, hash('sha256', $token))) {
            // Одинаковый ответ на «нет токена» и «неверный токен»
            throw ApiException::forbidden();
        }
    }

    /** POST /api/v1/admin/migrate — выкладка вызывает после загрузки файлов. */
    public function migrate(Request $req): Response
    {
        self::requireAdmin($req);
        return Response::json(['applied' => Migrator::run(Db::pdo())]);
    }
}
