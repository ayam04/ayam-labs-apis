## What this does

Point it at a URL and get the on-page signals that decide whether the page ranks, scored 0-100 with a list of what is wrong.

The audit covers title and meta description length, heading structure, canonical, robots directives, Open Graph and Twitter cards, image alt coverage, internal and external link counts, structured data presence, page weight, response time, redirect chain and HTTPS. Each finding carries a severity and a concrete fix.

## Endpoints

- **GET /v1/audit** - full audit for one URL, weighted score and findings
- **GET /v1/meta** - head tags only, the fast path
- **GET /v1/links** - internal and external link inventory
- **GET /v1/keywords** - term frequency and TF-IDF for a page or raw text
- **GET /v1/readability** - Flesch, Flesch-Kincaid, Gunning fog
- **GET /v1/robots** - robots.txt fetch and parse
- **GET /v1/sitemap** - sitemap index or urlset, parsed and counted
- **POST /v1/text** - readability plus keywords on text you already have

## What to expect

Pages are fetched with a real browser-grade user agent and parsed server-side, so client-rendered text still counts. Results are cached per URL for 10 minutes.

## Limits, stated plainly

This checks on-page signals only. It does not measure backlinks, domain authority or rankings, and it does not read Search Console data. If a site blocks bots, the audit reports the block instead of inventing a score.
