# Иконки приложения: python3 scripts/gen-icons.py
# Рисует мастер-картинку 1024×1024 в Chromium (шрифт Nunito 900 из node_modules) и режет на размеры:
#  apple-touch-icon 180 (без прозрачности и скруглений — iOS скругляет сам), icon-192/512 (скруглённые «any»),
#  maskable-512 (полная заливка, буква в безопасной зоне 80%), favicon-48.
import base64, io, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "icons")
FONT = os.path.join(ROOT, "node_modules/@fontsource/nunito/files/nunito-latin-900-normal.woff2")
font_b64 = base64.b64encode(open(FONT, "rb").read()).decode()

def svg(scale=1.0, radius=0):
    # scale<1 сжимает содержимое к центру (для maskable), radius — скругление фона в единицах 1024
    c = 512
    rays = "".join(
        f'<rect x="-13" y="-114" width="26" height="46" rx="13" fill="url(#ray)" transform="rotate({a})"/>' for a in (-62, -21, 21, 62)
    )
    rim = (
        f'<rect x="4" y="4" width="1016" height="1016" rx="{radius - 4}" fill="none" stroke="url(#rim)" stroke-width="8"/>'
        if radius else ""
    )
    return f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff3f93"/>
      <stop offset="0.5" stop-color="#f11a76"/>
      <stop offset="1" stop-color="#ff5d3a"/>
    </linearGradient>
    <radialGradient id="under" cx="0.5" cy="1.05" r="0.75">
      <stop offset="0" stop-color="#ffd27a" stop-opacity="0.95"/>
      <stop offset="0.45" stop-color="#ff9a5a" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#ff5d3a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="0.5" cy="0.5" r="0.72">
      <stop offset="0.6" stop-color="#8c0040" stop-opacity="0"/>
      <stop offset="1" stop-color="#8c0040" stop-opacity="0.42"/>
    </radialGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0.08"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.85"/>
      <stop offset="0.5" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#ffe2a0" stop-opacity="0.7"/>
    </linearGradient>
    <linearGradient id="letter" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#fff4f9"/>
      <stop offset="1" stop-color="#ffbdd9"/>
    </linearGradient>
    <radialGradient id="orb" cx="0.36" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#fffbcf"/>
      <stop offset="0.35" stop-color="#ffe14d"/>
      <stop offset="1" stop-color="#ff9a12"/>
    </radialGradient>
    <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff2a0"/>
      <stop offset="1" stop-color="#ffb81a"/>
    </linearGradient>
    <filter id="sh" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="22" stdDeviation="20" flood-color="#6b0030" flood-opacity="0.5"/>
    </filter>
    <filter id="sh2" x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#8a2a00" flood-opacity="0.45"/>
    </filter>
    <clipPath id="shape"><rect width="1024" height="1024" rx="{radius}"/></clipPath>
    <style>@font-face{{font-family:N;src:url(data:font/woff2;base64,{font_b64}) format('woff2');font-weight:900}}</style>
  </defs>
  <g clip-path="url(#shape)">
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <rect width="1024" height="1024" fill="url(#under)"/>
    <rect width="1024" height="1024" fill="url(#vig)"/>
    <!-- глянцевый блик «Aqua» на верхней половине -->
    <path d="M-40 -10 H1064 V392 C 880 500 144 500 -40 392 Z" fill="url(#gloss)" opacity="0.5"/>
    <g transform="translate({c} {c}) scale({scale}) translate({-c} {-c})">
      <!-- солнышко-леденец -->
      <g transform="translate(826 214)" filter="url(#sh2)">
        {rays}
        <circle r="50" fill="url(#orb)"/>
        <ellipse cx="-14" cy="-22" rx="22" ry="13" fill="#fff" opacity="0.8" transform="rotate(-30 -14 -22)"/>
      </g>
      <!-- буква: «желейная», с тенью и бликом -->
      <g filter="url(#sh)">
        <text x="452" y="776" text-anchor="middle" font-family="N" font-weight="900" font-size="820" fill="url(#letter)">K</text>
      </g>
    </g>
    {rim}
  </g>
</svg>"""

def render(page, s):
    page.set_content(f"<html><body style='margin:0;background:transparent'>{s}</body></html>")
    page.wait_for_function("document.fonts.ready.then(()=>true)")
    page.evaluate("document.fonts.load('900 100px N')")
    page.wait_for_timeout(200)
    png = page.screenshot(omit_background=True, clip={"x": 0, "y": 0, "width": 1024, "height": 1024})
    return Image.open(io.BytesIO(png)).convert("RGBA")

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1024, "height": 1024})
    full = render(pg, svg(1.0, 0))          # квадрат без скруглений
    rounded = render(pg, svg(1.0, 230))     # скруглённый «any»
    mask = render(pg, svg(0.8, 0))          # maskable: содержимое в центральных 80%
    b.close()

def save(img, name, size, flatten=False):
    im = img.resize((size, size), Image.LANCZOS)
    if flatten:
        bg = Image.new("RGB", im.size, (255, 46, 126)); bg.paste(im, mask=im.split()[3]); im = bg
    im.save(os.path.join(OUT, name), optimize=True)

save(full, "apple-touch-icon.png", 180, flatten=True)
save(rounded, "icon-192.png", 192)
save(rounded, "icon-512.png", 512)
save(mask, "maskable-512.png", 512, flatten=True)
save(rounded, "favicon-48.png", 48)
full.resize((512, 512), Image.LANCZOS).save(os.path.join(os.environ.get("ICON_PREVIEW", "/tmp"), "icon-preview.png"))
print("ok")
