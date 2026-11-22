import pathlib, json

OUT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
SITE = "https://labs.ayamk.in"

NAV = """        <a href="/emailcheck.html">EmailCheck</a>
        <a href="/seo-audit.html">SEO Audit</a>
        <a href="/docparse.html">DocParse</a>
        <a href="/ai-text.html">TextMind</a>
        <a href="/pii-shield.html">PII Shield</a>
        <a href="/demo.html">Demo</a>
        <a href="/guides.html">Guides</a>
        <a href="/pricing.html">Pricing</a>"""

SHELL = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{site}/{slug}">
<meta property="og:type" content="website">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta name="theme-color" content="#08090a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">{ld}</script>
</head>
<body>
<header class="site-header">
  <div class="wrap inner">
    <a class="brand" href="/"><span class="mark">AL</span> Ayam Labs</a>
    <nav class="nav">
{nav}
    </nav>
    <a class="btn btn-sm" href="{listing}" rel="noopener">Get an API key</a>
  </div>
</header>
<main>
  <section class="hero">
    <div class="wrap">
      <div class="eyebrow">{eyebrow}</div>
      <h1 style="font-size:clamp(2rem,5vw,3.2rem);margin:18px 0 18px;max-width:26ch">{h1}</h1>
      <p class="lede" style="max-width:62ch">{lede}</p>
{form}
      <p id="demo-status" style="margin:0 0 20px;color:var(--muted);font-size:.85rem;min-height:20px">Sends one live request to <code>{endpoint}</code>.</p>
      <div id="demo-out" style="display:none;border:1px solid var(--line);border-radius:14px;padding:24px;background:var(--bg-raised);max-width:820px">
{out}
        <pre style="margin:20px 0 0;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto;font-size:.78rem;max-height:260px"><code id="demo-raw">--</code></pre>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="wrap">
      <div class="section-head"><div><div class="section-num">01 - WHAT YOU ARE SEEING</div><h2>{cards_title}</h2></div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:26px">{cards}</div>
      <p style="margin:26px 0 0;color:var(--muted);font-size:.85rem">Ten demo calls per visitor per day. Past that the endpoint returns 429 and points at the listing, because a demo that never ends is a free tier.</p>
      <p style="margin:14px 0 0;color:var(--text-dim)">Read the <a href="/{guide}">guide</a> or open the <a href="{listing}" rel="noopener">listing</a>.</p>
    </div>
  </section>
</main>
<footer class="site-footer">
  <div class="wrap inner">
    <div><span class="mono">&copy; 2026 Ayam Labs</span> &nbsp;·&nbsp; APIs for email, SEO, documents, text and privacy.</div>
    <div class="mono"><a href="/guides.html">Guides</a> &nbsp;·&nbsp; <a href="/pricing.html">Pricing</a> &nbsp;·&nbsp; <a href="/legal.html">Legal</a></div>
  </div>
