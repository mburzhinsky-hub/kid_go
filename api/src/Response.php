<?php
declare(strict_types=1);

namespace Kg;

final class Response
{
    /** @param array<string,string> $headers */
    public function __construct(public readonly int $status, public readonly string $body, public readonly array $headers = []) {}

    /** @param array<string,string> $headers */
    public static function json(mixed $data, int $status = 200, array $headers = []): self
    {
        $body = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        return new self($status, $body, ['Content-Type' => 'application/json; charset=utf-8'] + $headers);
    }

    public static function error(ApiException $e): self
    {
        return self::json(['error' => ['code' => $e->errorCode, 'message' => $e->getMessage()]], $e->status, $e->headers);
    }

    public static function noContent(): self
    {
        return new self(204, '');
    }

    /** Заголовки безопасности для любого ответа API. Приватные данные не кэшируем. */
    public function send(): void
    {
        http_response_code($this->status);
        $h = $this->headers + [
            'Cache-Control' => 'no-store',
            'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'same-origin',
            'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
        ];
        foreach ($h as $k => $v) header("$k: $v");
        echo $this->body;
    }
}
