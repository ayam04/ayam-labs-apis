import sys, json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = browser.contexts[0]
    page = ctx.pages[0] if ctx.pages else ctx.new_page()
    page.goto("https://rapidapi.com/studio/api_dc7ba64b-683f-4980-8739-34d84f218d64/publish/general", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(9000)
    print("url:", page.url[:80])
    print("title:", page.title()[:70])
    body = page.inner_text("body")
    print("logged in:", "Personal Account" in body or "Hub Listing" in body)
    print("visibility snippet:", [l for l in body.splitlines() if "API Project is" in l][:2])
