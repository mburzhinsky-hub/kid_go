<?php
declare(strict_types=1);

namespace Kg;

/** Минимальный маршрутизатор: /collections/:id → параметры попадают в обработчик. */
final class Router
{
    /** @var list<array{string,string,callable}> */
    private array $routes = [];

    public function add(string $method, string $pattern, callable $handler): void
    {
        $this->routes[] = [strtoupper($method), $pattern, $handler];
    }

    public function dispatch(Request $req): Response
    {
        try {
            $path = $this->normalize($req->path);
            if ($path === null) throw ApiException::notFound('Такого адреса нет');
            $allowed = [];
            foreach ($this->routes as [$method, $pattern, $handler]) {
                $params = $this->match($pattern, $path);
                if ($params === null) continue;
                if ($method !== $req->method) {
                    $allowed[] = $method;
                    continue;
                }
                $res = $handler($req, $params);
                return $res instanceof Response ? $res : Response::json($res);
            }
            if ($allowed) {
                throw new ApiException(405, 'method_not_allowed', 'Метод не поддерживается', ['Allow' => implode(', ', array_unique($allowed))]);
            }
            throw ApiException::notFound('Такого адреса нет');
        } catch (ApiException $e) {
            return Response::error($e);
        } catch (\Throwable $e) {
            // Подробности — только в лог сервера, пользователю — общее сообщение
            error_log('[kidsgo-api] ' . get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            $msg = Config::isProduction() ? 'Что-то пошло не так. Попробуйте ещё раз.' : ('Ошибка: ' . $e->getMessage());
            return Response::error(new ApiException(500, 'server_error', $msg));
        }
    }

    /** Оставляем часть после /api/v1; всё остальное — не наш адрес. */
    private function normalize(string $path): ?string
    {
        if (preg_match('#^(?:/api)?/v1(/.*)?$#', $path, $m)) return rtrim($m[1] ?? '/', '/') ?: '/';
        return null;
    }

    /** @return array<string,string>|null */
    private function match(string $pattern, string $path): ?array
    {
        $re = preg_replace('#:([a-z_]+)#', '(?P<$1>[^/]+)', $pattern);
        if (!preg_match('#^' . $re . '$#', $path, $m)) return null;
        return array_filter($m, static fn ($k) => is_string($k), ARRAY_FILTER_USE_KEY);
    }
}
