from playwright.sync_api import sync_playwright

subs = ["webdev", "SideProject", "indiehackers", "microsaas", "SaaS", "cloudflare", "devops", "programming"]
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9222")
    ctx = b.contexts[0]
    page = ctx.pages[0]
    for sub in subs:
        try:
            page.goto(f"https://www.reddit.com/r/{sub}/about/rules", wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(4000)
            rules = page.evaluate("""() => {
                const out = [];
                document.querySelectorAll('[class*="rule"], li, div').forEach((el) => {
                  const t = el.querySelector('h3, h4, strong, summary, span');
                  if (!t) return;
                  const name = (t.textContent || '').trim();
                  if (name.length < 4 || name.length > 90) return;
                  if (!/self|promo|spam|advert|link|blog|show|market|sell|disclos/i.test(name)) return;
                  const desc = (el.textContent || '').replace(/\s+/g, ' ').trim();
                  out.push(desc.slice(0, 220));
                });
                return [...new Set(out)].slice(0, 4);
            }""")
            print(f"=== r/{sub} ({page.url[:50]})")
            for r in rules:
                print("   -", r)
        except Exception as e:
            print(f"=== r/{sub} FAILED {str(e)[:60]}")
    b.close()
