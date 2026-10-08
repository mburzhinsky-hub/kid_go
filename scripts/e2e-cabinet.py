"""
Сквозной сценарий кабинета на мобильном вьюпорте (нужны сайт, собранный с NEXT_PUBLIC_ACCOUNTS=1, и API на том же адресе).
  python3 scripts/e2e-cabinet.py [http://127.0.0.1:8099]

Телефон A: создаёт кабинет → хотелка, «были», оценка → подборка → короткая ссылка.
Чужой браузер B (без кабинета): открывает ссылку; после перевода подборки в «приватную» и удаления кабинета — не открывает.
Телефон C: входит по нику и паролю и видит те же данные; выходит, и данные кабинета с устройства уходят.
Жалобы и модерация (нужен E2E_ADMIN_TOKEN — служебный токен, SHA-256 которого задан серверу в KG_ADMIN_TOKEN_SHA256):
друг жалуется кнопкой, ещё две жалобы с других устройств скрывают подборку, автор видит пояснение, модератор на /api/moderation.php
возвращает подборку и блокирует/разблокирует автора.
Всё это время в запросах к /api/ не должно быть ничего про детей и семью.
"""
import json
import os
import re
import sys
from playwright.sync_api import sync_playwright

B = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8099").rstrip("/")
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
NICK, PW = "mama_test", "Pa55-word-test"
ADMIN = os.environ.get("E2E_ADMIN_TOKEN", "")
fails, errors, api_bodies = [], [], []


def check(ok, msg):
    print(("  ✓ " if ok else "  ✗ ") + msg)
    if not ok:
        fails.append(msg)


def new_ctx(b, track=False):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA, permissions=["clipboard-read", "clipboard-write"])
    ctx.add_init_script("try{sessionStorage.setItem('kidgo-onb-shown','1')}catch(e){}")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    if track:
        pg.on("request", lambda r: api_bodies.append((r.method, r.url, r.post_data or "")) if "/api/" in r.url else None)
    return ctx, pg


def go(pg, path, wait=1500):
    pg.goto(B + path)
    pg.wait_for_load_state("domcontentloaded")
    pg.wait_for_timeout(wait)


def overflow(pg):
    return pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")


def token(pg):
    return pg.evaluate("localStorage.getItem('kidgo-token')")


def api(pg, method, path, body=None):
    return pg.evaluate(
        """async ([m, p, b, t]) => {
          const r = await fetch('/api/v1' + p, {method: m, headers: {'Content-Type': 'application/json', ...(t ? {Authorization: 'Bearer ' + t} : {})}, body: b ? JSON.stringify(b) : undefined});
          let j = null; try { j = await r.json(); } catch (e) {}
          return {status: r.status, json: j};
        }""",
        [method, path, body, token(pg)],
    )


def admin(ctx, method, path, token=None):
    r = ctx.request.fetch(
        B + "/api/v1/admin" + path,
        method=method,
        headers={"Authorization": "Bearer " + (token or ADMIN), "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.200"},
        data="{}" if method != "GET" else None,
    )
    try:
        return r.status, r.json()
    except Exception:
        return r.status, None


def report(ctx, cid, reason, ip, note=None):
    r = ctx.request.post(B + f"/api/v1/collections/{cid}/report", headers={"X-Forwarded-For": ip}, data={"reason": reason, **({"note": note} if note else {})})
    return r.status


