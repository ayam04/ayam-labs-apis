import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

pairs = {
 "emailcheck.html": "reference-emailcheck.html",
 "seo-audit.html": "reference-seo-audit.html",
 "docparse.html": "reference-docparse.html",
 "ai-text.html": "reference-ai-text.html",
 "pii-shield.html": "reference-pii-shield.html",
}
linked = 0
for page, ref in pairs.items():
    p = PUB / page
    t = p.read_text(encoding="utf-8")
    if ref in t:
        continue
    anchor = '<a class="btn" href="/demo'
    idx = t.find(anchor)
    if idx > -1:
        end = t.find("</a>", idx) + 4
        t = t[:end] + f'\n          <a class="btn" href="/{ref}">Full API reference</a>' + t[end:]
        p.write_text(t, encoding="utf-8")
        linked += 1
print("product pages linked:", linked)

# guides index: a reference block
g = PUB / "guides.html"
t = g.read_text(encoding="utf-8")
if "reference-emailcheck" not in t:
    block = ('<h2 style="margin:44px 0 14px;font-size:1.4rem">API reference</h2>'
             '<p style="color:var(--text-dim);margin:0 0 16px">Every route, parameter and curl example, generated from each live OpenAPI document.</p>'
             '<ul style="color:var(--text-dim);padding-left:20px;line-height:1.9">'
             '<li><a href="/reference-emailcheck.html">EmailCheck reference</a>, 5 routes</li>'
             '<li><a href="/reference-seo-audit.html">SEO Audit reference</a>, 8 routes</li>'
             '<li><a href="/reference-docparse.html">DocParse reference</a>, 7 routes</li>'
             '<li><a href="/reference-ai-text.html">TextMind reference</a>, 11 routes</li>'
             '<li><a href="/reference-pii-shield.html">PII Shield reference</a>, 6 routes</li>'
             '</ul>')
    t = t.replace('<div class="wrap" style="max-width:78ch">', '<div class="wrap" style="max-width:78ch">\n' + block, 1)
    g.write_text(t, encoding="utf-8")
    print("guides index: reference block added")

# disclosure on the build log article
b = PUB / "blog-five-apis.html"
t = b.read_text(encoding="utf-8")
disc = ('<p style="border-left:2px solid var(--accent);padding:10px 0 10px 16px;color:var(--text-dim);'
        'margin:0 0 22px;font-size:.92rem"><b>Disclosure:</b> I built these APIs and I sell them. '
        'Everything here is what I measured on my own product, and the pricing comparison page names '
        'where a competitor is cheaper. Treat the post as a build log, not an independent review.</p>')
if "Disclosure:" not in t:
    idx = t.find('<div class="wrap"')
    if idx > -1:
        t = t.replace('<div class="wrap"', '<div class="wrap">' + disc + '<div style="display:none">', 1)
        t = t.replace('<div style="display:none"></div>', '')
        # simpler: insert after the first paragraph
        b.write_text(t, encoding="utf-8")
        print("disclosure inserted (wrapper)")
    else:
        print("no wrap anchor")

# sitemap
sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
for slug, _, _, _, _, _ in [("emailcheck","", "", "", "", ""), ("seo-audit","", "", "", "", ""), ("docparse","", "", "", "", ""), ("ai-text","", "", "", "", ""), ("pii-shield","", "", "", "", "")]:
    u = f"reference-{slug}.html"
    if u not in xml:
        xml = xml.replace("</urlset>", f'  <url><loc>https://labs.ayamk.in/{u}</loc><changefreq>monthly</changefreq></url>\n</urlset>')
sm.write_text(xml, encoding="utf-8")
print("sitemap urls:", xml.count("<loc>"))
