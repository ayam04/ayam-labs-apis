from playwright.sync_api import sync_playwright
import sys

DEMOS = [
    ("emailcheck", "https://labs.ayamk.in/demo", "#demo-email", "#demo-btn"),
    ("seo-audit", "https://labs.ayamk.in/demo-seo-audit", "#demo-url", "#demo-btn"),
    ("docparse", "https://labs.ayamk.in/demo-docparse", "#demo-url", "#demo-btn"),
    ("ai-text", "https://labs.ayamk.in/demo-textmind", "#demo-text", "#demo-btn"),
    ("pii-shield", "https://labs.ayamk.in/demo-pii-shield", "#demo-text", "#demo-btn"),
]

with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel="msedge")
    except Exception:
        b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1300, "height": 1000})
    failures = 0
    for name, url, field, btn in DEMOS:
        try:
            page.goto(url, wait_until="load", timeout=45000)
            page.wait_for_timeout(1200)
            if page.locator(field).count() == 0:
                print(f"{name:11} SKIP (selector {field} missing)")
                failures += 1
                continue
            page.click(btn)
            page.wait_for_timeout(6000)
            body = page.inner_text("body")
            ok = ("error" not in body.lower()) and len(body) > 400
            print(f"{name:11} {'OK' if ok else 'CHECK'} | body {len(body)} chars")
            if not ok:
                print("   ", body[:160].replace("\n", " "))
                failures += 1
        except Exception as e:
            print(f"{name:11} FAILED {str(e)[:70]}")
            failures += 1
    b.close()
    print("failures:", failures)
    sys.exit(0 if failures == 0 else 1)