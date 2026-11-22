from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0]
    for label in ["Reject All", "Accept All", "Accept"]:
        try:
            loc = page.get_by_role("button", name=label, exact=True)
            if loc.count():
                loc.first.click(timeout=4000)
                print("clicked", label)
                break
        except Exception as e:
            pass
    page.wait_for_timeout(1500)
    print("banner gone:", page.get_by_text("Why we use cookies").count() == 0)
    page.screenshot(path=r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\.tmp\shots\login-ready.png")
