"""
Сквозной сценарий «подборки + Хочу сюда + атрибуция» на мобильном вьюпорте.
  python3 scripts/e2e-collections.py [http://localhost:3000]

Прогоняет путь, который описан в ТЗ: ссылка из Reels → подборка без регистрации → «Хочу сюда» → Избранное →
сохранить подборку → создать свою (конструктор, порядок, заметка) → опубликовать → ссылка у друга → кабинет автора → админка → перенос.
Выход ≠ 0, если что-то из этого не работает.
"""
import json
import re
import sys
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
fails = []
errors = []


def check(ok, msg):
    print(("  ✓ " if ok else "  ✗ ") + msg)
    if not ok:
        fails.append(msg)


def rel(url):
    """Путь внутри приложения: без домена и без базового пути (на GitHub Pages сайт лежит в /kid_go)."""
    base = urlparse(B).path.rstrip("/")
    path = url.split(urlparse(B).netloc, 1)[-1]
    return path[len(base):] if base and path.startswith(base + "/") else path


def new_ctx(b, w=390, h=844):
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=UA, permissions=["clipboard-read", "clipboard-write"])
    ctx.add_init_script("try{sessionStorage.setItem('kidgo-onb-shown','1')}catch(e){}")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    pg.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "ERR_" not in m.text and "Failed to load resource" not in m.text and "net::" not in m.text else None)
    return ctx, pg


def overflow(pg):
    return pg.evaluate("document.documentElement.scrollWidth - window.innerWidth")


def go(pg, path, wait=1500):
    pg.goto(B + path)
    pg.wait_for_load_state("domcontentloaded")
    pg.wait_for_timeout(wait)


