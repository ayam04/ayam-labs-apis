from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    print("pages:", [(i, pg.url[:60]) for i, pg in enumerate(ctx.pages)])
    g = [pg for pg in ctx.pages if "accounts.google.com" in pg.url]
    if not g:
        print("no google tab; reopening flow")
        page = [pg for pg in ctx.pages if "rapidapi.com" in pg.url][0]
        page.get_by_text("Login with Google").first.click()
        page.wait_for_timeout(6000)
        g = [pg for pg in ctx.pages if "accounts.google.com" in pg.url]
    if g:
        page = g[0]
        print("google tab:", page.url[:70])
        page.bring_to_front()
        try:
            field = page.get_by_role("textbox").first
            field.click()
            field.fill("ayamullahkhan04@gmail.com")
            page.wait_for_timeout(800)
            nxt = page.get_by_role("button", name="Next")
            if nxt.count():
                nxt.first.click()
            page.wait_for_timeout(7000)
            print("after next:", page.url[:70])
            print("page:", page.inner_text("body")[:350].replace("\n", " | "))
        except Exception as e:
            print("err", str(e)[:200])
        page.screenshot(path=r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\.tmp\shots\google-step2.png")
