#!/usr/bin/env python3
"""Проверка боевого сайта глазами поискового робота (только чтение, несколько сотен запросов к kids-go.fun).
Запускается из GitHub Actions, потому что из рабочей среды разработки внешние сайты недоступны.
Результат пишется в seo-probe/result.txt и seo-probe/sitemap.tsv."""
import http.client, ssl, socket, re, time, os, sys
from urllib.parse import urlsplit, urljoin

HOST = "kids-go.fun"
UA_Y = "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)"
UA_B = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
UA_C = "curl/8.5.0"
os.makedirs("seo-probe", exist_ok=True)
OUT = open("seo-probe/result.txt", "w", encoding="utf-8")

def say(*a):
    s = " ".join(str(x) for x in a)
    print(s, flush=True)
    OUT.write(s + "\n"); OUT.flush()

def fetch(method, url, ua, limit=3_000_000):
    u = urlsplit(url)
    cls = http.client.HTTPSConnection if u.scheme == "https" else http.client.HTTPConnection
    kw = {"timeout": 25}
    if u.scheme == "https": kw["context"] = ssl.create_default_context()
    t0 = time.time()
    try:
        c = cls(u.netloc, **kw)
        c.request(method, (u.path or "/") + (("?" + u.query) if u.query else ""), headers={"User-Agent": ua, "Accept": "text/html,application/xml;q=0.9,*/*;q=0.8", "Accept-Encoding": "identity"})
        r = c.getresponse()
        body = r.read(limit) if method != "HEAD" else b""
        h = {k.lower(): v for k, v in r.getheaders()}
        c.close()
        return r.status, h, body, time.time() - t0
    except Exception as e:
        return "ERR " + type(e).__name__ + ": " + str(e)[:80], {}, b"", time.time() - t0

def chain(url, ua, method="GET"):
    hops = []
    for _ in range(6):
        st, h, body, dt = fetch(method, url, ua)
        hops.append(f"{st} {url}")
        if isinstance(st, int) and st in (301, 302, 303, 307, 308) and "location" in h:
            url = urljoin(url, h["location"])
        else:
            return hops, st, h, body
    return hops, "LOOP", {}, b""

def page_info(body):
    s = body.decode("utf-8", "replace")
    t = re.search(r"<title[^>]*>(.*?)</title>", s, re.S)
    c = re.search(r'<link[^>]+rel="canonical"[^>]+href="([^"]*)"', s) or re.search(r'<link[^>]+href="([^"]*)"[^>]+rel="canonical"', s)
    r = re.search(r'<meta[^>]+name="robots"[^>]+content="([^"]*)"', s)
    return (t.group(1).strip()[:90] if t else ""), (c.group(1) if c else ""), (r.group(1) if r else ""), len(s)

KEY = ["/", "/robots.txt", "/sitemap.xml", "/planner/", "/places/abramtsevo/", "/kuda-shodit/", "/kuda-shodit/muzei/", "/yandex_ecb6d0a4889299b5.html"]
HDRS = ["server", "content-type", "content-length", "content-encoding", "cache-control", "x-robots-tag", "last-modified", "etag", "strict-transport-security", "location", "retry-after", "x-powered-by", "via", "cf-ray", "x-cache"]

say("== A. заголовки ключевых страниц (User-Agent: YandexBot)")
for p in KEY:
    st, h, body, dt = fetch("GET", f"https://{HOST}{p}", UA_Y)
    say(f"\n{p}  ->  {st}  ({dt:.2f} c, {len(body)} байт)")
    for k in HDRS:
        if k in h: say(f"   {k}: {h[k][:120]}")
    if isinstance(st, int) and st == 200 and "html" in h.get("content-type", ""):
        say("   title/canonical/robots/длина:", page_info(body))

