<?php
declare(strict_types=1);

namespace Kg;

use Kg\Controllers\AdminController;
use Kg\Controllers\AuthController;
use Kg\Controllers\CollectionsController;
use Kg\Controllers\DocsController;
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
        // Облачная копия локального состояния: документы intents, trips, plans, saves, follows, prefs
        $docs = new DocsController();
        $r->add('GET', '/me/docs', [$docs, 'index']);
        $r->add('PUT', '/me/docs/:name', [$docs, 'put']);
        // Подборки и страницы авторов
        $col = new CollectionsController();
        $r->add('GET', '/collections', [$col, 'index']);
        $r->add('POST', '/collections', [$col, 'create']);
        $r->add('GET', '/collections/:id', [$col, 'show']);
        $r->add('PUT', '/collections/:id', [$col, 'update']);
        $r->add('DELETE', '/collections/:id', [$col, 'delete']);
        $r->add('GET', '/authors/:handle', [$col, 'authorPage']);
        // Дальше: жалобы, статистика, модерация — подключаются здесь
        return $r;
    }
}
