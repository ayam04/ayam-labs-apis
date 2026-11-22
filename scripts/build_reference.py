import json, pathlib, html, urllib.request, urllib.parse

OUT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
SITE = "https://labs.ayamk.in"
APIS = [
    ("emailcheck", "emailcheck.ayamk.in", "EmailCheck", "/demo.html", "/guides-email-verification.html", "https://rapidapi.com/ayamullahkhan04/api/emailcheck-api"),
    ("seo-audit", "seo-audit.ayamk.in", "SEO Audit", "/demo-seo-audit.html", "/guides-seo-audit.html", "https://rapidapi.com/ayamullahkhan04/api/seo-audit-api16"),
    ("docparse", "docparse.ayamk.in", "DocParse", "/demo-docparse.html", "/guides-pdf-text.html", "https://rapidapi.com/ayamullahkhan04/api/docparse-api"),
    ("ai-text", "textmind.ayamk.in", "TextMind", "/demo-textmind.html", "/guides-ai-text.html", "https://rapidapi.com/ayamullahkhan04/api/textmind-api"),
    ("pii-shield", "piishield.ayamk.in", "PII Shield", "/demo-pii-shield.html", "/guides-pii-redaction.html", "https://rapidapi.com/ayamullahkhan04/api/pii-shield-api"),
]

NAV = """        <a href="/emailcheck.html">EmailCheck</a>
        <a href="/seo-audit.html">SEO Audit</a>
        <a href="/docparse.html">DocParse</a>
        <a href="/ai-text.html">TextMind</a>
        <a href="/pii-shield.html">PII Shield</a>
        <a href="/demo.html">Demo</a>
        <a href="/guides.html">Guides</a>
        <a href="/performance.html">Latency</a>
        <a href="/pricing.html">Pricing</a>"""

def esc(s):
    return html.escape(str(s), quote=False)

import re as _re

def md(text):
    """Minimal inline markdown: bold, italic, code, and blank-line paragraphs."""
    out = esc(text or "")
    out = _re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", out)
    out = _re.sub(r"(?<![*\w])\*([^*\n]+)\*(?![*\w])", r"<i>\1</i>", out)
    parts = [p.strip() for p in out.split("\n\n") if p.strip()]
    return "</p><p style='color:var(--text-dim);margin:0 0 14px'>".join(parts)

CURRENT_SPEC = {}

# the specs' own example values need two fixes before they run:
#  - acme.example hosts are refused by the SSRF guard (reserved TLD), so use example.com
#  - DocumentInput/HtmlInput accept exactly one of url/base64 or url/html; send one
BODY_KEEP = {"DocumentInput": "url", "HtmlInput": "html"}
GET_PARAM_KEEP = {"/v1/keywords": ["text"], "/v1/readability": ["text"]}
# per-endpoint example overrides: a DOCX route needs a DOCX, not the PDF the schema suggests
BODY_URL_OVERRIDE = {
    "/v1/docx/text": "https://calibre-ebook.com/downloads/demos/demo.docx",
}

def scrub(value):
    if isinstance(value, str):
        return value.replace("acme.example", "example.com").replace("https://example.example", "https://example.com")
    if isinstance(value, list):
        return [scrub(v) for v in value]
    if isinstance(value, dict):
        return {k: scrub(v) for k, v in value.items()}
    return value

def resolve(schema):
    """Follow a $ref into components.schemas, otherwise return the schema unchanged."""
    seen = 0
    while isinstance(schema, dict) and "$ref" in schema and seen < 5:
        name = schema["$ref"].split("/")[-1]
        schema = (CURRENT_SPEC.get("components", {}).get("schemas", {}) or {}).get(name, {})
        seen += 1
    return schema

def param_value(p):
    sch = resolve(p.get("schema") or {})
    if sch.get("example") is not None:
        return sch["example"]
    name = (p.get("name") or "").lower()
    if name == "email":
        return "jane@example.com"
    if name == "domain":
        return "stripe.com"
    if name in ("url", "target"):
        return "https://example.com"
    if name == "lang":
        return "en"
    return sch.get("default", "example")

