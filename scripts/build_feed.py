import pathlib, re, html
from email.utils import format_datetime
from datetime import datetime, timezone

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
BASE = "https://labs.ayamk.in"
DATE = datetime(2026, 11, 22, 12, 0, tzinfo=timezone.utc)

order = [
    ("blog-five-apis.html", "/blog-five-apis.html"),
    ("guides-pii-llm.html", "/guides-pii-llm.html"),
    ("guides-email-verification.html", "/guides-email-verification.html"),
    ("guides-seo-audit.html", "/guides-seo-audit.html"),
    ("guides-pdf-text.html", "/guides-pdf-text.html"),
    ("guides-ai-text.html", "/guides-ai-text.html"),
    ("guides-pii-redaction.html", "/guides-pii-redaction.html"),
    ("reference-emailcheck.html", "/reference-emailcheck.html"),
    ("reference-seo-audit.html", "/reference-seo-audit.html"),
    ("reference-docparse.html", "/reference-docparse.html"),
    ("reference-ai-text.html", "/reference-ai-text.html"),
    ("reference-pii-shield.html", "/reference-pii-shield.html"),
    ("disposable-domains.html", "/disposable-domains.html"),
    ("compare-pricing.html", "/compare-pricing.html"),
    ("performance.html", "/performance.html"),
]

items = []
for filename, path in order:
    f = PUB / filename
    if not f.exists():
        print("missing:", filename)
        continue
    t = f.read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", t, re.S)
    desc = re.search(r'<meta name="description" content="([^"]*)"', t)
    title = html.unescape(title.group(1).strip()) if title else path
    desc = html.unescape(desc.group(1).strip()) if desc else ""
    items.append((title, BASE + path, desc))

entries = "\n".join(
    f"""    <item>
      <title>{html.escape(t)}</title>
      <link>{u}</link>
      <guid isPermaLink="true">{u}</guid>
      <pubDate>{format_datetime(DATE)}</pubDate>
      <description>{html.escape(d)}</description>
    </item>"""
    for t, u, d in items
)

feed = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Ayam Labs - build notes and guides</title>
    <link>{BASE}/</link>
    <description>Five small APIs on Cloudflare Workers: email verification, on-page SEO audit, document text extraction, text analysis and PII redaction.</description>
    <language>en</language>
    <lastBuildDate>{format_datetime(DATE)}</lastBuildDate>
    <atom:link href="{BASE}/feed.xml" rel="self" type="application/rss+xml" />
{entries}
  </channel>
</rss>
"""
(PUB / "feed.xml").write_text(feed, encoding="utf-8")
print("wrote feed.xml with", len(items), "items")

# discovery link in every page head
count = 0
for f in PUB.glob("*.html"):
    t = f.read_text(encoding="utf-8")
    if "feed.xml" in t:
        continue
    if "</head>" in t:
        t = t.replace("</head>", '<link rel="alternate" type="application/rss+xml" title="Ayam Labs" href="/feed.xml">\n</head>', 1)
        f.write_text(t, encoding="utf-8")
        count += 1
print("pages with feed discovery:", count)
