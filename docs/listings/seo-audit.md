# SEO Audit API

## Short description (max 120 chars)

audit any public page in one call: metadata, headings, links, keywords, readability and a transparent 0-100 score.

## Long description (markdown)

### What it does

point it at one public URL and get the on-page review an SEO would do first, without a headless browser and without a six figure tool contract.

one GET /v1/audit call returns:

- fetch result: status code, timing, https, content type, compression, body size, the final url after redirects and how many redirects were followed
- title and meta description with their character lengths and truncation flags (60 and 160)
- canonical url and the robots meta directives (index / noindex, follow / nofollow)
- html lang, charset, viewport and theme-color
- h1 to h6 counts, plus the first three heading texts of every level
- image count with missing-alt and empty-alt counts
- internal vs external link counts, nofollow / sponsored / ugc counts and empty anchor text
- word count, sentence and paragraph counts, and the text-to-html ratio
- flesch reading ease and flesch-kincaid grade
- open graph and twitter card completeness with the exact missing fields
- json-ld types found and the number of valid blocks
- hreflang entries
- a 0-100 score built from 14 weighted checks whose weights always sum to 100, each with an id, status, weight, earned points and a one line message

every number comes from parsing the html you already serve. no third party seo data, no lighthouse, no browser.

### Endpoints at a glance

| method | path | what you get |
|---|---|---|
| GET | /v1/audit | full weighted audit of one page: score 0-100 plus every check and every extracted field |
| GET | /v1/meta | head only: title, description, canonical, robots, og:*, twitter:*, json-ld summaries, favicons, hreflang, theme-color |
| GET | /v1/links | every anchor: internal vs external, rel attributes, anchor text, up to 500 links with a truncated flag |
| GET | /v1/keywords | one and two word terms with counts, density percentages, and an idf-style importance score (1-100 terms) |
| GET | /v1/readability | flesch reading ease, flesch-kincaid grade, gunning fog, word/sentence/paragraph/syllable counts, longest sentence, passive voice hints |
| GET | /v1/robots | robots.txt user-agent groups, allow/disallow rules with line numbers, crawl-delay, sitemap urls |
| GET | /v1/sitemap | sitemap urlset or sitemap index: up to 500 urls or 200 child sitemaps, with lastmod, changefreq and priority |
| POST | /v1/text | readability and keyword analysis on text you send, no network call |

### Why use this instead of building it

- **it is one request, not a pipeline.** extracting metadata, resolving anchors, stripping html for real word counts, counting syllables and scoring a page are five different jobs. this is one call that returns all of them in the same shape every time.
- **the score is inspectable.** most "seo score" endpoints hand you a number. this one returns the 14 checks behind it, with their weights, so you can show your own users exactly why a page scored 78 instead of 90, or roll your own score from the parts.
- **cheap and fast by construction.** html parsing only, no third parties, no browser. typical audit of a 250 kb page lands around 300-900 ms including the fetch.
- **safe by default.** every outbound request goes through an ssrf guarded fetcher, redirects are followed only to public addresses, bodies are capped at 2 mb and the request times out in 10 s.
- **it tells you what it cannot do** (see the honest limits below) instead of inventing a metric.

### Code examples

all examples run against the deployed worker at `https://seo-audit.ayamullahkhan04.workers.dev`. through the marketplace use `https://seo-audit.p.rapidapi.com` with your `X-RapidAPI-Key` and `X-RapidAPI-Host: seo-audit.p.rapidapi.com`.

#### curl: full audit

```bash
curl -s "https://seo-audit.p.rapidapi.com/v1/audit?url=https://www.python.org" \
  -H "X-RapidAPI-Key: YOUR_KEY" \
  -H "X-RapidAPI-Host: seo-audit.p.rapidapi.com"
```

direct origin, no marketplace in front:

```bash
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/audit?url=https://www.python.org"
```

abbreviated response:

