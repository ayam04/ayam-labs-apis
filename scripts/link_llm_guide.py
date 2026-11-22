import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

# add to the guides index
g = PUB / "guides.html"
t = g.read_text(encoding="utf-8")
if "guides-pii-llm.html" not in t:
    card = ('      <a href="/guides-pii-llm.html" style="display:block;border:1px solid var(--line);border-radius:14px;padding:22px;margin:0 0 14px;background:var(--bg-raised)">'
            '<div class="eyebrow" style="margin-bottom:10px">Guide / Privacy</div>'
            '<h2 style="font-size:1.2rem;margin:0 0 8px">Redact before the prompt, not after the leak</h2>'
            '<p style="margin:0;color:var(--text-dim);font-size:.94rem">Where customer text escapes when it reaches a model, and how to redact with labels so the answer still makes sense.</p></a>\n')
    anchor = '<h2 style="margin:44px 0 14px;font-size:1.4rem">API reference</h2>'
    if anchor in t:
        t = t.replace(anchor, card + anchor, 1)
    else:
        t = t.replace("  </div></section>", card + "  </div></section>", 1)
    g.write_text(t, encoding="utf-8")
    print("guides index card added")

# link from the pii guide
p = PUB / "guides-pii-redaction.html"
t = p.read_text(encoding="utf-8")
if "guides-pii-llm.html" not in t:
    anchor = '<h2 style="margin:44px 0 14px;font-size:1.5rem">Where heuristics stop</h2>'
    note = ('<p style="color:var(--text-dim);margin:0 0 16px">Sending text to a model prompt has its own pattern: '
            '<a href="/guides-pii-llm.html">redacting before an LLM call</a> covers labels, the restore map and what still leaks.</p>')
    if anchor in t:
        t = t.replace(anchor, note + anchor, 1)
        p.write_text(t, encoding="utf-8")
        print("pii guide cross-linked")

# llms.txt + sitemap
ll = PUB / "llms.txt"
t = ll.read_text(encoding="utf-8")
if "guides-pii-llm" not in t:
    t = t.replace("- [PII redaction before logging]", "- [Redact before an LLM prompt](https://labs.ayamk.in/guides-pii-llm.html)\n- [PII redaction before logging]")
    ll.write_text(t, encoding="utf-8")
    print("llms updated")

sm = PUB / "sitemap.xml"
xml = sm.read_text(encoding="utf-8")
if "guides-pii-llm.html" not in xml:
    xml = xml.replace("</urlset>", '  <url><loc>https://labs.ayamk.in/guides-pii-llm.html</loc><changefreq>monthly</changefreq></url>\n</urlset>')
    sm.write_text(xml, encoding="utf-8")
print("sitemap urls:", xml.count("<loc>"))
