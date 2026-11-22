from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://accounts.google.com/", wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(4000)
    body = page.inner_text("body")[:400].replace("\n", " | ")
    print("google:", body)
    page.screenshot(path=r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\.tmp\shots\google-state.png")
