# Карта с подменёнными тайлами (WebGL через swiftshader): python3 scripts/e2e-map.py http://localhost:3000
# 1) /map: канвас на весь экран, маркеры каталога и мест OSM, точка выезда;
# 2) «Указать на карте»: сдвиг карты → подпись меняется → «Выехать отсюда» → точка выезда custom.
import io, json, re, sys
from pathlib import Path
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
FIX = (Path(__file__).parent / "fixtures" / "overpass-sample.json").read_text()
im = Image.new("RGB", (256, 256), (244, 239, 230)); d = ImageDraw.Draw(im)
for i in range(0, 256, 32):
    d.line([(i, 0), (i, 256)], fill=(205, 195, 175), width=2); d.line([(0, i), (256, i)], fill=(205, 195, 175), width=2)
buf = io.BytesIO(); im.save(buf, "PNG"); TILE = buf.getvalue()
errs, tiles = [], []

with sync_playwright() as p:
    br = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"])
    ctx = br.new_context(viewport={"width": 390, "height": 844}, service_workers="block")
    def handler(route):
        u = route.request.url
        cors = {"access-control-allow-origin": "*"}
        if "cartocdn" in u:
            tiles.append(u); return route.fulfill(status=200, body=TILE, headers={**cors, "content-type": "image/png"})
        if "interpreter" in u and "mail.ru" in u:
            return route.fulfill(status=200, body=FIX, headers={**cors, "content-type": "application/json"})
        route.abort()
    ctx.route(re.compile(r"https://(?!localhost).*"), handler)
    # точка выезда — посёлок из фикстуры
    origin = {"lat": 56.06, "lng": 36.98, "label": "Посёлок (тест)", "source": "custom"}
    ctx.add_init_script("localStorage.setItem('kidgo-family', JSON.stringify({state:{onboarded:true,children:[{id:'c1',name:'',age:5,interests:[],emoji:'🦁'}],origin:%s,transport:'car',transportAuto:false},version:3}))" % json.dumps(origin))
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errs.append(("pageerror", str(e))))
    pg.goto(B + "/map"); pg.wait_for_timeout(9000)
    c = pg.evaluate("()=>{const c=document.querySelector('canvas.maplibregl-canvas');return c?{cw:c.clientWidth,ch:c.clientHeight}:null}")
    print("1 canvas:", c, "| tile requests:", len(tiles))
    assert c and c["ch"] > 600, "канвас карты должен занимать экран"
    mk = pg.evaluate("()=>[...document.querySelectorAll('.kg-marker')].filter(m=>m.style.display!=='none').length")
    allm = pg.evaluate("()=>document.querySelectorAll('.kg-marker').length")
    print("   markers visible/all:", mk, "/", allm)
    assert allm > 60, "маркеры каталога и OSM должны быть созданы"
    assert pg.evaluate("()=>document.querySelectorAll('.kg-user-dot').length") >= 1, "нет точки выезда"
    pg.screenshot(path="/tmp/e2e-map.png")

    pg.goto(B + "/"); pg.wait_for_timeout(1000)
    pg.locator("header button[aria-label^='Точка выезда']").first.click()
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
    br.close()
print("ERRORS:", errs[:5])
sys.exit(1 if errs else 0)
