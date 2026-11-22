from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0]
    page.goto("https://dev.to/new", wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(6000)
    info = page.evaluate("""() => {
      const out = [];
      document.querySelectorAll('input,textarea,[contenteditable]').forEach((el) => {
        out.push({
          tag: el.tagName,
          type: el.type || '',
          id: el.id || '',
          name: el.name || '',
          placeholder: el.getAttribute('placeholder') || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          cls: (el.className || '').toString().slice(0, 60)
        });
      });
      return out;
    }""")
    for i in info[:12]:
        print(i)
    b.close()
