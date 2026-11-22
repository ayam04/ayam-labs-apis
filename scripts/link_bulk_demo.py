import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

# link from the emailcheck page and from the email demo
ec = PUB / "emailcheck.html"
t = ec.read_text(encoding="utf-8")
if "demo-bulk.html" not in t:
    old = '<a class="btn" href="/demo.html">Try it live, no key</a>'
    if old in t:
        t = t.replace(old, old + '\n          <a class="btn" href="/demo-bulk.html">Bulk demo</a>', 1)
        ec.write_text(t, encoding="utf-8")
        print("emailcheck linked")

d = PUB / "demo.html"
t = d.read_text(encoding="utf-8")
if "demo-bulk.html" not in t:
    t = t.replace('<a href="/demo-bulk.html"', '<a href="/demo-bulk.html"')  # noop
    if "demo-strip" in t:
        t = t.replace('<a href="/demo.html" style=', '<a href="/demo-bulk.html" style="padding:8px 14px;border:1px solid var(--line-bright);border-radius:999px;font-size:.85rem;color:var(--text-dim)">Bulk (20 at once)</a><a href="/demo.html" style=', 1)
        d.write_text(t, encoding="utf-8")
        print("demo strip updated")

# guides: bulk maths section
g = PUB / "guides-email-verification.html"
t = g.read_text(encoding="utf-8")
if "demo-bulk.html" not in t:
    t = t.replace("The maths is laid out with sources on the <a href=\"/compare-pricing.html\">pricing comparison</a> page.",
                  "The maths is laid out with sources on the <a href=\"/compare-pricing.html\">pricing comparison</a> page, and <a href=\"/demo-bulk.html\">the bulk demo</a> runs a real 20-address call so you can see the per-address cost.", 1)
    g.write_text(t, encoding="utf-8")
    print("guide linked")

# sitemap + feed
sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
if "demo-bulk.html" not in xml:
    xml = xml.replace("</urlset>", '  <url><loc>https://labs.ayamk.in/demo-bulk.html</loc><changefreq>monthly</changefreq></url>\n</urlset>')
    sm.write_text(xml, encoding="utf-8")
print("sitemap urls:", xml.count("<loc>"))

f = PUB / "feed.xml"
t = f.read_text(encoding="utf-8")
if "demo-bulk" not in t:
    item = """    <item>
      <title>Bulk email verification demo - 20 addresses in one call</title>
      <link>https://labs.ayamk.in/demo-bulk.html</link>
      <guid isPermaLink="true">https://labs.ayamk.in/demo-bulk.html</guid>
      <description>Paste a list and see per-address verdicts, scores and the per-address cost of the bulk endpoint.</description>
    </item>
"""
    t = t.replace("  </channel>", item + "  </channel>", 1)
    f.write_text(t, encoding="utf-8")
    print("feed item added")
