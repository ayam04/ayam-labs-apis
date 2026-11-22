from playwright.sync_api import sync_playwright

urls = [
    ("known-listing", "https://rapidapi.com/apilayer/api/currency-converter"),
    ("ours-seo", "https://rapidapi.com/ayamullahkhan04/api/seo-audit-api"),
]
with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="msedge")
    except Exception:
        browser = p.chromium.launch()
    for name, url in urls:
        page = browser.new_page(viewport={"width": 1440, "height": 980})
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(7000)
            body = page.inner_text("body")[:220].replace("\n", " | ")
            print(name, "TITLE:", page.title()[:60])
            print("   ", body)
        except Exception as exc:
            print(name, "failed", exc)
        page.close()
    browser.close()
