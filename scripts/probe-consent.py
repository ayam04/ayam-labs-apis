from playwright.sync_api import sync_playwright

url = "https://rapidapi.com/ayamullahkhan04/api/emailcheck-api"
with sync_playwright() as p:
    try:
        browser = p.chromium.launch(channel="msedge")
    except Exception:
        browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": 1440, "height": 980}, user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
    page = ctx.new_page()
    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3000)
    for label in ["Accept All", "Accept all", "I Accept"]:
        try:
            page.get_by_role("button", name=label).first.click(timeout=3000)
            print("clicked", label)
            break
        except Exception:
            continue
    page.wait_for_timeout(6000)
    print("TITLE:", page.title()[:80])
    print("H1:", page.inner_text("h1")[:120] if page.query_selector("h1") else "no h1")
    body = page.inner_text("body")[:300].replace("\n", " | ")
    print("BODY:", body)
    browser.close()
