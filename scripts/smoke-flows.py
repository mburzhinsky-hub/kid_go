# Сквозная воронка (Playwright): python3 scripts/smoke-flows.py http://localhost:3000
#
#  A. Первый запуск: онбординг → главная (одна главная кнопка «Собрать наш день»)
#  B. «Москва»: главная → планировщик (дети из профиля) → варианты дня → день → место → «Что потом?» → «Наш день»;
#     приключение («Поехали!»), сценарий, карта и поиск без области (области нет нигде)
#  C. «Москва + область»: переключатель, поездка на день, сценарий «Выезд на день» → место области →
#     «Собрать день вокруг этого места» → день с этим местом; приключение за городом; карта и поиск с областью
# Каждая проверка печатает, что именно подтвердилось; любое расхождение — AssertionError и код 1.
import json, re, sys
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
errs = []
KIDS = [
    {"id": "c1", "name": "Миша", "age": 5, "interests": ["dinosaurs"], "emoji": "🦁"},
    {"id": "c2", "name": "Аня", "age": 9, "interests": ["drawing"], "emoji": "🦄"},
]


def seed(scope, transport="transit"):
    state = {"state": {"children": KIDS, "onboarded": True, "geoScope": scope, "transport": transport, "transportAuto": False}, "version": 5}
    return "try{if(!localStorage.getItem('kidgo-family')){localStorage.setItem('kidgo-family'," + json.dumps(json.dumps(state)) + ")}}catch(e){}"


def new_page(b, scope=None, transport="transit"):
    ctx = b.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
    ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash|tile\.).*"), lambda r: r.abort())
    if scope:
        ctx.add_init_script(seed(scope, transport))
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(("pageerror", str(e))))
    pg.on("console", lambda m: m.type == "error" and errs.append(("console", m.text[:200])))
    return pg


def ok(cond, msg):
    assert cond, msg
    print("   ✓", msg)


def day_links(pg):
    return pg.locator("a[href*='/day'][href*='?']")


