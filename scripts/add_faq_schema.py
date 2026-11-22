import json, pathlib, re, html

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
pages = ["emailcheck.html", "seo-audit.html", "docparse.html", "ai-text.html", "pii-shield.html"]

tag_re = re.compile(r"<[^>]+>")
def clean(s):
    return html.unescape(tag_re.sub("", s)).strip()

total = 0
for name in pages:
    p = PUB / name
    t = p.read_text(encoding="utf-8")
    if '"FAQPage"' in t:
        print(name, "already has FAQ schema")
        continue
    pairs = re.findall(r"<details[^>]*>\s*<summary[^>]*>(.*?)</summary>(.*?)</details>", t, re.S)
    faqs = []
    for q, a in pairs:
        question, answer = clean(q), clean(a)
        if question and answer:
            faqs.append({"@type": "Question", "name": question,
                         "acceptedAnswer": {"@type": "Answer", "text": answer}})
    if not faqs:
        print(name, "no FAQ pairs found")
        continue
    ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": faqs}
    block = '<script type="application/ld+json">' + json.dumps(ld) + "</script>\n</head>"
    t = t.replace("</head>", block, 1)
    p.write_text(t, encoding="utf-8")
    total += len(faqs)
    print(name, "faq questions:", len(faqs))
print("total faqs:", total)
