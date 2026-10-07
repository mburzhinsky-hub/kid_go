<?php
declare(strict_types=1);

namespace Kg;

use Kg\Controllers\AdminController;
use Kg\Controllers\AuthController;
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
        $auth = new AuthController();
        $r->add('GET', '/handles/check', [$auth, 'checkHandle']);
        $r->add('POST', '/accounts', [$auth, 'register']);
        $r->add('POST', '/sessions', [$auth, 'login']);
        $r->add('DELETE', '/sessions/current', [$auth, 'logout']);
        $r->add('DELETE', '/sessions', [$auth, 'logoutAll']);
        $r->add('GET', '/me', [$auth, 'me']);
        $r->add('PATCH', '/me', [$auth, 'updateMe']);
        $r->add('DELETE', '/me', [$auth, 'deleteMe']);
        $r->add('GET', '/me/sessions', [$auth, 'sessions']);
        $r->add('POST', '/me/password', [$auth, 'changePassword']);
        // Этапы 2+: аккаунты, подборки, «хочу сюда», жалобы — подключаются здесь
        return $r;
    }
}
