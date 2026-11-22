from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0]
    for name, url in [("dev.to","https://dev.to/dashboard"), ("hashnode","https://hashnode.com/dashboard"), ("reddit","https://www.reddit.com/submit")]:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)
            print(name, "->", page.url[:70])
        except Exception as e:
            print(name, "ERR", str(e)[:50])
    b.close()