```json
{
  "requestedUrl": "https://www.python.org/",
  "finalUrl": "https://www.python.org/",
  "redirected": false,
  "redirectChainLength": 0,
  "statusCode": 200,
  "https": true,
  "timings": { "fetchMs": 280, "parseMs": 96, "totalMs": 384 },
  "page": { "title": "Welcome to Python.org", "titleLength": 21, "titleTooLong": false },
  "headings": { "counts": { "h1": 5, "h2": 9, "h3": 0, "h4": 0, "h5": 0, "h6": 0 }, "total": 14 },
  "images": { "total": 1, "missingAlt": 0, "emptyAlt": 0, "missingAltPercent": 0 },
  "links": { "total": 215, "internal": 167, "external": 45, "other": 3 },
  "content": { "wordCount": 1011, "textToHtmlRatioPercent": 13.8 },
  "readability": { "fleschReadingEase": 56.2, "fleschKincaidGrade": 6.2, "readingLevel": "fairly difficult" },
  "score": {
    "value": 78,
    "grade": "C",
    "passed": 10,
    "warned": 2,
    "failed": 2,
    "checks": [
      { "id": "title", "label": "Title tag", "status": "pass", "weight": 15, "points": 15, "message": "Title is 21 characters, inside the 15-60 range." },
      { "id": "canonical", "label": "Canonical URL", "status": "fail", "weight": 8, "points": 0, "message": "No canonical link element was found." }
    ]
  }
}
```

#### curl: one example per endpoint

```bash
# heads only
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/meta?url=https://www.python.org"

# anchors, internal vs external
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/links?url=https://news.ycombinator.com"

# keywords from a live page, top 10 terms
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/keywords?url=https://en.wikipedia.org/wiki/Web_scraping&limit=10"

# keywords from text you already have (no network)
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/keywords?text=keyword+research+starts+with+intent"

# readability of a live page
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/readability?url=https://www.python.org"

# readability of a string
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/readability?text=The+cat+sat+on+the+mat.+The+dog+ran+in+the+park."

# robots.txt
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/robots?domain=github.com"

# sitemap or sitemap index
curl -s "https://seo-audit.ayamullahkhan04.workers.dev/v1/sitemap?url=https://www.smashingmagazine.com/sitemap.xml"

# raw text, readability and keywords together
curl -s -X POST "https://seo-audit.ayamullahkhan04.workers.dev/v1/text" \
  -H "Content-Type: application/json" \
  -d '{"text":"Keyword research is the practice of finding the terms people type into search engines. Good research starts with intent.","limit":10}'
```

#### JavaScript (fetch)

```javascript
const res = await fetch(
  "https://seo-audit.p.rapidapi.com/v1/audit?url=" + encodeURIComponent("https://www.python.org"),
  {
    headers: {
      "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
      "X-RapidAPI-Host": "seo-audit.p.rapidapi.com",
    },
  },
);
if (!res.ok) {
  const { error } = await res.json(); // { code, message, hint }
  throw new Error(error.code + ": " + error.message);
}
const audit = await res.json();
console.log(audit.score.value, audit.score.grade);
for (const check of audit.score.checks.filter((c) => c.status !== "pass")) {
  console.log(check.id, check.weight, check.message);
}
```

calling the deployed worker directly from a browser is fine too, cors is open:

```javascript
const report = await (
  await fetch("https://seo-audit.ayamullahkhan04.workers.dev/v1/meta?url=https://stripe.com")
).json();
console.log(report.title, report.openGraph.missing);
```

#### Python (requests)

```python
import os
import requests

BASE = "https://seo-audit.p.rapidapi.com"
HEADERS = {
    "X-RapidAPI-Key": os.environ["RAPIDAPI_KEY"],
    "X-RapidAPI-Host": "seo-audit.p.rapidapi.com",
}

audit = requests.get(f"{BASE}/v1/audit", params={"url": "https://www.python.org"}, headers=HEADERS, timeout=20)
audit.raise_for_status()
report = audit.json()
print(report["score"]["value"], report["score"]["grade"])
for check in report["score"]["checks"]:
    if check["status"] != "pass":
        print(check["status"], check["id"], check["message"])

# readability and keywords on your own draft, no network
draft = "The quick brown fox jumps over the lazy dog. " * 40
analysis = requests.post(
    f"{BASE}/v1/text",
    json={"text": draft, "limit": 15},
    headers=HEADERS,
    timeout=20,
)
analysis.raise_for_status()
print(analysis.json()["readability"]["fleschReadingEase"])
print([term["term"] for term in analysis.json()["keywords"]["terms"][:5]])
```