def submit_planner(pg, duration=None):
    pg.wait_for_selector("h1:has-text('Что будем делать сегодня?')")
    pg.wait_for_timeout(500)
    if duration:
        pg.get_by_role("radio", name=re.compile(duration)).click()
    pg.get_by_role("button", name="Показать варианты дня").click()
    pg.wait_for_url(re.compile(r".*/planner/results.*"), timeout=20000)
    pg.wait_for_selector("h1", timeout=20000)
    pg.wait_for_timeout(1200)


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ───────── A. Первый запуск ─────────
        print("A. первый запуск")
        pg = new_page(b)
        pg.goto(B + "/")
        pg.wait_for_url(re.compile(r".*/onboarding/?$"), timeout=8000)
        pg.click("text=Начнём")
        pg.get_by_role("radio", name="5").click()
        pg.fill("input[placeholder='Имя — если хотите']", "Тёма")
        pg.click("text=Динозавры")
        # несколько детей: «Добавить ещё ребёнка»
        pg.get_by_role("button", name="Добавить ещё ребёнка").click()
        ok(pg.get_by_role("list", name="Добавленные дети").count() == 1 and "Тёма" in pg.inner_text("main"), "в знакомстве первый ребёнок сохранился, форма очистилась")
        pg.get_by_role("radio", name="7", exact=True).click()
        pg.fill("input[placeholder='Имя — если хотите']", "Соня")
        pg.get_by_role("button", name="Дальше", exact=True).click()
        # «Где ищем»: понятный выбор охвата
        grp = pg.get_by_role("radiogroup", name="Охват поиска")
        ok(grp.get_by_role("radio", name=re.compile(r"^Москва\s*Лучшие")).get_attribute("aria-checked") == "true", "по умолчанию выбрано «Москва»")
        grp.get_by_role("radio", name=re.compile("Москва \\+ область")).click()
        pg.wait_for_timeout(200)
        ok("Ищем в Москве и области" in pg.inner_text("main"), "выбрали «Москва + область» — подпись «Ищем в Москве и области»")
        pg.get_by_role("button", name="ВАО", exact=True).click()
        pg.wait_for_timeout(300)
        ok("Ищем рядом: ВАО" in pg.inner_text("main"), "выбрали округ — «Ищем рядом: ВАО», дорога от района")
        pg.click("text=Поехали! 🚀")
        pg.wait_for_url(re.compile(r".*/kid_go/?$|.*:\d+/?$"))
        pg.wait_for_timeout(1500)
        body = pg.inner_text("body")
        ok("Миша" not in body and "Аня" not in body, "чужих демо-детей нет")
        ok(pg.get_by_role("link", name=re.compile("Собрать наш день")).count() == 1, "на главной одна главная кнопка «Собрать наш день»")
        ok("Тёма" in body and "Соня" in body, "оба ребёнка из знакомства подхватились")
        pg.get_by_role("link", name=re.compile("Собрать наш день")).click()
        pg.wait_for_url(re.compile(r".*/planner/?$"))
        pg.wait_for_selector("h1:has-text('Что будем делать сегодня?')")
        pg.wait_for_timeout(500)
        ok("Тёма" in pg.inner_text("main") and "Соня" in pg.inner_text("main"), "в планировщике оба сохранённых ребёнка уже выбраны")
        pg.context.close()

        # ───────── B. «Москва» ─────────
        print("B. Москва")
        pg = new_page(b, "moscow")
        pg.goto(B + "/")
        pg.wait_for_selector("h2:has-text('Что будем делать сегодня?')")
        pg.wait_for_timeout(800)
        grp = pg.get_by_role("radiogroup", name="Где ищем")
        ok(grp.count() == 1 and grp.get_by_role("radio", name="Москва", exact=True).get_attribute("aria-checked") == "true", "на главной виден выбор географии, выбрано «Москва»")
        ok(pg.locator("a[href*='?s=']").count() >= 6, f"ниже главной кнопки — быстрые ситуации: {pg.locator('a[href*=\"?s=\"]').count()}")
        pg.get_by_role("link", name=re.compile("Собрать наш день")).click()
        pg.wait_for_url(re.compile(r".*/planner/?$"))
        pg.wait_for_selector("h1:has-text('Что будем делать сегодня?')")
        pg.wait_for_timeout(600)
        main = pg.inner_text("main")
        ok("Миша" in main and "Аня" in main, "в планировщике дети из профиля: Миша, Аня")
        ok(pg.get_by_role("radio").count() >= 4 + 6, "время и настроение выбираются на одном экране")
        submit_planner(pg)
        n = day_links(pg).count()
        ok(n >= 2, f"получили готовые варианты дня: {n}")
        ok("от Москвы" not in pg.inner_text("main"), "в режиме «Москва» поездок за город нет")
        day_links(pg).first.click()
        pg.wait_for_url(re.compile(r".*/day/?\?.*"))
        pg.wait_for_selector("ol")
        pg.wait_for_timeout(800)
        ok(pg.get_by_role("link", name=re.compile("Поехали")).count() >= 1, "в дне есть главная кнопка «Поехали!»")
        ok(pg.locator("a[href*='/map'][href*='plan=']").count() >= 1, "в дне есть маршрут на карте")
        place_links = pg.locator("ol a[href*='/places/']")
        ok(place_links.count() >= 1, "шаги дня — ссылки на места")
        place_links.first.click()
        pg.wait_for_url(re.compile(r".*/places/[^/]+/?$"))
        pg.wait_for_selector("h1")
        pg.wait_for_timeout(700)
        ok(pg.get_by_role("heading", name="Что потом?").count() == 1, "на месте есть блок «Что потом?»")
        ok(pg.get_by_role("link", name=re.compile("Собрать день вокруг этого места")).count() >= 1, "есть «Собрать день вокруг этого места»")
        ok(pg.get_by_role("button", name=re.compile("Хочу сюда")).count() >= 1, "есть «Хочу сюда»")
        add = pg.get_by_role("button", name="Добавить в наш день")
        ok(add.count() >= 1, "в «Что потом?» есть «Добавить в наш день»")
        add.first.click()
        pg.wait_for_timeout(500)
        pg.goto(B + "/day")
        pg.wait_for_selector("ol")
        pg.wait_for_timeout(600)
        steps = pg.locator("ol > li").count()
        ok(steps >= 2, f"«Наш день» собрался из {steps} шагов")
        ok(pg.get_by_role("link", name=re.compile("Поехали")).count() >= 1, "«Наш день» с кнопкой «Поехали!»")

        # дорога по выбору: «На машине» в планировщике → в дне «на машине», маршрут «Поехали!» на машине
        pg.goto(B + "/planner")
        pg.wait_for_selector("h1:has-text('Что будем делать сегодня?')")
        pg.wait_for_timeout(500)
        pg.get_by_role("button", name=re.compile("Уточнить подбор")).click()
        pg.get_by_role("button", name=re.compile("На машине")).click()
        submit_planner(pg)
        ok("transport=car" in "".join(day_links(pg).nth(i).get_attribute("href") for i in range(day_links(pg).count())), "ссылки на дни несут выбранный способ: transport=car")
        day_links(pg).first.click()
        pg.wait_for_url(re.compile(r".*/day/?\?.*transport=car.*"))
        pg.wait_for_selector("ol")
        pg.wait_for_timeout(800)
        legs = pg.locator("ol").inner_text()
        ok("на транспорте" not in legs, "в дне нет «на транспорте», хотя выбрана машина")
        ok(pg.locator("a[href*='rtt=auto']").count() >= 1, "«Поехали!» открывает маршрут на машине")

        # приключение
        pg.goto(B + "/adventures")
        pg.wait_for_timeout(800)
        ok(pg.locator("a[href*='/adventures/']").count() >= 12, f"приключений в каталоге: {pg.locator('a[href*=\"/adventures/\"]').count()} (≥12)")
        ok(pg.locator("a[href*='kolomna']").count() == 0 and pg.locator("a[href*='arkhangelskoe']").count() == 0, "в режиме «Москва» поездок за город среди приключений нет")
        pg.goto(B + "/adventures/den-dinozavrov")
        pg.wait_for_selector("h1")
        pg.wait_for_timeout(600)
        ok(pg.get_by_role("link", name=re.compile("Поехали")).count() >= 1 and pg.locator("a[href*='/map'][href*='plan=']").count() >= 1, "приключение: «Поехали!» и маршрут на карте")

        # сценарий
        pg.goto(B + "/scenarios")
        pg.wait_for_timeout(800)
        sc = pg.locator("a[href*='?s=']")
        ok(sc.count() >= 78, f"сценариев на странице: {sc.count()}")
        ok(pg.locator("a[href*='s=day-trip']").count() == 1, "группа «За город» есть и в режиме «Москва» (в списке всех сценариев)")
        pg.goto(B + "/planner/results?s=rain&wx=rain")
        pg.wait_for_selector("a[href*='/day'][href*='?']", timeout=15000)
        ok(day_links(pg).count() >= 1 and "от Москвы" not in pg.inner_text("main"), "сценарий «дождь» в Москве: планы без области")

        # карта и поиск без области
        pg.goto(B + "/map")
        pg.wait_for_timeout(2500)
        mg = pg.get_by_role("radiogroup", name="Где ищем")
        ok(mg.count() == 1, "на карте виден выбор «Москва / Москва + область»")
        ok("Москва + Подмосковье" not in pg.inner_text("body"), "карта без области: подмосковной выдачи нет")
        pg.goto(B + "/search?q=Архангельское")
        pg.wait_for_timeout(800)
        sr = pg.inner_text("main")
        ok("в области" in sr and pg.locator("a[href*='/places/arkhangelskoe']").count() == 0, "поиск в режиме «Москва» прячет область и подсказывает, что она есть")
        pg.close()

        # ───────── C. «Москва + область» ─────────
        print("C. Москва + область")
        pg = new_page(b, "moscow-region", "car")
        pg.goto(B + "/")
        pg.wait_for_selector("h2:has-text('Что будем делать сегодня?')")
        pg.wait_for_timeout(800)
        grp = pg.get_by_role("radiogroup", name="Где ищем")
        ok(grp.get_by_role("radio", name="Москва + область").get_attribute("aria-checked") == "true", "на главной выбрано «Москва + область»")
        ok(pg.locator("a[href*='s=day-trip'], a[href*='s=estate-park']").count() >= 1, "на главной появились ситуации «за город»")
        # переключатель постоянный: меняем на главной → виден в планировщике
        grp.get_by_role("radio", name="Москва", exact=True).click()
        pg.wait_for_timeout(300)
        pg.goto(B + "/planner")
        pg.wait_for_selector("h1")
        pg.wait_for_timeout(500)
        ok(pg.get_by_role("radiogroup", name="Где ищем").get_by_role("radio", name="Москва", exact=True).get_attribute("aria-checked") == "true", "выбор географии сохранился между экранами")
        pg.get_by_role("radiogroup", name="Где ищем").get_by_role("radio", name="Москва + область").click()
        pg.wait_for_timeout(300)

        # поездка на день из планировщика
        submit_planner(pg, "Почти весь день")
        res = pg.inner_text("main")
        ok(day_links(pg).count() >= 1, f"варианты на весь день: {day_links(pg).count()}")
        ok("от Москвы" in res, "в карточках есть «~N мин от Москвы»")
        # 2 часа: за город не едем
        pg.goto(B + "/planner")
        submit_planner(pg, "2 часа")
        ok("от Москвы" not in pg.inner_text("main"), "на 2 часа за город не предлагаем")

        # сценарий «Выезд на день» → место области → «Собрать день вокруг этого места»
        pg.goto(B + "/planner/results?s=day-trip")
        pg.wait_for_selector("a[href*='/day'][href*='?']", timeout=20000)
        pg.wait_for_timeout(600)
        ok(day_links(pg).count() >= 1 and "от Москвы" in pg.inner_text("main"), "сценарий «Выезд на день»: план с дорогой от Москвы")
        pg.goto(B + "/places/arkhangelskoe")
        pg.wait_for_selector("h1")
        pg.wait_for_timeout(700)
        ok(pg.get_by_role("heading", name="Что потом?").count() == 1, "у места области есть «Что потом?»")
        around = pg.get_by_role("link", name=re.compile("Собрать день вокруг этого места"))
        ok(around.count() >= 1, "у места области есть «Собрать день вокруг этого места»")
        around.first.click()
        pg.wait_for_url(re.compile(r".*/planner/?\?anchor=arkhangelskoe.*"))
        pg.wait_for_selector("h1")
        pg.wait_for_timeout(600)
        ok("День вокруг места" in pg.inner_text("main") and "Архангельское" in pg.inner_text("main"), "планировщик помнит выбранное место")
        pg.get_by_role("button", name="Показать варианты дня").click()
        pg.wait_for_url(re.compile(r".*/planner/results.*anchor=arkhangelskoe.*"), timeout=20000)
        pg.wait_for_selector("a[href*='/day'][href*='?']", timeout=20000)
        pg.wait_for_timeout(600)
        hrefs = [day_links(pg).nth(i).get_attribute("href") for i in range(day_links(pg).count())]
        ok(len(hrefs) >= 1 and all("arkhangelskoe" in h for h in hrefs), f"все {len(hrefs)} варианта содержат выбранное место")
        ok("От Москвы" in pg.inner_text("main") or "от Москвы" in pg.inner_text("main"), "дорога от Москвы показана")

        # приключение за городом
        pg.goto(B + "/adventures")
        pg.wait_for_timeout(800)
        ok(pg.locator("a[href*='kolomna']").count() >= 1 and pg.locator("a[href*='arkhangelskoe']").count() >= 1, "в режиме «Москва + область» видны приключения за городом")
        pg.goto(B + "/adventures/kolomna-kreml-i-pastila")
        pg.wait_for_selector("h1")
        pg.wait_for_timeout(700)
        ok("от Москвы" in pg.inner_text("main") and pg.get_by_role("link", name=re.compile("Поехали")).count() >= 1, "приключение за городом: дорога от Москвы и «Поехали!»")

        # карта с областью
        pg.goto(B + "/map")
        pg.wait_for_timeout(2500)
        ok("Москва + Подмосковье" in pg.inner_text("body"), "карта с областью: «Москва + Подмосковье»")
        pg.goto(B + "/map")
        pg.wait_for_timeout(1500)
        pg.get_by_role("radiogroup", name="Где ищем").get_by_role("radio", name="Москва", exact=True).click()
        pg.wait_for_timeout(600)
        ok("Москва + Подмосковье" not in pg.inner_text("body"), "карта: переключатель убирает область")

        # поиск с областью
        pg.goto(B + "/search?q=Архангельское")
        pg.wait_for_timeout(800)
        pg.get_by_role("radiogroup", name="Где ищем").get_by_role("radio", name="Москва + область").click()
        pg.wait_for_timeout(500)
        ok(pg.locator("a[href*='/places/arkhangelskoe']").count() >= 1, "поиск с областью находит место за городом")
        ok(pg.get_by_role("link", name=re.compile("Собрать день вокруг")).count() >= 1, "в выдаче поиска есть «Собрать день вокруг»")
        pg.close()
        b.close()


run()
real = [e for e in errs if not any(x in e[1] for x in ("ERR_FAILED", "ERR_TUNNEL", "ERR_BLOCKED", "Failed to load resource"))]
print("ERRORS:", real[:10])
sys.exit(1 if real else 0)
