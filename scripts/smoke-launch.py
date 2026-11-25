"""Mobile prelaunch smoke tests. Runs against local production static export with Chromium."""
import json
import os
import time
import urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.getenv("KIDGO_QA_BASE", "http://127.0.0.1:3000").rstrip("/")
Path("artifacts").mkdir(exist_ok=True)
errors = []
results = []

def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": str(detail)})
    if not ok:
        errors.append(name + ": " + str(detail))
    print(("PASS " if ok else "FAIL ") + name + " " + str(detail))

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        routes = [
            "/", "/planner/", "/scenarios/", "/adventures/",
            "/adventures/dozhdiku-nazlo/", "/places/eksperimentanium/",
            "/places/depo-food-hall/", "/search/", "/favorites/",
            "/kuda-shodit/", "/planner/results/?s=rain&wx=rain",
        ]
        for width in (320, 390, 430):
            context = browser.new_context(viewport={"width": width, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
            context.route("https://api.open-meteo.com/**", lambda route: route.abort())
            context.route("https://*.openfreemap.org/**", lambda route: route.abort())
            page = context.new_page()
            page_errors = []
            page.on("pageerror", lambda err: page_errors.append(str(err)))
            for route in routes:
                page_errors.clear()
                label = str(width) + ":" + route
                try:
                    response = page.goto(BASE + route, wait_until="domcontentloaded", timeout=25000)
                    page.wait_for_timeout(1000)
                    check(label + " loads", response is not None and response.status < 400, response.status if response else "no response")
                    overflow = page.evaluate("() => ({document: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollWidth - document.documentElement.clientWidth})")
                    check(label + " no horizontal overflow", overflow["document"] <= 2 and overflow["body"] <= 2, overflow)
                    check(label + " no JS crash", not page_errors, page_errors[:2])
                    if width == 390 and route in ("/", "/planner/", "/adventures/dozhdiku-nazlo/"):
                        page.screenshot(path="artifacts/mobile-" + (route.strip("/").replace("/","-") or "home") + ".png", full_page=True)
                    if route == "/":
                        check(label + " no forced onboarding", "/onboarding" not in page.url, page.url)
                        check(label + " primary CTA", page.get_by_role("link", name="Собрать наш день").count() > 0)
                    if route == "/adventures/dozhdiku-nazlo/":
                        check(label + " new adventure name", "Плохой погоде назло" in page.locator("main").inner_text())
                except Exception as e:
                    check(label + " route exception", False, str(e)[:250])
            context.close()
        # Real navigation from homepage into planner as anonymous first-time visitor.
        context=browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
        page=context.new_page()
        try:
            page.goto(BASE+"/", wait_until="domcontentloaded",timeout=25000)
            page.get_by_role("link",name="Собрать наш день").first.click(timeout=8000)
            page.wait_for_timeout(800)
            check("anonymous homepage -> planner", "/planner/" in page.url, page.url)
            check("new visitor sees age picker", page.get_by_role("radiogroup",name="Возраст ребёнка").count()>0)
            page.get_by_role("radiogroup",name="Возраст ребёнка").get_by_role("radio",name="5").click(timeout=5000)
            submit = page.get_by_role("button",name="Показать варианты дня")
            check("planner submit after selecting age", submit.count()>0 and submit.is_enabled())
            submit.click(timeout=8000)
            page.wait_for_url("**/planner/results/**",timeout=15000)
            check("anonymous visitor reaches results", "/planner/results/" in page.url, page.url)
        except Exception as e:
            check("anonymous planner entry",False,str(e)[:250])
        context.close()
        browser.close()
    with open("artifacts/mobile-smoke.json","w") as f:
        json.dump({"checks":results,"errors":errors},f,ensure_ascii=False,indent=2)
    with open("artifacts/mobile-smoke.md","w") as f:
        f.write("# Kid Go mobile browser smoke\n\n")
        f.write("Chromium mobile emulation: 320, 390, 430 CSS pixels. This is not physical iOS/Android testing.\n\n")
        f.write("Checks: "+str(len(results))+"; failures: "+str(len(errors))+"\n\n")
        for x in errors:f.write("- "+x+"\n")
    print("Checks:",len(results),"Failures:",len(errors))
    if errors:raise SystemExit(1)

if __name__=="__main__":main()