with sync_playwright() as p:
    b = p.chromium.launch()

    # ───────── A: создание кабинета ─────────
    print("A1. Создание кабинета")
    ctxA, A = new_ctx(b, track=True)
    go(A, "/profile/")
    card = A.get_by_role("link", name=re.compile("Создать кабинет"))
    check(card.count() == 1, "в профиле есть карточка «Создать кабинет»")
    card.click()
    A.wait_for_timeout(1200)
    check(A.get_by_role("heading", name="Мой кабинет").count() == 1, "открылся экран кабинета (гость)")
    A.get_by_role("button", name="Создать кабинет").first.click()
    A.wait_for_timeout(500)
    dlg = A.get_by_role("dialog")
    check(dlg.count() == 1, "открылся шит регистрации")
    nick = dlg.get_by_label("Ник", exact=True)
    nick.fill("ab")
    A.wait_for_timeout(700)
    check(dlg.get_by_text("Минимум 3 символа").count() == 1, "короткий ник — подсказка")
    nick.fill(NICK)
    A.wait_for_timeout(1200)
    check(dlg.get_by_text("Ник свободен").count() == 1, "ник проверен на лету: свободен")
    dlg.get_by_label("Пароль", exact=True).fill("short")
    check(dlg.get_by_role("button", name="Создать кабинет").is_disabled(), "кнопка выключена: пароль короткий, нет согласия")
    dlg.get_by_label("Пароль", exact=True).fill(PW)
    check(dlg.get_by_text("восстановить забытый пароль нельзя").count() == 1, "предупреждение «пароль не восстановить»")
    dlg.get_by_role("checkbox").check()
    A.wait_for_timeout(1500)
    for el in dlg.locator("input").all():
        fs = el.evaluate("e => parseFloat(getComputedStyle(e).fontSize)")
        if el.get_attribute("type") in ("checkbox",) or el.get_attribute("name") == "website":
            continue
        check(fs >= 16, f"шрифт поля ≥16px ({fs})")
    dlg.get_by_role("button", name="Создать кабинет").click()
    A.wait_for_timeout(2500)
    check(A.get_by_text(f"@{NICK}").count() >= 1, "кабинет создан, виден ник")
    check(bool(token(A)), "токен входа сохранён")
    check(overflow(A) <= 0, f"кабинет без горизонтального скролла ({overflow(A)})")

    print("A2. Хотелка, «были», оценка — уезжают на сервер")
    go(A, "/@weekend-parents/rainy-day/")
    A.get_by_role("button", name="Хочу сюда").first.click()
    A.wait_for_timeout(500)
    A.get_by_role("button", name="Хочу сюда").first.click()
    A.wait_for_timeout(500)
    go(A, "/favorites/?tab=want")
    A.get_by_label("Уже были").first.click()
    A.wait_for_timeout(400)
    A.locator("button[aria-pressed]").filter(has_text=re.compile("^Уже были")).click()
    A.wait_for_timeout(500)
    A.get_by_label("Да", exact=True).first.click()
    A.wait_for_timeout(4500)
    docs = api(A, "GET", "/me/docs")
    d = docs["json"]["docs"] if docs["status"] == 200 else {}
    items = (d.get("intents", {}).get("body") or {}).get("items", {})
    check(len(items) >= 2, f"намерения на сервере: {len(items)}")
    check(any(v.get("status") == "VISITED" and v.get("feedback") == "LIKE" for v in items.values()), "«были» с оценкой «понравилось» на сервере")
    check(any(v.get("status") == "WANT_TO_GO" for v in items.values()), "«хочу сюда» на сервере")
    check("user_id" not in json.dumps(d) and "anonymous" not in json.dumps(d), "в документах нет id устройства и пользователя")

    print("A3. Подборка и короткая ссылка")
    go(A, "/collections/new/")
    A.get_by_placeholder(re.compile("Например: 10 мест")).fill("Дождливые выходные")
    A.get_by_role("button", name=re.compile("Дальше — места")).click()
    A.wait_for_timeout(500)
    A.get_by_text("Добавить места").first.click()
    A.wait_for_timeout(600)
    A.get_by_label("Поиск мест").fill("музей")
    A.wait_for_timeout(500)
    rows = A.locator("ul li button[aria-pressed]")
    for i in range(min(3, rows.count())):
        rows.nth(i).click()
        A.wait_for_timeout(150)
    A.get_by_role("button", name=re.compile("^Готово")).click()
    A.wait_for_timeout(500)
    A.get_by_role("button", name=re.compile("^Дальше")).click()
    A.wait_for_timeout(500)
    A.get_by_role("button", name=re.compile("Предпросмотр")).click()
    A.wait_for_timeout(1200)
    A.get_by_role("button", name="Опубликовать").click()
    A.wait_for_timeout(1500)
    check(A.get_by_text("Ник для ссылки").count() == 0, "кабинет есть — подпись автора не спрашивают")
    check(A.get_by_text("Подборка опубликована").count() > 0, "«Подборка опубликована»")
    A.get_by_role("button", name="Поделиться").first.click()
    A.wait_for_timeout(600)
    share = A.locator("input[readonly]").first.input_value()
    m = re.search(r"/c/([a-z0-9]{10})/", share)
    check(bool(m), f"короткая ссылка вида /c/<код>/: {share[:70]}")
    cid = m.group(1) if m else ""
    A.keyboard.press("Escape")
    A.wait_for_timeout(3000)
    mine = api(A, "GET", "/collections?mine=1")
    srv = [c for c in mine["json"]["collections"] if c["id"] == cid]
    check(len(srv) == 1 and srv[0]["status"] == "PUBLISHED" and len(srv[0]["items"]) == 3, "подборка на сервере: опубликована, 3 места")

    # ───────── B: чужой браузер ─────────
    print("B. Друг открывает ссылку без кабинета")
    ctxB, Bp = new_ctx(b)
    go(Bp, f"/c/{cid}/", 2500)
    check("Дождливые выходные" in Bp.inner_text("body"), "подборка открылась у друга по короткой ссылке")
    raw = ctxB.request.get(B + f"/c/{cid}/")
    html = raw.text()
    check(raw.status == 200 and f'og:title" content="Дождливые выходные"' in html, "мессенджер (без JavaScript) видит название подборки в og:title")
    check("og:image" in html and f"/c/{cid}/" in html and 'rel="canonical"' in html, "в разметке есть og:image и canonical")
    check("3 места" in html or "места для детей" in html or "Подборка от" in html, "в описании превью есть подпись автора")
    check('name="robots"' not in html, "публичная подборка не закрыта от поисковиков")
    check(Bp.get_by_role("button", name="Хочу сюда").count() >= 2, "у друга есть «Хочу сюда»")
    check(overflow(Bp) <= 0, f"страница подборки без горизонтального скролла ({overflow(Bp)})")
    r = api(A, "PUT", f"/collections/{cid}", {"visibility": "PRIVATE"})
    check(r["status"] == 200, "автор сделал подборку приватной")
    go(Bp, f"/c/{cid}/", 2500)
    check("Дождливые выходные" not in Bp.inner_text("body"), "приватная подборка у друга больше не открывается")
    check(ctxB.request.get(B + f"/c/{cid}/").status == 404, "приватная подборка: сервер отвечает 404")
    api(A, "PUT", f"/collections/{cid}", {"visibility": "UNLISTED"})

    # ───────── M: жалобы и модерация ─────────
    if ADMIN:
        print("M1. Друг жалуется кнопкой на странице подборки")
        go(A, f"/c/{cid}/", 2500)
        check(A.get_by_role("button", name="Пожаловаться на подборку").count() == 0, "у автора кнопки жалобы нет")
        go(Bp, f"/c/{cid}/", 2500)
        btn = Bp.get_by_role("button", name="Пожаловаться на подборку")
        check(btn.count() == 1, "у друга есть кнопка «Пожаловаться на подборку»")
        btn.click()
        Bp.wait_for_timeout(500)
        dlgR = Bp.get_by_role("dialog")
        send = dlgR.get_by_role("button", name="Отправить жалобу")
        check(send.is_disabled(), "«Отправить жалобу» выключена, пока не выбрана причина")
        dlgR.get_by_role("radio", name=re.compile("Спам или реклама")).click()
        note = dlgR.get_by_label(re.compile("Комментарий"))
        note.fill("Реклама в описании")
        check(note.evaluate("e => parseFloat(getComputedStyle(e).fontSize)") >= 16, "шрифт комментария ≥16px")
        check(overflow(Bp) <= 0, f"шит жалобы без горизонтального скролла ({overflow(Bp)})")
        check(send.is_enabled(), "причина выбрана — кнопка доступна")
        send.click()
        Bp.wait_for_timeout(1500)
        check(dlgR.get_by_text("Мы получили жалобу").count() == 1, "после отправки — «Спасибо» и пояснение")
        Bp.keyboard.press("Escape")
        st, q = admin(ctxB, "GET", "/reports")
        row = next((i for i in (q or {}).get("items", []) if i["collection"]["id"] == cid), None)
        check(st == 200 and row is not None and row["reports"]["count"] == 1 and row["reports"]["reasons"] == {"spam": 1}, "жалоба дошла до очереди модератора")
        check(row is not None and row["reports"]["notes"][0]["note"] == "Реклама в описании" and row["author"]["handle"] == NICK, "в очереди виден комментарий и автор")
        check(report(ctxB, cid, "spam", "203.0.113.200") == 200, "жалоба от гостя другим способом принимается")

        print("M2. Три жалобы от разных людей скрывают подборку")
        check(report(ctxB, cid, "inappropriate", "203.0.113.11") == 200, "жалоба 3 принята")
        mine = api(A, "GET", "/collections?mine=1")
        cur = [c for c in mine["json"]["collections"] if c["id"] == cid]
        check(len(cur) == 1 and cur[0]["status"] == "HIDDEN", "подборка скрыта автоматически")
        go(Bp, f"/c/{cid}/", 2500)
        check("Дождливые выходные" not in Bp.inner_text("body"), "друг больше не видит скрытую подборку")
        check(ctxB.request.get(B + f"/c/{cid}/").status == 404, "превью скрытой подборки: сервер отвечает 404")
        check(report(ctxB, cid, "spam", "203.0.113.12") == 404, "на скрытую подборку жаловаться уже нельзя")

        print("M3. Автор видит, что подборку скрыли")
        go(A, "/collections/", 3500)
        check(A.get_by_text("Скрыта модерацией").count() >= 1, "в «Моих подборках» — пометка «Скрыта модерацией»")
        go(A, f"/c/{cid}/", 3000)
        check(A.get_by_text("Подборку скрыли").count() == 1, "на странице подборки автору объяснили, что она скрыта")
        check("Дождливые выходные" in A.inner_text("body"), "автор по-прежнему видит свою подборку")

        print("M4. Страница модератора")
        ctxM, M = new_ctx(b)
        console = []
        M.on("console", lambda m: console.append(m.text) if m.type in ("error", "warning") else None)
        go(M, "/api/moderation.php", 1200)
        check("Модерация Kids Go" in M.inner_text("body"), "страница модератора открылась")
        check("null" not in M.inner_text("body") and "[object" not in M.inner_text("body"), "на странице входа нет «null» и «[object …]»")
        check(M.evaluate("document.querySelector('meta[name=robots]').content").startswith("noindex"), "страница закрыта от поисковиков")
        M.get_by_placeholder("Служебный токен").fill("wrong-token-wrong-token")
        M.get_by_role("button", name="Войти").click()
        M.wait_for_timeout(1000)
        check(M.get_by_text("Неверный токен").count() == 1, "неверный токен — понятная ошибка")
        M.get_by_placeholder("Служебный токен").fill(ADMIN)
        M.get_by_role("button", name="Войти").click()
        M.wait_for_timeout(1500)
        check(M.get_by_role("heading", name="Модерация", exact=True).count() == 1, "верный токен — открылась очередь")
        check(M.get_by_text("Дождливые выходные").count() == 1 and M.get_by_text("Скрыта автоматически").count() == 1, "в очереди скрытая подборка с пометкой «Скрыта автоматически»")
        check(M.get_by_text(re.compile("Жалоб: 3")).count() == 1, "видно число жалоб (3)")
        check("null" not in M.inner_text("body") and "[object" not in M.inner_text("body"), "в очереди нет «null» и «[object …]»")
        check(M.locator("li").count() == 3, "список мест подборки выведен (3 пункта)")
        check(M.get_by_text("Реклама в описании").count() == 1, "виден комментарий жалобщика")
        check(overflow(M) <= 0, f"страница модератора без горизонтального скролла ({overflow(M)})")
        M.get_by_role("button", name="Вернуть").click()
        M.wait_for_timeout(1500)
        check(M.get_by_text("Опубликована").count() == 1 and M.get_by_text("проверена").count() == 1, "подборка возвращена и помечена «проверена»")
        go(Bp, f"/c/{cid}/", 2500)
        check("Дождливые выходные" in Bp.inner_text("body"), "друг снова видит подборку")
        go(A, "/collections/", 3500)
        check(A.get_by_text("Скрыта модерацией").count() == 0, "у автора пометка «Скрыта» пропала")

        print("M5. Блокировка автора")
        reg = ctxB.request.post(B + "/api/v1/accounts", headers={"X-Forwarded-For": "203.0.113.77"}, data={"handle": "mod_victim", "password": PW, "display_name": "Нарушитель", "avatar": "🦊", "tint": "#FFE4F1", "consent": True})
        vt = reg.json()["token"]
        vc = ctxB.request.post(B + "/api/v1/collections", headers={"Authorization": "Bearer " + vt, "X-Forwarded-For": "203.0.113.77"}, data={"title": "Подборка нарушителя", "visibility": "PUBLIC", "publish": True, "items": [{"place_id": "moskovsky-zoopark"}]})
        vid = vc.json()["collection"]["id"]
        check(ctxB.request.get(B + f"/api/v1/collections/{vid}").status == 200, "подборка нарушителя видна всем")
        M.get_by_role("button", name="Найти", exact=True).first.click()
        M.wait_for_timeout(500)
        M.get_by_placeholder(re.compile("Ссылка на подборку")).fill(f"{B}/c/{vid}/")
        M.get_by_role("button", name="Найти", exact=True).last.click()
        M.wait_for_timeout(1200)
        check(M.get_by_text("Подборка нарушителя").count() >= 1, "поиск по ссылке находит подборку")
        M.once("dialog", lambda d: d.accept())
        M.get_by_role("button", name="Заблокировать автора").click()
        M.wait_for_timeout(1500)
        check(M.get_by_text(re.compile("заблокирован")).count() >= 1, "автор помечен как заблокированный")
        check(ctxB.request.get(B + f"/api/v1/collections/{vid}").status == 404, "подборки заблокированного автора не открываются")
        check(ctxB.request.post(B + "/api/v1/sessions", headers={"X-Forwarded-For": "203.0.113.78"}, data={"handle": "mod_victim", "password": PW}).status == 401, "заблокированный не может войти")
        M.get_by_role("button", name="Разблокировать автора").click()
        M.wait_for_timeout(1500)
        check(ctxB.request.get(B + f"/api/v1/collections/{vid}").status == 200, "после разблокировки подборка снова видна")
        check(ctxB.request.post(B + "/api/v1/sessions", headers={"X-Forwarded-For": "203.0.113.79"}, data={"handle": "mod_victim", "password": PW}).status == 200, "после разблокировки автор входит")
        check(not any("Content Security Policy" in t for t in console), "страница модератора не нарушает собственную политику безопасности (CSP)")
        ctxM.close()
    else:
        print("M. Жалобы и модерация: пропущено (нет E2E_ADMIN_TOKEN)")

    # ───────── C: второй телефон ─────────
    print("C. Вход на втором телефоне")
    ctxC, C = new_ctx(b)
    go(C, "/cabinet/")
    C.get_by_role("button", name="Войти").first.click()
    C.wait_for_timeout(500)
    dc = C.get_by_role("dialog")
    dc.get_by_label("Ник", exact=True).fill(NICK)
    dc.get_by_label("Пароль", exact=True).fill("wrong-password-1")
    dc.get_by_role("button", name="Войти").click()
    C.wait_for_timeout(1500)
    check(dc.get_by_role("alert").count() == 1, "неверный пароль — понятная ошибка")
    dc.get_by_label("Пароль", exact=True).fill(PW)
    dc.get_by_role("button", name="Войти").click()
    C.wait_for_timeout(4500)
    check(C.get_by_text(f"@{NICK}").count() >= 1, "вошли на втором телефоне")
    body = C.inner_text("body")
    check(re.search(r"Уже были\s*\n?\s*|Уже были", body) is not None, "в кабинете видны плитки")
    go(C, "/favorites/?tab=visited", 2500)
    check(C.get_by_text("были ✓").count() >= 1, "«Уже были» приехали на второй телефон")
    check(C.get_by_label("Да", exact=True).first.get_attribute("aria-pressed") == "true", "оценка «Да» приехала")
    go(C, "/collections/", 2500)
    check("Дождливые выходные" in C.inner_text("body"), "подборка приехала на второй телефон")

    print("C2. Выход очищает устройство")
    go(C, "/cabinet/", 1500)
    C.get_by_role("button", name="Выйти").click()
    C.wait_for_timeout(2500)
    check(C.get_by_text("Создать кабинет").count() >= 1, "после выхода снова гость")
    check(C.evaluate("JSON.parse(localStorage.getItem('kidgo-family')||'{}').state?.wantPlaces?.length||0") == 0, "хотелки с устройства убраны")
    check(not token(C), "токен удалён")
    r = api(A, "GET", "/me")
    check(r["status"] == 200, "телефон A остался в кабинете")

    # ───────── удаление ─────────
    print("A4. Удаление кабинета")
    go(A, "/cabinet/")
    A.get_by_role("button", name="Удалить кабинет").click()
    A.wait_for_timeout(500)
    da = A.get_by_role("dialog")
    da.get_by_label("Введите пароль для подтверждения").fill(PW)
    da.get_by_role("button", name="Удалить навсегда").click()
    A.wait_for_timeout(3000)
    check(A.get_by_text("Создать кабинет").count() >= 1, "кабинет удалён, снова гость")
    go(Bp, f"/c/?id={cid}", 2500)
    check("Дождливые выходные" not in Bp.inner_text("body"), "ссылка на подборку после удаления кабинета не открывается")

    # ───────── приватность ─────────
    print("Приватность запросов")
    blob = " ".join(f"{m} {u} {d}" for m, u, d in api_bodies).lower()
    check(len(api_bodies) > 5, f"запросов к API перехвачено: {len(api_bodies)}")
    for w in ("child", "children", "family", "birth", "kids"):
        check(w not in blob, f"в запросах нет «{w}»")
    check(not errors, "ошибок страницы нет" if not errors else "; ".join(errors[:3]))
    b.close()

print("\n" + ("ВСЁ ЗЕЛЁНОЕ" if not fails else f"ПРОВАЛЕНО: {len(fails)}"))
sys.exit(1 if fails else 0)
