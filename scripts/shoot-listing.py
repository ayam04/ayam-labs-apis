import sys
from playwright.sync_api import sync_playwright

out = sys.argv[1]
urls = [
    ("listing-emailcheck", "https://rapidapi.com/ayamullahkhan04/api/emailcheck-api"),
    ("landing-article", "https://ayam-labs-site.ayamullahkhan04.workers.dev/blog-five-apis.html"),
]
with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="msedge")
    except Exception:
        browser = p.chromium.launch()
    for name, url in urls:
        page = browser.new_page(viewport={"width": 1440, "height": 980})
        try:
            page.goto(url, wait_until="load", timeout=60000)
            page.wait_for_timeout(4000)
            page.screenshot(path=f"{out}/{name}.png")
            print("shot", name, page.title()[:80])
        except Exception as exc:
            print("failed", name, exc)
        page.close()
    browser.close()
