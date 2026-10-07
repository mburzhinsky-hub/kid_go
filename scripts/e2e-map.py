# Карта с подменёнными тайлами (WebGL через swiftshader): python3 scripts/e2e-map.py http://localhost:3000
# 1) /map: канвас на весь экран, маркеры каталога и мест OSM, точка выезда;
# 2) «Указать на карте»: сдвиг карты → подпись меняется → «Выехать отсюда» → точка выезда custom.
import io, json, re, sys
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
FIX = (Path(__file__).parent / "fixtures" / "overpass-sample.json").read_text()
def tile_png(seed):
    """Разные тайлы для разных координат (как у настоящего сервера): сетка + «шум» от адреса тайла."""
    im = Image.new("RGB", (256, 256), (244, 239, 230)); d = ImageDraw.Draw(im)
    for i in range(0, 256, 32):
        d.line([(i, 0), (i, 256)], fill=(205, 195, 175), width=2); d.line([(0, i), (256, i)], fill=(205, 195, 175), width=2)
    d.rectangle([seed % 200, (seed * 7) % 200, seed % 200 + 40, (seed * 7) % 200 + 40], fill=(200, 230, 190))
    buf = io.BytesIO(); im.save(buf, "PNG"); return buf.getvalue()
PLACEHOLDER = tile_png(0)  # «API KEY REQUIRED»: одна и та же картинка на любой запрос
def tile_for(u):
    nums = [int(n) for n in re.findall(r"/(\d+)", u)][-3:]
    return tile_png(sum(nums) + 1)
