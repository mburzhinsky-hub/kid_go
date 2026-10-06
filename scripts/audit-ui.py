# Аудит интерфейса: python3 scripts/audit-ui.py http://localhost:3000 [папка для JSON/скриншотов]
# Все экраны × размеры телефонов: зоны нажатия, шрифты (размер/семейство), иконки (размер/толщина),
# контраст текста, симметрия полей, обрезанный/переломленный текст, кнопки без названия,
# поля ввода <16px (iOS-зум), картинки без alt, консольные ошибки.
# Выход: код 1, если есть жёсткие нарушения (HARD); мягкие (SOFT) — предупреждения.
import re, sys, json, os, collections
from playwright.sync_api import sync_playwright

B = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000").rstrip("/")
OUT = sys.argv[2] if len(sys.argv) > 2 else None
if OUT: os.makedirs(OUT, exist_ok=True)

VIEWPORTS = [(320, 640), (360, 740), (390, 844), (430, 932), (768, 1024)]
ROUTES = [
    "/", "/scenarios/", "/adventures/", "/adventures/den-dinozavrov/", "/map/", "/search/", "/favorites/", "/profile/",
    "/planner/", "/planner/results/?s=science", "/planner/results/?s=rain", "/planner/results/?s=picnic", "/planner/results/?s=rink",
    "/places/moskovsky-zoopark/", "/places/depo-food-hall/", "/places/park-sokolniki/", "/places/akvapark-moreon/",
    "/collections/", "/collections/new/", "/nearby/", "/day/?steps=moskovsky-zoopark,jooie-presnya&title=Тест&emoji=%F0%9F%8C%BF&start=12:00&d=90,60",
]

