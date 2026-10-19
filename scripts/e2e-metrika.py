# Метрика в браузере: python3 scripts/e2e-metrika.py http://localhost:3100
# Страница открывается под именем kids-go.fun (Chromium направляет его на сервер из аргумента), а mc.yandex.ru подменён заглушкой.
# Заглушка повторяет то, что делает настоящий тег: при загрузке отправляет служебный запрос nohit с ПОЛНЫМ адресом из строки браузера.
# Проверяем главное: ни один запрос к Яндексу не содержит параметров с данными семьи, а на «грязных» адресах счётчик вообще не стартует.
import sys, re, json
from urllib.parse import urlparse, unquote
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
  // как настоящий тег: служебный запрос nohit с полным адресом страницы
  (new Image()).src = 'https://mc.yandex.ru/watch/113672662?nohit=1&page-url=' + encodeURIComponent(location.href);
})();
"""
problems = []
def bad(m): problems.append(m); print("  ✗", m)
def ok(m): print("  ✓", m)

SECRET = re.compile(r"kids=|3~7|animals|duration=|steps=|attempt=|[?&]q=|c=secret")

with sync_playwright() as p:
    br = p.chromium.launch(args=["--host-resolver-rules=MAP kids-go.fun 127.0.0.1"])

    def new_page():
        ctx = br.new_context(viewport={"width": 390, "height": 844})
        pg = ctx.new_page()
        st = {"tag": 0, "other": []}
        def handler(route):
            u = route.request.url
            if "metrika/tag.js" in u:
                st["tag"] += 1
                route.fulfill(status=200, content_type="application/javascript", body=STUB)
            else:
                st["other"].append(unquote(u))
                route.fulfill(status=200, body="")
        pg.route(re.compile(r"https?://([a-z0-9.-]+\.)?(yandex\.(ru|com)|yastatic\.net)/.*"), handler)
        return pg, st

    def calls(pg, kind):
        return [c for c in (pg.evaluate("window.__ym || []")) if len(c) >= 2 and c[1] == kind]
    def leak(pg, st):
        blob = json.dumps(pg.evaluate("window.__ym || []"), ensure_ascii=False) + " ".join(st["other"])
        return SECRET.findall(blob)

    print("1. чистый заход по рекламной ссылке")
    pg, st = new_page()
    pg.goto(f"{SITE}/?utm_source=tg&utm_medium=social&utm_campaign=t1", wait_until="networkidle"); pg.wait_for_timeout(1500)
    h = calls(pg, "hit")
    if not h: bad("нет hit")
    else:
        ok(f"hit: {h[0][2]}")
        if "utm_source=tg" not in h[0][2]: bad("utm не сохранён")
    i = calls(pg, "init")
    if not i: bad("нет init")
    else:
        o = i[0][2]
        for k, v in {"defer": True, "webvisor": False, "clickmap": False, "trackLinks": False, "accurateTrackBounce": False}.items():
            if o.get(k) != v: bad(f"init {k}={o.get(k)!r}, нужно {v!r}")
        if "kids=" in o.get("url", "") or "kids=" in o.get("referrer", ""): bad("init.url с параметрами")
        ok("init: defer, без Вебвизора, карты кликов, отслеживания ссылок и точного отказа")
    if leak(pg, st): bad(f"утечка: {leak(pg, st)}")

    print("2. полная загрузка с параметрами семьи: счётчик не стартует")
    for url in [
        "/planner/results/?kids=6:animals.drawing,2:fairy&duration=mid&mood=surprise&budget=5000&transport=transit",
        "/search/?q=с+ребёнком+3+лет",
        "/day/?steps=a,b&title=Наш+день",
    ]:
        pg, st = new_page()
        pg.goto(SITE + url, wait_until="networkidle"); pg.wait_for_timeout(1200)
        started = pg.evaluate("typeof window.ym") != "undefined" or st["tag"] or st["other"]
        if started: bad(f"{url[:40]}…: счётчик стартовал (tag={st['tag']}, запросов={len(st['other'])})")
        else: ok(f"{url[:44]}…: счётчик не запущен, запросов к Яндексу нет")

    print("2б. рекламная ссылка с лишним параметром kids=3 (первый заход уводит на /onboarding)")
    pg, st = new_page()
    pg.goto(SITE + "/?utm_source=tg&utm_medium=social&kids=3", wait_until="networkidle"); pg.wait_for_timeout(1500)
    print("   адрес после загрузки:", pg.url.replace(SITE, ""))
    if leak(pg, st): bad(f"утечка: {leak(pg, st)}")
    else: ok(f"в запросах к Яндексу нет kids= (tag={st['tag']}, hit={len(calls(pg, 'hit'))})")

    print("3. после такого захода счётчик стартует на первом чистом адресе")
    pg, st = new_page()
    pg.goto(SITE + "/planner/results/?kids=3~7&duration=half&mood=active&budget=mid&transport=car", wait_until="networkidle"); pg.wait_for_timeout(1000)
    if st["tag"]: bad("на грязном адресе счётчик уже стартовал")
    link = pg.locator("a[href='/planner']").first
    if link.count() == 0: bad("нет ссылки на /planner")
    else:
        link.click(); pg.wait_for_timeout(2500)
        print("   адрес после клика:", pg.url.replace(SITE, ""))
        h = calls(pg, "hit")
        if not st["tag"] or not h: bad(f"счётчик не стартовал после перехода (tag={st['tag']}, hits={len(h)})")
        else: ok(f"после перехода: hit {h[-1][2]}, referer {h[-1][3].get('referer')}")
        if leak(pg, st): bad(f"утечка: {leak(pg, st)}")
        else: ok("в запросах к Яндексу нет параметров семьи")

    print("3б. счётчик уже работает, переход без перезагрузки на результаты и в закрытые разделы")
    pg, st = new_page()
    pg.goto(SITE + "/privacy/", wait_until="networkidle"); pg.wait_for_timeout(1200)
    n0 = len(calls(pg, "hit"))
    if not n0: bad("на /privacy нет hit")
    has_router = pg.evaluate("!!(window.next && window.next.router)")
    if not has_router: bad("нет window.next.router для проверки перехода")
    else:
        pg.evaluate("window.next.router.push('/planner/results?kids=3~7&duration=half&mood=active&budget=mid&transport=car')")
        pg.wait_for_timeout(2000)
        hs = calls(pg, "hit")
        if len(hs) <= n0: bad("нет hit на результатах")
        else:
            u = hs[-1][2]; ok(f"hit на результатах: {u}, referer {hs[-1][3].get('referer')}")
            if "?" in u or "kids=" in json.dumps(hs[-1][3]): bad("в hit попали параметры")
        n1 = len(calls(pg, "hit"))
        pg.evaluate("window.next.router.push('/profile')"); pg.wait_for_timeout(1500)
        if len(calls(pg, "hit")) != n1: bad("на /profile ушёл hit")
        else: ok("на /profile hit не отправляется")
        if leak(pg, st): bad(f"утечка: {leak(pg, st)}")
        else: ok("в запросах к Яндексу нет параметров семьи")

    print("4. закрытые разделы при полной загрузке")
    for url in ["/import/?c=secret", "/admin?attempt=1", "/profile/", "/cabinet/"]:
        pg, st = new_page()
        pg.goto(SITE + url, wait_until="networkidle"); pg.wait_for_timeout(1000)
        if st["tag"] or st["other"] or pg.evaluate("typeof window.ym") != "undefined": bad(f"{url}: счётчик стартовал")
        else: ok(f"{url}: запросов к Яндексу нет")

    print("5. исключение своих визитов")
    pg, st = new_page()
    pg.goto(f"{SITE}/privacy/", wait_until="networkidle")
    pg.evaluate("localStorage.setItem('kg-no-metrika','1')")
    pg.goto(f"{SITE}/privacy/", wait_until="networkidle"); pg.wait_for_timeout(1000)
    if st["tag"] > 1 or pg.evaluate("typeof window.__ym") != "undefined": bad("kg-no-metrika не сработал")
    else: ok("с kg-no-metrika счётчик не запускается")

    print("6. localhost не считается")
    pg, st = new_page()
    pg.goto(f"{B}/", wait_until="networkidle"); pg.wait_for_timeout(1000)
    if st["tag"] or pg.evaluate("typeof window.ym") != "undefined": bad("на localhost счётчик запустился")
    else: ok("на localhost счётчика нет")
    br.close()

print("\nПроблем:", len(problems))
sys.exit(1 if problems else 0)
