# Сквозные сценарии (Playwright): python3 scripts/smoke-flows.py http://localhost:3000
# Онбординг без демо-детей → точка выезда → сценарий «Успеть до дождя» (тестовая погода) → план дня →
# замена шага → .ics → «Если дождь» только под крышей → ситуации → маршрут на карте → профиль → планер без детей.
import re, sys
from playwright.sync_api import sync_playwright
B=sys.argv[1] if len(sys.argv)>1 else "http://localhost:3000"
errs=[]
def run():
  with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={"width":390,"height":844}, accept_downloads=True)
    # block external network (open-meteo, tiles) quickly
    ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash).*"), lambda r: r.abort())
    pg=ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(("pageerror", str(e))))
    pg.on("console", lambda m: m.type=="error" and errs.append(("console", m.text[:200])))
    pg.goto(B+"/"); pg.wait_for_url(re.compile(r".*/onboarding/?$"), timeout=8000); print("1 redirected to onboarding")
    pg.click("text=Начнём")
    pg.get_by_role("radio", name="5").click()
    pg.fill("input[placeholder='Имя — если хотите']","Тёма")
    pg.click("text=Динозавры")
    pg.click("text=Дальше")
    pg.get_by_role("button", name="ВАО", exact=True).click()
    pg.wait_for_timeout(300)
    assert "Ищем рядом: ВАО" in pg.inner_text("main"), "origin not shown"
    pg.click("text=Поехали! 🚀"); pg.wait_for_url(re.compile(r".*/kid_go/?$|.*:3000/?$")); pg.wait_for_timeout(1500)
    body=pg.inner_text("body")
    assert "Миша" not in body and "Аня" not in body, "demo kids visible"
    print("2 home ok; chip:", pg.locator("header button[aria-label^='Где ищем']").inner_text())
    print("   weather:", pg.locator("a:has-text('Сегодня')").first.inner_text().replace("\n"," | ")[:160])
    print("   for you title present:", "Для Тёмы" in body)
    # scenarios grid
    print("   scenario cards:", pg.locator("section:has-text('Что хочется сегодня?') a[href*='planner/results'][href*='?s=']").count())
    # results with rain from 15
    pg.goto(B+"/planner/results?s=before-rain&wx=rain15"); pg.wait_for_selector("h1"); pg.wait_for_timeout(800)
    print("3 results h1:", pg.inner_text("h1"))
    print("   sub:", pg.locator("h1 + p").inner_text()[:200])
    cards=pg.locator("a[href*='/day'][href*='?']"); print("   plans:", cards.count())
    print("   first explanation:", pg.locator("a[href*='/day'][href*='?'] p").nth(1).inner_text()[:220])
    cards.first.click(); pg.wait_for_url(re.compile(r".*/day/?\?.*")); pg.wait_for_timeout(800)
    tl=pg.inner_text("ol"); print("4 day timeline:", tl.replace("\n"," | ")[:400])
    assert "Тёма" not in pg.url, "name leaked in url"
    # replace a step
    pg.locator("button:has-text('Заменить')").first.click(); pg.wait_for_timeout(300)
    opts=pg.get_by_role("dialog").locator("button:has(img), button:has(span.truncate)")
    n=pg.get_by_role("dialog").locator("button.press").count()
    print("   replace options:", n-1)
    if n>1:
        pg.get_by_role("dialog").locator("button.press").nth(1).click(); pg.wait_for_timeout(500)
        print("   replaced, url steps:", re.search(r"steps=([^&]+)", pg.url).group(1))
    with pg.expect_download() as dl:
        pg.click("text=В календарь")
    print("   ics:", dl.value.suggested_filename)
    # rain all day: indoor only
    pg.goto(B+"/planner/results?s=rain&wx=rain"); pg.wait_for_selector("a[href*='/day'][href*='?']"); 
    hrefs=[pg.locator("a[href*='/day'][href*='?']").nth(i).get_attribute("href") for i in range(pg.locator("a[href*='/day'][href*='?']").count())]
    print("5 rain plans:", [re.search(r"steps=([^&]+)", h).group(1) for h in hrefs])
    pg.goto(B+"/scenarios"); print("6 scenarios:", pg.locator("a[href*='?s=']").count())
    # стрелка «назад»: вкладка → карточка → «Назад» возвращает на вкладку (а не выбрасывает из приложения)
    pg.goto(B+"/"); pg.wait_for_timeout(600)
    pg.get_by_role("link", name="Приключения").last.click(); pg.wait_for_url(re.compile(r".*/adventures/?$")); pg.wait_for_timeout(500)
    pg.locator("a[href*='/adventures/']").first.click(); pg.wait_for_url(re.compile(r".*/adventures/[^/]+/?$")); pg.wait_for_timeout(500)
    assert pg.get_by_role("button", name="Назад").count() + pg.get_by_role("link", name="Назад").count() >= 1, "нет стрелки «назад» в приключении"
    (pg.get_by_role("button", name="Назад") if pg.get_by_role("button", name="Назад").count() else pg.get_by_role("link", name="Назад")).first.click()
    pg.wait_for_url(re.compile(r".*/adventures/?$")); print("6b back arrow ok")
    pg.goto(B+"/map?plan=paleontologichesky-muzey,dream-kids"); pg.wait_for_timeout(2500); print("7 map:", pg.locator("h2").first.inner_text())
    pg.goto(B+"/profile"); print("8 profile has minutes:", "40 мин" in pg.inner_text("main"))
    pg.goto(B+"/places/kidzania-aviapark"); pg.wait_for_timeout(500); print("9 place travel:", pg.locator("text=/\\d+ мин/").first.inner_text())
    # planner wizard with no kids path: new context
    ctx2=b.new_context(viewport={"width":390,"height":844}); ctx2.route(re.compile(r"https://(api\.open-meteo|tiles|images).*"), lambda r: r.abort())
    p2=ctx2.new_page(); p2.on("pageerror", lambda e: errs.append(("pageerror2", str(e))))
    p2.goto(B+"/planner"); p2.wait_for_timeout(800)
    print("10 wizard no kids heading:", p2.locator("h2").first.inner_text())
    p2.get_by_role("radio", name="7").click(); p2.click("text=Дальше")
    p2.click("text=3–4 часа"); p2.wait_for_timeout(400); p2.click("text=Выплеснуть энергию"); p2.wait_for_timeout(400)
    p2.click("text=до 5 000 ₽"); p2.wait_for_timeout(400); p2.click("text=Общественный транспорт"); p2.click("text=Придумать день ✨")
    p2.wait_for_url(re.compile(r".*/planner/results.*"), timeout=10000); p2.wait_for_timeout(1000)
    print("   results:", p2.inner_text("h1"), p2.locator("a[href*='/day'][href*='?']").count(), "plans; url kids:", re.search(r"kids=([^&]+)", p2.url).group(1))
    b.close()
run()
real=[e for e in errs if "ERR_FAILED" not in e[1] and "ERR_TUNNEL" not in e[1]]
print("ERRORS:", real[:10])
sys.exit(1 if real else 0)