JS = r"""
() => {
  const vw = document.documentElement.clientWidth;
  const vis = (el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05; };
  const sel = (el) => { const t = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 36); return el.tagName.toLowerCase() + (t ? `«${t}»` : '') ; };
  const res = { vw, tap: [], small: [], fonts: {}, weights: {}, families: {}, icons: {}, strokes: {}, noname: [], noalt: [], inputs: [], contrast: [], clipped: [], broken: [], gutters: [], h1: 0, overlap: [], errors: [] };
  const col = document.querySelector('main')?.parentElement; const colR = col ? col.getBoundingClientRect() : { left: 0, right: vw, width: vw };
  res.h1 = document.querySelectorAll('h1').length;
  res.lint = [];
  { const body = document.body.innerText || ''; const bad = [/≈\s*≈/, /\(\s*0\s*\)/, /\bundefined\b/, /\bNaN\b/, /\[object/, /\bnull\b/, /«\s*«/, /»\s*»/, /,\s*,/, /\s—\s—/, /:\s*—\s/, /\.\./, /\{\{|\}\}/];
    for (const re of bad) { const m = body.match(re); if (m) res.lint.push(m[0] + ' … ' + body.slice(Math.max(0, m.index - 25), m.index + 30).replace(/\n/g, ' ')); } }

  // ── зоны нажатия (с учётом невидимой зоны ::after и label вокруг поля ввода)
  const inText = (el) => { const p = el.closest('p, li'); return !!p && el.tagName === 'A' && p.textContent.trim().length > el.textContent.trim().length + 8; };
  const effRect = (el) => {
    let w = el.getBoundingClientRect().width, h = el.getBoundingClientRect().height;
    const a = getComputedStyle(el, '::after');
    if (a.content !== 'none' && a.position === 'absolute') { w = Math.max(w, parseFloat(a.width) || 0); h = Math.max(h, parseFloat(a.height) || 0); }
    return { w, h };
  };
  for (const el of document.querySelectorAll('a[href], button, [role=button], [role=tab], input:not([type=hidden]), select, textarea, summary, label')) {
    if (!vis(el)) continue;
    if (el.tagName === 'LABEL' && !el.querySelector('input,textarea,select')) continue;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) && el.closest('label')) continue;
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > 20000) continue;
    if (inText(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'absolute' && el.tagName === 'A' && r.width * r.height > 0.5 * vw * vw) continue; // оверлей-ссылка поверх карточки
    const e = effRect(el);
    if (e.w < 44 || e.h < 44) res.tap.push({ s: sel(el), w: Math.round(e.w), h: Math.round(e.h), cls: el.className.toString().slice(0, 60) });
  }

  // ── кнопки/ссылки без названия, картинки без alt, поля ввода
  for (const el of document.querySelectorAll('a[href], button, [role=button]')) {
    if (!vis(el)) continue;
    const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\s+/g, '').trim() || (el.getAttribute('aria-labelledby') ? 'x' : '') || el.querySelector('img[alt]:not([alt=""])')?.alt;
    if (!name) res.noname.push({ s: el.tagName.toLowerCase(), cls: el.className.toString().slice(0, 60), w: Math.round(el.getBoundingClientRect().width) });
  }
  for (const im of document.querySelectorAll('img')) if (vis(im) && im.getAttribute('alt') == null) res.noalt.push(im.src.slice(-40));
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, select')) {
    if (!vis(el)) continue; const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 16) res.inputs.push({ s: sel(el), fs });
  }

  // ── шрифты: размер/вес/семейство по реальным текстовым узлам
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const lumin = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const blend = (fg, bg) => [fg[0] * fg[3] + bg[0] * (1 - fg[3]), fg[1] * fg[3] + bg[1] * (1 - fg[3]), fg[2] * fg[3] + bg[2] * (1 - fg[3]), 1];
  const bgOf = (el) => { // непрозрачный фон; null если под текстом картинка/градиент
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none') return null;
      const c = parse(cs.backgroundColor); if (c && c[3] > 0) { stack.push(c); if (c[3] >= 0.999) break; }
    }
    if (stack.length === 0) return 'page';
    let base = [251, 250, 247, 1];
    for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base);
    return base;
  };
  const seen = new Set(); let node;
  while ((node = walker.nextNode())) {
    const t = node.textContent.replace(/\s+/g, ' ').trim(); if (!t) continue;
    const el = node.parentElement; if (!el || !vis(el)) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize); const w = cs.fontWeight;
    res.fonts[fs] = (res.fonts[fs] || 0) + t.length; res.weights[w] = (res.weights[w] || 0) + t.length;
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim(); res.families[fam] = (res.families[fam] || 0) + t.length;
    if (fs < 12 && !seen.has(el)) { seen.add(el); res.small.push({ s: sel(el), fs, t: t.slice(0, 30) }); }
    // контраст
    const key = cs.color + '|' + fs + '|' + w + '|' + (el.className || '').toString().slice(0, 30);
    if (!seen.has(key)) {
      seen.add(key);
      const fg = parse(cs.color); let bg = bgOf(el);
      if (fg && fg[0] > 235 && fg[1] > 235 && fg[2] > 235) { let a = el, onPhoto = false; for (let i = 0; i < 6 && a; i++, a = a.parentElement) { if (a.querySelector && a.querySelector('img, [class*="inset-0"], svg[aria-hidden]')) { onPhoto = true; break; } } if (onPhoto) bg = null; }
      if (bg === 'page') bg = fg && fg[0] > 235 && fg[1] > 235 && fg[2] > 235 ? null : [251, 250, 247, 1]; // белый текст без фона — поверх картинки
      const brand = bg && Math.abs(bg[0] - 255) < 2 && Math.abs(bg[1] - 46) < 3 && Math.abs(bg[2] - 136) < 3 && fg && fg[0] > 240; // белый на фирменном розовом — фирменная кнопка
      if (fg && bg && !brand && !el.closest('[aria-hidden=true]')) {
        const f = blend(fg, bg); const L1 = lumin(f), L2 = lumin(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        const large = fs >= 24 || (fs >= 18.66 && +w >= 700);
        if (cr < (large ? 3 : 4.5)) res.contrast.push({ s: sel(el), cr: Math.round(cr * 100) / 100, fs, color: cs.color, t: t.slice(0, 30) });
      }
    }
  }

  // ── иконки
  for (const sv of document.querySelectorAll('svg')) {
    if (!vis(sv)) continue; const r = sv.getBoundingClientRect(); const k = Math.round(r.width) + '×' + Math.round(r.height);
    res.icons[k] = (res.icons[k] || 0) + 1;
    const sw = sv.getAttribute('stroke-width'); if (sw && sv.classList.contains('lucide')) res.strokes[sw] = (res.strokes[sw] || 0) + 1;
  }

  // ── обрезанный текст и переломленные слова
  for (const el of document.querySelectorAll('main *, header *, nav *')) {
    if (!vis(el)) continue; const cs = getComputedStyle(el);
    if (el.children.length === 0 && el.textContent.trim() && /(hidden|clip)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && !cs.webkitLineClamp && cs.display !== 'inline' && el.scrollWidth > el.clientWidth + 1)
      res.clipped.push({ s: sel(el), sw: el.scrollWidth, cw: el.clientWidth });
  }
  const w2 = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT); let n2, cnt = 0;
  while ((n2 = w2.nextNode()) && cnt < 1500) {
    const el = n2.parentElement; if (!el || !vis(el) || el.closest('[aria-hidden=true]')) continue;
    const text = n2.textContent; const re = /[A-Za-zА-Яа-яЁё0-9₽.\-–:]{7,}/g; let m;
    while ((m = re.exec(text)) && cnt < 1500) {
      cnt++; const rg = document.createRange(); rg.setStart(n2, m.index); rg.setEnd(n2, m.index + m[0].length);
      const rects = [...rg.getClientRects()].filter((q) => q.width > 1);
      const tops = new Set(rects.map((q) => Math.round(q.top / 4)));
      if (tops.size > 1 && !/-/.test(m[0]) && !/^\d{1,2}:\d{2}–/.test(m[0]) && getComputedStyle(el).hyphens !== 'auto') res.broken.push({ w: m[0], s: sel(el) });
    }
  }

  // ── симметрия полей: блоки на всю ширину колонки
  const main = document.querySelector('main');
  if (main) {
    const inScroll = (el) => { for (let p = el.parentElement; p && p !== main; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth + 1) return true; } return false; };
    for (const el of main.querySelectorAll(':scope > *, :scope > * > *, :scope > * > * > *')) {
      if (!vis(el) || inScroll(el)) continue; const r = el.getBoundingClientRect();
      if (r.width < colR.width * 0.55 || r.height < 24) continue;
      const cs = getComputedStyle(el); if (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky') continue;
      const boxy = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0 || el.tagName === 'IMG';
      if (!boxy) continue;
      const pcs = el.parentElement ? getComputedStyle(el.parentElement) : null;
      if (pcs && ((pcs.display.includes('flex') && pcs.flexDirection.startsWith('row') && el.parentElement.children.length > 1) || pcs.display.includes('grid'))) continue;
      const l = Math.round((r.left - colR.left) * 10) / 10, rr = Math.round((colR.right - r.right) * 10) / 10;
      if (Math.abs(l - rr) > 1.5 && r.right <= colR.right + 1 && r.left >= colR.left - 1) res.gutters.push({ s: sel(el), l, r: rr, cls: el.className.toString().slice(0, 50) });
    }
  }

  // ── фиксированные панели не перекрывают последние элементы
  const fixed = [...document.querySelectorAll('body *')].filter((e) => getComputedStyle(e).position === 'fixed' && vis(e) && e.getBoundingClientRect().height < 200 && e.getBoundingClientRect().width > 100);
  const mainEls = [...document.querySelectorAll('main a[href], main button, main p, main h1, main h2, main h3')].filter(vis);
  window.scrollTo(0, document.documentElement.scrollHeight);
  res.fixedTops = fixed.map((e) => Math.round(e.getBoundingClientRect().top));
  res.vh = window.innerHeight; res.docH = document.documentElement.scrollHeight;
  res.lastBottom = Math.max(0, ...mainEls.filter((e) => getComputedStyle(e).position !== 'fixed' && !e.closest('[class*=fixed]')).map((e) => e.getBoundingClientRect().bottom));
  window.scrollTo(0, 0);
  return res;
}
"""

