import json, sys, time, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace")

APIS = [
    ("emailcheck", "api_dc7ba64b-683f-4980-8739-34d84f218d64", "emailcheck"),
    ("seo-audit", "api_0f2334a5-2b69-402c-b1ec-d2b4572fcb85", "seo-audit"),
    ("docparse", "api_bf9fc63c-c220-4339-8fa0-0ce263d7e6e2", "docparse"),
    ("ai-text", "api_329e11c5-546c-4c88-b40f-0a35ee510d54", "ai-text"),
    ("pii-shield", "api_27c95665-1450-4da5-bef5-ef825114860c", "pii-shield"),
]

def save(page):
    btn = page.get_by_role("button", name="Save", exact=True)
    if btn.count():
        btn.first.click(timeout=8000)
        page.wait_for_timeout(3500)
        return True
    # fallback: the bar may render as a link/div
    alt = page.locator("text=Save").first
    if alt.count():
        alt.click(timeout=8000)
        page.wait_for_timeout(3500)
        return True
    return False

def set_visibility(page):
    """Tick the rights checkbox, flip the toggle, save. Returns final state text."""
    box = page.get_by_role("checkbox", name="I confirm that I own or have rights")
    if box.count() and not box.first.is_checked():
        box.first.check(timeout=8000)
        page.wait_for_timeout(900)
    # the switch sits right under the checkbox
    sw = page.get_by_role("switch")
    if sw.count():
        on = sw.first.get_attribute("aria-checked")
        if on != "true":
            sw.first.click(timeout=8000)
    else:
        # click by proximity to the checkbox
        b = box.first.bounding_box()
        if b:
            page.mouse.click(b["x"] + 6, b["y"] + 36)
    page.wait_for_timeout(1800)
    ok = save(page)
    page.wait_for_timeout(2500)
    body = page.inner_text("body")
    state = "Public" if "API Project is Public" in body else ("Private" if "API Project is Private" in body else "unknown")
    return state, ok

def main():
    with sync_playwright() as p:
        b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
        ctx = b.contexts[0]
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.set_default_timeout(30000)

        for slug, guid, page_slug in APIS:
            print("\n==", slug)
            page.goto(f"https://rapidapi.com/studio/{guid}/publish/general", wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(6000)
            if "auth/login" in page.url:
                print("NOT LOGGED IN - stopping")
                return
            state, saved = set_visibility(page)
            print("  visibility:", state, "| save clicked:", saved)

            # long description
            long_md = (ROOT / "docs" / "listings" / f"{slug}-long.md").read_text(encoding="utf-8")
            ta = page.get_by_role("textbox", name="Long Description")
            if ta.count():
                ta.first.fill(long_md)
                page.wait_for_timeout(600)
            web = page.get_by_role("textbox", name="Website")
            if web.count():
                web.first.fill(f"https://labs.ayamk.in/{slug}.html")
            terms = page.get_by_role("textbox", name="Terms of Use")
            if terms.count():
                terms.first.fill("https://labs.ayamk.in/legal.html")
            page.wait_for_timeout(800)
            print("  content save:", save(page))

        # verify
        print("\n== verify")
        for slug, guid, page_slug in APIS:
            page.goto(f"https://rapidapi.com/studio/{guid}/publish/general", wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(5000)
            body = page.inner_text("body")
            state = "Public" if "API Project is Public" in body else ("Private" if "API Project is Private" in body else "unknown")
            has_long = len(body) > 0 and ("What this does" in body or "On-page" in body)
            web = "labs.ayamk.in" in body
            print(f"  {slug:11s} visibility={state} long={'yes' if has_long else 'no'} website={'yes' if web else 'no'}")

if __name__ == "__main__":
    main()
