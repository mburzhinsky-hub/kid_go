<?php
declare(strict_types=1);

namespace Kg\Controllers;

use Kg\ApiException;
use Kg\Auth;
use Kg\Config;
use Kg\Db;
use Kg\Handles;
use Kg\Ids;
use Kg\Passwords;
use Kg\RateLimit;
use Kg\Request;
use Kg\Response;
use PDO;
use PDOException;

/** Кабинет по нику и паролю: регистрация, вход по устройствам, профиль, смена пароля, удаление. */
final class AuthController
{
    private const CONSENT_VERSION = '2026-10';

    /** Строковое поле тела запроса: обрезка пробелов, проверка длины. */
    private function str(array $b, string $key, int $max, bool $required = false): ?string
    {
        $v = $b[$key] ?? null;
        if ($v === null || $v === '') {
            if ($required) throw ApiException::badRequest("Не заполнено поле: $key", 'missing_field');
            return null;
        }
        if (!is_string($v)) throw ApiException::badRequest("Неверное значение: $key", 'bad_field');
        $v = trim($v);
        if (mb_strlen($v) > $max) throw ApiException::badRequest("Слишком длинное поле: $key", 'too_long');
        return $v;
    }

    private function emoji(?string $v): string
    {
        if ($v === null || $v === '') return '🙂';
        if (mb_strlen($v) > 8 || preg_match('/[A-Za-z0-9<>&"\'\\\\\s]/u', $v)) throw ApiException::badRequest('Аватар — это один эмодзи', 'bad_avatar');
        return $v;
    }

    private function tint(?string $v): string
    {
        if ($v === null || $v === '') return '#ffe9f3';
        if (!preg_match('/^#[0-9a-fA-F]{6}$/', $v)) throw ApiException::badRequest('Неверный цвет', 'bad_tint');
        return strtolower($v);
    }

    /** Сессионная cookie: сохраняется, даже если Safari очистит localStorage. */
    private function cookie(string $token, bool $clear = false): array
    {
        $secure = str_starts_with((string) Config::get('site_url', ''), 'https://') ? '; Secure' : '';
        $age = $clear ? 0 : Auth::SESSION_DAYS * 86400;
        $val = $clear ? '' : $token;
        return ['Set-Cookie' => "kg_session=$val; Max-Age=$age; Path=/; HttpOnly; SameSite=Lax$secure"];
    }

    private function device(Request $req): string
    {
        $ua = (string) $req->header('user-agent');
        $os = str_contains($ua, 'iPhone') ? 'iPhone' : (str_contains($ua, 'Android') ? 'Android' : (str_contains($ua, 'Windows') ? 'Windows' : (str_contains($ua, 'Mac') ? 'Mac' : 'Устройство')));
        $app = str_contains($ua, 'Safari') && !str_contains($ua, 'Chrome') ? 'Safari' : (str_contains($ua, 'Chrome') ? 'Chrome' : 'Браузер');
        return "$os · $app";
    }

    /** GET /handles/check?h=ник — свободен ли ник (форма и занятость). */
    public function checkHandle(Request $req): Response
    {
        $db = Db::pdo();
        RateLimit::hit($db, 'handle:check:' . $req->ip, 60, 60);
        $h = Handles::normalize((string) ($req->query['h'] ?? ''));
        $err = Handles::validate($h);
        if ($err === null && $this->taken($db, $h)) $err = 'Этот ник занят';
        return Response::json(['handle' => $h, 'available' => $err === null, 'reason' => $err]);
    }

    private function taken(PDO $db, string $h): bool
    {
        $st = $db->prepare('SELECT 1 FROM users WHERE handle_lc = ? UNION SELECT 1 FROM handle_holds WHERE handle_lc = ? AND release_at > UTC_TIMESTAMP()');
        $st->execute([$h, $h]);
        return (bool) $st->fetchColumn();
    }