### Pricing

| plan | price | requests / month | overage |
|---|---|---|---|
| BASIC | free | 500 | not available |
| PRO | $25 | 10,000 | $0.0040 per request |
| ULTRA | $75 | 40,000 | $0.0025 per request |
| MEGA | $150 | 120,000 | $0.0015 per request |

every plan returns the full response. no field is held back behind a higher tier.

### Use cases

- **seo agencies**: first pass triage across a client's key pages. pull the checks that failed and hand the client a list of fixes, not a vague score.
- **saas products with a "site audit" feature**: embed the score and the check breakdown instead of building a parser, a scorer and a readability library. the response already carries the per check weights, so you can re-weight them for your own audience.
- **ci checks before launch**: fail a deploy when the title is missing, the canonical points off site, or og:image is absent. one curl in a github action.
- **content teams**: POST /v1/text scores a draft for flesch and keyword density before it is published, with no page to deploy first.
- **growth marketers**: compare your page against a competitor's on the same 14 checks and see exactly which ones they win.

### Honest limits

- it audits **a single public page's HTML**. it does not crawl a whole site, so pass it a url per page (or read /v1/sitemap first and loop).
- it **does not execute JavaScript**. tags injected by a client side framework after load are invisible to it. if your title only exists after hydration, the audit will not see it.
- it **does not measure Core Web Vitals**, lighthouse scores, real user metrics or server response time beyond the time to receive headers.
- word, syllable and readability statistics target Latin script languages. CJK segmentation is not implemented, so word counts for Chinese, Japanese and Korean pages will be understated.
- hard caps: 2 mb HTML per audit, 5 mb per sitemap, 512 kb robots.txt, 10 s fetch timeout, 500 links, 500 sitemap urls, 200 child sitemaps, 100,000 characters per text analysis. non HTML targets return 415, oversized bodies return 413, slow targets return 504.
- keyword importance uses a bundled english frequency prior, not a live search corpus. it ranks terms inside one document, it does not give you search volume.

### FAQ

**does one call crawl my whole site?**
no. one url per call. use /v1/sitemap to list your pages, then call /v1/audit per page. 500 pages is 500 calls and that is the honest shape of this api.

**why does /v1/meta say the description is missing when i can see it in the browser?**
usually the tag is injected by JavaScript after load, which this api does not execute, or the page sets it through a framework that renders client side. check the raw html your server returns.

**how is the score calculated?**
14 checks with fixed weights that sum to 100: https 10, title 15, meta description 12, canonical 8, lang 5, single h1 8, heading structure 6, image alt 8, internal links 6, structured data 6, open graph 6, twitter card 4, viewport 3, charset 3. pass earns the full weight, warn earns half rounded up, fail earns nothing. the response lists every check, so the number is never a black box.

**can i call it from the browser?**
yes, cors is open for all origins and the response headers expose the request id and timing headers.

**what happens when the target is slow, huge or offline?**
10 s fetch timeout returns 504 UPSTREAM_TIMEOUT, a body over 2 mb returns 413 PAYLOAD_TOO_LARGE, a non HTML content type returns 415 UNSUPPORTED_MEDIA, and a private or reserved address returns 400 BLOCKED_TARGET. errors always use one envelope: `{ error: { code, message, hint }, requestId, timestamp }`.

**does it need an api key of its own?**
no. subscribe on rapidapi and send the marketplace headers, or call the deployed worker directly. there are no upstream keys, no per request billing from a third party, and no login gated data is touched.
