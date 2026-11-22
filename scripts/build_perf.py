import pathlib, json
OUT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
SITE = "https://labs.ayamk.in"
ROWS = """<tr><td>emailcheck /v1/verify</td><td class="mono">172 ms</td><td class="mono">554 ms</td><td class="mono">147 ms</td></tr><tr><td>emailcheck /v1/bulk (10)</td><td class="mono">163 ms</td><td class="mono">185 ms</td><td class="mono">156 ms</td></tr><tr><td>seo-audit /v1/audit (uncached)</td><td class="mono">595 ms</td><td class="mono">1359 ms</td><td class="mono">267 ms</td></tr><tr><td>seo-audit /v1/audit (cached)</td><td class="mono">211 ms</td><td class="mono">227 ms</td><td class="mono">199 ms</td></tr><tr><td>docparse /v1/html/text</td><td class="mono">181 ms</td><td class="mono">470 ms</td><td class="mono">159 ms</td></tr><tr><td>docparse /v1/pdf/text 16p</td><td class="mono">596 ms</td><td class="mono">668 ms</td><td class="mono">433 ms</td></tr><tr><td>textmind /v1/sentiment</td><td class="mono">152 ms</td><td class="mono">409 ms</td><td class="mono">142 ms</td></tr><tr><td>textmind /v1/summarize</td><td class="mono">2405 ms</td><td class="mono">2939 ms</td><td class="mono">2095 ms</td></tr><tr><td>pii-shield /v1/redact</td><td class="mono">174 ms</td><td class="mono">486 ms</td><td class="mono">164 ms</td></tr>"""
NAV = """        <a href="/emailcheck.html">EmailCheck</a>
        <a href="/seo-audit.html">SEO Audit</a>
        <a href="/docparse.html">DocParse</a>
        <a href="/ai-text.html">TextMind</a>
        <a href="/pii-shield.html">PII Shield</a>
        <a href="/demo.html">Demo</a>
        <a href="/guides.html">Guides</a>
        <a href="/pricing.html">Pricing</a>"""

ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Measured latency",
      "description": "Real client-side latency for each endpoint, measured on 22 November 2026.",
      "url": SITE + "/performance.html"}

html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Measured latency - real numbers per endpoint | Ayam Labs</title>
<meta name="description" content="Client-side p50 and p95 latency for every endpoint, measured on 22 November 2026, with the method and the caveats.">
<link rel="canonical" href="{SITE}/performance.html">
<meta property="og:type" content="article">
<meta property="og:title" content="Measured latency - real numbers per endpoint">
<meta property="og:description" content="p50 and p95 per endpoint, with method and caveats.">
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
    <a class="btn btn-sm" href="/demo.html">Try a live call</a>
  </div>
</header>
<main>
  <section class="hero">
    <div class="wrap">
      <div class="eyebrow">Performance / measured</div>
      <h1 style="font-size:clamp(2rem,5vw,3.2rem);margin:18px 0 18px;max-width:26ch">Real latency, from a real client</h1>
      <p class="lede" style="max-width:64ch">Nobody should have to guess. These are client-side timings measured on 22 November 2026 from one machine in Asia, hitting the production endpoints with a marketplace key.</p>
    </div>
  </section>
  <section class="section"><div class="wrap" style="max-width:84ch">
    <div style="overflow:auto;margin:0 0 22px"><table style="width:100%;border-collapse:collapse;font-size:.9rem">
      <thead><tr><th>Endpoint</th><th>p50</th><th>p95</th><th>fastest</th></tr></thead>
      <tbody>{ROWS}</tbody></table></div>

    <h2 style="margin:40px 0 12px;font-size:1.4rem">Read the panel, not just the row</h2>
    <p style="color:var(--text-dim);margin:0 0 14px">Every response carries its own server-side timing. Calling <code>/v1/verify</code> reports:</p>
    <pre style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto;font-size:.8rem"><code>x-response-time-ms: 16
Server-Timing: cfEdge;dur=7, cfOrigin;dur=0, cfWorker;dur=21</code></pre>
    <p style="color:var(--text-dim);margin:0 0 14px">So of the 172ms round trip, about 16ms was the Worker. The rest is distance: the request travelled from Asia to a Cloudflare edge location and back. A client in Frankfurt or Virginia will see a smaller number for the same endpoint, and no amount of code on our side changes that.</p>

    <h2 style="margin:40px 0 12px;font-size:1.4rem">What the numbers show</h2>
    <ul style="color:var(--text-dim);margin:0 0 18px;padding-left:20px;line-height:1.8">
      <li>The deterministic endpoints sit at the floor: ~150-180ms p50, which is essentially the network round trip, not compute.</li>
      <li>The cached audit is 211ms p50 against 595ms uncached. That is the edge cache doing what the guide says it does.</li>
      <li>A 16-page PDF takes about 600ms; the parse is the work, not the fetch.</li>
      <li>The one neural endpoint measured, <code>/v1/summarize</code>, is 2.4s p50. That is a 20B model answering, and it is the honest cost of the feature.</li>
      <li>p95 is two to three times p50 on several rows because these are single calls from one machine with no warmup, not a load test.</li>
    </ul>

    <h2 style="margin:40px 0 12px;font-size:1.4rem">Method and limits</h2>
    <ul style="color:var(--text-dim);margin:0 0 18px;padding-left:20px;line-height:1.8">
      <li>Node's <code>fetch</code> from one residential connection in Asia, 12 sequential calls per endpoint (4 for the model and PDF rows), no concurrency.</li>
      <li>The audit rows use eight distinct URLs for "uncached" and ten repeats of one URL for "cached".</li>
      <li>Timings include DNS, TLS and the full body read. They are end-to-end, not server-side only.</li>
      <li>This is not a benchmark of peak throughput. It is what one caller experienced, which is the number a buyer actually cares about.</li>
    </ul>
    <p style="color:var(--muted);font-size:.85rem">Re-run it yourself: <code>node .tmp/bench.mjs</code> against the live hosts. The script is in the public repo.</p>
  </div></section>
</main>
<footer class="site-footer">
  <div class="wrap inner">
    <div><span class="mono">&copy; 2026 Ayam Labs</span> &nbsp;·&nbsp; APIs for email, SEO, documents, text and privacy.</div>
    <div class="mono"><a href="https://github.com/ayam04/ayam-labs-apis" rel="noopener">Source</a> &nbsp;·&nbsp; <a href="/guides.html">Guides</a> &nbsp;·&nbsp; <a href="/legal.html">Legal</a></div>
  </div>
</footer>
<script src="/app.js" defer></script>
</body>
</html>
"""
(OUT / "performance.html").write_text(html, encoding="utf-8")
print("wrote performance.html")
