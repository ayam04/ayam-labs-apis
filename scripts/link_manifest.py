import pathlib, json, re

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
manifest = json.loads((PUB / "verification.json").read_text(encoding="utf-8"))

block = ('<div style="border:1px solid var(--line);border-radius:14px;padding:22px;margin:30px 0;background:var(--bg-raised)">'
         '<h3 style="margin:0 0 8px;font-size:1.05rem">Verify this yourself</h3>'
         '<p style="margin:0 0 14px;color:var(--text-dim);font-size:.92rem">'
         + str(manifest["totals"]["apis"]) + ' APIs, ' + str(manifest["totals"]["endpoints"]) + ' documented endpoints, '
         + str(manifest["tests"]["count"]) + ' unit tests. The manifest below is generated from the live services rather than written by hand: '
         'it reads each <code>/openapi.json</code>, each <code>/health</code> and each <code>/v1/formats</code> and records what it found.</p>'
         '<a class="btn btn-sm" href="/verification.json">verification.json</a> '
         '<a class="btn btn-sm" href="https://github.com/ayam04/ayam-labs-apis" rel="noopener">source</a>'
         '<p style="margin:12px 0 0;color:var(--muted);font-size:.8rem">generated ' + manifest["generatedAt"][:10] + '</p></div>')

for name, anchor in [("performance.html", '<h2 style="margin:44px 0 14px;font-size:1.5rem">'), ("pricing.html", '<h2 style="margin:44px 0 14px;font-size:1.5rem">')]:
    p = PUB / name
    if not p.exists():
        print(name, "missing")
        continue
    t = p.read_text(encoding="utf-8")
    if "verification.json" in t:
        print(name, "already linked")
        continue
    idx = t.find(anchor)
    t = t[:idx] + block + "\n" + t[idx:] if idx > -1 else t.replace("</main>", block + "</main>", 1)
    p.write_text(t, encoding="utf-8")
    print(name, "linked")

# sitemap + llms
sm = PUB / "sitemap.xml"
x = sm.read_text(encoding="utf-8")
if "verification.json" not in x:
    x = x.replace("</urlset>", '  <url><loc>https://labs.ayamk.in/verification.json</loc><changefreq>weekly</changefreq></url>\n</urlset>')
    sm.write_text(x, encoding="utf-8")
ll = PUB / "llms.txt"
t = ll.read_text(encoding="utf-8")
if "verification.json" not in t:
    t = t.replace("## Feed", "## Manifest\n\nhttps://labs.ayamk.in/verification.json - generated counts, limits, health and pricing.\n\n## Feed")
    ll.write_text(t, encoding="utf-8")
print("sitemap/llms updated")
