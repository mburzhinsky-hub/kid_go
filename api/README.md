# Kids Go API (PHP 8.3 + MySQL 8.0)

Серверная часть личных кабинетов. Без Composer и фреймворков — работает на обычном виртуальном хостинге.

- `index.php` — входной файл, `src/` — код, `migrations/` — схема базы (SQL, по номерам), `tests/run.php` — проверки.
- Настройки: скопируйте `config.example.php` в `config.php` **на хостинге** и впишите пароль базы. В репозиторий `config.php` не попадает.
- Миграции: `php api/migrate.php` (консоль) или `POST /api/v1/admin/migrate` с токеном (его SHA-256 лежит в `config.php`).
- Проверки: `php api/tests/run.php` (без базы — только маршрутизация и чистые функции; с `KG_DB_NAME`, `KG_DB_USER`, … — полный набор, включая `tests/auth.php` и `tests/collections.php`). В CI это делает workflow `API`.
- Адреса: `/api/v1/…`. Формат ошибок: `{"error":{"code":"…","message":"…"}}`, сообщения по-русски.
- Список допустимых мест — необязательный файл `data/places.json` (массив slug). Он есть — подборки принимают только эти места; нет — проверяется только формат `^[a-z0-9][a-z0-9-]{0,79}$`.

Как устроены кабинеты и этапы работ — `docs/cabinets-prompt.md`.

## Эндпоинты

«Токен» — `Authorization: Bearer …` или cookie `kg_session`. Ошибки проверки полей — `422`, лимиты — `429` с `Retry-After`.

| Метод и путь | Доступ | Что делает |
|---|---|---|
| `GET /health` (`?deep=1` — с проверкой базы) | открыто | жив ли сервис |
| `POST /admin/migrate` | служебный токен | применить миграции |
| `GET /handles/check?h=` | открыто | свободен ли ник |
| `POST /accounts` | открыто | создать кабинет → профиль и токен |
| `POST /sessions` · `DELETE /sessions/current` · `DELETE /sessions` | вход · токен | вход по нику и паролю · выход здесь · выход на всех устройствах |
| `GET /me` · `PATCH /me` · `DELETE /me` | токен | профиль · правка · удаление кабинета со всеми данными (подборки и документы уходят каскадом) |
| `GET /me/sessions` · `POST /me/password` | токен | устройства · смена пароля |
| `GET /me/docs` | токен | все документы синхронизации кабинета: `{"docs":{"intents":{"version":3,"body":{…},"updated_at":"…Z"}}}` (только существующие) |
| `PUT /me/docs/{name}` | токен | записать документ: `{"base_version":N,"body":<объект или массив>}` → `200 {"version":N+1,"updated_at":"…Z"}` |
| `GET /collections?mine=1` | токен | все мои подборки (любой вид), свежие сверху: `{"collections":[…]}` |
| `GET /collections?public=1&limit=24&cursor=` | открыто | публичный каталог (PUBLIC + PUBLISHED, по `published_at` убыв.): `{"collections":[…],"next":"…"\|null}` |
| `POST /collections` | токен | создать подборку → `201 {"collection":{…},"author":{…}}` |
| `GET /collections/{id}` | открыто | подборка: `{"collection":{…},"author":{…},"mine":bool}` |
| `PUT /collections/{id}` | владелец | частичное обновление + `publish: true/false` → `200 {"collection":{…},"author":{…}}` |
| `DELETE /collections/{id}` | владелец | удалить → `204` |
| `GET /authors/{handle}` | открыто | `{"author":{id,name,username,avatar,tint,bio?},"collections":[публичные]}` |

### Документы синхронизации (`user_docs`)

Простая облачная копия локального состояния. Имена: `intents`, `trips`, `plans`, `saves`, `follows`, `prefs` (другое имя — `404`). Тело — любой JSON-объект или массив до 256 КБ после кодирования (больше — `413`, не объект/массив или битый JSON — `422`). Сервер ничего не разбирает внутри тела, кроме одного: на любой глубине отклоняются (`422`, код `children_forbidden`) ключи `children`, `child`, `family`, `kids`, `childName`, `child_name`, `birthday` (без учёта регистра) — данные детей и семьи на сервер не попадают.

Запись оптимистичная: `base_version` должен совпасть с текущей версией (для нового документа — `0`), иначе `409`:

```json
{"error":{"code":"conflict","message":"…"},"current":{"version":3,"body":{…}}}
```

Если документа нет, а `base_version` не 0, в `current` будет `{"version":0,"body":null}`. Версия растёт на 1 при каждой записи (даже если тело то же). Лимит — 120 записей в минуту на пользователя.

### Подборки (`collections`)

Подборка в ответах: `id` (10 случайных символов `[a-z0-9]`), `user_id`, `title`, `slug`, `description`, `cover` (`{"kind":"place","slug":"…"}` или `{"kind":"collage"}`), `city`, `visibility` (`PRIVATE`/`UNLISTED`/`PUBLIC`), `status` (`DRAFT`/`PUBLISHED`/`HIDDEN`), `age_min`, `age_max`, `created_at`, `updated_at`, `published_at` (только у опубликованных), `items` (`{id,collection_id,place_id,position,creator_note?}`). Автор — `{id,name,username,avatar,tint}`; без имени вместо `name` отдаётся ник. В списках (`mine`, каталог, `authors`) автор лежит внутри каждой подборки как `author`.

Правила:

- Видят: владелец — свою в любом виде; остальные — только `UNLISTED`/`PUBLIC` в статусе `PUBLISHED`, иначе `404`. Чужая и несуществующая подборка при `PUT`/`DELETE` тоже `404`.
- `GET /collections/{id}`: владельцу `Cache-Control: no-store`, остальным `public, max-age=60`.
- Создание: `title` 1–100 символов (обязателен), `description` ≤ 600, `items` до 30 мест (`place_id` по маске выше, заметка `creator_note` ≤ 240; повторы убираются, места не из `data/places.json` отбрасываются), `age_min`/`age_max` 0–18 и `age_min ≤ age_max` (по умолчанию 0–12), `visibility` по умолчанию `PRIVATE`, `city` по умолчанию «Москва». Строки обрезаются по краям, управляющие символы удаляются (перевод строки становится пробелом).
- `publish: true` — статус `PUBLISHED`, `published_at` = сейчас; нужно хотя бы одно место, иначе `422`. `publish: false` возвращает в `DRAFT`. Подборку, скрытую модерацией (`HIDDEN`), владелец опубликовать не может — `403`.
- `slug` — транслитерация названия (`Парки Москвы` → `parki-moskvy`), уникален в пределах кабинета (`-2`, `-3`…), если пусто — `podborka`; пересчитывается при смене названия только пока подборка `DRAFT`.
- Лимиты: не больше 50 подборок на кабинет (`409`, код `limit_reached`), не больше 10 созданий в сутки (`429`).
- Каталог: `limit` 1–50 (по умолчанию 24), `cursor` — непрозрачная строка из поля `next` предыдущего ответа; подборки заблокированных авторов не показываются.
- Жалобы, статистика, модерация и сохранение чужих подборок на сервере (это документ `saves`) пока не реализованы.
