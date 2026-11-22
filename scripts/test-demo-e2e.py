from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel="msedge")
    except Exception:
        b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1280, "height": 1000})
    page.goto("https://labs.ayamk.in/demo.html", wait_until="load", timeout=45000)
    page.fill("#demo-email", "ayam.khan@gmail.com")
    page.click("#demo-btn")
    page.wait_for_selector("#demo-out", state="visible", timeout=25000)
    page.wait_for_timeout(1200)
    print("score:", page.inner_text("#demo-score"))
    print("verdict:", page.inner_text("#demo-verdict"))
    print("provider:", page.inner_text("#demo-provider"))
    print("flags:", page.inner_text("#demo-flags").replace("\n", " | "))
    print("status:", page.inner_text("#demo-status"))
    page.screenshot(path=r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\.tmp\shots\demo.png")
    b.close()