say("\n== B. статус по методам и User-Agent (GET / HEAD)")
say("url | UA | GET | HEAD")
for p in KEY[:6]:
    for name, ua in (("yandex", UA_Y), ("chrome", UA_B), ("curl", UA_C)):
        g = fetch("GET", f"https://{HOST}{p}", ua)[0]
        hd = fetch("HEAD", f"https://{HOST}{p}", ua)[0]
        say(f"{p} | {name} | {g} | {hd}")
        time.sleep(0.2)

say("\n== C. 503 на HEAD: серии запросов (5 раз, пауза 1 с)")
for p in ["/planner/", "/planner/results/", "/planner/results/?kids=3~7&duration=half&mood=active&budget=mid&transport=car", "/"]:
    for m in ("HEAD", "GET"):
        res = []
        for _ in range(5):
            res.append(str(fetch(m, f"https://{HOST}{p}", UA_C)[0])); time.sleep(1)
        say(f"{m} {p[:60]}: {' '.join(res)}")

say("\n== D. редиректы и граничные случаи")
tests = [f"http://{HOST}/", f"http://www.{HOST}/", f"https://www.{HOST}/", f"https://{HOST}/planner", f"https://{HOST}/places/abramtsevo",
         f"https://{HOST}/index.html", f"https://{HOST}//", f"https://{HOST}/net-takoj-stranicy/", f"https://{HOST}/places/net-takogo-mesta/",
         f"https://{HOST}/?utm_source=tg&utm_medium=social", f"https://{HOST}/robots.txt", f"https://{HOST}/sitemap.xml"]
for t in tests:
    hops, st, h, body = chain(t, UA_Y)
    say(f"{t}\n   " + "  =>  ".join(hops))
    if isinstance(st, int) and st == 200 and "html" in h.get("content-type", ""):
        say("   title/canonical/robots/длина:", page_info(body))
    time.sleep(0.2)

say("\n== E. DNS и сертификат")
for hn in (HOST, "www." + HOST):
    try:
        say(hn, sorted({a[4][0] for a in socket.getaddrinfo(hn, 443)}))
    except Exception as e:
        say(hn, "DNS:", e)
try:
    ctx = ssl.create_default_context()
    with socket.create_connection((HOST, 443), timeout=15) as s, ctx.wrap_socket(s, server_hostname=HOST) as ss:
        cert = ss.getpeercert()
        say("TLS:", ss.version(), "| до:", cert.get("notAfter"), "| издатель:", dict(x[0] for x in cert["issuer"]).get("organizationName"),
            "| SAN:", [x[1] for x in cert.get("subjectAltName", [])][:6])
except Exception as e:
    say("TLS ошибка:", e)

say("\n== F. карта сайта: все адреса глазами YandexBot")
st, h, body, dt = fetch("GET", f"https://{HOST}/sitemap.xml", UA_Y)
urls = re.findall(r"<loc>([^<]+)</loc>", body.decode("utf-8", "replace"))
say("адресов в sitemap.xml:", len(urls), "| статус:", st)
rows, bad = [], 0
for i, u in enumerate(urls):
    st, h, b, dt = fetch("GET", u, UA_Y)
    title, canon, rob, n = page_info(b) if isinstance(st, int) and st == 200 else ("", "", "", 0)
    flag = ""
    if st != 200: flag += " STATUS"
    if st == 200 and canon != u: flag += " CANON"
    if "noindex" in rob.lower() or "noindex" in h.get("x-robots-tag", "").lower(): flag += " NOINDEX"
    if st == 200 and not title: flag += " NOTITLE"
    if flag: bad += 1
    rows.append(f"{st}\t{dt:.2f}\t{n}\t{u}\t{canon if canon != u else '='}\t{title}\t{flag.strip()}")
    time.sleep(0.15)
open("seo-probe/sitemap.tsv", "w", encoding="utf-8").write("status\tsec\thtml_len\turl\tcanonical\ttitle\tflags\n" + "\n".join(rows) + "\n")
say("с проблемами:", bad)
for r in rows:
    if r.split("\t")[-1]: say("  ", r)
say("\nготово")
