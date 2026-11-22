from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    print("pages:", len(ctx.pages))
    for i, pg in enumerate(ctx.pages):
        try:
            print(f"  [{i}] {pg.url[:100]}")
        except Exception:
            print(f"  [{i}] (n/a)")
