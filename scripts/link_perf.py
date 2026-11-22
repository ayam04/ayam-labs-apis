import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

# link performance from footers and sitemap
count = 0
for f in PUB.glob("*.html"):
    t = f.read_text(encoding="utf-8")
    if "performance.html" in t:
        continue
    old = '<a href="/pricing.html">Pricing</a> &nbsp;·&nbsp; <a href="/legal.html">Legal</a>'
    new = '<a href="/pricing.html">Pricing</a> &nbsp;·&nbsp; <a href="/performance.html">Latency</a> &nbsp;·&nbsp; <a href="/legal.html">Legal</a>'
    if old in t:
        t = t.replace(old, new, 1)
        f.write_text(t, encoding="utf-8")
        count += 1
print("footer links added:", count)

sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
if "performance.html" not in xml:
    xml = xml.replace("</urlset>", '  <url><loc>https://labs.ayamk.in/performance.html</loc><changefreq>monthly</changefreq></url>\n</urlset>')
    sm.write_text(xml, encoding="utf-8")
print("sitemap urls:", xml.count("<loc>"))

ll = PUB / "llms.txt"
t = ll.read_text(encoding="utf-8")
if "performance.html" not in t:
    t = t.replace("## Listings", "- [Measured latency](https://labs.ayamk.in/performance.html): p50 and p95 per endpoint.\n\n## Listings")
    ll.write_text(t, encoding="utf-8")
    print("llms updated")