errs, tiles = [], []

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"])
    ctx = br.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
    def handler(route):
        u = route.request.url
        cors = {"access-control-allow-origin": "*"}
        # OSM «заблокирован» и отдаёт заглушку на любой тайл → источник должен быть отброшен, карта берёт osm.de
        if "tile.openstreetmap.org" in u:
            tiles.append(u); return route.fulfill(status=200, body=PLACEHOLDER, headers={**cors, "content-type": "image/png"})
        if "tile.openstreetmap.de" in u:
            tiles.append(u); return route.fulfill(status=200, body=tile_for(u), headers={**cors, "content-type": "image/png"})
        if "interpreter" in u and "mail.ru" in u:
            return route.fulfill(status=200, body=FIX, headers={**cors, "content-type": "application/json"})
        route.abort()
    ctx.route(re.compile(r"https://(?!localhost).*"), handler)
    # точка выезда — посёлок из фикстуры
    origin = {"lat": 56.06, "lng": 36.98, "label": "Посёлок (тест)", "source": "custom"}
    ctx.add_init_script("try{localStorage.setItem('kidgo-family', JSON.stringify({state:{onboarded:true,children:[{id:'c1',name:'',age:5,interests:[],emoji:'🦁'}],origin:%s,transport:'car',transportAuto:false},version:3}))}catch(e){}" % json.dumps(origin))
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(("pageerror", str(e))))
    pg.goto(B + "/map"); pg.wait_for_timeout(9000)
    c = pg.evaluate("()=>{const c=document.querySelector('canvas.maplibregl-canvas');return c?{cw:c.clientWidth,ch:c.clientHeight}:null}")
    print("1 canvas:", c, "| tile requests:", len(tiles))
    assert c and c["ch"] > 600, "канвас карты должен занимать экран"
    real = [u for u in tiles if "/9/" not in u]
    assert any("openstreetmap.de" in u for u in real), "карта должна взять рабочий источник osm.de"
    assert not any("tile.openstreetmap.org" in u for u in real), "источник-заглушка не должен использоваться для карты"
    print("   tile hosts:", sorted({re.search(r"//([^/]+)/", u).group(1) for u in real}))
    assert pg.get_by_role("button", name="Сменить карту").count() == 1
    mk = pg.evaluate("()=>[...document.querySelectorAll('.kg-marker')].filter(m=>m.style.display!=='none').length")
    allm = pg.evaluate("()=>document.querySelectorAll('.kg-marker').length")
    print("   markers visible/all:", mk, "/", allm)
    assert allm > 60, "маркеры каталога и OSM должны быть созданы"
    assert pg.evaluate("()=>document.querySelectorAll('.kg-user-dot').length") >= 1, "нет точки выезда"
    pg.screenshot(path="/tmp/e2e-map.png")
    # ручное переключение: «Сменить карту» → Яндекс; «Основная» → вернулась та же карта
    pg.get_by_role("button", name="Сменить карту").click(); pg.wait_for_timeout(500)
    assert pg.locator("iframe[title^='Карта (Яндекс)']").count() == 1, "ручное переключение на Яндекс"
    assert "Другой вид карты" in pg.get_by_role("status").first.inner_text()
    pg.get_by_role("button", name="Основная").click(); pg.wait_for_timeout(500)
    assert pg.locator("iframe[title^='Карта (Яндекс)']").count() == 0 and pg.get_by_role("button", name="Сменить карту").count() == 1, "возврат на основную карту"
    print("   manual switch ok")

    pg.goto(B + "/"); pg.wait_for_timeout(1000)
    pg.locator("button[aria-label^='Где ищем:']").first.click()
    pg.get_by_role("dialog").get_by_text("Указать на карте").click(); pg.wait_for_timeout(5000)
    dlg = pg.locator("[aria-label='Указать точку на карте']")
    print("2 picker title before:", dlg.locator("p").first.inner_text())
    box = dlg.bounding_box()
    pg.mouse.move(box["x"] + 200, box["y"] + 450); pg.mouse.down(); pg.mouse.move(box["x"] + 60, box["y"] + 300, steps=12); pg.mouse.up(); pg.wait_for_timeout(1200)
    after = dlg.locator("p").first.inner_text(); print("   after drag:", after)
    pg.screenshot(path="/tmp/e2e-picker.png")
    pg.get_by_text("Выехать отсюда").click(); pg.wait_for_timeout(600)
    st = json.loads(pg.evaluate("localStorage.getItem('kidgo-family')"))["state"]["origin"]
    print("   saved origin:", st)
    assert st["source"] == "custom" and (abs(st["lat"] - 56.06) > 0.001 or abs(st["lng"] - 36.98) > 0.001), "точка должна сместиться"
    # 3) «вся Москва» по умолчанию: карта показывается, заголовок «Лучшее в Москве», точки «я» нет
    ctx2 = br.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
    ctx2.route(re.compile(r"https://(?!localhost).*"), handler)
    ctx2.add_init_script("try{localStorage.setItem('kidgo-family', JSON.stringify({state:{onboarded:true,children:[{id:'c1',name:'',age:5,interests:[],emoji:'🦁'}]},version:3}))}catch(e){}")
    pg2 = ctx2.new_page(); pg2.on("pageerror", lambda e: errs.append(("pageerror", str(e))))
    pg2.goto(B + "/map"); pg2.wait_for_timeout(9000)
    c2 = pg2.evaluate("()=>{const c=document.querySelector('canvas.maplibregl-canvas');return c?{ch:c.clientHeight}:null}")
    print("3 any-mode canvas:", c2, "| title:", pg2.locator("h2").first.inner_text())
    assert c2 and c2["ch"] > 600
    assert "Москв" in pg2.locator("h2").first.inner_text()
    assert pg2.evaluate("()=>document.querySelectorAll('.kg-user-dot').length") == 0, "в режиме «вся Москва» точки «я» быть не должно"
    pg2.screenshot(path="/tmp/e2e-map-any.png")

    # 4) все тайл-серверы недоступны → баннер с запасными вариантами, схема и Яндекс; «Схема» рисует места
    ctx3 = br.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
    ctx3.route(re.compile(r"https://(?!localhost).*"), lambda r: r.abort())
    ctx3.add_init_script("try{localStorage.setItem('kidgo-family', JSON.stringify({state:{onboarded:true,children:[{id:'c1',name:'',age:5,interests:[],emoji:'🦁'}]},version:3}))}catch(e){}")
    pg3 = ctx3.new_page(); pg3.on("pageerror", lambda e: errs.append(("pageerror", str(e))))
    pg3.goto(B + "/map"); pg3.wait_for_timeout(6000)
    banner = pg3.get_by_role("status").first
    print("4 offline banner:", banner.inner_text().replace("\n", " | "))
    assert pg3.locator("iframe[title^='Карта (Яндекс)']").count() == 1, "должна открыться карта Яндекса"
    src = pg3.locator("iframe").first.get_attribute("src"); print("   yandex src:", src[:140])
    pg3.get_by_role("button", name="Схема").click(); pg3.wait_for_timeout(800)
    assert pg3.get_by_text("Схема округов и расстояний").count() == 1
    print("   schematic markers:", pg3.evaluate("()=>document.querySelectorAll('button').length"))
    pg3.screenshot(path="/tmp/e2e-map-fallback.png")
    br.close()
print("ERRORS:", errs[:5])
sys.exit(1 if errs else 0)
