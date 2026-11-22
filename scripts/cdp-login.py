from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    for extra in ctx.pages[1:]:
        try: extra.close()
        except Exception: pass
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://rapidapi.com/auth/login", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(4000)
    page.bring_to_front()
    print("ready at:", page.url[:70])
    body = page.inner_text("body")[:300].replace("\n", " | ")
    print("page:", body)
