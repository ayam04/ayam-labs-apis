import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

# link from the EmailCheck page and guide
p = PUB / "emailcheck.html"
t = p.read_text(encoding="utf-8")
if "disposable-domains.html" not in t:
    old = '<a class="btn" href="/demo.html">Try it live, no key</a>'
    if old in t:
        t = t.replace(old, old + '\n          <a class="btn" href="/disposable-domains.html">Free domain list</a>', 1)
        p.write_text(t, encoding="utf-8")
        print("emailcheck page linked")

g = PUB / "guides-email-verification.html"
t = g.read_text(encoding="utf-8")
if "disposable-domains.html" not in t:
    anchor = '<h2 style="margin:44px 0 14px;font-size:1.5rem">The bulk maths</h2>'
    note = ('<p style="color:var(--text-dim);margin:0 0 16px">If all you need is the blocklist itself, it is free: '
            '<a href="/disposable-domains.html">10,400 disposable domains</a> as plain text or JSON, no signup.</p>')
    if anchor in t:
        t = t.replace(anchor, note + anchor, 1)
        g.write_text(t, encoding="utf-8")
        print("guide linked")

# sitemap
sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
if "disposable-domains.html" not in xml:
    xml = xml.replace("</urlset>", '  <url><loc>https://labs.ayamk.in/disposable-domains.html</loc><changefreq>weekly</changefreq></url>\n</urlset>')
    sm.write_text(xml, encoding="utf-8")
print("sitemap urls:", xml.count("<loc>"))

# llms.txt
ll = PUB / "llms.txt"
t = ll.read_text(encoding="utf-8")
if "disposable-domains" not in t:
    t = t.replace("## Guides", "- [Disposable email domain list](https://labs.ayamk.in/disposable-domains.html): 10,400 domains, free txt and json.\n\n## Guides")
    ll.write_text(t, encoding="utf-8")
    print("llms updated")
