# Builds SEO guide pages for labs.ayamk.in
import html, json, os, pathlib

OUT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
SITE = "https://labs.ayamk.in"

NAV = """        <a href="/emailcheck.html">EmailCheck</a>
        <a href="/seo-audit.html">SEO Audit</a>
        <a href="/docparse.html">DocParse</a>
        <a href="/ai-text.html">TextMind</a>
        <a href="/pii-shield.html">PII Shield</a>
        <a href="/guides.html">Guides</a>
        <a href="/pricing.html">Pricing</a>"""

def shell(title, desc, slug, body, ld):
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{SITE}/{slug}">
<meta property="og:type" content="article">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta name="theme-color" content="#08090a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">{json.dumps(ld)}</script>
</head>
<body>
<header class="site-header">
  <div class="wrap inner">
    <a class="brand" href="/"><span class="mark">AL</span> Ayam Labs</a>
    <nav class="nav">
{NAV}
    </nav>
    <a class="btn btn-sm" href="https://rapidapi.com/ayamullahkhan04">Get an API key</a>
  </div>
</header>
<main>
{body}
</main>
<footer class="site-footer">
  <div class="wrap inner">
    <div><span class="mono">&copy; 2026 Ayam Labs</span> &nbsp;·&nbsp; APIs for email, SEO, documents, text and privacy.</div>
    <div class="mono"><a href="/guides.html">Guides</a> &nbsp;·&nbsp; <a href="/pricing.html">Pricing</a> &nbsp;·&nbsp; <a href="/legal.html">Legal</a></div>
  </div>
