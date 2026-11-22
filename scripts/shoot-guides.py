import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1]
pages = [("guides-index", "https://labs.ayamk.in/guides.html"),
         ("guide-email", "https://labs.ayamk.in/guides-email-verification.html")]
with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel="msedge")
    except Exception:
        b = p.chromium.launch()
    for name, url in pages:
        pg = b.new_page(viewport={"width": 1440, "height": 1000})
        pg.goto(url, wait_until="load", timeout=45000)
        pg.wait_for_timeout(1800)
        pg.screenshot(path=f"{out}/{name}.png")
        print("shot", name)
        pg.close()
    b.close()
