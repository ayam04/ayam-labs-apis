from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    print("pages:")
    for i, pg in enumerate(ctx.pages):
        try:
            print(f"  [{i}] {pg.url[:100]}")
        except Exception:
            pass
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://rapidapi.com/studio", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(6000)
    body = page.inner_text("body")[:200].replace("\n", " | ")
    print("studio body:", body)
    print("logged in:", "Add API Project" in body or "Personal Account" in body)