</footer>
<script>
(function () {{
  var form = document.getElementById('demo-form');
  var btn = document.getElementById('demo-btn');
  var status = document.getElementById('demo-status');
  var out = document.getElementById('demo-out');
  var raw = document.getElementById('demo-raw');
  form.addEventListener('submit', async function (e) {{
    e.preventDefault();
    btn.disabled = true;
    status.textContent = 'Calling the API...';
    out.style.display = 'none';
    try {{
      var payload = {{ {payload} }};
      var res = await fetch('/api/demo/{app}', {{ method: 'POST', headers: {{ 'content-type': 'application/json' }}, body: JSON.stringify(payload) }});
      var data = await res.json();
      if (!res.ok) {{ status.textContent = data.error || ('Request failed (' + res.status + ')'); return; }}
      {render}
      raw.textContent = JSON.stringify(data, null, 2);
      out.style.display = 'block';
      status.textContent = '{done}';
    }} catch (err) {{
      status.textContent = 'Network error. Try again.';
    }} finally {{
      btn.disabled = false;
    }}
  }});
}})();
</script>
</body>
</html>
"""

def card(title, body):
    return ('<div style="border:1px solid var(--line);border-radius:12px;padding:18px">'
            f'<h3 style="margin:0 0 8px;font-size:1rem">{title}</h3>'
            f'<p style="margin:0;color:var(--text-dim);font-size:.9rem">{body}</p></div>')

def form_input(id_, placeholder, kind="url"):
    return (f'      <form id="demo-form" style="margin:34px 0 10px;display:flex;gap:10px;flex-wrap:wrap;max-width:680px">\n'
            f'        <input id="{id_}" type="{kind}" required placeholder="{placeholder}" autocomplete="off"\n'
            '          style="flex:1 1 380px;padding:12px 14px;background:var(--bg-raised);border:1px solid var(--line-bright);border-radius:10px;color:var(--text);font-family:var(--font-mono);font-size:.95rem">\n'
            '        <button class="btn btn-primary" type="submit" id="demo-btn">Run</button>\n'
            '      </form>')

def form_text(id_, placeholder, default=None):
    seed = default or "The deploy was smooth and the tests all passed, but the docs are still thin."
    return (f'      <form id="demo-form" style="margin:34px 0 10px;max-width:680px">\n'
            f'        <textarea id="{id_}" required rows="4" placeholder="{placeholder}"\n'
            f'          style="width:100%;padding:12px 14px;background:var(--bg-raised);border:1px solid var(--line-bright);border-radius:10px;color:var(--text);font-family:var(--font-mono);font-size:.9rem;resize:vertical">{seed}</textarea>\n'
            '        <button class="btn btn-primary" type="submit" id="demo-btn" style="margin-top:12px">Run</button>\n'
            '      </form>')

PAGES = []

# SEO audit
PAGES.append(dict(
    slug="demo-seo-audit.html", app="seo-audit",
    title="Try the SEO audit API - live demo | Ayam Labs",
    desc="Audit any URL's on-page SEO in the browser: weighted score, 14 checks, the exact message for each failure.",
    eyebrow="Live demo / SEO Audit",
    h1="Audit a page from the address bar",
    lede="Paste any URL. The API fetches it, parses it, and runs fourteen weighted checks. You get the score, the grade and the reason for every check that did not pass.",
    endpoint="seo-audit.ayamk.in/v1/audit",
    form=form_input("demo-url", "https://example.com"),
    out='''        <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap">
          <div class="mono" id="s-value" style="font-size:2.6rem;line-height:1">--</div>
          <div><div class="mono" id="s-grade" style="font-size:1.1rem;color:var(--accent)">--</div>
          <div id="s-summary" style="color:var(--muted);font-size:.85rem">--</div></div>
        </div>
        <div id="s-checks" style="margin:20px 0 0;display:grid;gap:8px"></div>''',
    cards_title="Every check carries a weight and a message",
    cards="".join([
        card("score.value", "0 to 100, computed from fourteen weighted checks. Not a vibe, arithmetic."),
        card("status", "pass, warn or fail, with the points awarded so you can see what a fix is worth."),
        card("message", "Plain English, e.g. &#34;Title is 14 characters; aim for 15-60.&#34;"),
        card("timings", "fetch and parse milliseconds, so you know whether the site or the parser was slow."),
    ]),
    guide="guides-seo-audit.html",
    listing="https://rapidapi.com/ayamullahkhan04/api/seo-audit-api16",
    payload="url: document.getElementById('demo-url').value",
    done="Live audit complete.",
    render='''document.getElementById('s-value').textContent = data.score.value;
      document.getElementById('s-grade').textContent = data.score.grade;
      document.getElementById('s-summary').textContent = data.score.passed + ' passed, ' + data.score.warned + ' warnings, ' + data.score.failed + ' failed on ' + data.finalUrl;
      var box = document.getElementById('s-checks');
      box.innerHTML = '';
      (data.score.checks || []).forEach(function (c) {
        var row = document.createElement('div');
        var colour = c.status === 'pass' ? '#4ade80' : (c.status === 'warn' ? '#fbbf24' : '#f87171');
        row.style.cssText = 'display:grid;grid-template-columns:70px 1fr;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;font-size:.86rem';
        row.innerHTML = '<span class="mono" style="color:' + colour + '">' + c.status + '</span>' +
          '<span><b>' + c.label + '</b> <span style="color:var(--muted)">· ' + c.points + '/' + c.weight + '</span><br>' +
          '<span style="color:var(--text-dim)">' + c.message + '</span></span>';
        box.appendChild(row);
      });''',
))

# DocParse
PAGES.append(dict(
    slug="demo-docparse.html", app="docparse",
    title="Try the document text extraction API - live demo | Ayam Labs",
    desc="Paste a URL to a PDF, DOCX or HTML page and get clean text back in the browser. No install, no parser to bundle.",
    eyebrow="Live demo / DocParse",
    h1="Paste a link, get the text back",
    lede="Point it at a PDF or an HTML page. The API detects which is which, fetches it, and returns the readable text with counts. Try a paper, a help page, an invoice.",
    endpoint="docparse.ayamk.in/v1/pdf/text or /v1/html/text",
    form=form_input("demo-url", "https://arxiv.org/pdf/1810.04805"),
    out='''        <div id="d-meta" style="display:flex;gap:22px;flex-wrap:wrap;font-size:.85rem;color:var(--muted)"></div>
        <h3 id="d-title" style="margin:16px 0 10px;font-size:1.05rem">--</h3>
        <div id="d-text" style="font-family:var(--font-mono);font-size:.8rem;line-height:1.65;color:var(--text-dim);max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--bg)"></div>''',
    cards_title="The same call handles three formats",
    cards="".join([
        card("detection", "A .pdf path goes to the PDF parser, anything else to the HTML reader. You do not branch."),
        card("counts", "characters, words and page count, so you can budget chunking before you pay for embedding."),
        card("no storage", "The file lives in memory for the request only. Nothing is written to a bucket."),
        card("no OCR", "A scanned PDF has no text layer and comes back empty. That is a different service, stated plainly."),
    ]),
    guide="guides-pdf-text.html",
    listing="https://rapidapi.com/ayamullahkhan04/api/docparse-api",
    payload="url: document.getElementById('demo-url').value",
    done="Extracted.",
    render='''document.getElementById('d-title').textContent = data.title || data.metadata && data.metadata.title || '(no title found)';
      document.getElementById('d-meta').innerHTML =
        '<span>' + (data.words || 0) + ' words</span>' +
        '<span>' + (data.characters || 0) + ' characters</span>' +
        (data.pageCount ? '<span>' + data.pageCount + ' pages</span>' : '') +
        (data.truncated ? '<span style="color:#fbbf24">truncated</span>' : '');
      var t = (data.text || '').slice(0, 3000);
      document.getElementById('d-text').textContent = t || '(no text layer found, the document may be scanned)';''',
))

# TextMind
PAGES.append(dict(
    slug="demo-textmind.html", app="ai-text",
    title="Try the text analysis API - sentiment and keywords demo | Ayam Labs",
    desc="Paste text and get sentiment with the words that drove it, plus ranked keywords. Deterministic, no model bill.",
    eyebrow="Live demo / TextMind",
    h1="Sentiment you can argue with",
    lede="Paste a paragraph. You get a label, a score, the words that moved it, and the ranked keywords. Lexicon-driven, so the same input always gives the same answer.",
    endpoint="textmind.ayamk.in/v1/sentiment and /v1/keywords",
    form=form_text("demo-text", "Paste a review, a ticket or a paragraph"),
    out='''        <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap">
          <div class="mono" id="t-label" style="font-size:1.8rem;line-height:1">--</div>
          <div id="t-score" style="color:var(--muted);font-size:.9rem">--</div>
        </div>
        <div id="t-detail" style="margin:14px 0 0;font-size:.85rem;color:var(--text-dim)"></div>
        <div id="t-keywords" style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 0"></div>''',
    cards_title="Two free endpoints, no model in the loop",
    cards="".join([
        card("label", "positive, negative, neutral or mixed, from an AFINN-style lexicon with negation handling."),
        card("why", "topPositive and topNegative list the exact tokens and their valence. Nothing is hidden."),
        card("keywords", "term frequency with stop words removed and phrases merged, with a TF-IDF option."),
        card("when to pay", "summaries, rewrites, zero-shot labels and translation are the neural endpoints on the same key. Use them on the ambiguous band only."),
    ]),
    guide="guides-ai-text.html",
    listing="https://rapidapi.com/ayamullahkhan04/api/textmind-api",
    payload="text: document.getElementById('demo-text').value",
    done="Analysis complete.",
    render='''var s = data.sentiment || {};
      document.getElementById('t-label').textContent = s.label || '?';
      document.getElementById('t-score').textContent = 'score ' + (s.score != null ? s.score : '?') + ' · ' + (s.matchedTokens || 0) + ' of ' + (s.tokens || 0) + ' tokens matched';
      var details = [];
      (s.topPositive || []).slice(0, 4).forEach(function (x) { details.push('+' + x.token); });
      (s.topNegative || []).slice(0, 4).forEach(function (x) { details.push('-' + x.token); });
      document.getElementById('t-detail').textContent = details.length ? 'driven by: ' + details.join(', ') : 'no lexicon tokens matched, so the score stays near zero';
      var box = document.getElementById('t-keywords');
      box.innerHTML = '';
      var list = (data.keywords && (data.keywords.keywords || data.keywords.terms)) || [];
      list.slice(0, 12).forEach(function (k) {
        var term = typeof k === 'string' ? k : (k.term || k.keyword || k.token || '');
        var chip = document.createElement('span');
        chip.textContent = term;
        chip.style.cssText = 'font-family:var(--font-mono);font-size:.75rem;padding:4px 9px;border-radius:999px;border:1px solid var(--line-bright);color:var(--muted)';
        box.appendChild(chip);
      });''',
))

# PII Shield
PAGES.append(dict(
    slug="demo-pii-shield.html", app="pii-shield",
    title="Try the PII redaction API - live demo | Ayam Labs",
    desc="Paste text with emails, phones or card numbers and see it redacted live, with the detector and validator used for each finding.",
    eyebrow="Live demo / PII Shield",
    h1="Watch your data get redacted",
    lede="Paste text that looks like a support ticket. Emails, phones, cards, IBANs, tokens and 13 more detectors run, then the text comes back with the values masked and the reason for each hit.",
    endpoint="piishield.ayamk.in/v1/redact",
    form=form_text("demo-text", "Paste text containing personal data", "Hi, I am Jane Doe. Email jane.doe@example.com or call 555-123-4567. Card on file: 4111 1111 1111 1111. IP 203.0.113.42."),
    out='''        <div style="font-family:var(--font-mono);font-size:.85rem;line-height:1.7;background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:14px" id="p-redacted">--</div>
        <div id="p-count" style="margin:14px 0 0;color:var(--muted);font-size:.85rem"></div>
        <div id="p-findings" style="margin:14px 0 0;display:grid;gap:6px"></div>''',
    cards_title="Detection, then a policy you choose",
    cards="".join([
        card("mask", "Keeps the last four characters. What a support agent needs to read a card back."),
        card("label", "Stable tokens like [EMAIL_1]. Two occurrences share a token, so a model can follow the thread."),
        card("hash", "SHA-256 prefix plus a count map. Records stay joinable, the value never comes back."),
        card("validators", "Luhn for cards, mod-97 for IBANs. A number that fails the check is not reported as a card."),
    ]),
    guide="guides-pii-redaction.html",
    listing="https://rapidapi.com/ayamullahkhan04/api/pii-shield-api",
    payload="text: document.getElementById('demo-text').value",
    done="Redacted.",
    render='''document.getElementById('p-redacted').textContent = data.redactedText || '(nothing to redact)';
      document.getElementById('p-count').textContent = (data.replacementCount || 0) + ' replacements · style ' + (data.style || 'mask') + (data.keepLast != null ? ' · keepLast ' + data.keepLast : '');
      var box = document.getElementById('p-findings');
      box.innerHTML = '';
      (data.findings || []).forEach(function (f) {
        var row = document.createElement('div');
        row.style.cssText = 'display:grid;grid-template-columns:130px 1fr 90px;gap:10px;font-size:.82rem;padding:6px 0;border-bottom:1px solid var(--line)';
        row.innerHTML = '<span class="mono" style="color:var(--accent)">' + f.type + '</span>' +
          '<span style="color:var(--text-dim);overflow:hidden;text-overflow:ellipsis">' + String(f.value) + '</span>' +
          '<span class="mono" style="color:var(--muted);text-align:right">' + (f.validator || '') + '</span>';
        box.appendChild(row);
      });''',
))

for pg in PAGES:
    ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": pg["title"].split(" - ")[0],
          "url": f"{SITE}/{pg['slug']}", "applicationCategory": "DeveloperApplication",
          "operatingSystem": "Any (HTTP API)",
          "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD", "description": "10 live demo calls per visitor per day"}}
    htmlout = SHELL.format(
        title=pg["title"], desc=pg["desc"], site=SITE, slug=pg["slug"], ld=json.dumps(ld),
        nav=NAV, listing=pg["listing"], eyebrow=pg["eyebrow"], h1=pg["h1"], lede=pg["lede"],
        form=pg["form"], endpoint=pg["endpoint"], out=pg["out"], cards_title=pg["cards_title"],
        cards=pg["cards"], guide=pg["guide"], app=pg["app"], payload=pg["payload"],
        render=pg["render"], done=pg["done"],
    )
    (OUT / pg["slug"]).write_text(htmlout, encoding="utf-8")
    print("wrote", pg["slug"])