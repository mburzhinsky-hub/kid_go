# Метрика в браузере: python3 scripts/e2e-metrika.py http://localhost:3100
# Страница открывается под именем kids-go.fun (Chromium направляет его на сервер из аргумента), а mc.yandex.ru подменён заглушкой,
# которая записывает вызовы ym(). Проверяем: что отправляется, какой адрес, и что в адресе нет параметров с данными семьи.
import sys, re, json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
port = urlparse(B).port or 80
SITE = f"http://kids-go.fun:{port}"

STUB = """
(function () {
  var log = (window.__ym = []);
  var f = function () { log.push([].slice.call(arguments)); };
  var q = (window.ym && window.ym.a) || [];
  window.ym = f;
  q.forEach(function (a) { f.apply(null, a); });
})();
"""
problems = []
def bad(m): problems.append(m); print("  ✗", m)
def ok(m): print("  ✓", m)

with sync_playwright() as p:
    br = p.chromium.launch(args=[f"--host-resolver-rules=MAP kids-go.fun 127.0.0.1"])
    def new_page(origin_host):
        ctx = br.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        sent = []
        def handler(route):
            u = route.request.url
            if "metrika/tag.js" in u:
                route.fulfill(status=200, content_type="application/javascript", body=STUB)
            else:
                sent.append(u)
                route.fulfill(status=200, body="")
        pg.route(re.compile(r"https?://([a-z0-9.-]+\.)?(yandex\.(ru|com)|yastatic\.net)/.*"), handler)
        return pg, sent

    def hits(pg):
        return [c for c in (pg.evaluate("window.__ym || []")) if len(c) >= 2 and c[1] == "hit"]
    def inits(pg):
        return [c for c in (pg.evaluate("window.__ym || []")) if len(c) >= 2 and c[1] == "init"]

    print("1. заход по рекламной ссылке с параметрами семьи")
    pg, sent = new_page("kids-go.fun")
    pg.goto(f"{SITE}/?utm_source=tg&utm_medium=social&utm_campaign=t1&kids=3~7&anchor=x", wait_until="networkidle")
    pg.wait_for_timeout(1500)
    h = hits(pg)
    if not h: bad("ни одного hit")
    else:
        ok(f"hit отправлен: {h[0][2]}")
        if "kids=" in h[0][2] or "anchor" in h[0][2]: bad("в адрес попали параметры семьи")
        if "utm_source=tg" not in h[0][2]: bad("utm не сохранён в первом hit")
    i = inits(pg)
    if not i: bad("нет init")
    else:
        o = i[0][2]
        want = {"defer": True, "webvisor": False, "clickmap": False, "trackLinks": False, "accurateTrackBounce": False}
        for k, v in want.items():
            if o.get(k) != v: bad(f"init {k}={o.get(k)!r}, нужно {v!r}")
        ok("init: defer, без Вебвизора, карты кликов, отслеживания ссылок и точного отказа")
    if sent: bad(f"лишние запросы к Яндексу: {sent}")

    print("2. страница результатов подбора (в адресе возрасты детей)")
    pg.goto(f"{SITE}/planner/results?kids=3~7&duration=half&mood=active&budget=mid&transport=car", wait_until="networkidle")
    pg.wait_for_timeout(1500)
    h = hits(pg)
    last = h[-1][2] if h else ""
    if not h: bad("нет hit на странице результатов")
    elif "?" in last or "kids" in last.split("//", 1)[-1].split("/", 1)[-1]: bad(f"в адрес hit попали параметры: {last}")
    else: ok(f"hit без параметров: {last}")
    allcalls = json.dumps(pg.evaluate("window.__ym || []"), ensure_ascii=False)
    if "kids=" in allcalls or "3~7" in allcalls: bad("возрасты детей встречаются в вызовах Метрики")
    else: ok("в вызовах Метрики нет возрастов детей")

    print("3. закрытые разделы")
    pg.goto(f"{SITE}/import?c=secret", wait_until="networkidle")
    pg.wait_for_timeout(1000)
    if hits(pg): bad(f"/import отправил hit: {hits(pg)}")
    else: ok("/import не отправляется")
    pg.goto(f"{SITE}/admin", wait_until="networkidle")
    pg.wait_for_timeout(1000)
    if hits(pg): bad("/admin отправил hit")
    else: ok("/admin не отправляется")

    print("4. исключение своих визитов")
    pg.goto(f"{SITE}/privacy/", wait_until="networkidle")
    pg.evaluate("localStorage.setItem('kg-no-metrika','1')")
    pg.goto(f"{SITE}/privacy/", wait_until="networkidle")
    pg.wait_for_timeout(1000)
    if pg.evaluate("typeof window.__ym") != "undefined" and hits(pg): bad("kg-no-metrika не сработал")
    else: ok("с kg-no-metrika счётчик не запускается")

    print("5. localhost не считается")
    pg2, sent2 = new_page("localhost")
    pg2.goto(f"{B}/", wait_until="networkidle")
    pg2.wait_for_timeout(1000)
    if pg2.evaluate("typeof window.ym") != "undefined": bad("на localhost счётчик запустился")
    else: ok("на localhost счётчика нет")
    br.close()

print("\nПроблем:", len(problems))
sys.exit(1 if problems else 0)
