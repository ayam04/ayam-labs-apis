from playwright.sync_api import sync_playwright

cases = [
    ("demo-seo-audit.html", "https://example.com", "#s-value", None),
    ("demo-docparse.html", "https://example.com", "#d-title", None),
    ("demo-textmind.html", None, "#t-label", None),
    ("demo-pii-shield.html", None, "#p-redacted", None),
]
with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel="msedge")
    except Exception:
        b = p.chromium.launch()
    for slug, url, sel, _ in cases:
        page = b.new_page(viewport={"width": 1280, "height": 1100})
        page.goto("https://labs.ayamk.in/" + slug, wait_until="load", timeout=45000)
        if url:
            page.fill("#demo-url", url)
        page.click("#demo-btn")
        try:
            page.wait_for_selector("#demo-out", state="visible", timeout=30000)
            page.wait_for_timeout(800)
            print(slug, "->", page.inner_text(sel).replace("\n", " ")[:90])
        except Exception as exc:
            print(slug, "-> FAILED:", page.inner_text("#demo-status")[:90])
        page.close()
    b.close()