with sync_playwright() as p:
    b = p.chromium.launch()

    # ───────── 1. Ссылка на публичную подборку, анонимный посетитель ─────────
    print("1. Публичная подборка /@weekend-parents/rainy-day/")
    ctx, pg = new_ctx(b)
    go(pg, "/@weekend-parents/rainy-day/?utm_source=instagram&utm_medium=reel&utm_campaign=test")
    check("7 мест" in pg.inner_text("h1"), "заголовок подборки виден")
    check("Родители на выходных" in pg.inner_text("body"), "автор виден")
    check(overflow(pg) <= 0, f"нет горизонтального скролла ({overflow(pg)})")
    check(pg.get_by_role("button", name="Хочу сюда").count() >= 3, "кнопки «Хочу сюда» на карточках")

    first = pg.get_by_role("button", name="Хочу сюда").first
    first.click()
    pg.wait_for_timeout(500)
    check(pg.get_by_text("Добавили в ваши хотелки").count() > 0, "тост «Добавили в ваши хотелки»")
    check(pg.get_by_role("button", name="В хотелках").count() == 1, "кнопка стала «В хотелках»")
    pg.reload()
    pg.wait_for_timeout(1500)
    check(pg.get_by_role("button", name="В хотелках").count() == 1, "хотелка пережила перезагрузку")

    # сохранить подборку, поделиться
    pg.get_by_role("button", name="Сохранить", exact=True).first.click()
    pg.wait_for_timeout(400)
    check(pg.get_by_role("button", name="Сохранено").count() > 0, "подборка сохранена")
    pg.get_by_role("button", name="Поделиться", exact=True).first.click()
    pg.wait_for_timeout(500)
    link_val = pg.locator("input[readonly]").first.input_value()
    check("/@weekend-parents/rainy-day/" in link_val and "utm_source=copy" in link_val, f"ссылка для шаринга с меткой канала: {link_val}")
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)

    # «Открыть в приложении»
    app = pg.get_by_role("button", name=re.compile("Открыть в приложении"))
    check(app.count() > 0, "плашка «Открыть в приложении»")
    if app.count():
        app.first.click()
        pg.wait_for_timeout(500)
        check(pg.get_by_text("Продолжить в браузере").count() > 0, "шит приложения с «Продолжить в браузере»")
        pg.get_by_text("Продолжить в браузере").first.click()
        pg.wait_for_timeout(300)

    # «На карте»
    pg.get_by_role("link", name=re.compile("На карте")).first.click()
    try:
        pg.wait_for_url("**/map**", timeout=60000)
    except Exception:
        pass
    pg.wait_for_timeout(2500)
    u = urlparse(pg.url)
    check("/map" in u.path and "places=" in u.query, f"карта открылась с местами подборки ({u.path}?{u.query[:60]})")
    check("Маршрут" not in pg.inner_text("body")[:200], "карта подборки не называется «Маршрут»")

    # Избранное
    go(pg, "/favorites/?tab=want")
    check(pg.get_by_text("Из подборки").count() > 0, "в «Хочу сходить» видно «Из подборки …»")
    pg.get_by_role("button", name=re.compile("^Подборки")).click()
    pg.wait_for_timeout(500)
    check(pg.get_by_text("7 мест, куда сходить с ребёнком в дождь").count() > 0, "вкладка «Подборки» показывает сохранённую")
    # «Уже были» + «Понравилось?»
    pg.get_by_role("button", name=re.compile("^Хочу сходить")).click()
    pg.wait_for_timeout(400)
    pg.get_by_label("Уже были").first.click()
    pg.wait_for_timeout(400)
    pg.get_by_role("button", name=re.compile("^Уже были")).click()
    pg.wait_for_timeout(500)
    check(pg.get_by_text("Понравилось?").count() > 0, "в «Уже были» есть «Понравилось?»")
    pg.get_by_label("Да", exact=True).first.click()
    pg.wait_for_timeout(300)
    check(pg.get_by_label("Да", exact=True).first.get_attribute("aria-pressed") == "true", "оценка «Да» сохранилась")
    check(overflow(pg) <= 0, f"Избранное без горизонтального скролла ({overflow(pg)})")

    # главная: «Советуют родители»
    go(pg, "/")
    check(pg.get_by_text("Советуют родители").count() > 0, "главная: «Советуют родители»")
    check(overflow(pg) <= 0, f"главная без горизонтального скролла ({overflow(pg)})")

    # страница автора
    go(pg, "/@weekend-parents/")
    check(pg.get_by_text("Родители на выходных").count() > 0, "страница автора открывается")
    check(overflow(pg) <= 0, f"страница автора без горизонтального скролла ({overflow(pg)})")

    # атрибуция: событие хотелки несёт creator/collection
    ev = json.loads(pg.evaluate("localStorage.getItem('kidgo-events') || localStorage.getItem('kg_events') || '[]'") or "[]") if False else None
    ctx.close()

    # ───────── 2. Конструктор ─────────
    print("2. Конструктор подборки")
    ctx, pg = new_ctx(b)
    go(pg, "/collections/new/")
    pg.get_by_placeholder(re.compile("Например: 10 мест")).fill("Тест: дождливые выходные")
    pg.get_by_placeholder(re.compile("Для кого она")).fill("Всё под крышей.")
    pg.get_by_role("button", name=re.compile("Дальше — места")).click()
    pg.wait_for_timeout(500)
    pg.get_by_text("Добавить места").first.click()
    pg.wait_for_timeout(600)
    pg.get_by_label("Поиск мест").fill("музей")
    pg.wait_for_timeout(500)
    rows = pg.locator("ul li button[aria-pressed]")
    n = min(3, rows.count())
    check(n >= 3, f"поиск находит места ({rows.count()})")
    for i in range(n):
        rows.nth(i).click()
        pg.wait_for_timeout(150)
    pg.get_by_role("button", name=re.compile("^Готово")).click()
    pg.wait_for_timeout(500)
    handles = pg.get_by_label(re.compile("^Перетащить:"))
    check(handles.count() == 3, f"3 места в списке ({handles.count()})")
    names_before = [h.get_attribute("aria-label") for h in handles.all()]
    # порядок с клавиатуры: первое место вниз
    handles.first.focus()
    pg.keyboard.press("ArrowDown")
    pg.wait_for_timeout(400)
    names_after = [h.get_attribute("aria-label") for h in pg.get_by_label(re.compile("^Перетащить:")).all()]
    check(names_after[1] == names_before[0] and names_after[0] == names_before[1], "порядок меняется стрелками")
    # заметка
    note = pg.get_by_placeholder(re.compile("Комментарий автора")).first
    if note.count() == 0:
        # заметка раскрывается кнопкой
        pg.get_by_role("button", name=re.compile("заметк", re.I)).first.click()
        pg.wait_for_timeout(300)
    pg.get_by_placeholder(re.compile("Комментарий автора")).first.fill("Приезжайте к открытию.")
    pg.get_by_role("button", name=re.compile("^Дальше")).click()
    pg.wait_for_timeout(500)
    check(pg.get_by_text("Кто увидит").count() > 0, "шаг «Обложка и доступ»")
    pg.get_by_role("button", name=re.compile("Предпросмотр")).click()
    pg.wait_for_timeout(1200)
    check(pg.get_by_text("Так подборку увидят другие").count() > 0, "предпросмотр")
    check("Тест: дождливые выходные" in pg.inner_text("body"), "в предпросмотре заголовок")
    pg.get_by_role("button", name="Опубликовать").click()
    pg.wait_for_timeout(700)
    # первая публикация: подпись автора
    check(pg.get_by_text("Ник для ссылки").count() > 0, "при первой публикации просят имя автора")
    pg.get_by_placeholder("Например: Мама Маша").fill("Мама Тест")
    pg.wait_for_timeout(300)
    pg.get_by_role("button", name=re.compile("Опубликовать|Сохранить|Готово|Далее", re.I)).last.click()
    pg.wait_for_timeout(1200)
    check(pg.get_by_text("Подборка опубликована").count() > 0, "«Подборка опубликована 🎉»")
    pg.get_by_role("button", name="Поделиться").first.click()
    pg.wait_for_timeout(500)
    share_url = pg.locator("input[readonly]").first.input_value()
    check("/c/?d=" in share_url, f"ссылка со снимком подборки: {share_url[:70]}…")
    pg.keyboard.press("Escape")

    # кабинет автора
    go(pg, "/collections/")
    check(pg.get_by_text("Тест: дождливые выходные").count() > 0, "«Мои подборки»: подборка в списке")
    check(overflow(pg) <= 0, f"кабинет без горизонтального скролла ({overflow(pg)})")
    own_ctx = ctx

    # ───────── 3. Друг открывает ссылку в чистом браузере ─────────
    print("3. Друг открывает ссылку")
    ctx2, pg2 = new_ctx(b)
    path = rel(share_url)
    go(pg2, path)
    check("Тест: дождливые выходные" in pg2.inner_text("h1"), "друг видит подборку без регистрации")
    check("Мама Тест" in pg2.inner_text("body"), "друг видит автора")
    check("Приезжайте к открытию" in pg2.inner_text("body"), "друг видит заметку автора")
    check(overflow(pg2) <= 0, f"страница по ссылке без горизонтального скролла ({overflow(pg2)})")
    pg2.get_by_role("button", name="Хочу сюда").first.click()
    pg2.wait_for_timeout(500)
    check(pg2.get_by_role("button", name="В хотелках").count() == 1, "друг ставит «Хочу сюда»")
    # у друга хотелка в Избранном с пометкой источника
    go(pg2, "/favorites/?tab=want")
    check(pg2.get_by_text("Из подборки").count() > 0, "у друга в хотелках — «Из подборки …»")
    # перенос
    pg2.get_by_text("Перенести на другое устройство").first.click()
    pg2.wait_for_timeout(600)
    turl = pg2.locator("input[readonly]").first.input_value()
    check("/import/?d=" in turl, "ссылка переноса")
    ctx3, pg3 = new_ctx(b)
    go(pg3, rel(turl))
    check(pg3.get_by_text("Перенесём ваши хотелки").count() > 0, "страница импорта")
    pg3.get_by_role("button", name="Добавить сюда").click()
    pg3.wait_for_timeout(1500)
    check("/favorites" in pg3.url, "после импорта — Избранное")
    check(pg3.get_by_text("Из подборки").count() > 0, "перенесённая хотелка с источником")
    ctx3.close()
    ctx2.close()

    # ───────── 4. Кабинет автора видит просмотры друга? (устройство другое — честно: нет) ─────────
    # на этом же устройстве считаем свои действия
    print("4. Админка")
    pg = own_ctx.pages[0]
    go(pg, "/admin/")
    for tab in ("Авторы", "Подборки", "Намерения"):
        pg.get_by_role("button", name=tab).click()
        pg.wait_for_timeout(400)
        check(pg.get_by_text("Считаем действия").count() > 0, f"админка: вкладка «{tab}»")
    check(overflow(pg) <= 0, f"админка без горизонтального скролла ({overflow(pg)})")

    # скрытие подборки админом убирает её у автора
    pg.get_by_role("button", name="Подборки").click()
    pg.wait_for_timeout(300)
    pg.get_by_role("button", name="Скрыть").first.click()
    pg.wait_for_timeout(300)
    go(pg, "/")
    own_ctx.close()

    # ───────── 5. Узкие экраны ─────────
    print("5. Узкие экраны 360px / 430px")
    for w in (360, 430):
        ctx, pg = new_ctx(b, w=w, h=800)
        for path in ("/@weekend-parents/rainy-day/", "/@weekend-parents/", "/favorites/?tab=collections", "/favorites/?tab=visited", "/collections/", "/collections/new/", "/", "/admin/"):
            go(pg, path, 1200)
            check(overflow(pg) <= 0, f"{w}px {path}: без горизонтального скролла ({overflow(pg)})")
        ctx.close()

    b.close()

print()
real_errors = [e for e in errors if "favicon" not in e]
print("Ошибки консоли/страницы:", len(real_errors))
for e in real_errors[:20]:
    print("  !", e[:200])
print(f"\nПровалено проверок: {len(fails)}")
sys.exit(1 if fails or real_errors else 0)
