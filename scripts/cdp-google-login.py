from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://rapidapi.com/auth/login", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3500)
    print("url:", page.url[:70])
    btn = page.get_by_role("button", name="Login with Google")
    if not btn.count():
        btn = page.get_by_text("Login with Google")
    print("google button count:", btn.count())
    if btn.count():
        btn.first.click()
        page.wait_for_timeout(6000)
        print("pages now:", len(ctx.pages))
        for i, pg in enumerate(ctx.pages):
            print(f"  [{i}] {pg.url[:90]}")
        cur = ctx.pages[-1]
        try:
            body = cur.inner_text("body")[:500].replace("\n", " | ")
            print("current tab:", body)
        except Exception as e:
            print("body err", e)
