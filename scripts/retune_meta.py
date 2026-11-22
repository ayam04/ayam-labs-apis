import pathlib, re

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

changes = {
    "emailcheck.html": (
        "EmailCheck API - Email verification | Ayam Labs",
        "Email verification API - validate an address without sending mail | Ayam Labs",
        "Validate email addresses before you send, store or bill for them.",
        "Email verification API: syntax, live MX and A records, a 10,400 domain disposable list, role accounts, typo suggestions and a 0-100 score. Try it with no key.",
    ),
    "docparse.html": (
        "DocParse API - Document extraction | Ayam Labs",
        "PDF to text API - extract text from PDF, DOCX and HTML | Ayam Labs",
        "Turn PDFs, DOCX and HTML into clean text for your LLM pipeline.",
        "PDF to text API: per-page text, metadata and markdown from PDF, DOCX and HTML, billed per call. Text-based PDFs only, scanned pages are not OCR'd and the API says so.",
    ),
    "pii-shield.html": (
        "PII Shield API - Privacy and safety | Ayam Labs",
        "PII redaction API - find and mask personal data in text | Ayam Labs",
        "Find and redact personal data before it reaches your logs or your model.",
        "PII redaction API: 19 detectors with Luhn and mod-97 validation, offsets and confidence, three redaction styles, plus profanity, spam and moderation in the same key.",
    ),
    "seo-audit.html": (
        "SEO Audit API - On-page analysis | Ayam Labs",
        "SEO audit API - on-page analysis in one request | Ayam Labs",
        "Score any page in one request, without a headless browser.",
        "SEO audit API: 14 weighted on-page checks with a 0-100 score, headings, images, links, structured data, robots and sitemap, in a single request and no headless browser.",
    ),
}

for name, (old_title, new_title, old_desc, new_desc) in changes.items():
    p = PUB / name
    t = p.read_text(encoding="utf-8")
    before = t
    t = t.replace(old_title, new_title, 1)
    t = t.replace(old_desc, new_desc, 1)
    # keep the og/twitter copies in sync
    t = re.sub(r'(<meta property="og:title" content=")[^"]*(")', r"\g<1>" + new_title.rsplit(" | ", 1)[0] + r'\g<2>', t, count=1)
    p.write_text(t, encoding="utf-8")
    print(name, "changed" if t != before else "NO CHANGE")
