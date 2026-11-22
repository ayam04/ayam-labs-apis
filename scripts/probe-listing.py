from playwright.sync_api import sync_playwright

url = "https://rapidapi.com/ayamullahkhan04/api/emailcheck-api"
with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="msedge")
    except Exception:
        browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 980})
    responses = []
    page.on("response", lambda r: responses.append((r.status, r.url)) if ("emailcheck" in r.url or "api" in r.url) and r.status >= 400 else None)
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(9000)
    print("TITLE:", page.title())
    body = page.inner_text("body")[:600].replace("\n", " | ")
    print("BODY:", body)
    print("ERRORS:", responses[:10])
    browser.close()