def example_for(schema, depth=0):
    schema = resolve(schema)
    if not isinstance(schema, dict):
        return None
    if "example" in schema:
        return schema["example"]
    t = schema.get("type")
    if t == "object":
        props = schema.get("properties") or {}
        out = {}
        for k, v in props.items():
            ev = example_for(v, depth + 1)
            out[k] = ev if ev is not None else default_for(v)
        return out
    if t == "array":
        items = schema.get("items") or {}
        return schema.get("example") or [example_for(items, depth + 1) or default_for(items)]
    return schema.get("default")

def default_for(schema):
    t = (schema or {}).get("type")
    if t == "string":
        return "string"
    if t == "integer" or t == "number":
        return 0
    if t == "boolean":
        return False
    if t == "array":
        return []
    if t == "object":
        return {}
    return None

def params_table(params):
    if not params:
        return ""
    rows = []
    for p in params:
        sch = p.get("schema") or {}
        rows.append(
            "<tr><td class='mono'>" + esc(p.get("name", "")) + "</td><td>" + esc(p.get("in", "")) + "</td>"
            + "<td>" + esc(sch.get("type", "")) + (" (required)" if p.get("required") else "") + "</td>"
            + "<td>" + esc(p.get("description") or sch.get("description") or "") + "</td></tr>"
        )
    return ("<div style='overflow:auto;margin:0 0 16px'><table style='width:100%;border-collapse:collapse;font-size:.88rem'>"
            "<thead><tr><th>Parameter</th><th>In</th><th>Type</th><th>Description</th></tr></thead><tbody>"
            + "".join(rows) + "</tbody></table></div>")

def body_block(body):
    try:
        schema = body["content"]["application/json"]["schema"]
    except Exception:
        return ""
    ex = example_for(schema) or {}
    return ("<p style='color:var(--text-dim);margin:0 0 8px'><b>Request body</b></p>"
            "<pre style='background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto;font-size:.8rem;margin:0 0 14px'><code>"
            + esc(json.dumps(ex, indent=2)) + "</code></pre>")

def curl_for(method, path, params, body):
    url = path
    if params:
        if path in GET_PARAM_KEEP:
            params = [p for p in params if p.get("name") in GET_PARAM_KEEP[path]]
        pairs = []
        for p in params:
            v = param_value(p)
            if isinstance(v, bool):
                v = "true" if v else "false"
            pairs.append(str(p.get("name")) + "=" + urllib.parse.quote(str(scrub(v)), safe=":/"))
        url = path + "?" + "&".join(pairs)
    lines = ["curl -s -X " + method.upper() + " 'https://{host}" + url + "' \\"]
    lines.append("  -H 'X-RapidAPI-Key: YOUR_KEY' \\")
    lines.append("  -H 'X-RapidAPI-Host: " + "{proxy}" + "'")
    if body:
        lines[-1] += " \\"
        raw_schema = body["content"]["application/json"]["schema"]
        ref_name = raw_schema.get("$ref", "").split("/")[-1] if isinstance(raw_schema, dict) else ""
        ex = example_for(raw_schema) or {}
        if ref_name in BODY_KEEP:
            keep = BODY_KEEP[ref_name]
            schema_props = resolve(raw_schema).get("properties") or {}
            ex = {keep: ex.get(keep)} if keep in schema_props else ex
        ex = scrub(ex)
        if path in BODY_URL_OVERRIDE:
            ex = dict(ex)
            ex["url"] = BODY_URL_OVERRIDE[path]
        lines.append("  -H 'Content-Type: application/json' \\")
        lines.append("  -d '" + json.dumps(ex) + "'")
    return "\n".join(lines)

