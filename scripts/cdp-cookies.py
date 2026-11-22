from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    cookies = ctx.cookies("https://rapidapi.com")
    print("rapidapi cookies:", len(cookies))
    for c in cookies[:12]:
        print(" ", c.get("name"), "| expires:", c.get("expires"), "| httpOnly:", c.get("httpOnly"))
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://rapidapi.com/", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(5000)
    body = page.inner_text("body")[:300].replace("\n", " | ")
    print("home body:", body)