HARD, SOFT = [], []
agg = collections.defaultdict(lambda: collections.defaultdict(int))
allres = {}

def add(level, route, vp, msg):
    (HARD if level == "H" else SOFT).append(f"{route} @{vp}: {msg}")

with sync_playwright() as p:
    b = p.chromium.launch()
    for (w, h) in VIEWPORTS:
        ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=w < 500, device_scale_factor=2 if w < 500 else 1)
        ctx.add_init_script("try{localStorage.setItem('kidgo-family', JSON.stringify({state:{onboarded:true,children:[{id:'c1',name:'',age:5,interests:[],emoji:'🦁'}],transport:'transit',transportAuto:false},version:3}));sessionStorage.setItem('kidgo-onb-shown','1')}catch(e){}")
        ctx.route(re.compile(r"https://(api\.open-meteo|tiles\.openfreemap|images\.unsplash|[a-z]\.tile).*"), lambda r: r.abort())
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
        pg.on("console", lambda m: errs.append(m.text[:120]) if m.type == "error" and "ERR_FAILED" not in m.text and "Failed to load resource" not in m.text else None)
        for r in ROUTES:
            errs.clear()
            try:
                pg.goto(B + r, wait_until="load"); pg.wait_for_timeout(1400)
            except Exception as e:
                add("H", r, w, f"не открылся: {str(e)[:80]}"); continue
            d = pg.evaluate(JS); allres[f"{w}{r}"] = d
            name = f"{w}{r.split('?')[0].strip('/').replace('/', '_') or 'home'}"
            if OUT and w in (320, 390): pg.screenshot(path=f"{OUT}/{name}-{r.split('=')[-1] if '?' in r else ''}.png".replace("-.png", ".png"), full_page=True)
            if errs: add("H", r, w, f"ошибки консоли: {errs[:2]}")
            if d["h1"] != 1 and r not in ("/map/",): add("S", r, w, f"h1 = {d['h1']}")
            for t in d["tap"]: add("S" if min(t["w"], t["h"]) >= 36 else "H", r, w, f"зона нажатия {t['w']}×{t['h']}: {t['s']} [{t['cls']}]")
            for t in d["noname"]: add("H", r, w, f"кнопка/ссылка без названия: {t['s']} [{t['cls']}]")
            for t in d["noalt"]: add("S", r, w, f"img без alt: {t}")
            for t in d["lint"]: add("H", r, w, f"подозрительный текст: {t}")
            for t in d["inputs"]: add("H", r, w, f"поле {t['fs']}px (<16 — iOS зумит): {t['s']}")
            for t in d["small"]:
                if t["fs"] >= 11 or (t["fs"] >= 10 and t["t"] in ("Главная", "Карта", "Приключения", "Избранное", "Профиль")): continue
                add("S" if t["fs"] >= 11 else "H", r, w, f"мелкий шрифт {t['fs']}px: {t['s']} «{t['t']}»")
            for t in d["contrast"]: add("S", r, w, f"контраст {t['cr']} ({t['fs']}px): {t['s']}")
            for t in d["clipped"]: add("H", r, w, f"текст обрезан {t['sw']}>{t['cw']}: {t['s']}")
            for t in d["broken"]: add("H", r, w, f"слово переломлено: «{t['w']}» в {t['s']}")
            for t in d["gutters"]: add("S", r, w, f"несимметричные поля слева {t['l']} / справа {t['r']}: {t['s']} [{t['cls']}]")
            for k, v in d["fonts"].items(): agg["fonts"][k] += v
            for k, v in d["families"].items(): agg["families"][k] += v
            for k, v in d["weights"].items(): agg["weights"][k] += v
            for k, v in d["icons"].items(): agg["icons"][k] += v
            for k, v in d["strokes"].items(): agg["strokes"][k] += v
        ctx.close()
    b.close()

