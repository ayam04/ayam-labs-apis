from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0]
    for name, url in [("dev.to","https://dev.to/dashboard"), ("hashnode","https://hashnode.com/dashboard"), ("reddit","https://www.reddit.com/")]:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3500)
            body = page.inner_text("body")[:160].replace("\n"," | ")
            print(name, "->", page.url[:60])
            print("   ", body[:120])
        except Exception as e:
            print(name, "ERR", str(e)[:60])
    b.close()
