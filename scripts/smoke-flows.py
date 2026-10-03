# Сквозные пользовательские сценарии (Playwright, Python): python3 scripts/smoke-flows.py http://localhost:3000
import asyncio, sys
from playwright.async_api import async_playwright, expect
BASE=sys.argv[1] if len(sys.argv)>1 else "http://localhost:3002"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome")
        ctx=await b.new_context(viewport={"width":390,"height":844}, device_scale_factor=1, is_mobile=True, has_touch=True, locale="ru-RU", timezone_id="Europe/Moscow")
        page=await ctx.new_page()
        errs=[]
        page.on("pageerror", lambda e: errs.append(str(e)))
        await page.route("**/tiles.openfreemap.org/**", lambda r: r.abort())
        ok=lambda m: print("✓", m)

        # 1. сценарий «Если дождь» → результаты → план → день
        await page.goto(BASE+"/")
        await page.get_by_role("link", name="Если дождь").click()
        await page.wait_for_url("**/planner/results**")
        await expect(page.get_by_role("heading", name="Мы придумали вам", exact=False)).to_be_visible(timeout=15000)
        n=await page.get_by_role("link", name="Хочу так").count()
        ok(f"сценарий «Если дождь» → {n} варианта")
        await page.get_by_role("link", name="Хочу так").first.click()
        await page.wait_for_url("**/day?**")
        await expect(page.get_by_text("План дня")).to_be_visible()
        stops=await page.locator("ol > li").count()
        ok(f"план дня открыт, точек: {stops}")
        await page.get_by_role("button", name="11:00", exact=True).click()
        ok("сменили время старта")

        # 2. Планировщик: 5 шагов
        await page.goto(BASE+"/planner")
        await expect(page.get_by_text("Кто идёт?")).to_be_visible()
        await page.get_by_role("button", name="Дальше").click()
        await page.get_by_role("button", name="Полдня").click()
        await page.get_by_role("button", name="Выплеснуть энергию").click()
        await page.get_by_role("button", name="до 5 000 ₽").click()
        await page.get_by_role("button", name="На машине").click()
        await page.get_by_role("button", name="Придумать день ✨").click()
        await expect(page.get_by_text("Придумываем приключение…")).to_be_visible()
        await page.wait_for_url("**/planner/results**", timeout=15000)
        await expect(page.get_by_role("heading", name="Мы придумали вам", exact=False)).to_be_visible(timeout=15000)
        ok("планировщик: 5 шагов → лоадер → результаты")

        # 2b. Естественный язык
        await page.goto(BASE+"/planner")
        await page.get_by_label("Или просто опишите словами").fill("Хочу куда-нибудь недалеко, чтобы дети побегали и потом нормально поесть")
        await expect(page.get_by_text("потом поесть")).to_be_visible()
        await page.get_by_role("button", name="Готово").click()
        await page.wait_for_url("**/planner/results**", timeout=15000)
        await expect(page.locator("text=Хочу так").first).to_be_visible(timeout=15000)
        ok("NL-запрос → фильтры → результаты")

        # 3. Место → «Что потом?» → наш день
        await page.goto(BASE+"/places/paleontologichesky-muzey")
        await page.get_by_role("button", name="Добавить в наш день").click()
        await expect(page.get_by_role("status")).to_contain_text("в нашем дне")
        await page.goto(BASE+"/day")
        await expect(page.get_by_role("heading", name="Наш день")).to_be_visible()
        stops=await page.locator("ol > li").count()
        ok(f"«Что потом?» → наш день: {stops} точки")

        # 4. Хочу сюда → шит
        await page.goto(BASE+"/places/moskvarium")
        await page.get_by_role("button", name="Хочу сюда!").click()
        await expect(page.get_by_text("Отличный выбор!")).to_be_visible()
        await page.get_by_role("button", name="Сохранить в «Хотим сходить»").click()
        await page.goto(BASE+"/favorites")
        await expect(page.get_by_text("Москвариум")).to_be_visible()
        ok("«Хочу сюда!» → сохранено в хотелки")

        # 5. Приключение → сохранить → в избранном
        await page.goto(BASE+"/adventures/den-dinozavrov")
        await page.get_by_role("button", name="Сохранить", exact=True).first.click()
        await page.goto(BASE+"/favorites?tab=plans")
        await expect(page.get_by_text("День динозавров")).to_be_visible()
        ok("приключение сохранено")

        # 6. Поиск
        await page.goto(BASE+"/search")
        await page.get_by_label("Поиск").fill("батуты")
        await expect(page.get_by_text("Батутный центр «Прыг-Скок»")).to_be_visible()
        ok("поиск «батуты»")
        await page.get_by_label("Поиск").fill("бесплатно на улице")
        await expect(page.get_by_text("Поняли так")).to_be_visible()
        c=await page.locator("a[href^='/places/']").count()
        ok(f"поиск «бесплатно на улице» → {c} мест")

        # 7. Профиль: добавить ребёнка
        await page.goto(BASE+"/profile")
        await page.get_by_role("button", name="Добавить ребёнка").click()
        await page.get_by_placeholder("Как зовут?").fill("Соня")
        await page.get_by_role("button", name="🎨 Рисование").click()
        await page.get_by_role("button", name="Добавить", exact=True).click()
        await expect(page.get_by_text("Соня,")).to_be_visible()
        ok("профиль: добавлен ребёнок")

        # 8. Карта: фильтр и выбор маркера
        await page.goto(BASE+"/map")
        await page.wait_for_timeout(2500)
        await page.get_by_role("button", name="Под крышей").click()
        await page.locator("button[aria-label*=\", рейтинг\"]").first.click()
        await expect(page.get_by_role("link", name="Подробнее")).to_be_visible()
        ok("карта: фильтр + маркер → карточка")

        # 9. Онбординг
        await page.goto(BASE+"/onboarding")
        await page.get_by_role("button", name="Дальше").click()
        await page.get_by_role("button", name="Дальше").click()
        await page.get_by_placeholder("Имя").fill("Лёва")
        await page.get_by_role("button", name="Поехали! 🚀").click()
        await page.wait_for_url(BASE+"/")
        ok("онбординг пройден")

        print("ошибки страницы:", errs[:5] or "нет")
        await b.close()
asyncio.run(main())
