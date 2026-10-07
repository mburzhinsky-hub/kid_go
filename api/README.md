# Kids Go API (PHP 8.3 + MySQL 8.0)

Серверная часть личных кабинетов. Без Composer и фреймворков — работает на обычном виртуальном хостинге.

- `index.php` — входной файл, `src/` — код, `migrations/` — схема базы (SQL, по номерам), `tests/run.php` — проверки.
- Настройки: скопируйте `config.example.php` в `config.php` **на хостинге** и впишите пароль базы. В репозиторий `config.php` не попадает.
- Миграции: `php api/migrate.php` (консоль) или `POST /api/v1/admin/migrate` с токеном (его SHA-256 лежит в `config.php`).
- Проверки: `php api/tests/run.php` (без базы — только маршрутизация; с `KG_DB_NAME`, `KG_DB_USER`, … — полный набор). В CI это делает workflow `API`.
- Адреса: `/api/v1/…`. Формат ошибок: `{"error":{"code":"…","message":"…"}}`.

Как устроены кабинеты и этапы работ — `docs/cabinets-prompt.md`.
