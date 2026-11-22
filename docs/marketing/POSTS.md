# Publishing pack - prepared 2026-11-22 (Sunday)

Everything here is written and ready. It is unposted because dev.to, Hashnode and Reddit are
all logged out in the debug Chrome session (I caused that by restarting Chrome for control;
those sessions are cookies, and they did not survive).

## Before anything: check the live rules

Reddit rule pages now require a session (`old.reddit.com` included; `/about/rules` redirects
to `/mod/<sub>/rules/`). Third-party summaries as of today suggest:

| Sub | Summary (unverified) | Post type |
| --- | --- | --- |
| r/webdev | no karma/age minimum in written rules, but no excessive self-promo, commercial promotion removed, projects only on **Saturday**, must be technically discussable | technical build log, no pitch |
| r/SideProject | self-promo explicitly allowed with conditions, must show the actual product | show the product, short |
| r/indiehackers | case-by-case, one self-promo post with flair | build log + numbers |
| r/microsaas, r/SaaS, r/cloudflare | unknown, need reading | read first |

**These are third-party claims, not the rules.** Read the real pages before posting. Note today
is Sunday, so r/webdev's Saturday window is closed anyway.

## dev.to / Hashnode

Article: `.tmp/article-devto.md` (4,734 chars), title: `.tmp/article-title.txt`.

- Title: Five APIs on Cloudflare Workers, and the bugs that nearly shipped
- Tags (dev.to, max 4): cloudflare, api, typescript, webdev
- Hashnode tags: Cloudflare Workers, API, TypeScript, Web Development
- Both want the disclosure footer that is already the last line of the article.

## Reddit variants

### r/webdev (technical, no sales language, link last)

I spent the last stretch shipping five small APIs on Cloudflare Workers and the bugs were all
in the boring parts, not the parsing.

Three that cost me real time:

1. **The SSRF guard rejected every hostname.** The validator ran an IP range check on the
   hostname string. Hostnames are not IPs. Fixed by resolving over DNS-over-HTTPS first, then
   range checking the resolved addresses, and only range checking the literal when the input
   is actually an IP.

2. **The OpenAPI import failed with "Failed to parse JSON".** Not a schema problem. PowerShell's
   `Set-Content -Encoding UTF8` writes a BOM and the importer rejects it. Write the bytes with
   `UTF8Encoding(false)` instead.

3. **Every marketplace call returned 401.** The proxy secret had a trailing newline from a
   piped `secret put`. Trim both sides.

The one that still annoys me: the listings were private for days because the visibility toggle
renders as "Public" the moment you click it, and nothing is sent to the server until you press
a Save button at the bottom of the page. The UI agreed with me and it was wrong.

Writeup with the architecture and the measured numbers: https://labs.ayamk.in/blog-five-apis.html

Disclosure: these are my APIs, I sell them, and the post is a build log rather than a review.

### r/SideProject (product shown, short)

Shipped five small APIs instead of one big platform, all on Cloudflare Workers:

- email verification (syntax, MX, disposable list, role accounts, 0-100 score)
- on-page SEO audit, 14 weighted checks
- PDF/DOCX/HTML to clean text
- text analysis: sentiment, keywords, entities, plus neural summaries
- PII redaction before text reaches a log or a model

Each one is live with a no-key demo, so you can try before reading anything: https://labs.ayamk.in/demo.html

The part I would do differently: I published a pricing table that compares my per-unit cost to
public competitor prices, including the two rows where I am 10x and 66x more expensive than the
market. It is uncomfortable and it is the only reason anyone believes the rest.

Disclosure: I built these and I sell them.

### r/indiehackers (numbers, lesson)

Five APIs, 37 endpoints, 470 tests, zero customers so far. The useful lessons:

- **The pricing maths is the marketing.** I published a comparison against public competitor
  rates, including where I am 10x more expensive per unit. Naming your own worst row is the
  cheapest credibility you can buy.
- **Measure what the buyer measures.** The Worker does its work in ~16ms; a client round trip
  from India is 172ms. Publishing p50/p95 beat any adjective I could have written.
- **Test the docs like code.** A script now diffs every documented endpoint against the live
  OpenAPI document, because I had three wrong endpoint lists in live copy.
- **Distribution is the hard part, not the build.** Marketplace search is ad-dominated; a new
  listing does not surface. The site, the free dataset and the repo are the funnel instead.

https://labs.ayamk.in - demo, pricing comparison and measured latency are all linked from there.

Disclosure: my products, my numbers.

## Publish checklist

1. Log in to dev.to, Hashnode and Reddit in the debug Chrome window.
2. Read the live rules for each target sub, and note the day-of-week restriction before posting.
3. dev.to: `/new`, paste title and body, tags `cloudflare, api, typescript, webdev`, publish.
4. Hashnode: new draft, same content, tags, publish.
5. Reddit: only subs whose rules allow it, disclosure line intact, one link only.
6. After each: open the public URL logged out and confirm it renders, so the post is not a 404
   for strangers (the same mistake as the private listings).