if OUT: json.dump(allres, open(f"{OUT}/ui-audit.json", "w"), ensure_ascii=False)
# сводка: дубли по (маршрут, сообщение) схлопываем по размерам экранов
def squash(items):
    d = collections.OrderedDict()
    for it in items:
        route, rest = it.split(" @", 1); vp, msg = rest.split(": ", 1)
        d.setdefault((route, msg), []).append(vp)
    return [f"{r}  [{','.join(v)}]  {m}" for (r, m), v in d.items()]
print("\n== ШРИФТЫ (px → символов):", dict(sorted(((float(k), v) for k, v in agg["fonts"].items()))))
print("== СЕМЕЙСТВА:", dict(agg["families"]))
print("== ВЕСА:", dict(agg["weights"]))
print("== ИКОНКИ (размер → шт):", dict(sorted(agg["icons"].items(), key=lambda kv: -kv[1])[:24]))
print("== ТОЛЩИНА ЛИНИЙ lucide:", dict(agg["strokes"]))
print(f"\n== ЖЁСТКИЕ: {len(HARD)}")
for s in squash(HARD)[:150]: print("  ✗", s)
print(f"\n== МЯГКИЕ: {len(SOFT)}")
for s in squash(SOFT)[:260]: print("  ·", s)
sys.exit(1 if HARD else 0)
