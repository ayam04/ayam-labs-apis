from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel="msedge")
    except Exception:
        b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1300, "height": 1150})
    page.goto("https://labs.ayamk.in/demo-bulk.html", wait_until="load", timeout=45000)
    page.click("#demo-btn")
    page.wait_for_selector("#demo-out", state="visible", timeout=40000)
    page.wait_for_timeout(1000)
    print("summary:", page.inner_text("#b-summary").replace("\n", " ")[:140])
    rows = page.locator("#b-rows tr")
    print("rows:", rows.count())
    for i in range(min(rows.count(), 3)):
        print("  ", rows.nth(i).inner_text().replace("\n", " | ")[:110])
    print("cost:", page.inner_text("#b-cost")[:160])
    page.screenshot(path=r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\.tmp\shots\bulk-demo.png")
    b.close()