</footer>
<script src="/app.js" defer></script>
</body>
</html>
"""

def article(eyebrow, h1, lede, sections):
    out = [f"""  <section class="hero">
    <div class="wrap">
      <div class="eyebrow">{eyebrow}</div>
      <h1 style="font-size:clamp(2rem,5vw,3.2rem);margin:18px 0 18px;max-width:22ch">{h1}</h1>
      <p class="lede" style="max-width:64ch">{lede}</p>
    </div>
  </section>"""]
    out.append('  <section class="section"><div class="wrap" style="max-width:78ch">')
    for s in sections:
        out.append(s)
    out.append("  </div></section>")
    return "\n".join(out)

def h2(t):
    return f'      <h2 style="margin:44px 0 14px;font-size:1.5rem">{t}</h2>'

def p(t):
    return f'      <p style="color:var(--text-dim);margin:0 0 16px">{t}</p>'

def ul(items):
    lis = "".join(f"<li>{i}</li>" for i in items)
    return f'      <ul style="color:var(--text-dim);margin:0 0 18px;padding-left:20px;line-height:1.75">{lis}</ul>'

def code(text, lang=""):
    return f'      <pre style="background:var(--bg-raised);border:1px solid var(--line);border-radius:12px;padding:16px 18px;overflow:auto;margin:0 0 18px"><code>{html.escape(text)}</code></pre>'

def table(headers, rows):
    th = "".join(f"<th>{h}</th>" for h in headers)
    tr = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'      <div style="overflow:auto;margin:0 0 20px"><table style="width:100%;border-collapse:collapse;font-size:.9rem"><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'

def note(t):
    return f'      <p style="border-left:2px solid var(--accent);padding:10px 0 10px 16px;color:var(--text-dim);margin:0 0 18px;font-size:.92rem">{t}</p>'

def cta(listing, name):
    return f"""      <div style="border:1px solid var(--line);border-radius:14px;padding:22px;margin:36px 0 10px;background:var(--bg-raised)">
        <h3 style="margin:0 0 8px;font-size:1.05rem">Try {name}</h3>
        <p style="margin:0 0 14px;color:var(--text-dim);font-size:.92rem">Pay as you go at $0.05 a call, no monthly minimum. or a monthly plan from $25 once the volume justifies it.</p>
        <a class="btn btn-primary" href="{listing}" rel="noopener">Open the listing on RapidAPI</a>
      </div>"""

# ---------------- guides ----------------
GUIDES = []

GUIDES.append(dict(
    slug="guides-email-verification.html",
    title="How to verify an email address without sending mail",
    desc="What an email verification API can actually check without SMTP, how to read the score, and where the approach stops working.",
    eyebrow="Guide / Email verification",
    h1="Verify an email address without sending a single message",
    lede="You can tell whether an address is worth keeping in one request. You cannot tell whether the mailbox exists. Knowing the difference is most of the work.",
    body=[
        h2("Why bad addresses cost money"),
        p("A bounce is not free. Every hard bounce teaches the receiving provider that your sending domain is noisy, and those signals compound. Cleaning at signup is cheaper than cleaning later, and far cheaper than repairing a sending reputation."),
        h2("What you can check without SMTP"),
        ul(["<b>Syntax</b>: RFC length limits, quoted locals, illegal characters.",
            "<b>MX records</b>: does the domain accept mail at all, and which provider handles it.",
            "<b>A/AAAA fallback</b>: domains without MX sometimes inherit the A record.",
            "<b>Disposable domains</b>: blocklists of throwaway providers.",
            "<b>Role accounts</b>: support@, admin@, noreply@ never reach a human.",
            "<b>Typo distance</b>: gmail.con is not gmail.com."]),
        note("What you cannot check: whether one specific mailbox exists. That needs an SMTP conversation, and most providers now treat verification probes as hostile. Vendors that promise it are guessing or risking your IP reputation."),
        h2("One request"),
        p("Use the marketplace proxy URL with your key. The same call works from a browser, a worker or a script."),
        code("curl -s 'https://emailcheck.p.rapidapi.com/v1/verify?email=ayam.khan%40gmail.com' \\\n  -H 'X-RapidAPI-Key: YOUR_KEY' \\\n  -H 'X-RapidAPI-Host: emailcheck.p.rapidapi.com'"),
        code("const res = await fetch('https://emailcheck.p.rapidapi.com/v1/verify?email=' + encodeURIComponent(email), {\n  headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'emailcheck.p.rapidapi.com' }\n});\nconst { score, deliverability, flags, didYouMean } = await res.json();"),
        h2("Reading the response"),
        code('{\n  "email": "ayam.khan@gmail.com",\n  "canonical": "ayamkhan@gmail.com",\n  "validFormat": true,\n  "score": 88,\n  "deliverability": "deliverable",\n  "flags": {\n    "disposable": false, "roleAccount": false, "freeProvider": true,\n    "hasMx": true, "hasARecord": true, "nullMx": false, "possibleTypo": false\n  },\n  "provider": "Google Workspace / Gmail",\n  "didYouMean": null\n}'),
        table(["Field", "What it means", "How to use it"], [
            ["score", "0-100, weighted by the checks that fired", "Gate signup below a threshold, e.g. 60"],
            ["deliverability", "deliverable / risky / undeliverable", "Log risky, block undeliverable"],
            ["flags.disposable", "known throwaway provider", "Block, or allow on a trial tier only"],
            ["flags.roleAccount", "shared inbox, not a person", "Reject for account signups, keep for B2B contact forms"],
            ["didYouMean", "typo suggestion, same TLD only", "Offer a correction UI instead of rejecting"],
        ]),
        h2("Pitfalls worth knowing before you ship"),
        ul(["<b>Catch-all domains</b> accept every address, so they look deliverable. The flag set will not save you here; treat catch-all as risky.",
            "<b>Score thresholds are policy, not truth</b>. A 70 is fine for a newsletter and too low for a billing contact.",
            "<b>Typo suggestions are deliberately conservative</b>: same TLD, edit distance of two or less. It will not suggest gmail.com for hotmail.com because those are different products.",
            "<b>Bulk is one call for up to 100 addresses</b>. For a list, use /v1/bulk and keep the per-address reasons; do not loop the single endpoint 100 times."]),
        h2("Where this fits"),
        p("Run it on signup, on list import, and before any campaign send. Store the score, not just the boolean, so you can re-decide later without another request."),
        cta("https://rapidapi.com/ayamullahkhan04/api/emailcheck-api", "EmailCheck"),
    ],
))

GUIDES.append(dict(
    slug="guides-seo-audit.html",
    title="Audit a page's on-page SEO with one HTTP request",
    desc="The on-page signals that decide whether a page can rank, how to read them from a single audit response, and what the audit cannot tell you.",
    eyebrow="Guide / SEO",
    h1="The on-page audit you can run in one request",
    lede="Titles, headings, canonical, structured data, alt coverage and weight. All of it is in the HTML you already have. A crawler is optional.",
    body=[
        h2("What actually moves on-page"),
        p("Backlinks and authority are not on the page. Everything else is: title length, meta description, one H1, heading order, canonical, robots directives, structured data, image alt text, internal link count, page weight and response time. Those are the things a template regression breaks first."),
        h2("The request"),
        code("curl -s 'https://seo-audit.p.rapidapi.com/v1/audit?url=https://example.com' \\\n  -H 'X-RapidAPI-Key: YOUR_KEY' \\\n  -H 'X-RapidAPI-Host: seo-audit.p.rapidapi.com'"),
        code("const res = await fetch('https://seo-audit.p.rapidapi.com/v1/audit?url=' + encodeURIComponent(pageUrl), {\n  headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'seo-audit.p.rapidapi.com' }\n});\nconst audit = await res.json();\nconsole.log(audit.score, audit.findings.map(f => f.id));"),
        h2("The shape of the response"),
        code('{\n  "requestedUrl": "https://example.com/",\n  "finalUrl": "https://example.com/",\n  "redirected": false,\n  "statusCode": 200,\n  "https": true,\n  "bodyBytes": 577,\n  "timings": { "fetchMs": 10, "parseMs": 0, "totalMs": 10 },\n  "page": {\n    "title": "Example Domain",\n    "titleLength": 14,\n    "metaDescription": null,\n    "canonical": null\n  }\n}'),
        table(["Signal", "Why it matters", "Typical fix"], [
            ["titleLength", "Truncated titles lose the tail in SERPs", "Aim 30-60 chars, front-load the phrase"],
            ["metaDescription", "Missing means Google writes its own", "Write 120-155 chars with the offer"],
            ["headings", "Order communicates structure", "One H1, no skipped levels"],
            ["canonical", "Duplicates split signals", "Self-referencing canonical per page"],
            ["images without alt", "Accessibility and image search", "Describe the content, not the filename"],
            ["bodyBytes", "Heavy HTML delays first paint", "Trim inline data, move to assets"],
        ]),
        h2("Other endpoints on the same API"),
        ul(["/v1/text returns the readable text, useful for diffing content after a template change.",
            "/v1/meta is the fast path when you only need head tags.",
            "/v1/links and /v1/headings for structure checks across a sitemap.",
            "/v1/structured-data to confirm your JSON-LD survives the build.",
            "/v1/robots to read robots.txt without another dependency."]),
        h2("What the audit cannot do"),
        ul(["It does not measure backlinks, domain authority or rankings.",
            "It does not read Search Console. Clicks and impressions are yours, not ours.",
            "If the site blocks bots, the response says so. It will not invent a score."]),
        cta("https://rapidapi.com/ayamullahkhan04/api/seo-audit-api16", "SEO Audit"),
    ],
))

GUIDES.append(dict(
    slug="guides-pdf-text.html",
    title="Extract text from a PDF in a serverless function",
    desc="Why PDF parsing breaks in edge runtimes, and how to get clean text, page counts and metadata from one POST without bundling a parser.",
    eyebrow="Guide / Documents",
    h1="PDF text extraction that runs where your code already runs",
    lede="Parsers assume a filesystem, a canvas and a few hundred milliseconds of CPU you may not have. A POST is easier than a runtime.",
    body=[
        h2("Why this is annoying in a worker"),
        p("Most PDF libraries pull in a native canvas for layout, assume Node built-ins, or want 300ms of CPU per page. In an edge runtime that is either unavailable or priced differently than you expect. The alternative is to move parsing out of your process entirely."),
        h2("The request"),
        p("Send a URL or a base64 payload. URL is better for anything large: no encoding cost, and the fetch happens on our side."),
        code("curl -s -X POST 'https://docparse.p.rapidapi.com/v1/pdf/text' \\\n  -H 'Content-Type: application/json' \\\n  -H 'X-RapidAPI-Key: YOUR_KEY' \\\n  -H 'X-RapidAPI-Host: docparse.p.rapidapi.com' \\\n  -d '{\"url\":\"https://arxiv.org/pdf/1810.04805\"}'"),
        code("const res = await fetch('https://docparse.p.rapidapi.com/v1/pdf/text', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,\n    'X-RapidAPI-Host': 'docparse.p.rapidapi.com'\n  },\n  body: JSON.stringify({ url: pdfUrl })\n});\nconst { text, pages, pageCount, words } = await res.json();"),
        h2("HTML is the same call shape"),
        code('{\n  "url": "https://example.com/",\n  "title": "Example Domain",\n  "text": "This domain is for use in documentation examples...",\n  "characters": 156,\n  "words": 25,\n  "truncated": false\n}'),
        h2("Choosing an endpoint"),
        table(["Endpoint", "Returns", "When to use"], [
            ["POST /v1/pdf/text", "full text, per-page text, page count, words", "the default for search, summarising, chunking"],
            ["POST /v1/pdf/info", "metadata, page count, version, size", "validation before you pay for extraction"],
            ["POST /v1/pdf/pages", "only the pages you list", "long documents where you need one section"],
            ["POST /v1/docx/text", "headings, lists, tables, paragraphs", "Word documents from customers"],
            ["POST /v1/html/text", "readable text, title, byline", "articles, blog posts, help pages"],
            ["POST /v1/html/markdown", "clean markdown", "feeding a model or a CMS"],
        ]),
        h2("Limits, stated plainly"),
        ul(["<b>No OCR.</b> A scanned PDF has no text layer, so the text comes back empty. That is a different service.",
            "Encrypted or password-protected files are rejected with a clear error rather than a partial parse.",
            "A 100-page, 45,000-word PDF takes about three seconds. A 16-page paper is under one.",
            "Nothing is stored. The file is held in memory for the request and dropped."]),
        cta("https://rapidapi.com/ayamullahkhan04/api/docparse-api", "DocParse"),
    ],
))

GUIDES.append(dict(
    slug="guides-ai-text.html",
    title="Sentiment and keyword extraction without an LLM bill",
    desc="Deterministic text analysis you can run on every row, when to pay for a model instead, and how to read the confidence numbers.",
    eyebrow="Guide / Text analysis",
    h1="Sentiment on every row, priced like a regex",
    lede="Not every text problem needs a model. Sentiment, keywords, entities and language detection can be deterministic, explainable and cheap enough to run on the whole table.",
    body=[
        h2("The two kinds of text endpoints"),
        p("Lexicon and rule based endpoints are deterministic: same input, same output, no tokens, no bill that scales with prose. Neural endpoints (summaries, rewrites, zero-shot classification, translation) cost more and take seconds instead of milliseconds. Pick per column, not per project."),
        table(["Task", "Method", "Latency", "Cost class"], [
            ["sentiment", "AFINN-style lexicon with negation handling", "under 100ms", "free"],
            ["keywords", "term frequency with stop words and phrase merging", "under 100ms", "free"],
            ["entities", "pattern and shape matching", "under 100ms", "free"],
            ["language", "script plus trigram detection", "under 100ms", "free"],
            ["summarize / rewrite / classify / translate", "Workers AI model", "1-3s", "neural"],
        ]),
        h2("The request"),
        code("curl -s -X POST 'https://textmind.p.rapidapi.com/v1/sentiment' \\\n  -H 'Content-Type: application/json' \\\n  -H 'X-RapidAPI-Key: YOUR_KEY' \\\n  -H 'X-RapidAPI-Host: textmind.p.rapidapi.com' \\\n  -d '{\"text\":\"The deploy was smooth and the tests all passed.\"}'"),
        h2("The response explains itself"),
        code('{\n  "score": 0.0444,\n  "label": "neutral",\n  "rawScore": 2,\n  "tokens": 9,\n  "matchedTokens": 1,\n  "negatedTokens": 0,\n  "topPositive": [{ "token": "smooth", "valence": 2, "count": 1 }],\n  "topNegative": [],\n  "meta": { "costClass": "free", "method": "afinn-lexicon-v1" }\n}'),
        p("That is the whole point of a lexicon method: you can see which word moved the score. When a result looks wrong you can fix the input or the threshold, not retrain a model."),
        h2("Where it breaks"),
        ul(["<b>Sarcasm</b> and irony read as positive because the words are positive.",
            "<b>Negation scoping</b> handles the common cases (not good, never great) and not the exotic ones.",
            "<b>Domain vocabulary</b> matters: in finance, volatile is neutral, not negative.",
            "If your text is short and idiomatic, the neural endpoints on the same API will do better. Use them for the rows that matter, not the whole table."]),
        h2("A sensible pipeline"),
        p("Run the deterministic endpoints on everything, store the label and score, then send only the ambiguous band (say 0.4 to 0.6) through the neural endpoint. You get coverage and accuracy without paying for both on every row."),
        cta("https://rapidapi.com/ayamullahkhan04/api/textmind-api", "TextMind"),
    ],
))

GUIDES.append(dict(
    slug="guides-pii-redaction.html",
    title="Redact PII before it reaches a log or a model",
    desc="Detecting emails, phones, cards and tokens in text, choosing between redact, mask and hash, and why offsets matter more than counts.",
    eyebrow="Guide / Privacy",
    h1="Stop sending customer text to places that keep it",
    lede="Logs outlive their purpose. Prompts travel further than you think. Redaction is the cheap control that makes both survivable.",
    body=[
        h2("Where the leak actually happens"),
        ul(["Error logs that capture the request body.",
            "Support tickets pasted into a model prompt.",
            "Analytics events with a free-text field.",
            "Third-party enrichment calls that echo the input back."]),
        p("You rarely need the raw value after the request is served. You need to know it was there, and you need the record to remain joinable. That is what offsets and stable hashes give you."),
        h2("The request"),
        code("curl -s -X POST 'https://piishield.p.rapidapi.com/v1/scan' \\\n  -H 'Content-Type: application/json' \\\n  -H 'X-RapidAPI-Key: YOUR_KEY' \\\n  -H 'X-RapidAPI-Host: piishield.p.rapidapi.com' \\\n  -d '{\"text\":\"Contact ayam@example.com or +44 7700 900123, card 4111 1111 1111 1111.\"}'"),
        h2("Findings carry positions and confidence"),
        code('{\n  "textLength": 70,\n  "findings": [\n    { "type": "EMAIL", "start": 8, "end": 24, "confidence": 0.99, "validator": "email-syntax" },\n    { "type": "PHONE", "start": 28, "end": 43, "confidence": 0.9, "validator": "phone-shape" },\n    { "type": "CREDIT_CARD", "start": 50, "end": 69, "confidence": 0.97, "validator": "luhn", "detail": "visa" }\n  ],\n  "counts": { "EMAIL": 1, "PHONE": 1, "CREDIT_CARD": 1 }\n}'),
        h2("Which endpoint for which job"),
        table(["Endpoint", "Output", "Use when"], [
            ["POST /v1/scan", "findings with offsets", "you want to review before changing anything"],
            ["POST /v1/redact", "text with typed placeholders", "shipping to a log or a model"],
            ["POST /v1/mask", "last four kept, rest masked", "showing a human a card or phone"],
            ["POST /v1/hash", "stable hash per value", "you need to join records without storing the value"],
            ["POST /v1/validate", "is this really a card or IBAN", "you already have a candidate value"],
        ]),
        h2("Why validators matter"),
        p("A card number that fails Luhn is almost certainly not a card, and redacting it costs you real information. The card detector runs Luhn, the IBAN runs mod-97, and the response names the validator that fired so you can decide how strict to be."),
        h2("Where heuristics stop"),
        ul(["Structured data (emails, cards, IBANs, IPs, tokens) is reliable and checksummed.",
            "Names and addresses are shapes, not formats. They carry lower confidence deliberately.",
            "Unusual formats will slip through. That is why every finding has an offset and a confidence: review the low-confidence band, and never treat one pass as a guarantee."]),
        cta("https://rapidapi.com/ayamullahkhan04/api/pii-shield-api", "PII Shield"),
    ],
))

for g in GUIDES:
    ld = {"@context": "https://schema.org", "@type": "TechArticle",
          "headline": g["h1"], "description": g["desc"],
          "author": {"@type": "Organization", "name": "Ayam Labs"},
          "publisher": {"@type": "Organization", "name": "Ayam Labs"},
          "mainEntityOfPage": f"{SITE}/{g['slug']}"}
    body = article(g["eyebrow"], g["h1"], g["lede"], g["body"])
    (OUT / g["slug"]).write_text(shell(g["title"], g["desc"], g["slug"], body, ld), encoding="utf-8")
    print("wrote", g["slug"])

# index
cards = []
for g in GUIDES:
    cards.append(f"""      <a href="/{g['slug']}" style="display:block;border:1px solid var(--line);border-radius:14px;padding:22px;margin:0 0 14px;background:var(--bg-raised)">
        <div class="eyebrow" style="margin-bottom:10px">{g['eyebrow']}</div>
        <h2 style="font-size:1.2rem;margin:0 0 8px">{g['h1']}</h2>
        <p style="margin:0;color:var(--text-dim);font-size:.94rem">{g['desc']}</p>
      </a>""")
idx_body = f"""  <section class="hero">
    <div class="wrap">
      <div class="eyebrow">Guides</div>
      <h1 style="font-size:clamp(2rem,5vw,3.2rem);margin:18px 0 18px;max-width:24ch">How to do the job, not just call the endpoint</h1>
      <p class="lede" style="max-width:62ch">Five short guides on the problems behind the APIs: verification without SMTP, on-page audits, PDF parsing at the edge, deterministic text analysis, and PII redaction. Each one says plainly where the method stops working.</p>
    </div>
  </section>
  <section class="section"><div class="wrap" style="max-width:78ch">
{chr(10).join(cards)}
  </div></section>"""
ld = {"@context": "https://schema.org", "@type": "CollectionPage", "name": "Guides", "url": f"{SITE}/guides.html"}
(OUT / "guides.html").write_text(shell("Guides - email, SEO, documents, text, privacy | Ayam Labs",
    "Five guides on email verification, on-page SEO audits, PDF text extraction, text analysis and PII redaction.",
    "guides.html", idx_body, ld), encoding="utf-8")
print("wrote guides.html")
