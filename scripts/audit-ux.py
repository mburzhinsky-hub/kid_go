# Аудит механик интерфейса: python3 scripts/audit-ux.py http://localhost:3000
# Вкладки и aria-current, поиск (ввод / очистка / «ничего не нашлось» / фильтр категории), избранное
# (сердечко → список → удаление → пустое состояние → сохранение после перезагрузки), шторка выбора места
# (открытие, фокус внутрь, ловушка Tab, Esc, возврат фокуса), клавиатура (видимый фокус), страница 404,
# нижняя навигация на 320px, ребёнок в профиле (добавить → перезагрузка → изменить → удалить).
# Выход: код 1, если хоть одна проверка не прошла.
import re, sys
from playwright.sync_api import sync_playwright

B = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
fails, errs = [], []


def check(ok, name, extra=""):
    print(("  ✓ " if ok else "  ✗ ") + name + (f"  [{extra}]" if extra and not ok else ""))
    if not ok:
        fails.append(name)


def new_ctx(b, w=390, h=844):
    ctx = b.new_context(viewport={"width": w, "height": h})
    ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash|.*\.basemaps).*"), lambda r: r.abort())
    # пропускаем приветственный экран: у семьи уже есть ребёнок
    ctx.add_init_script("try{sessionStorage.setItem('kidgo-onb-shown','1')}catch(e){}")
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(("pageerror", str(e)[:200])))
    pg.on("console", lambda m: m.type == "error" and not re.search(r"Failed to load resource|ERR_FAILED|net::", m.text) and errs.append(("console", m.text[:200])))
    return ctx, pg


def seed_family(pg):
    pg.goto(B + "/")
    pg.evaluate(
        """() => localStorage.setItem('kidgo-family', JSON.stringify({state:{city:'Москва',children:[{id:'c1',name:'Тёма',age:5,interests:['dinosaurs'],emoji:'🦁'}],budget:'5000',transport:'transit',transportAuto:true,maxDistanceKm:10,maxTravelMin:40,geoScope:'moscow',onboarded:true,loved:[],disliked:[],seen:[],trips:[],intents:{},wantPlaces:[],visitedPlaces:[],savedPlans:[],day:[]},version:5}))"""
    )
    pg.reload()
    pg.wait_for_timeout(700)


