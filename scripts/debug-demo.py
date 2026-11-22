from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel="msedge")
    except Exception:
        b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1280, "height": 1100})
    msgs = []
    page.on("console", lambda m: msgs.append("console:" + m.type + ":" + m.text[:200]))
    page.on("pageerror", lambda e: msgs.append("pageerror:" + str(e)[:300]))
    page.goto("https://labs.ayamk.in/demo-seo-audit.html", wait_until="load", timeout=45000)
    page.fill("#demo-url", "https://example.com")
    page.click("#demo-btn")
    page.wait_for_timeout(9000)
    print("status:", page.inner_text("#demo-status")[:160])
    print("messages:")
    for m in msgs[:10]:
        print("  ", m)
    b.close()
