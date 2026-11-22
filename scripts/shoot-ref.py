from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel="msedge")
    except Exception:
        b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1280, "height": 1050})
    page.goto("https://labs.ayamk.in/reference-emailcheck.html", wait_until="load", timeout=45000)
    page.wait_for_timeout(1200)
    page.screenshot(path=r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\.tmp\shots\reference.png")
    print("shot")
    b.close()
