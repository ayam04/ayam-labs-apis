import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace")
TITLE = (ROOT / ".tmp" / "article-title.txt").read_text(encoding="utf-8").strip()
BODY = (ROOT / ".tmp" / "article-body.txt").read_text(encoding="utf-8")

with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://dev.to/new", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(6000)
    print("url:", page.url[:60])
    if "enter" in page.url or "login" in page.url:
        print("NOT LOGGED IN")
    else:
        page.get_by_label("Post Title").fill(TITLE[:120])
        page.wait_for_timeout(500)
        body_box = page.locator("div[role='textbox'], textarea").first
        body_box.click()
        page.wait_for_timeout(400)
        page.keyboard.insert_text(BODY)
        page.wait_for_timeout(1500)
        print("body length in editor:", len(page.locator("div[role='textbox']").first.inner_text()))
        tag = page.get_by_placeholder("Add up to 4 tags")
        if tag.count():
            tag.click()
            for t in ["cloudflare", "api", "typescript", "webdev"]:
                tag.fill(t)
                page.wait_for_timeout(500)
                tag.press("Enter")
                page.wait_for_timeout(700)
            print("tags entered")
        page.wait_for_timeout(1200)
        page.screenshot(path=str(ROOT / ".tmp" / "shots" / "devto-ready.png"))
        print("ready to publish")
