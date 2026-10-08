<?php
declare(strict_types=1);

namespace Kg\Controllers;

use Kg\ApiException;
use Kg\Auth;
use Kg\Db;
use Kg\RateLimit;
use Kg\Request;
use Kg\Response;
use Kg\Text;
use PDO;
use PDOException;
use stdClass;

/**
 * Облачная копия локального состояния: документы intents, trips, plans, saves, follows, prefs.
 * Сервер ничего не разбирает внутри тела, кроме одного: ключи про детей и семью не принимаются.
 * Запись — «оптимистичная»: клиент присылает версию, на которой основан, и при расхождении получает 409 с актуальным документом.
 */
final class DocsController
{
    public const NAMES = ['intents', 'trips', 'plans', 'saves', 'follows', 'prefs'];
    public const MAX_BYTES = 262144; // 256 КБ после кодирования
    private const WRITES_PER_MINUTE = 120;
    /** Ключи, которых на сервере быть не должно (сравнение без учёта регистра). */
    private const FORBIDDEN_KEYS = ['children', 'child', 'family', 'kids', 'childname', 'child_name', 'birthday'];

    /** GET /me/docs — все существующие документы кабинета. */
    public function index(Request $req): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $st = $db->prepare('SELECT name, version, body, updated_at FROM user_docs WHERE user_id = ?');
        $st->execute([$u['id']]);
        $rows = [];
        foreach ($st->fetchAll() as $r) $rows[$r['name']] = $r;
        $docs = new stdClass(); // объект, чтобы пустой результат был {} а не []
        foreach (self::NAMES as $name) {
            if (!isset($rows[$name])) continue;
            $r = $rows[$name];
            $docs->$name = [
                'version' => (int) $r['version'],
                'body' => json_decode((string) $r['body'], false),
                'updated_at' => Text::iso($r['updated_at']),
            ];
        }
        return Response::json(['docs' => $docs]);
    }

    /** PUT /me/docs/:name — {"base_version":N,"body":…}; N должен совпасть с текущей версией (для нового документа — 0). */
    public function put(Request $req, array $params): Response
    {
        $db = Db::pdo();
        $u = Auth::require($db, $req);
        $name = (string) ($params['name'] ?? '');
        if (!in_array($name, self::NAMES, true)) {
            throw ApiException::notFound('Такого документа нет. Доступны: ' . implode(', ', self::NAMES));
        }
        try {
            RateLimit::hit($db, 'docs:put:' . $u['id'], self::WRITES_PER_MINUTE, 60);
        } catch (ApiException $e) {
            throw new ApiException(429, 'rate_limited', 'Слишком много сохранений. Подождите минуту.', $e->headers);
        }

        try {
            $in = $req->jsonValue(32);
        } catch (ApiException $e) {
            if ($e->errorCode !== 'bad_json') throw $e;
            throw ApiException::unprocessable($e->getMessage(), 'bad_json');
        }
        if (!$in instanceof stdClass) throw ApiException::unprocessable('Ожидался объект {"base_version":…, "body":…}', 'bad_json');
        $base = $in->base_version ?? null;
        if (!is_int($base) || $base < 0) {
            throw ApiException::unprocessable('base_version — целое число от 0 (для нового документа — 0)', 'bad_base_version');
        }
        if (!property_exists($in, 'body')) throw ApiException::unprocessable('Не заполнено поле: body', 'missing_field');
        $body = $in->body;
        if (!is_array($body) && !$body instanceof stdClass) {
            throw ApiException::unprocessable('body — это JSON-объект или массив', 'bad_body');
        }
        $json = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (strlen($json) > self::MAX_BYTES) throw ApiException::tooLarge('Документ слишком большой: не больше 256 КБ');
        $bad = self::forbiddenKey($body);
        if ($bad !== null) {
            throw ApiException::unprocessable("Данные о детях и семье не хранятся на сервере: уберите поле «{$bad}»", 'children_forbidden');
        }

        $nowSql = gmdate('Y-m-d H:i:s');
        if ($base === 0) {
            try {
                $db->prepare('INSERT INTO user_docs (user_id, name, version, body, updated_at) VALUES (?,?,1,?,?)')
                    ->execute([$u['id'], $name, $json, $nowSql]);
            } catch (PDOException $e) {
                if ($e->getCode() === '23000') return $this->conflict($db, $u['id'], $name); // документ уже есть (или гонка двух запросов)
                throw $e;
            }
            $version = 1;
        } else {
            // version всегда меняется, поэтому rowCount() надёжен и без MYSQL_ATTR_FOUND_ROWS
            $st = $db->prepare('UPDATE user_docs SET body = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND name = ? AND version = ?');
            $st->execute([$json, $nowSql, $u['id'], $name, $base]);
            if ($st->rowCount() !== 1) return $this->conflict($db, $u['id'], $name);
            $version = $base + 1;
        }
        return Response::json(['version' => $version, 'updated_at' => Text::iso($nowSql)]);
    }

    /** 409: версия не совпала. В ответе — актуальный документ, чтобы клиент мог объединить изменения. */
    private function conflict(PDO $db, string $userId, string $name): Response
    {
        $st = $db->prepare('SELECT version, body FROM user_docs WHERE user_id = ? AND name = ?');
        $st->execute([$userId, $name]);
        $cur = $st->fetch();
        return Response::json([
            'error' => [
                'code' => 'conflict',
                'message' => 'Документ уже изменён на другом устройстве. Загрузите свежую версию, объедините изменения и сохраните ещё раз.',
            ],
            'current' => [
                'version' => $cur ? (int) $cur['version'] : 0,
                'body' => $cur ? json_decode((string) $cur['body'], false) : null,
            ],
        ], 409);
    }

    /** Первый найденный на любой глубине ключ из чёрного списка или null. */
    private static function forbiddenKey(mixed $v): ?string
    {
        if (is_array($v)) {
            foreach ($v as $x) {
                $k = self::forbiddenKey($x);
                if ($k !== null) return $k;
            }
        } elseif ($v instanceof stdClass) {
            foreach (get_object_vars($v) as $key => $x) {
                if (in_array(strtolower(trim((string) $key)), self::FORBIDDEN_KEYS, true)) return (string) $key;
                $k = self::forbiddenKey($x);
                if ($k !== null) return $k;
            }
        }
        return null;
    }
}
