from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    g = [pg for pg in ctx.pages if "accounts.google.com" in pg.url]
    if g:
        g[0].bring_to_front()
        # focus the password field so the user can just type
        try:
            f = g[0].get_by_role("textbox").first
            f.click()
            print("focused password field")
        except Exception as e:
            print("focus err", str(e)[:120])
        print("url:", g[0].url[:60])