total_ops = 0
for slug, host, name, demo, guide, listing in APIS:
    spec = json.loads(pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\.tmp\spec-" + slug + ".json").read_text(encoding="utf-8"))
    CURRENT_SPEC = spec
    proxy = slug.replace("-", "") + ".p.rapidapi.com"
    sections = []
    ops = 0
    for path, item in spec["paths"].items():
        for method in ("get", "post"):
            op = item.get(method)
            if not op:
                continue
            ops += 1
            params = op.get("parameters") or []
            body = op.get("requestBody")
            anchor = (method + path).replace("/", "_").replace("{", "").replace("}", "")
            curl = curl_for(method, path, params, body).replace("{host}", host).replace("{proxy}", proxy)
            sections.append(f"""
    <div id="{anchor}" style="border-top:1px solid var(--line);padding:26px 0 6px">
      <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap">
        <span class="mono" style="color:var(--accent);font-size:.8rem;letter-spacing:.08em">{method.upper()}</span>
        <span class="mono" style="font-size:1rem">{esc(path)}</span>
      </div>
      <h3 style="margin:10px 0 8px;font-size:1.05rem">{esc(op.get('summary') or '')}</h3>
      <p style="color:var(--text-dim);margin:0 0 14px">{md(op.get('description') or '')}</p>
      {params_table(params)}
      {body_block(body)}
      <details style="margin:0 0 10px"><summary style="cursor:pointer;color:var(--muted);font-size:.85rem">curl example</summary>
        <pre style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto;font-size:.78rem;margin:10px 0 0"><code>{esc(curl)}</code></pre>
      </details>
    </div>""")
    total_ops += ops

    intro = md(spec["info"].get("description") or "")
    body_html = f"""  <section class="hero">
    <div class="wrap">
      <div class="eyebrow">Reference / {esc(name)}</div>
      <h1 style="font-size:clamp(1.9rem,4.4vw,2.9rem);margin:18px 0 16px;max-width:28ch">{esc(spec['info']['title'])} reference</h1>
      <p class="lede" style="max-width:64ch">{intro if intro else esc(spec['info']['title']) + ' - every route, parameter and example, generated from the live OpenAPI document.'}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px">
        <a class="btn btn-primary" href="{demo}">Try it live</a>
        <a class="btn" href="{listing}" rel="noopener">Open the listing</a>
        <a class="btn" href="{guide}">Read the guide</a>
      </div>
    </div>
  </section>
  <section class="section"><div class="wrap" style="max-width:86ch">
    <h2 style="margin:0 0 10px;font-size:1.3rem">Auth</h2>
    <p style="color:var(--text-dim);margin:0 0 10px">Two headers on every call. The marketplace rejects requests without them before they reach the API.</p>
    <pre style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto;font-size:.82rem;margin:0 0 22px"><code>X-RapidAPI-Key: YOUR_KEY
X-RapidAPI-Host: {proxy}</code></pre>

    <h2 style="margin:0 0 10px;font-size:1.3rem">Errors</h2>
    <p style="color:var(--text-dim);margin:0 0 10px">Every failure returns the same envelope, with a requestId you can quote to support.</p>
    <pre style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:12px;overflow:auto;font-size:.8rem;margin:0 0 26px"><code>{{ "error": {{ "code": "INVALID_INPUT", "message": "...", "hint": "..." }}, "requestId": "uuid", "timestamp": "ISO-8601" }}</code></pre>

    <h2 style="margin:0;font-size:1.3rem">{ops} endpoints</h2>
    {''.join(sections)}

    <p style="color:var(--muted);font-size:.85rem;margin:26px 0 0">Generated from <a href="https://{host}/openapi.json">{host}/openapi.json</a> on 2026-11-22. If the page and the spec ever disagree, the spec is right.</p>
  </div></section>"""

    ld = {"@context": "https://schema.org", "@type": "TechArticle",
          "headline": spec["info"]["title"] + " reference",
          "url": f"{SITE}/reference-{slug}.html",
          "publisher": {"@type": "Organization", "name": "Ayam Labs"}}
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(name)} API reference - every endpoint and parameter | Ayam Labs</title>
<meta name="description" content="{esc(name)} API reference generated from the live OpenAPI document: {ops} endpoints, parameters, request bodies and curl examples.">
<link rel="canonical" href="{SITE}/reference-{slug}.html">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(name)} API reference">
<meta property="og:description" content="{ops} endpoints with parameters and curl examples.">
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
    <a class="btn btn-sm" href="{listing}" rel="noopener">Get an API key</a>
  </div>
</header>
<main>
{body_html}
</main>
<footer class="site-footer">
  <div class="wrap inner">
    <div><span class="mono">&copy; 2026 Ayam Labs</span> &nbsp;·&nbsp; APIs for email, SEO, documents, text and privacy.</div>
    <div class="mono"><a href="/guides.html">Guides</a> &nbsp;·&nbsp; <a href="/performance.html">Latency</a> &nbsp;·&nbsp; <a href="/legal.html">Legal</a></div>
  </div>
</footer>
<script src="/app.js" defer></script>
</body>
</html>
"""
    (OUT / f"reference-{slug}.html").write_text(page, encoding="utf-8")
    print("wrote reference-" + slug, "ops:", ops)

print("total endpoints documented:", total_ops)