from playwright.sync_api import sync_playwright
targets = [
    ("dev.to", "https://dev.to/dashboard", "you haven't written anything yet"),
    ("hashnode", "https://hashnode.com/draft", ""),
    ("reddit", "https://www.reddit.com/", ""),
]
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0]
    for name, url, marker in targets:
        page.goto(url, wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(5000)
        final = page.url
        body = page.inner_text("body")[:200].replace("\n", " | ")
        logged = ("sign in" not in body.lower() and "log in" not in body.lower()) or "log in" not in final
        print(f"{name}: {final[:70]}")
        print(f"   body: {body[:140]}")
    b.close()