    /** POST /accounts — регистрация: ник, пароль, аватар, согласие. */
    public function register(Request $req): Response
    {
        $db = Db::pdo();
        $b = $req->json();
        if (($b['website'] ?? '') !== '') throw ApiException::badRequest('Не удалось создать кабинет', 'rejected'); // ловушка для ботов
        RateLimit::over($db, 'acct:create:' . $req->ip, 5, 86400); // считаем только созданные кабинеты
        if (($b['consent'] ?? false) !== true) throw ApiException::badRequest('Нужно согласиться с правилами и политикой', 'consent_required');
        $handle = Handles::normalize($this->str($b, 'handle', 40, true));
        if ($err = Handles::validate($handle)) throw ApiException::badRequest($err, 'bad_handle');
        $pw = (string) ($b['password'] ?? '');
        if ($err = Passwords::validate($pw, $handle)) throw ApiException::badRequest($err, 'bad_password');
        $name = $this->str($b, 'display_name', 60) ?? '';
        $avatar = $this->emoji($this->str($b, 'avatar', 16));
        $tint = $this->tint($this->str($b, 'tint', 7));

        if ($this->taken($db, $handle)) throw ApiException::conflict('Этот ник занят', 'handle_taken');
        $id = 'u' . Ids::random(11);
        $now = gmdate('Y-m-d H:i:s');
        try {
            $db->prepare('INSERT INTO users (id, handle, handle_lc, display_name, avatar_kind, avatar_value, tint, password_hash, consent_version, consent_at, created_at, updated_at, last_seen_at)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
                ->execute([$id, $handle, $handle, $name, 'emoji', $avatar, $tint, Passwords::hash($pw), self::CONSENT_VERSION, $now, $now, $now, $now]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000') throw ApiException::conflict('Этот ник занят', 'handle_taken');
            throw $e;
        }
        RateLimit::hit($db, 'acct:create:' . $req->ip, 1000, 86400);
        $token = Auth::createSession($db, $id, $this->device($req));
        $user = $db->query("SELECT * FROM users WHERE id = " . $db->quote($id))->fetch();
        return Response::json(['user' => Auth::publicMe($user), 'token' => $token], 201, $this->cookie($token));
    }

    /** POST /sessions — вход по нику и паролю. Ошибка одинакова для «нет ника» и «неверный пароль». */
    public function login(Request $req): Response
    {
        $db = Db::pdo();
        $b = $req->json();
        $handle = Handles::normalize((string) ($b['handle'] ?? ''));
        $pw = (string) ($b['password'] ?? '');
        if ($handle === '' || $pw === '' || strlen($pw) > 200) throw ApiException::badRequest('Введите ник и пароль', 'missing_field');
        // Подбор пароля: не больше 5 неудач на ник и 20 на адрес за 15 минут
        RateLimit::over($db, 'login:fail:h:' . $handle, 5, 900);
        RateLimit::over($db, 'login:fail:ip:' . $req->ip, 20, 900);
        $st = $db->prepare("SELECT * FROM users WHERE handle_lc = ? AND status = 'ACTIVE'");
        $st->execute([$handle]);
        $u = $st->fetch() ?: null;
        if (!Passwords::verify($pw, $u['password_hash'] ?? null)) {
            RateLimit::hit($db, 'login:fail:h:' . $handle, 1000, 900);
            RateLimit::hit($db, 'login:fail:ip:' . $req->ip, 1000, 900);
            throw new ApiException(401, 'bad_credentials', 'Неверный ник или пароль');
        }
        $token = Auth::createSession($db, $u['id'], $this->device($req));
        $db->prepare('UPDATE users SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$u['id']]);
        return Response::json(['user' => Auth::publicMe($u), 'token' => $token], 200, $this->cookie($token));
    }

    /** DELETE /sessions/current — выйти на этом устройстве. */
    public function logout(Request $req): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $db->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([$u['session_hash']]);
        return new Response(204, '', $this->cookie('', true));
    }

    /** DELETE /sessions — выйти на всех устройствах. */
    public function logoutAll(Request $req): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $db->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$u['id']]);
        return new Response(204, '', $this->cookie('', true));
    }

    /** GET /me/sessions — на каких устройствах выполнен вход. */
    public function sessions(Request $req): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $st = $db->prepare('SELECT token_hash, device, created_at, last_used_at FROM sessions WHERE user_id = ? ORDER BY last_used_at DESC');
        $st->execute([$u['id']]);
        $out = array_map(static fn ($r) => [
            'device' => $r['device'],
            'created_at' => gmdate('c', strtotime($r['created_at'] . ' UTC')),
            'last_used_at' => gmdate('c', strtotime($r['last_used_at'] . ' UTC')),
            'current' => hash_equals($u['session_hash'], $r['token_hash']),
        ], $st->fetchAll());
        return Response::json(['sessions' => $out]);
    }

    public function me(Request $req): Response
    {
        $u = Auth::require(Db::pdo(), $req);
        return Response::json(['user' => Auth::publicMe($u)]);
    }

    /** PATCH /me — имя, о себе, аватар-эмодзи, цвет. Ник меняется отдельно правилами 7/30 дней (этап позже). */
    public function updateMe(Request $req): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $b = $req->json();
        $name = array_key_exists('display_name', $b) ? ($this->str($b, 'display_name', 60) ?? '') : $u['display_name'];
        $bio = array_key_exists('bio', $b) ? ($this->str($b, 'bio', 200) ?? '') : $u['bio'];
        $avatar = array_key_exists('avatar', $b) ? $this->emoji($this->str($b, 'avatar', 16)) : $u['avatar_value'];
        $tint = array_key_exists('tint', $b) ? $this->tint($this->str($b, 'tint', 7)) : $u['tint'];
        $kind = array_key_exists('avatar', $b) ? 'emoji' : $u['avatar_kind'];
        $db->prepare('UPDATE users SET display_name=?, bio=?, avatar_kind=?, avatar_value=?, tint=?, updated_at=UTC_TIMESTAMP() WHERE id=?')
            ->execute([$name, $bio, $kind, $avatar, $tint, $u['id']]);
        $fresh = $db->prepare('SELECT * FROM users WHERE id = ?');
        $fresh->execute([$u['id']]);
        return Response::json(['user' => Auth::publicMe($fresh->fetch())]);
    }

    /** POST /me/password — смена пароля; остальные устройства выходят. */
    public function changePassword(Request $req): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        RateLimit::over($db, 'pw:fail:u:' . $u['id'], 5, 900);
        $b = $req->json();
        if (!Passwords::verify((string) ($b['current'] ?? ''), $u['password_hash'])) {
            RateLimit::hit($db, 'pw:fail:u:' . $u['id'], 1000, 900);
            throw new ApiException(403, 'bad_credentials', 'Текущий пароль неверный');
        }
        $new = (string) ($b['new'] ?? '');
        if ($err = Passwords::validate($new, $u['handle_lc'])) throw ApiException::badRequest($err, 'bad_password');
        $db->prepare('UPDATE users SET password_hash=?, password_changed_at=UTC_TIMESTAMP(), updated_at=UTC_TIMESTAMP() WHERE id=?')
            ->execute([Passwords::hash($new), $u['id']]);
        $db->prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?')->execute([$u['id'], $u['session_hash']]);
        return Response::json(['ok' => true]);
    }

    /** DELETE /me — удалить кабинет и все данные; нужен пароль. */
    public function deleteMe(Request $req): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        RateLimit::over($db, 'pw:fail:u:' . $u['id'], 5, 900);
        $b = $req->json();
        if (!Passwords::verify((string) ($b['password'] ?? ''), $u['password_hash'])) {
            RateLimit::hit($db, 'pw:fail:u:' . $u['id'], 1000, 900);
            throw new ApiException(403, 'bad_credentials', 'Пароль неверный');
        }
        $db->beginTransaction();
        try {
            $db->prepare('UPDATE events SET user_id = NULL WHERE user_id = ?')->execute([$u['id']]);
            $db->prepare('UPDATE events SET creator_id = NULL WHERE creator_id = ?')->execute([$u['id']]);
            $db->prepare('DELETE FROM users WHERE id = ?')->execute([$u['id']]); // подборки, места, сохранения, входы — каскадом
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
        return new Response(204, '', $this->cookie('', true));
    }
}
