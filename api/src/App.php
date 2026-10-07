<?php
declare(strict_types=1);

namespace Kg;

use Kg\Controllers\AdminController;
use Kg\Controllers\HealthController;

final class App
{
    public static function router(): Router
    {
        $r = new Router();
        $health = new HealthController();
        $admin = new AdminController();
        $r->add('GET', '/health', [$health, 'health']);
        $r->add('POST', '/admin/migrate', [$admin, 'migrate']);
        // Этапы 1+: аккаунты, подборки, «хочу сюда», жалобы — подключаются здесь
        return $r;
    }
}
