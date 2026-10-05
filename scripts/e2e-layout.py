# Вёрстка: python3 scripts/e2e-layout.py http://localhost:3000 [папка для скриншотов]
# Все экраны × телефоны / планшет / ноутбук: горизонтальный «выезд» контента, элементы за краем колонки,
# фиксированные панели, которые не помещаются по высоте, и наличие стрелки «назад» на внутренних экранах.
import re, sys, json, os
from playwright.sync_api import sync_playwright
B = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
SHOTS = sys.argv[2] if len(sys.argv) > 2 else None
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
VIEWPORTS = [(320, 568), (360, 640), (375, 667), (390, 844), (430, 932), (768, 1024), (1280, 720), (1366, 650), (1536, 730)]
ROUTES = [
    ("/", "home", False),
    ("/map", "map", False),
    ("/adventures", "adventures", False),
    ("/adventures/den-dinozavrov", "adventure", True),
    ("/places/moskovsky-zoopark", "place", True),
    ("/favorites", "favorites", False),
    ("/profile", "profile", False),
    ("/search", "search", True),
    ("/planner", "planner", True),
    ("/planner/results?s=science", "results", True),
    ("/planner/results?s=science&wide=1", "results-wide", True),
    ("/scenarios", "scenarios", True),
    ("/day?steps=moskovsky-zoopark,kafe-zelyony-slon&title=Тест&emoji=%F0%9F%8C%BF&start=12:00&d=90,60", "day", True),
]
problems = []

JS_OVERFLOW = r"""
() => {
  const vw = document.documentElement.clientWidth;
  const col = document.querySelector('main')?.parentElement;
  const colR = col ? col.getBoundingClientRect() : { left: 0, right: vw };
  const limit = Math.min(vw, colR.right) + 2;
  const out = [];
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return true;
      if (/(hidden|clip)/.test(cs.overflowX)) return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll('main *, nav *, header *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed' && r.right <= limit) continue;
    if (r.right > limit && !inScroller(el)) {
      out.push({ tag: el.tagName.toLowerCase(), cls: (el.className && el.className.toString().slice(0, 70)) || '', text: (el.textContent || '').trim().slice(0, 40), right: Math.round(r.right), limit: Math.round(limit) });
      if (out.length > 6) break;
    }
  }
  return {
    docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyOverflow: document.body.scrollWidth - document.documentElement.clientWidth,
    items: out,
  };
}
"""
JS_FIXED = r"""
() => {
  const vh = window.innerHeight, out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.height > vh * 0.98 && el.tagName === 'MAIN') continue; // карта на весь экран
    if (r.bottom > vh + 1 || r.top < -1) out.push({ tag: el.tagName.toLowerCase(), cls: el.className.toString().slice(0, 60), top: Math.round(r.top), bottom: Math.round(r.bottom), vh });
  }
  return out;
}
"""
JS_BACK = r"""
() => !!document.querySelector('button[aria-label="Назад"], a[aria-label="Назад"], button[aria-label="На главную"], button[aria-label="Закрыть"]')
"""
def onboard(b):
    ctx = b.new_context(viewport={"width": 390, "height": 844})
    ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash|[abc]\.tile).*"), lambda r: r.abort())
    pg = ctx.new_page()
    pg.goto(B + "/"); pg.wait_for_url(re.compile(r".*/onboarding/?$"), timeout=15000)
    pg.click("text=Начнём")
    pg.get_by_role("radio", name="5").click()
    pg.click("text=Динозавры")
    pg.click("text=Дальше")
    pg.get_by_role("button", name="СЗАО", exact=True).click()
    pg.click("text=Поехали! 🚀"); pg.wait_for_timeout(1200)
    st = ctx.storage_state()
    ctx.close()
    return st

JS_CTA = r"""
() => {
  const vh = innerHeight;
  const b = [...document.querySelectorAll('button')].find(e => /^(Начнём|Дальше|Поехали)/.test((e.textContent || '').trim()) && e.getBoundingClientRect().height > 0);
  if (!b) return { err: 'нет кнопки' };
  const r = b.getBoundingClientRect();
  return { vh, bottom: Math.round(r.bottom), top: Math.round(r.top), page: document.documentElement.scrollHeight };
}
"""
def check_onboarding(b):
    """Знакомство: на каждом шаге кнопка «Дальше» видна без прокрутки и страница не выше экрана."""
    for (w, h) in VIEWPORTS:
        ctx = b.new_context(viewport={"width": w, "height": h})
        ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash|[abc]\.tile).*"), lambda r: r.abort())
        pg = ctx.new_page()
        pg.goto(B + "/"); pg.wait_for_url(re.compile(r".*/onboarding/?$"), timeout=15000); pg.wait_for_timeout(500)
        def chk(step):
            r = pg.evaluate(JS_CTA)
            if r.get("err") or r["bottom"] > r["vh"] + 1 or r["top"] < 0 or r["page"] > r["vh"] + 1:
                problems.append(f"{w}x{h} знакомство/{step}: кнопка не на экране {r}")
        chk("1")
        pg.click("text=Начнём"); pg.wait_for_timeout(300); chk("2")
        pg.get_by_role("radio", name="5").click(); pg.click("text=Динозавры"); pg.wait_for_timeout(300); chk("2+")
        pg.click("text=Дальше"); pg.wait_for_timeout(300); chk("3")
        ctx.close()

def main():
    with sync_playwright() as p:
        b = p.chromium.launch()
        check_onboarding(b)
        st = onboard(b)
        for (w, h) in VIEWPORTS:
            ctx = b.new_context(viewport={"width": w, "height": h}, storage_state=st)
            ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash|[abc]\.tile).*"), lambda r: r.abort())
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e: errs.append(str(e)))
            for (path, name, inner) in ROUTES:
                try:
                    pg.goto(B + path, wait_until="domcontentloaded")
                    pg.wait_for_timeout(1800 if name in ("map", "results", "results-wide") else 900)
                except Exception as e:
                    problems.append(f"{w}x{h} {name}: не открылась ({str(e)[:80]})"); continue
                r = pg.evaluate(JS_OVERFLOW)
                tag = f"{w}x{h} {name}"
                if r["docOverflow"] > 1 or r["bodyOverflow"] > 1:
                    problems.append(f"{tag}: страница шире экрана на {max(r['docOverflow'], r['bodyOverflow'])}px")
                for it in r["items"]:
                    problems.append(f"{tag}: за краем колонки <{it['tag']}> «{it['text']}» right={it['right']} > {it['limit']} [{it['cls']}]")
                for f in pg.evaluate(JS_FIXED):
                    problems.append(f"{tag}: фиксированный блок не помещается <{f['tag']}> top={f['top']} bottom={f['bottom']} vh={f['vh']} [{f['cls']}]")
                if inner and w <= 480 and not pg.evaluate(JS_BACK):
                    problems.append(f"{tag}: нет стрелки «назад»")
                if SHOTS and (w, h) in [(320, 568), (390, 844), (1366, 650)]:
                    pg.screenshot(path=f"{SHOTS}/{w}x{h}-{name}.png")
            for e in errs: problems.append(f"{w}x{h}: pageerror {e[:120]}")
            ctx.close()
        b.close()
    seen = []
    for x in problems:
        if x not in seen: seen.append(x)
    print(f"Проблем: {len(seen)}")
    for x in seen[:80]: print(" ✗", x)
    sys.exit(1 if seen else 0)
main()
