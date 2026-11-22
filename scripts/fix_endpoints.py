import pathlib, re
SITE = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
DOCS = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\docs\listings")

# 1. PII guide: real endpoints, styles live on /v1/redact
p = SITE / "guides-pii-redaction.html"
t = p.read_text(encoding="utf-8")
old_row_set = t[t.index('<div style="overflow:auto;margin:0 0 20px"><table style="width:100%;border-collapse:collapse;font-size:.9rem"><thead><tr><th>Endpoint</th>'):]
old_row_set = old_row_set[:old_row_set.index("</table></div>") + len("</table></div>")]
new_rows = ('<div style="overflow:auto;margin:0 0 20px"><table style="width:100%;border-collapse:collapse;font-size:.9rem">'
 '<thead><tr><th>Endpoint</th><th>Output</th><th>Use when</th></tr></thead><tbody>'
 '<tr><td>POST /v1/scan</td><td>findings with offsets and validators</td><td>you want to review before changing anything</td></tr>'
 '<tr><td>POST /v1/redact</td><td>same detection pass, replacements applied</td><td>shipping to a log or a model</td></tr>'
 '<tr><td>POST /v1/profanity</td><td>profanity with obfuscation handling</td><td>user generated content</td></tr>'
 '<tr><td>POST /v1/spam</td><td>weighted heuristic spam score</td><td>contact forms and comments</td></tr>'
 '<tr><td>POST /v1/moderation</td><td>PII, profanity and spam in one call</td><td>a single gate before publish</td></tr>'
 '<tr><td>GET /v1/types</td><td>every detector and its validator</td><td>building a review UI</td></tr>'
 '</tbody></table></div>')
t = t.replace(old_row_set, new_rows, 1)

# style explanation replaces the old mask/hash endpoint paragraph
old_p = '<p style="color:var(--text-dim);margin:0 0 16px">A card number that fails Luhn'
styles_block = ('<h2 style="margin:44px 0 14px;font-size:1.5rem">Redaction styles</h2>'
 '<p style="color:var(--text-dim);margin:0 0 16px">Styles are a parameter on <code>/v1/redact</code>, not separate endpoints. '
 '<b>mask</b> keeps the last <code>keepLast</code> characters, which is what a support agent needs to read a card back to a customer. '
 '<b>label</b> emits stable tokens like <code>[EMAIL_1]</code> so two occurrences of the same address share a token and a model can still follow the thread. '
 '<b>hash</b> emits the first eight hex characters of the value was SHA-256, plus a hash-to-count map, so records stay joinable without the raw value ever coming back.</p>'
 '<p style="color:var(--text-dim);margin:0 0 16px">A card number that fails Luhn')
t = t.replace(old_p, styles_block, 1)
p.write_text(t, encoding="utf-8")
print("fixed guides-pii-redaction.html")

# 2. SEO guide: real endpoint list
p = SITE / "guides-seo-audit.html"
t = p.read_text(encoding="utf-8")
start = t.index('<ul style="color:var(--text-dim);margin:0 0 18px;padding-left:20px;line-height:1.75"><li>/v1/text')
end = t.index("</ul>", start) + len("</ul>")
new_list = ('<ul style="color:var(--text-dim);margin:0 0 18px;padding-left:20px;line-height:1.75">'
 '<li><b>GET /v1/meta</b>: head tags only, the fast path when you do not need the body.</li>'
 '<li><b>GET /v1/links</b>: internal and external links with anchors and rel attributes.</li>'
 '<li><b>GET /v1/keywords</b>: term frequency and TF-IDF for a page or raw text.</li>'
 '<li><b>GET /v1/readability</b>: Flesch, Flesch-Kincaid and Gunning fog.</li>'
 '<li><b>GET /v1/robots</b> and <b>GET /v1/sitemap</b>: parse both files without another dependency.</li>'
 '<li><b>POST /v1/text</b>: readability plus keywords on text you already have.</li>'
 '</ul>')
t = t[:start] + new_list + t[end:]
p.write_text(t, encoding="utf-8")
print("fixed guides-seo-audit.html")

# 3. long descriptions
fixes = {
 "seo-audit-long.md": [
  ("- **GET /v1/audit** - full audit for one URL\n- **GET /v1/text** - extract the readable text of a page\n- **GET /v1/meta** - meta tags only, the fast path\n- **GET /v1/links** - internal and external link inventory\n- **GET /v1/headings** - heading outline and order\n- **GET /v1/images** - alt coverage and image weight\n- **GET /v1/structured-data** - JSON-LD and microdata extraction\n- **GET /v1/robots** - robots.txt fetch and parse",
   "- **GET /v1/audit** - full audit for one URL, weighted score and findings\n- **GET /v1/meta** - head tags only, the fast path\n- **GET /v1/links** - internal and external link inventory\n- **GET /v1/keywords** - term frequency and TF-IDF for a page or raw text\n- **GET /v1/readability** - Flesch, Flesch-Kincaid, Gunning fog\n- **GET /v1/robots** - robots.txt fetch and parse\n- **GET /v1/sitemap** - sitemap index or urlset, parsed and counted\n- **POST /v1/text** - readability plus keywords on text you already have"),
  ("The audit covers title and meta description length, H1 usage, heading order, canonical, robots directives, Open Graph and Twitter cards, image alt coverage, internal and external link counts, structured data presence, page weight, response time, redirect chain and HTTPS.",
   "The audit covers title and meta description length, heading structure, canonical, robots directives, Open Graph and Twitter cards, image alt coverage, internal and external link counts, structured data presence, page weight, response time, redirect chain and HTTPS."),
 ],
 "pii-shield-long.md": [
  ("- **POST /v1/scan** - detect PII and return the findings with offsets\n- **POST /v1/redact** - replace findings with typed placeholders\n- **POST /v1/mask** - keep the last four characters, mask the rest\n- **POST /v1/hash** - replace findings with stable hashes so records stay joinable\n- **POST /v1/validate** - confirm whether a specific value is a real card, IBAN or phone number\n- **GET /v1/detectors** - the full detector list with patterns",
   "- **POST /v1/scan** - detect PII and return findings with offsets and validators\n- **POST /v1/redact** - replace findings; styles are mask, label or hash\n- **POST /v1/profanity** - profanity screening with obfuscation handling\n- **POST /v1/spam** - weighted heuristic spam score\n- **POST /v1/moderation** - PII, profanity and spam in one call\n- **GET /v1/types** - every detector, what it matches, how it validates"),
 ],
 "ai-text-long.md": [
  ("- **plus 3 more** - translate, extract JSON and score readability",
   "- **POST /v1/readability** - Flesch, Flesch-Kincaid, Gunning fog\n- **POST /v1/translate** - between 100 languages\n- **GET /v1/stopwords** - the stop word list used by the keyword endpoint"),
 ],
}
for name, pairs in fixes.items():
    f = DOCS / name
    t = f.read_text(encoding="utf-8")
    for old, new in pairs:
        if old not in t:
            print("  MISS in", name, old[:50])
        t = t.replace(old, new)
    f.write_text(t, encoding="utf-8")
    print("fixed", name)
