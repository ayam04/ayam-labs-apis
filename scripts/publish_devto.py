"""Publish the prepared article to dev.to once a session exists.

Run: python scripts/publish_devto.py
Exits non-zero with a clear message if not logged in.
"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace")
TITLE = (ROOT / ".tmp" / "article-title.txt").read_text(encoding="utf-8").strip()
BODY = (ROOT / ".tmp" / "article-body.txt").read_text(encoding="utf-8")
TAGS = ["cloudflare", "api", "typescript", "webdev"]

def main() -> int:
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = b.contexts[0]
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto("https://dev.to/new", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(5000)

        title = page.locator("textarea#article-form-title, input#article-form-title, [placeholder*='title' i]").first
        if title.count() == 0:
            print("NOT LOGGED IN: dev.to is showing", page.url)
            print("Log in in the debug Chrome window, then re-run this script.")
            return 2
        title.fill(TITLE)
        page.wait_for_timeout(400)

        body = page.locator("div[role='textbox'], textarea.crayons-textfield").first
        body.click()
        page.keyboard.insert_text(BODY)
        page.wait_for_timeout(800)

        tag_input = page.locator("[placeholder*='tag' i]").first
        if tag_input.count():
            for t in TAGS:
                tag_input.click()
                tag_input.fill(t)
                page.wait_for_timeout(400)
                tag_input.press("Enter")
                page.wait_for_timeout(400)

        page.wait_for_timeout(800)
        printed = page.evaluate("() => document.body.innerText.length")
        print("editor filled, page text length:", printed)

        page.get_by_role("button", name=re.compile("^Publish$")).first.click()
        page.wait_for_timeout(6000)
        print("after publish url:", page.url)
        if "/p/" in page.url:
            print("PUBLISHED:", page.url)
            return 0
        print("publish result unclear, inspect the browser")
        return 1

if __name__ == "__main__":
    sys.exit(main())