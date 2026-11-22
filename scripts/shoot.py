import sys
from playwright.sync_api import sync_playwright

out = sys.argv[1]
base = "https://ayam-labs-site.ayamullahkhan04.workers.dev"

targets = [
    ("home-hero", base + "/", 1440, 980),
    ("home-registry", base + "/", 1440, 980),
    ("product-emailcheck", base + "/emailcheck.html", 1440, 980),
    ("pricing", base + "/pricing.html", 1440, 980),
    ("home-mobile", base + "/", 390, 844),
]

with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="msedge")
    except Exception:
        browser = p.chromium.launch()
    for name, url, w, h in targets:
        page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
        page.goto(url, wait_until="load", timeout=45000)
        page.wait_for_timeout(1600)
        if name == "home-registry":
            page.evaluate("window.scrollTo(0, document.querySelector('.registry').getBoundingClientRect().top + window.scrollY - 120)")
            page.wait_for_timeout(900)
        page.screenshot(path=f"{out}/{name}.png")
        print("shot", name, page.title()[:60])
        page.close()
    browser.close()
