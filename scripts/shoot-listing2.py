import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1]
with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel="msedge")
    except Exception:
        b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.goto("https://labs.ayamk.in/emailcheck.html", wait_until="load", timeout=45000)
    page.wait_for_timeout(2000)
    page.screenshot(path=out + "/emailcheck-page.png")
    print("shot site page")
    b.close()
