import sys
from playwright.sync_api import sync_playwright

out = sys.argv[1]
targets = [
    ("labs-home", "https://labs.ayamk.in/"),
    ("labs-pricing", "https://labs.ayamk.in/pricing.html"),
]
with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="msedge")
    except Exception:
        browser = p.chromium.launch()
    for name, url in targets:
        page = browser.new_page(viewport={"width": 1440, "height": 980})
        try:
            page.goto(url, wait_until="load", timeout=45000)
            page.wait_for_timeout(2500)
            page.screenshot(path=f"{out}/{name}.png")
            print("shot", name, page.title()[:60])
        except Exception as exc:
            print("failed", name, exc)
        page.close()
    browser.close()
