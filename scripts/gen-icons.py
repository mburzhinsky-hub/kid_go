# Иконки приложения: python3 scripts/gen-icons.py
# Рисует мастер 1024×1024 в Chromium (шрифт Nunito 900 из node_modules) — белый глянцевый «леденец» с цветными
# буквами Kids Go, как в логотипе, — и режет на размеры:
#  apple-touch-icon 180 (без прозрачности и скруглений — iOS скругляет сам), icon-192/512 (скруглённые «any»),
#  maskable-512 (полная заливка, содержимое в безопасной зоне 80%), favicon-48 (одна буква K — надпись в 48px не читается).
import base64, io, os
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "icons")
FONT = os.path.join(ROOT, "node_modules/@fontsource/nunito/files/nunito-latin-900-normal.woff2")
font_b64 = base64.b64encode(open(FONT, "rb").read()).decode()

COLORS = {  # верх → низ градиента буквы (цвета логотипа в шапке)
    "K": ("#43d985", "#14924a"), "i": ("#ffb84d", "#f07d00"), "d": ("#ff6b5e", "#e0261c"),
    "s": ("#ffd84d", "#f2a600"), "G": ("#7b7bff", "#3030d8"), "o": ("#55d6f5", "#0f9fcc"),
}

def lg(i, top, bot):
    return f'<linearGradient id="{i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{top}"/><stop offset="1" stop-color="{bot}"/></linearGradient>'

def sun(x, y, s=1.0):
    rays = "".join(f'<rect x="-13" y="-114" width="26" height="46" rx="13" fill="url(#ray)" transform="rotate({a})"/>' for a in (-62, -21, 21, 62))
    return (f'<g transform="translate({x} {y}) scale({s})" filter="url(#sh2)">{rays}<circle r="50" fill="url(#orb)"/>'
            f'<ellipse cx="-14" cy="-22" rx="22" ry="13" fill="#fff" opacity="0.8" transform="rotate(-30 -14 -22)"/></g>')

def letter(ch, x, y, size, rot):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="url(#g{ch})" transform="rotate({rot} {x} {y})">{ch}</text>'

def svg(scale=1.0, radius=0, favicon=False):
    c = 512
    if favicon:
        body = letter("K", 470, 820, 880, -4) + sun(800, 230, 1.1)
    else:
        body = (letter("K", 249, 466, 350, -6) + letter("i", 430, 476, 350, 4) + letter("d", 601, 466, 350, -3) + letter("s", 807, 471, 350, 5)
                + letter("G", 373, 826, 430, -4) + letter("o", 675, 831, 430, 6) + sun(866, 596, 0.92))
    rim = (f'<rect x="4" y="4" width="1016" height="1016" rx="{radius - 4}" fill="none" stroke="url(#rim)" stroke-width="8"/>' if radius else "")
    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <style>@font-face{{font-family:N;src:url(data:font/woff2;base64,{font_b64}) format('woff2');font-weight:900}}</style>
    {''.join(lg('g' + k, *v) for k, v in COLORS.items())}
    <radialGradient id="orb" cx="0.36" cy="0.3" r="0.8"><stop offset="0" stop-color="#fffbcf"/><stop offset="0.35" stop-color="#ffe14d"/><stop offset="1" stop-color="#ff9a12"/></radialGradient>
    <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2a0"/><stop offset="1" stop-color="#ffb81a"/></linearGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fff3f8"/><stop offset="1" stop-color="#ffd3e6"/></linearGradient>
    <radialGradient id="vig" cx="0.5" cy="0.5" r="0.72"><stop offset="0.7" stop-color="#ff2e88" stop-opacity="0"/><stop offset="1" stop-color="#ff2e88" stop-opacity="0.22"/></radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#ff9ac4" stop-opacity="0.6"/></linearGradient>
    <filter id="shc" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#3a2a40" flood-opacity="0.35"/></filter>
    <filter id="sh2" x="-40%" y="-40%" width="180%" height="190%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#8a2a00" flood-opacity="0.45"/></filter>
    <clipPath id="shape"><rect width="1024" height="1024" rx="{radius}"/></clipPath>
  </defs>
  <g clip-path="url(#shape)">
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <rect width="1024" height="1024" fill="url(#vig)"/>
    <g transform="translate({c} {c}) scale({scale}) translate({-c} {-c})">
      <g filter="url(#shc)" font-family="N" font-weight="900" text-anchor="middle">{body}</g>
    </g>
    {rim}
  </g>
</svg>"""

def render(page, s):
    page.set_content(f"<html><body style='margin:0;background:transparent'>{s}</body></html>")
    page.evaluate("document.fonts.load('900 100px N')")
    page.wait_for_timeout(300)
    png = page.screenshot(omit_background=True, clip={"x": 0, "y": 0, "width": 1024, "height": 1024})
    return Image.open(io.BytesIO(png)).convert("RGBA")

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1024, "height": 1024})
    full = render(pg, svg(1.0, 0))                 # квадрат без скруглений
    rounded = render(pg, svg(1.0, 230))            # скруглённый «any»
    mask = render(pg, svg(0.8, 0))                 # maskable: содержимое в центральных 80%
    fav = render(pg, svg(1.0, 230, favicon=True))  # вкладка браузера: одна буква
    b.close()

def save(img, name, size, flatten=False):
    im = img.resize((size, size), Image.LANCZOS)
    if flatten:
        bg = Image.new("RGB", im.size, (255, 243, 248)); bg.paste(im, mask=im.split()[3]); im = bg
    im.save(os.path.join(OUT, name), optimize=True)

save(full, "apple-touch-icon.png", 180, flatten=True)
save(rounded, "icon-192.png", 192)
save(rounded, "icon-512.png", 512)
save(mask, "maskable-512.png", 512, flatten=True)
save(fav, "favicon-48.png", 48)
prev = os.environ.get("ICON_PREVIEW")
if prev:
    full.resize((512, 512), Image.LANCZOS).save(os.path.join(prev, "icon-preview.png"))
    fav.resize((256, 256), Image.LANCZOS).save(os.path.join(prev, "fav-preview.png"))
print("ok")
