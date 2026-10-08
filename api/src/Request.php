<?php
declare(strict_types=1);

namespace Kg;

final class Request
{
    public const MAX_BODY = 1_048_576; // 1 МБ для JSON; загрузки фото обрабатываются отдельно

    /** @param array<string,string> $query @param array<string,string> $headers */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query = [],
        public readonly array $headers = [],
        private readonly string $rawBody = '',
        public readonly string $ip = '0.0.0.0',
    ) {}

    public static function fromGlobals(): self
    {
        $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
        $path = rawurldecode((string) parse_url($uri, PHP_URL_PATH));
        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (strncmp($k, 'HTTP_', 5) === 0) $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string) $v;
        }
        if (isset($_SERVER['CONTENT_TYPE'])) $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) && !isset($headers['authorization'])) {
            $headers['authorization'] = (string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        $len = (int) ($headers['content-length'] ?? 0);
        if ($len > self::MAX_BODY) throw ApiException::tooLarge();
        $raw = (string) file_get_contents('php://input', false, null, 0, self::MAX_BODY + 1);
        if (strlen($raw) > self::MAX_BODY) throw ApiException::tooLarge();
        /** @var array<string,string> $q */
        $q = array_map(static fn ($v) => is_scalar($v) ? (string) $v : '', $_GET);
        return new self(strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')), $path, $q, $headers, $raw, self::clientIp());
    }

    /** Реальный адрес клиента. За прокси хостинга он приходит в X-Real-IP / X-Forwarded-For (первый адрес). */
    private static function clientIp(): string
    {
        $cands = [$_SERVER['HTTP_X_REAL_IP'] ?? '', explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0], $_SERVER['REMOTE_ADDR'] ?? ''];
        foreach ($cands as $c) {
            $c = trim((string) $c);
            if ($c !== '' && filter_var($c, FILTER_VALIDATE_IP)) return $c;
        }
        return '0.0.0.0';
    }

    public function header(string $name): ?string
    {
        return $this->headers[strtolower($name)] ?? null;
    }

    /** Секретный ключ кабинета: из заголовка Authorization: Bearer … или из cookie kg_session. */
    public function bearerKey(): ?string
    {
        $h = $this->header('authorization');
        if ($h !== null && preg_match('/^Bearer\s+([A-Za-z0-9_-]{20,128})$/', $h, $m)) return $m[1];
        $c = $_COOKIE['kg_session'] ?? null;
        if (is_string($c) && preg_match('/^[A-Za-z0-9_-]{20,128}$/', $c)) return $c;
        return null;
    }

    /** @return array<string,mixed> */
    public function json(): array
    {
        if ($this->rawBody === '') return [];
        $ct = strtolower((string) $this->header('content-type'));
        if (!str_contains($ct, 'application/json')) throw ApiException::badRequest('Ожидается JSON', 'bad_content_type');
        try {
            $data = json_decode($this->rawBody, true, 16, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw ApiException::badRequest('Не удалось разобрать JSON', 'bad_json');
        }
        if (!is_array($data)) throw ApiException::badRequest('Ожидался объект JSON', 'bad_json');
        return $data;
    }

    /**
     * Тело запроса как JSON «как есть»: объекты остаются объектами (stdClass), поэтому пустой {} не превращается в [].
     * Нужно там, где сервер хранит чужой JSON и не должен менять его форму. Глубина до $depth.
     */
    public function jsonValue(int $depth = 32): mixed
    {
        if ($this->rawBody === '') throw ApiException::badRequest('Пустое тело запроса', 'bad_json');
        $ct = strtolower((string) $this->header('content-type'));
        if (!str_contains($ct, 'application/json')) throw ApiException::badRequest('Ожидается JSON', 'bad_content_type');
        try {
            return json_decode($this->rawBody, false, $depth, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw ApiException::badRequest('Не удалось разобрать JSON', 'bad_json');
        }
    }
}
