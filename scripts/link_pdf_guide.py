import pathlib, re
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

# link from the two product pages and the guides index
for name, anchor in [("pii-shield.html", '<a class="btn" href="/demo-pii-shield">Try the redactor</a>'),
                     ("docparse.html", '<a class="btn" href="/demo-docparse">Try it live</a>')]:
    p = PUB / name
    t = p.read_text(encoding="utf-8")
    if "guides-redact-pdf" in t:
        continue
    if anchor in t:
        t = t.replace(anchor, anchor + '\n          <a class="btn" href="/guides-redact-pdf">Redact a PDF</a>', 1)
        p.write_text(t, encoding="utf-8")
        print(name, "linked")
    else:
        print(name, "anchor not found")

g = PUB / "guides.html"
t = g.read_text(encoding="utf-8")
if "guides-redact-pdf" not in t:
    card = ('      <a href="/guides-redact-pdf" style="display:block;border:1px solid var(--line);border-radius:14px;padding:22px;margin:0 0 14px;background:var(--bg-raised)">'
            '<div class="eyebrow" style="margin-bottom:10px">Guide / Privacy</div>'
            '<h2 style="font-size:1.2rem;margin:0 0 8px">Redact PII from a PDF in two calls</h2>'
            '<p style="margin:0;color:var(--text-dim);font-size:.94rem">Extract the text, then find and mask the personal data. Working code and the honest limits.</p></a>\n')
    anchor = '<h2 style="margin:44px 0 14px;font-size:1.4rem">API reference</h2>'
    t = t.replace(anchor, card + anchor, 1) if anchor in t else t.replace("  </div></section>", card + "  </div></section>", 1)
    g.write_text(t, encoding="utf-8")
    print("guides index card added")

sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
if "guides-redact-pdf" not in xml:
    xml = xml.replace("</urlset>", '  <url><loc>https://labs.ayamk.in/guides-redact-pdf</loc><changefreq>monthly</changefreq></url>\n</urlset>')
    sm.write_text(xml, encoding="utf-8")
print("sitemap urls:", xml.count("<loc>"))

f = PUB / "feed.xml"
t = f.read_text(encoding="utf-8")
if "guides-redact-pdf" not in t:
    item = """    <item>
      <title>Redact PII from a PDF in two calls</title>
      <link>https://labs.ayamk.in/guides-redact-pdf</link>
      <guid isPermaLink="true">https://labs.ayamk.in/guides-redact-pdf</guid>
      <description>Extract text with DocParse, then find and mask personal data with PII Shield. Where the flow stops.</description>
    </item>
"""
    t = t.replace("  </channel>", item + "  </channel>", 1)
    f.write_text(t, encoding="utf-8")
    print("feed item added")
