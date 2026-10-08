<?php
declare(strict_types=1);

namespace Kg\Controllers;

use Kg\ApiException;
use Kg\Config;
use Kg\Db;
use Kg\Migrator;
use Kg\Moderation;
use Kg\RateLimit;
use Kg\Request;
use Kg\Response;
use Kg\Text;

final class AdminController
{
    private const ID_RE = '/^[a-z0-9]{10}$/D';
    private const MAX_NOTE = 300;

    /**
     * Служебный вход: токен в заголовке Authorization: Bearer …; на сервере хранится только SHA-256 токена.
     * Подбор токена ограничен: не больше 20 неудач с адреса за 15 минут (после этого 429, даже с верным токеном).
     */
    public static function requireAdmin(Request $req): void
    {
        $expected = (string) Config::get('admin_token_sha256', '');
        if ($expected === '') throw ApiException::forbidden(); // служебный вход не настроен
        self::limited(static fn () => RateLimit::over(Db::pdo(), 'admin:fail:' . $req->ip, 20, 900));
        $h = (string) $req->header('authorization');
        $token = preg_match('/^Bearer\s+(.{16,200})$/', $h, $m) ? $m[1] : '';
        if ($token === '' || !hash_equals($expected, hash('sha256', $token))) {
            self::limited(static fn () => RateLimit::hit(Db::pdo(), 'admin:fail:' . $req->ip, 1000, 900));
            // Одинаковый ответ на «нет токена» и «неверный токен»
            throw ApiException::forbidden();
        }
    }

    /** Счётчик неудач лежит в базе; в пустой базе (самая первая миграция) таблицы ещё нет — это не повод отказывать верному токену. */
    private static function limited(callable $f): void
    {
        try {
            $f();
        } catch (\PDOException) {
            // таблицы rate_limits ещё нет
        }
    }

    /** POST /api/v1/admin/migrate — выкладка вызывает после загрузки файлов. */
    public function migrate(Request $req): Response
    {
        self::requireAdmin($req);
        return Response::json(['applied' => Migrator::run(Db::pdo())]);
    }

    // ───────────────────────── модерация

    /** GET /admin/reports?status=NEW|DONE — подборки с жалобами (по умолчанию очередь NEW). */
    public function reports(Request $req): Response
    {
        self::requireAdmin($req);
        $status = strtoupper((string) ($req->query['status'] ?? 'NEW'));
        if (!in_array($status, ['NEW', 'DONE'], true)) throw ApiException::badRequest('status — NEW или DONE', 'bad_query');
        return Response::json(['status' => $status, 'items' => Moderation::queue(Db::pdo(), $status)]);
    }

    /** GET /admin/collections/:id — карточка любой подборки (в том числе скрытой и приватной), для разбора жалоб из почты. */
    public function collection(Request $req, array $params): Response
    {
        self::requireAdmin($req);
        return Response::json($this->cardOrFail($this->id($params)));
    }

    /** POST /admin/collections/:id/hide {note?} */
    public function hide(Request $req, array $params): Response
    {
        self::requireAdmin($req);
        $id = $this->id($params);
        Moderation::hide(Db::pdo(), $id, $this->note($req));
        return Response::json($this->cardOrFail($id));
    }

    /** POST /admin/collections/:id/restore {note?} — вернуть скрытую подборку и закрыть жалобы. */
    public function restore(Request $req, array $params): Response
    {
        self::requireAdmin($req);
        $id = $this->id($params);
        Moderation::restore(Db::pdo(), $id, $this->note($req));
        return Response::json($this->cardOrFail($id));
    }

    /** POST /admin/collections/:id/dismiss {note?} — жалобы необоснованны: закрыть, подборку не трогать. */
    public function dismiss(Request $req, array $params): Response
    {
        self::requireAdmin($req);
        $id = $this->id($params);
        Moderation::dismiss(Db::pdo(), $id, $this->note($req));
        return Response::json($this->cardOrFail($id));
    }

    /** GET /admin/authors/:handle — автор и все его подборки. */
    public function author(Request $req, array $params): Response
    {
        self::requireAdmin($req);
        return Response::json(Moderation::author(Db::pdo(), (string) ($params['handle'] ?? '')));
    }

    /** POST /admin/authors/:handle/suspend {note?} */
    public function suspend(Request $req, array $params): Response
    {
        self::requireAdmin($req);
        return Response::json(Moderation::suspend(Db::pdo(), (string) ($params['handle'] ?? ''), $this->note($req)));
    }

    /** POST /admin/authors/:handle/unsuspend {note?} */
    public function unsuspend(Request $req, array $params): Response
    {
        self::requireAdmin($req);
        return Response::json(Moderation::unsuspend(Db::pdo(), (string) ($params['handle'] ?? ''), $this->note($req)));
    }

    // ───────────────────────── служебное

    /** @param array<string,string> $params */
    private function id(array $params): string
    {
        $id = (string) ($params['id'] ?? '');
        if (!preg_match(self::ID_RE, $id)) throw ApiException::notFound('Подборка не найдена');
        return $id;
    }

    /** @return array<string,mixed> */
    private function cardOrFail(string $id): array
    {
        return Moderation::card(Db::pdo(), $id) ?? throw ApiException::notFound('Подборка не найдена');
    }

    /** Необязательная заметка модератора к действию: попадает в журнал admin_actions. */
    private function note(Request $req): string
    {
        $b = $req->json();
        $n = $b['note'] ?? '';
        if (!is_string($n)) throw ApiException::unprocessable('note — текст', 'bad_note');
        $n = Text::clean($n);
        if (mb_strlen($n) > self::MAX_NOTE) throw ApiException::unprocessable('Заметка — не длиннее 300 символов', 'bad_note');
        return $n;
    }
}
