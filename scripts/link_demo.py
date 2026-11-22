import pathlib, re
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

# link the demo from the emailcheck page CTA area and the home page
ec = PUB / "emailcheck.html"
t = ec.read_text(encoding="utf-8")
if "/demo.html" not in t:
    t = t.replace('<a class="btn btn-primary" href="#get-started">Get a key on RapidAPI</a>',
                  '<a class="btn btn-primary" href="#get-started">Get a key on RapidAPI</a>\n          <a class="btn" href="/demo.html">Try it live, no key</a>', 1)
    ec.write_text(t, encoding="utf-8")
    print("emailcheck: demo CTA added")

home = PUB / "index.html"
h = home.read_text(encoding="utf-8")
if "/demo.html" not in h:
    h = h.replace('<a class="btn btn-primary" href="/pricing.html">See pricing</a>',
                  '<a class="btn btn-primary" href="/demo.html">Try a live check</a>\n          <a class="btn" href="/pricing.html">See pricing</a>', 1)
    home.write_text(h, encoding="utf-8")
    print("home: demo CTA added")

# nav entry on every page
for f in PUB.glob("*.html"):
    t = f.read_text(encoding="utf-8")
    if "demo.html" in t and '<a href="/demo.html">Demo</a>' in t:
        continue
    if '<a href="/guides.html">Guides</a>' in t:
        t = t.replace('<a href="/guides.html">Guides</a>',
                      '<a href="/demo.html">Demo</a>\n        <a href="/guides.html">Guides</a>', 1)
        f.write_text(t, encoding="utf-8")

# sitemap
sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
if "demo.html" not in xml:
    xml = xml.replace("</urlset>", '  <url><loc>https://labs.ayamk.in/demo.html</loc><changefreq>monthly</changefreq></url>\n</urlset>')
    sm.write_text(xml, encoding="utf-8")
print("sitemap urls:", xml.count("<loc>"))
