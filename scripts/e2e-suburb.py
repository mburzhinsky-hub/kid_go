# Загород: python3 scripts/e2e-suburb.py http://localhost:3000
# Посёлок за МКАД, где в каталоге почти ничего нет: поиск адреса (геокодер подменён) → фоновая загрузка мест из OSM
# (Overpass подменён фикстурой) → планы с этими местами → карточка «места рядом» → «Наш день» после перезагрузки → карта.
import json, re, sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
ORIGIN = "{0.scheme}://{0.netloc}".format(urlparse(B))  # href-ы в статической выгрузке уже содержат basePath
FIX = (Path(__file__).parent / "fixtures" / "overpass-sample.json").read_text()
HIT = [{"lat": "56.06", "lon": "36.98", "name": "Тестовый посёлок", "display_name": "Тестовый посёлок, Московская область, Россия"}]
errs, overpass_calls = [], []

def run():
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash|[abcd]\.basemaps|tile\.openstreetmap).*"), lambda r: r.abort())
        ctx.route(re.compile(r"https://nominatim\.openstreetmap\.org/.*"), lambda r: r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps(HIT)))
        def overpass(r):
            overpass_calls.append(r.request.url)
            if "mail.ru" in r.request.url:  # остальные зеркала «лежат» — берётся первое ответившее
                r.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=FIX)
            else:
                r.abort()
        ctx.route(re.compile(r"https://(maps\.mail\.ru|overpass\.kumi\.systems|overpass-api\.de)/.*interpreter"), overpass)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errs.append(("pageerror", str(e))))
        pg.on("console", lambda m: m.type == "error" and errs.append(("console", m.text[:200])))

        # онбординг → возраст → точка выезда поиском
        pg.goto(B + "/"); pg.wait_for_url(re.compile(r".*/onboarding/?$"), timeout=8000)
        pg.click("text=Начнём"); pg.get_by_role("radio", name="5").click(); pg.click("text=Дальше")
        pg.click("text=Выбрать район")
        dlg = pg.get_by_role("dialog")
        dlg.get_by_placeholder("Город, посёлок или улица").fill("Тестовый посёлок")
        dlg.locator("ul button").first.wait_for(timeout=8000)
        dlg.locator("ul button").first.click(); pg.wait_for_timeout(300)
        assert "Тестовый посёлок" in pg.inner_text("main"), "origin from search not shown"
        print("1 origin by search ok")
        pg.click("text=Поехали! 🚀"); pg.wait_for_url(B + "/"); pg.wait_for_timeout(2500)
        assert overpass_calls, "Overpass не вызывался для посёлка с пустым каталогом"
        print("2 overpass calls:", len(overpass_calls), "(first-win from mirrors)")
        cache = pg.evaluate("localStorage.getItem('kidgo-osm-v1')")
        assert cache and "Центральный парк" in cache, "кэш ячейки не записан"
        print("   cache bytes:", len(cache))
        state = json.loads(pg.evaluate("localStorage.getItem('kidgo-family')"))["state"]
        print("   transport auto:", state.get("transport"), "| origin:", state["origin"]["label"], state["origin"]["source"])
        assert state["transport"] == "car", "за МКАД по умолчанию машина"

        # планы из OSM-мест
        pg.goto(B + "/planner/results?mood=surprise&duration=mid&budget=any"); pg.wait_for_selector("h1"); pg.wait_for_timeout(1500)
        print("3 results:", pg.inner_text("h1"))
        hrefs = [pg.locator("a[href*='/day'][href*='steps=']").nth(i).get_attribute("href") for i in range(pg.locator("a[href*='/day'][href*='steps=']").count())]
        steps = [re.search(r"steps=([^&]+)", h).group(1).replace("%2C", ",") for h in hrefs]
        print("   plans:", steps)
        assert hrefs, "нет планов в посёлке"
        assert any("osm-" in s for s in steps), "ни одного локального места из OSM в планах"
        body = pg.inner_text("main")
        assert "(0)" not in body, "показан рейтинг без отзывов"

        # «Наш день» c OSM-местами переживает перезагрузку
        href = next(h for h, s in zip(hrefs, steps) if "osm-" in s)
        pg.goto(ORIGIN + href); pg.wait_for_timeout(1200)
        tl = pg.inner_text("ol"); print("4 day:", tl.replace("\n", " | ")[:220])
        pg.reload(); pg.wait_for_timeout(1500)
        assert "Заменить" in pg.inner_text("ol"), "день с OSM-местами не восстановился после перезагрузки"
        print("   reload ok")

        # карточка места рядом
        pg.goto(B + "/nearby?id=osm-w1001"); pg.wait_for_timeout(1500)
        t = pg.inner_text("main"); print("5 nearby page:", t[:90].replace("\n", " | "))
        assert "Центральный парк" in t and "OpenStreetMap" in t, "карточка места рядом"
        assert not re.search(r"\(\d+\)", t.split("Центральный парк")[0]), "рейтинг без отзывов на герое"
        pg.goto(B + "/nearby?id=osm-w999999"); pg.wait_for_timeout(1200)
        assert "не нашлось" in pg.inner_text("main"), "несуществующее место → понятное сообщение"
        print("   unknown id handled")

        # карта: тайлов нет → схема; места из OSM на ней
        pg.goto(B + "/map"); pg.wait_for_timeout(11500)
        print("6 map heading:", pg.locator("h2").first.inner_text(), "| markers:", pg.locator("main button[aria-label]").count())
        assert "Схема расстояний" in pg.inner_text("main") or pg.locator("canvas").count() > 0
        pg.screenshot(path="/tmp/e2e-suburb-map.png")

        # поиск «в инкогнито»: нашли и место OSM
        pg.goto(B + "/search?q=библиотека"); pg.wait_for_timeout(1200)
        print("7 search:", pg.inner_text("main")[:200].replace("\n", " | "))
        assert "Детская библиотека" in pg.inner_text("main")
        # общая ссылка на день с OSM-местами открывается на «чужом» устройстве: места подтягиваются по id
        ctx2 = b.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
        ctx2.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash).*"), lambda r: r.abort())
        ctx2.route(re.compile(r"https://(maps\.mail\.ru|overpass\.kumi\.systems|overpass-api\.de)/.*interpreter"), overpass)
        p2 = ctx2.new_page()
        p2.on("pageerror", lambda e: errs.append(("pageerror2", str(e))))
        p2.goto(ORIGIN + href); p2.wait_for_timeout(2500)
        tl2 = p2.inner_text("main")
        assert "Заменить" in tl2 or "Детская площадка" in tl2, "общая ссылка с OSM-местами не открылась"
        print("8 shared link ok:", tl2[:80].replace("\n", " | "))

        # «Указать на карте»: тайлов нет → честное сообщение, поиск остаётся рабочим
        pg.goto(B + "/"); pg.wait_for_timeout(800)
        pg.locator("header button[aria-label^='Точка выезда']").first.click()
        pg.get_by_role("dialog").get_by_text("Указать на карте").click(); pg.wait_for_timeout(12000)
        assert pg.get_by_text("Карта не загрузилась").count() > 0, "нет сообщения, что карта не загрузилась"
        pg.get_by_text("Вернуться к поиску").click(); pg.wait_for_timeout(300)
        assert pg.get_by_placeholder("Город, посёлок или улица").count() > 0
        print("9 map picker fallback ok")
        b.close()

run()
real = [e for e in errs if "ERR_FAILED" not in e[1] and "ERR_TUNNEL" not in e[1] and "net::ERR_" not in e[1]]
print("ERRORS:", real[:10])
sys.exit(1 if real else 0)
