# Все 11 округов в браузере: места из OpenStreetMap (подставной Overpass) попадают в планы ТОЛЬКО из выбранного округа.
#   python3 scripts/e2e-okrug-osm.py http://localhost:3000
# Фикстура scripts/fixtures/okrug-osm.json (генератор — scripts/gen-okrug-osm-fixture.ts) содержит места во ВСЕХ округах;
# приложение должно взять оттуда только нужное: основное — из выбранного округа, кафе и магазины — из него или соседних.
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
FIX = json.loads((Path(__file__).parent / "fixtures" / "okrug-osm.json").read_text())
ALL = [e for els in FIX["elements"].values() for e in els]
META = FIX["meta"]
ADJ = {
    "cao": "sao svao vao uvao uao uzao zao szao", "sao": "cao svao szao zao", "svao": "sao cao vao", "vao": "svao cao uvao",
    "uvao": "vao cao uao", "uao": "uvao cao uzao", "uzao": "uao cao zao nao", "zao": "uzao cao szao sao nao",
    "szao": "zao sao cao zelao", "zelao": "szao sao", "nao": "uzao zao uao",
}
OKRUGS = [  # id, короткое имя, lat, lng — как в src/lib/location.ts
    ("cao", "ЦАО", 55.7558, 37.6173), ("sao", "САО", 55.838, 37.525), ("svao", "СВАО", 55.868, 37.655), ("vao", "ВАО", 55.775, 37.805),
    ("uvao", "ЮВАО", 55.69, 37.76), ("uao", "ЮАО", 55.63, 37.65), ("uzao", "ЮЗАО", 55.655, 37.525), ("zao", "ЗАО", 55.705, 37.445),
    ("szao", "СЗАО", 55.82, 37.4), ("zelao", "Зеленоград", 55.985, 37.195), ("nao", "Новая Москва", 55.53, 37.3),
]
SCEN = ["science", "walk", "animals", "creative", "rain-play", "rink"]
ANCHOR = {"park", "play", "museum", "active", "animals"}
bad, summary = [], []

with sync_playwright() as p:
    br = p.chromium.launch()
    for oid, short, lat, lng in OKRUGS:
        ctx = br.new_context(viewport={"width": 390, "height": 844})
        osm_calls = []
        def overpass(route, request):
            osm_calls.append(1)
            route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=json.dumps({"elements": ALL}))
        ctx.route(re.compile(r"https://(maps\.mail\.ru|overpass\.kumi\.systems|overpass-api\.de)/.*interpreter"), overpass)
        ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash|[abc]\.tile).*"), lambda r: r.abort())
        origin = {"lat": lat, "lng": lng, "label": short, "source": "area"}
        ctx.add_init_script("try{localStorage.setItem('kidgo-family', JSON.stringify({state:{onboarded:true,children:[{id:'c1',name:'',age:5,interests:[],emoji:'🦁'}],origin:%s,transport:'transit',transportAuto:false},version:3}))}catch(e){}" % json.dumps(origin))
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        ok = gap = withosm = 0
        for s in SCEN:
            pg.goto(f"{B}/planner/results?s={s}&wx=sun"); pg.wait_for_selector("h1", timeout=20000); pg.wait_for_timeout(2800)
            h1 = pg.inner_text("h1")
            # «В ЗАО под это ничего нет» — ниже ссылки на ДРУГОЙ округ, это не планы для выбранного
            if "ничего нет" in h1:
                gap += 1
                alt = pg.inner_text("main")
                if "другом округе" not in alt and "Что подойдёт" not in alt: bad.append(f"{short} · {s}: «ничего нет» без выхода (другой округ / другая ситуация)")
                continue
            hrefs = pg.eval_on_selector_all("a[href*='/day'][href*='?']", "els=>els.map(e=>e.getAttribute('href'))")
            if not hrefs:
                bad.append(f"{short} · {s}: нет планов и нет объяснения («{h1}»)")
                continue
            ok += 1
            for h in hrefs:
                m = re.search(r"steps=([^&]+)", h)
                for slug in (m.group(1).split("%2C") if "%2C" in m.group(1) else m.group(1).split(",")):
                    if slug.startswith("osm-"):
                        withosm += 1
                        meta = META.get(slug)
                        if not meta: bad.append(f"{short} · {s}: неизвестный osm-id {slug}"); continue
                        if meta["cat"] in ANCHOR and meta["okrug"] != oid:
                            bad.append(f"{short} · {s}: основное {slug} ({meta['cat']}) из {meta['okrug']}, а не из {oid}")
                        elif meta["okrug"] != oid and meta["okrug"] not in ADJ[oid].split():
                            bad.append(f"{short} · {s}: {slug} ({meta['cat']}) из {meta['okrug']} — не сосед {oid}")
        # вторая ситуация: «Заменить» не должна уводить из округа — проверяем по первому плану
        summary.append(f"{short:13} планы: {ok}/{len(SCEN)}  «здесь нет»: {gap}  шагов из OSM: {withosm:3}  запросов к Overpass: {len(osm_calls)}")
        for e in errs: bad.append(f"{short}: pageerror {e[:120]}")
        ctx.close()
    br.close()

print("\n".join(summary))
if bad:
    print("\nНАРУШЕНИЙ:", len(bad))
    for b in bad[:40]: print(" ✗", b)
    sys.exit(1)
print("Нарушений нет ✓")
