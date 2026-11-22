from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0]
    for url in ["https://old.reddit.com/r/SideProject/about/rules/", "https://old.reddit.com/r/webdev/about/rules/"]:
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        print("===", page.url[:80])
        txt = page.inner_text("body")[:900].replace("\n", " | ")
        print(txt[:900])
    b.close()
