import pathlib, re
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

pairs = {
 "seo-audit.html": ("/demo-seo-audit.html", "Audit a page live"),
 "docparse.html": ("/demo-docparse.html", "Extract a file live"),
 "ai-text.html": ("/demo-textmind.html", "Analyse text live"),
 "pii-shield.html": ("/demo-pii-shield.html", "Redact text live"),
}
CTA = '<a class="btn btn-primary" href="#get-started">Get a key on RapidAPI</a>'
for name, (demo, label) in pairs.items():
    p = PUB / name
    t = p.read_text(encoding="utf-8")
    if demo in t:
        print("already linked:", name)
        continue
    if CTA in t:
        t = t.replace(CTA, CTA + f'\n          <a class="btn" href="{demo}">{label}</a>', 1)
        p.write_text(t, encoding="utf-8")
        print("linked:", name, "->", demo)
    else:
        print("CTA pattern not found in", name)

# cross-links strip on each demo page
strip_items = [("/demo.html", "Email check"), ("/demo-seo-audit.html", "SEO audit"),
               ("/demo-docparse.html", "Document text"), ("/demo-textmind.html", "Text analysis"),
               ("/demo-pii-shield.html", "PII redaction")]
for f in PUB.glob("demo*.html"):
    t = f.read_text(encoding="utf-8")
    if "demo-strip" in t:
        continue
    links = "".join(
        f'<a href="{u}" style="padding:8px 14px;border:1px solid var(--line-bright);border-radius:999px;font-size:.85rem;'
        + ('background:var(--accent);color:#0a0a0a;' if u == "/" + f.name else 'color:var(--text-dim);') + f'">{lbl}</a>'
        for u, lbl in strip_items)
    strip = ('<div class="demo-strip" style="display:flex;gap:10px;flex-wrap:wrap;margin:0 0 26px">' + links + "</div>")
    anchor = '<div class="eyebrow">'
    idx = t.find(anchor)
    if idx > -1:
        t = t[:idx] + strip + "\n      " + t[idx:]
        f.write_text(t, encoding="utf-8")
        print("strip added:", f.name)

# sitemap
sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
for slug in ["demo-seo-audit.html", "demo-docparse.html", "demo-textmind.html", "demo-pii-shield.html"]:
    if slug not in xml:
        xml = xml.replace("</urlset>", f'  <url><loc>https://labs.ayamk.in/{slug}</loc><changefreq>monthly</changefreq></url>\n</urlset>')
sm.write_text(xml, encoding="utf-8")
print("sitemap urls:", xml.count("<loc>"))
