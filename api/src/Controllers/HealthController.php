<?php
declare(strict_types=1);

namespace Kg\Controllers;

use Kg\Db;
use Kg\Request;
use Kg\Response;

final class HealthController
{
    /** GET /api/v1/health — жив ли сервис; ?deep=1 дополнительно проверяет базу данных. */
    public function health(Request $req): Response
    {
        $out = ['ok' => true, 'service' => 'kidsgo-api', 'version' => 1, 'time' => gmdate('c')];
        if (($req->query['deep'] ?? '') === '1') {
            try {
                $out['db'] = (int) Db::pdo()->query('SELECT 1')->fetchColumn() === 1;
            } catch (\Throwable $e) {
                error_log('[kidsgo-api] health db: ' . $e->getMessage());
                return Response::json(['ok' => false, 'db' => false], 503);
            }
        }
        return Response::json($out);
    }
}
