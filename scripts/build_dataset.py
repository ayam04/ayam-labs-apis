import json, pathlib, datetime

ROOT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace")
PUB = ROOT / "marketing" / "site" / "public"
data = json.loads((ROOT / "apps" / "emailcheck" / "src" / "data" / "disposable.json").read_text(encoding="utf-8"))
domains = [d.strip().lower() for d in data["blocklist"].split("\n") if d.strip()]
domains = sorted(set(domains))
today = "2026-11-22"

# plain text
(PUB / "disposable-domains.txt").write_text("\n".join(domains) + "\n", encoding="utf-8")
# json
payload = {
    "name": "Disposable email domain list",
    "count": len(domains),
    "updated": today,
    "source": data.get("source"),
    "note": "Free to use. Check the upstream repository for its license terms.",
    "domains": domains,
}
(PUB / "disposable-domains.json").write_text(json.dumps(payload, indent=0), encoding="utf-8")
print("domains:", len(domains))

sample = ", ".join(domains[:4])
NAV = """        <a href="/emailcheck.html">EmailCheck</a>
        <a href="/seo-audit.html">SEO Audit</a>
        <a href="/docparse.html">DocParse</a>
        <a href="/ai-text.html">TextMind</a>
        <a href="/pii-shield.html">PII Shield</a>
        <a href="/demo.html">Demo</a>
        <a href="/guides.html">Guides</a>
        <a href="/performance.html">Latency</a>
        <a href="/pricing.html">Pricing</a>"""

ld = {"@context": "https://schema.org", "@type": "Dataset",
      "name": "Disposable email domain list",
      "description": f"{len(domains)} disposable and throwaway email domains, free to download as text or JSON.",
      "url": "https://labs.ayamk.in/disposable-domains.html",
      "license": "https://github.com/disposable-email-domains/disposable-email-domains",
      "creator": {"@type": "Organization", "name": "Ayam Labs"},
      "dateModified": today,
      "distribution": [
          {"@type": "DataDownload", "contentUrl": "https://labs.ayamk.in/disposable-domains.txt", "encodingFormat": "text/plain"},
          {"@type": "DataDownload", "contentUrl": "https://labs.ayamk.in/disposable-domains.json", "encodingFormat": "application/json"},
      ]}

html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{len(domains):,} disposable email domains, free list (txt and json) | Ayam Labs</title>
<meta name="description" content="A free list of {len(domains):,} disposable and throwaway email domains, updated {today}. Download as plain text or JSON, no signup.">
<link rel="canonical" href="https://labs.ayamk.in/disposable-domains.html">
<meta property="og:type" content="article">
<meta property="og:title" content="{len(domains):,} disposable email domains, free list">
<meta property="og:description" content="Free text and JSON download, updated {today}.">
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
    <a class="btn btn-sm" href="/demo.html">Try the API</a>
  </div>
</header>
<main>
  <section class="hero">
    <div class="wrap">
      <div class="eyebrow">Free dataset / email</div>
      <h1 style="font-size:clamp(2rem,5vw,3.2rem);margin:18px 0 18px;max-width:22ch">{len(domains):,} disposable email domains</h1>
      <p class="lede" style="max-width:64ch">A plain list of throwaway email providers, free to download and use. No signup, no tracking, no rate limit, because it is a static file.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px">
        <a class="btn btn-primary" href="/disposable-domains.txt" download>Download .txt</a>
        <a class="btn" href="/disposable-domains.json" download>Download .json</a>
        <a class="btn" href="/demo.html">Check an address live</a>
      </div>
      <p style="margin:20px 0 0;color:var(--muted);font-size:.85rem">Updated {today}. {len(domains):,} domains, one per line, lowercase, deduplicated and sorted.</p>
    </div>
  </section>
  <section class="section"><div class="wrap" style="max-width:80ch">
    <h2 style="margin:0 0 12px;font-size:1.4rem">What is in the file</h2>
    <ul style="color:var(--text-dim);margin:0 0 18px;padding-left:20px;line-height:1.9">
      <li><b>disposable-domains.txt</b>: one domain per line, about 160 KB, lowecased and sorted. Loop over it, load it into a Set, or grep it.</li>
      <li><b>disposable-domains.json</b>: the same list with a count, the update date and provenance, for code that wants metadata alongside the data.</li>
      <li>A sample: <span class="mono">{sample}</span> and {len(domains):,} more.</li>
    </ul>

    <h2 style="margin:38px 0 12px;font-size:1.4rem">Where the list comes from</h2>
    <p style="color:var(--text-dim);margin:0 0 14px">The domains are sourced from the community <a href="https://github.com/disposable-email-domains/disposable-email-domains" rel="noopener">disposable-email-domains</a> blocklist, then deduplicated, lowercased and sorted for this download. Check that repository for its license terms before you redistribute it.</p>
    <p style="color:var(--text-dim);margin:0 0 14px">The same list ships inside the EmailCheck API, where it is compiled into the worker, so a disposable check costs no network lookup.</p>

    <h2 style="margin:38px 0 12px;font-size:1.4rem">Why a list is not enough</h2>
    <p style="color:var(--text-dim);margin:0 0 14px">A static list tells you a domain was known to be disposable when the list was built. It cannot tell you whether the domain accepts mail at all, whether it is a catch-all, or whether it appeared last week. That is why the API runs the list plus live MX and A/AAAA lookups plus syntax and role-account checks, and returns the reasons rather than a single boolean.</p>
    <p style="color:var(--text-dim);margin:0 0 14px">If you only need the list, take the file. If you need a decision per address, use <a href="/reference-emailcheck.html">the API</a>.</p>

    <h2 style="margin:38px 0 12px;font-size:1.4rem">Check one address, right now</h2>
    <pre style="background:var(--bg-raised);border:1px solid var(--line);border-radius:10px;padding:14px;overflow:auto;font-size:.82rem;margin:0 0 18px"><code>curl -s 'https://emailcheck.p.rapidapi.com/v1/verify?email=someone%40mailinator.com' \\\\
  -H 'X-RapidAPI-Key: YOUR_KEY' \\\\
  -H 'X-RapidAPI-Host: emailcheck.p.rapidapi.com'</code></pre>
    <p style="color:var(--text-dim);margin:0 0 14px">Or run it in the browser without a key: <a href="/demo.html">the live demo</a> does exactly that call.</p>

    <p style="color:var(--muted);font-size:.85rem;margin:26px 0 0">Free to use with attribution. If the list helped, link this page rather than the raw file, so people see the update date.</p>
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
(PUB / "disposable-domains.html").write_text(html, encoding="utf-8")
print("wrote disposable-domains.html")