def run():
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ── 1. Вкладки
        print("1. Вкладки нижней навигации")
        ctx, pg = new_ctx(b)
        seed_family(pg)
        nav = pg.locator("nav[aria-label='Основная навигация']")
        for label, path in [("Карта", "/map"), ("Приключения", "/adventures"), ("Избранное", "/favorites"), ("Профиль", "/profile"), ("Главная", "")]:
            nav.get_by_role("link", name=label).click()
            pg.wait_for_timeout(500)
            cur = nav.locator("[aria-current='page']")
            check(cur.count() == 1 and label in cur.inner_text(), f"вкладка «{label}» активна ровно одна", f"{cur.count()}")
            check(re.search(re.escape(path) + r"/?$", pg.url) is not None, f"«{label}» → {path or '/'}", pg.url)
            check(pg.locator("h1").count() >= 1, f"«{label}»: есть заголовок h1")
        ctx.close()

        # ── 2. Поиск
        print("2. Поиск")
        ctx, pg = new_ctx(b)
        seed_family(pg)
        pg.goto(B + "/search/")
        pg.wait_for_selector("input[aria-label='Поиск']")
        inp = pg.locator("input[aria-label='Поиск']")
        check("Часто ищут" in pg.inner_text("main"), "пустой запрос: подсказки «Часто ищут»")
        inp.fill("зоопарк")
        pg.wait_for_timeout(400)
        n = pg.locator("main a[href*='/places/']").count()
        check(n > 0, "«зоопарк» находит места", str(n))
        check("зоопарк" in pg.inner_text("main").lower(), "в результатах есть слово запроса")
        pg.get_by_role("button", name="Очистить").click()
        pg.wait_for_timeout(300)
        check(inp.input_value() == "", "«Очистить» сбрасывает поле")
        check("Часто ищут" in pg.inner_text("main"), "после очистки подсказки вернулись")
        inp.fill("ыыыйцукен")
        pg.wait_for_timeout(400)
        check("Ничего не нашлось" in pg.inner_text("main"), "пустая выдача: понятное сообщение")
        check(pg.locator("main a:has-text('планировщик')").count() >= 1, "пустая выдача: есть выход (планировщик)")
        inp.fill("")
        pg.wait_for_timeout(200)
        # сортировка
        total_before = pg.locator("main a[href*='/places/']").count()
        pg.get_by_role("button", name="Дешевле").click()
        pg.wait_for_timeout(300)
        check(pg.get_by_role("button", name="Дешевле").get_attribute("aria-pressed") == "true", "сортировка «Дешевле» включилась (aria-pressed)")
        check(pg.locator("main a[href*='/places/']").count() == total_before, "сортировка не меняет число мест", f"{total_before}")
        # назад
        pg.goto(B + "/")
        pg.wait_for_timeout(500)
        pg.get_by_role("link", name=re.compile("Куда пойдём|Поиск")).first.click()
        pg.wait_for_url(re.compile(r".*/search/?"), timeout=5000)
        pg.get_by_role("button", name="Назад").click()
        pg.wait_for_timeout(600)
        check(re.search(r"/kid_go/?$|:\d+/?$", pg.url) is not None, "«Назад» из поиска возвращает на главную", pg.url)
        ctx.close()

        # ── 3. Избранное
        print("3. Избранное (сердечко → список → удаление → перезагрузка)")
        ctx, pg = new_ctx(b)
        seed_family(pg)
        pg.goto(B + "/places/moskovsky-zoopark/")
        pg.wait_for_selector("h1")
        title = pg.inner_text("h1").strip()
        heart = pg.get_by_role("button", name="Хочу сюда").first
        heart.click()
        pg.wait_for_timeout(400)
        again = pg.get_by_role("button", name="Убрать из «Хочу сходить»").first
        check(again.count() >= 1 and again.get_attribute("aria-pressed") == "true", "сердечко включилось (aria-pressed)")
        pg.reload()
        pg.wait_for_timeout(700)
        check(pg.get_by_role("button", name="Убрать из «Хочу сходить»").count() >= 1, "после перезагрузки сердечко сохранилось")
        pg.goto(B + "/favorites/")
        pg.wait_for_selector("h1")
        pg.wait_for_timeout(500)
        check(title in pg.inner_text("main"), "место видно в «Избранном»", title)
        nb = pg.locator("nav[aria-label='Основная навигация'] li:nth-child(4)").inner_text()
        check(re.search(r"\b1\b", nb) is not None, "бейдж-счётчик на вкладке «Избранное»", nb.replace("\n", " "))
        pg.goto(B + "/places/moskovsky-zoopark/")
        pg.wait_for_selector("h1")
        pg.get_by_role("button", name="Убрать из «Хочу сходить»").first.click()
        pg.wait_for_timeout(400)
        pg.goto(B + "/favorites/")
        pg.wait_for_timeout(600)
        check("Пока пусто" in pg.inner_text("main"), "после удаления — пустое состояние")
        check(pg.locator("main a:has-text('Смотреть места')").count() >= 1, "пустое состояние: кнопка «Смотреть места»")
        ctx.close()

        # ── 4. Шторка выбора места: фокус, Esc, возврат
        print("4. Шторка (BottomSheet)")
        ctx, pg = new_ctx(b)
        seed_family(pg)
        chip = pg.locator("header button[aria-label^='Где ищем']")
        chip.click()
        pg.wait_for_timeout(500)
        dlg = pg.get_by_role("dialog")
        check(dlg.count() == 1, "шторка открылась")
        check(dlg.get_attribute("aria-modal") == "true", "aria-modal")
        check(bool(dlg.get_attribute("aria-labelledby")), "aria-labelledby (есть название)")
        inside = pg.evaluate("() => !!document.activeElement && !!document.activeElement.closest('[role=dialog]')")
        check(inside, "фокус ушёл внутрь шторки")
        ok = True
        for _ in range(25):
            pg.keyboard.press("Tab")
            if not pg.evaluate("() => !!document.activeElement.closest('[role=dialog]')"):
                ok = False
                break
        check(ok, "Tab не выходит за пределы шторки (25 нажатий)")
        ok = True
        for _ in range(25):
            pg.keyboard.press("Shift+Tab")
            if not pg.evaluate("() => !!document.activeElement.closest('[role=dialog]')"):
                ok = False
                break
        check(ok, "Shift+Tab не выходит за пределы шторки")
        pg.keyboard.press("Escape")
        pg.wait_for_timeout(500)
        check(pg.get_by_role("dialog").count() == 0, "Esc закрывает шторку")
        back = pg.evaluate("() => (document.activeElement?.getAttribute('aria-label')||'').startsWith('Где ищем')")
        check(back, "фокус вернулся на кнопку «Где ищем»")
        chip.click()
        pg.wait_for_timeout(400)
        pg.mouse.click(195, 30)  # затемнение над шторкой
        pg.wait_for_timeout(500)
        check(pg.get_by_role("dialog").count() == 0, "тап по затемнению закрывает шторку")
        chip.click()
        pg.wait_for_timeout(400)
        pg.get_by_role("dialog").get_by_role("button", name="Закрыть").last.click()
        pg.wait_for_timeout(500)
        check(pg.get_by_role("dialog").count() == 0, "крестик «Закрыть» закрывает шторку")
        check(pg.evaluate("() => document.body.style.overflow !== 'hidden'"), "прокрутка страницы снова разрешена")
        ctx.close()

        # ── 5. Клавиатура: видимый фокус
        print("5. Клавиатура")
        ctx, pg = new_ctx(b)
        seed_family(pg)
        bad, seen = [], 0
        for _ in range(14):
            pg.keyboard.press("Tab")
            info = pg.evaluate(
                """() => { const e = document.activeElement; if (!e || e === document.body) return null; const cs = getComputedStyle(e);
                const vis = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 || (cs.boxShadow && cs.boxShadow !== 'none');
                const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 30), vis, inView: r.bottom > 0 && r.top < innerHeight }; }"""
            )
            if info:
                seen += 1
                if not info["vis"]:
                    bad.append(info["t"])
        check(seen >= 8, "Tab проходит по интерактивным элементам", str(seen))
        check(not bad, "у каждого элемента виден фокус", ", ".join(bad))
        ctx.close()

        # ── 6. 404
        print("6. Страница 404")
        ctx, pg = new_ctx(b)
        r = pg.goto(B + "/404.html")
        pg.wait_for_timeout(600)
        txt = pg.inner_text("body")
        check("Такой страницы нет" in txt, "404: понятный текст")
        check(pg.get_by_role("link", name="На главную").count() == 1, "404: кнопка «На главную»")
        ctx.close()

        # ── 7. Нижняя навигация на самых узких экранах
        print("7. Нижняя навигация: подписи помещаются")
        for w in (320, 340, 360, 375, 390, 430):
            ctx, pg = new_ctx(b, w, 740)
            seed_family(pg)
            res = pg.evaluate(
                """() => [...document.querySelectorAll("nav[aria-label='Основная навигация'] a")].map(a => { const rg = document.createRange(); const tn = [...a.childNodes].find(n => n.nodeType === 3); rg.selectNodeContents(tn); const t = rg.getBoundingClientRect(); const r = a.getBoundingClientRect();
                return { t: a.textContent.trim(), w: r.width, l: t.left, r: t.right, colL: r.left, colR: r.right }; })"""
            )
            over = [x["t"] for x in res if x["l"] < x["colL"] - 0.5 or x["r"] > x["colR"] + 0.5]
            gaps = [round(res[i + 1]["l"] - res[i]["r"], 1) for i in range(len(res) - 1)]
            check(len(res) == 5 and not over, f"{w}px: подписи вкладок помещаются в свою колонку", ", ".join(over))
            check(min(gaps) >= 6, f"{w}px: зазор между подписями ≥ 6px", str(gaps))
            ws = [round(x["w"], 1) for x in res]
            check(max(ws) - min(ws) < 1.5, f"{w}px: вкладки одной ширины (симметрия)", str(ws))
            ctx.close()

        # ── 8. Ребёнок в профиле
        print("8. Профиль: добавить → перезагрузка → изменить → удалить")
        ctx, pg = new_ctx(b)
        seed_family(pg)
        pg.goto(B + "/profile/")
        pg.wait_for_selector("h1")
        pg.get_by_role("button", name="Добавить ребёнка").click()
        pg.wait_for_timeout(400)
        dlg = pg.get_by_role("dialog")
        check(dlg.count() == 1, "шторка «Новый ребёнок»")
        dlg.get_by_placeholder("Как зовут? (необязательно)").fill("Соня")
        dlg.locator("select").select_option("7")
        dlg.get_by_role("button", name=re.compile("Динозавры")).click()
        dlg.get_by_role("button", name="Добавить", exact=True).click()
        pg.wait_for_timeout(500)
        check(pg.get_by_role("dialog").count() == 0, "шторка закрылась после «Добавить»")
        check("Соня" in pg.inner_text("main"), "ребёнок появился в профиле")
        pg.reload()
        pg.wait_for_timeout(700)
        main = pg.inner_text("main")
        check("Соня" in main and "Тёма" in main, "после перезагрузки оба ребёнка на месте")
        pg.get_by_role("button", name="Изменить Соня").click()
        pg.wait_for_timeout(400)
        dlg = pg.get_by_role("dialog")
        check(dlg.get_by_placeholder("Как зовут? (необязательно)").input_value() == "Соня", "редактирование: имя подставлено")
        dlg.get_by_placeholder("Как зовут? (необязательно)").fill("Софья")
        dlg.get_by_role("button", name="Сохранить").click()
        pg.wait_for_timeout(500)
        check("Софья" in pg.inner_text("main") and "Соня" not in pg.inner_text("main"), "имя изменилось")
        pg.get_by_role("button", name="Изменить Софья").click()
        pg.wait_for_timeout(400)
        pg.get_by_role("dialog").get_by_role("button", name="Удалить").click()
        pg.wait_for_timeout(500)
        check("Софья" not in pg.inner_text("main"), "ребёнок удалён")
        ctx.close()

        b.close()


run()
print()
real = [e for e in errs]
print("Ошибки консоли/страницы:", len(real))
for e in real[:10]:
    print("   ", e)
print("Провалено проверок:", len(fails))
for f in fails:
    print("   ✗", f)
sys.exit(1 if fails or real else 0)
