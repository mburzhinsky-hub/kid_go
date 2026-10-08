"""
Сквозной сценарий кабинета на мобильном вьюпорте (нужны сайт, собранный с NEXT_PUBLIC_ACCOUNTS=1, и API на том же адресе).
  python3 scripts/e2e-cabinet.py [http://127.0.0.1:8099]

Телефон A: создаёт кабинет → хотелка, «были», оценка → подборка → короткая ссылка.
Чужой браузер B (без кабинета): открывает ссылку; после перевода подборки в «приватную» и удаления кабинета — не открывает.
Телефон C: входит по нику и паролю и видит те же данные; выходит, и данные кабинета с устройства уходят.
Всё это время в запросах к /api/ не должно быть ничего про детей и семью.
"""
import json
import re
import sys
from playwright.sync_api import sync_playwright

B = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8099").rstrip("/")
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
NICK, PW = "mama_test", "Pa55-word-test"
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
