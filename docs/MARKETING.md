# Marketing state - 2026-11-22 (round 2)

## The one thing that converts: a live demo

`https://labs.ayamk.in/demo.html` - a visitor types an email, the page POSTs to
`/api/demo/verify` on the site Worker, which calls the production EmailCheck endpoint with
the proxy secret and returns the real payload. Score, deliverability, provider and flag
chips render from the live response, plus the raw JSON.

Verified end to end in a real browser: score 88, deliverable, Google Workspace / Gmail,
flags freeProvider + hasMx + hasARecord.

Guard rails:

- 10 calls per IP per UTC day, counted in the Worker's edge cache (`caches.default`),
  so no KV, no Durable Object, no database.
- Past the budget the endpoint returns 429 with a message pointing at the listing.
- Demo calls go straight to the Worker with the proxy secret, so they never touch the
  marketplace quota that a paying customer pays for.
- Input is length-checked before the upstream call; upstream errors are passed through
  with their real status.

TTL note: the counter key is per IP per day, cached for 24h, which is what makes it free.

## Pages live (16 URLs in sitemap)

| Page | Purpose |
| --- | --- |
| / | hub, live status of all five APIs |
| /demo.html | live EmailCheck demo, no key needed |
| /emailcheck.html ... /pii-shield.html | product pages |
| /guides.html + 5 guides | problem-first articles, real payloads |
| /blog-five-apis.html | build log |
| /pricing.html, /legal.html | plan ladder, terms |
| /llms.txt | machine-readable index for AI crawlers |

## Distribution

- IndexNow: 15 URLs pushed twice today (200 OK), key file verified byte-identical.
- sitemap.xml + robots.txt live, 16 sitemap URLs all returning 200.
- Structured data: Organization, SoftwareApplication per API, TechArticle per guide,
  WebApplication for the demo.
- Reddit: removed by automod twice, not retried.
- dev.to / Hashnode: needs an account session.

## Conversion notes

The demo is the only place a stranger can see the product work without a card. Everything
else is claims. Next step if traffic arrives: instrument the demo POST count per day to see
whether anyone reaches the 429.
