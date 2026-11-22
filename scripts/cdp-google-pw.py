from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[-1]
    print("tab:", page.url[:60])
    field = page.get_by_role("textbox").first
    field.fill("ayamullahkhan04@gmail.com")
    page.wait_for_timeout(700)
    nxt = page.get_by_role("button", name="Next")
    if nxt.count():
        nxt.first.click()
        print("clicked Next")
    page.wait_for_timeout(6000)
    print("url now:", page.url[:80])
    body = page.inner_text("body")[:400].replace("\n", " | ")
    print("page:", body)
    page.screenshot(path=r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\.tmp\shots\google-pw.png")
