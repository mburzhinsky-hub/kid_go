<?php
declare(strict_types=1);

namespace Kg;

/** Ошибка, которую безопасно показать пользователю: код, понятное сообщение по-русски, HTTP-статус. */
final class ApiException extends \RuntimeException
{
    /** @param array<string,string> $headers */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $headers = [],
    ) {
        parent::__construct($message);
    }

    public static function badRequest(string $msg, string $code = 'bad_request'): self { return new self(400, $code, $msg); }
    public static function unauthorized(string $msg = 'Нужен вход в кабинет'): self { return new self(401, 'unauthorized', $msg); }
    public static function forbidden(string $msg = 'Нет доступа'): self { return new self(403, 'forbidden', $msg); }
    public static function notFound(string $msg = 'Не найдено'): self { return new self(404, 'not_found', $msg); }
    public static function conflict(string $msg, string $code = 'conflict'): self { return new self(409, $code, $msg); }
    public static function tooLarge(string $msg = 'Слишком большой запрос'): self { return new self(413, 'too_large', $msg); }
    public static function tooMany(int $retryAfter): self
    {
        return new self(429, 'rate_limited', 'Слишком часто. Попробуйте чуть позже.', ['Retry-After' => (string) max(1, $retryAfter)]);
    }
}
