# API reference pages - 2026-11-22 (round 9)

Five pages, generated from the live OpenAPI documents, one per API:

| Page | Routes |
| --- | --- |
| /reference-emailcheck.html | 5 |
| /reference-seo-audit.html | 8 |
| /reference-docparse.html | 7 |
| /reference-ai-text.html | 11 |
| /reference-pii-shield.html | 6 |

37 operations in total, each with: method and path, summary, description, a parameter table
(name, in, type, required, description), a request body example built from the schema's own
example values, and a collapsible curl snippet with the real marketplace host.

## Why this exists

Marketplace search is ad-dominated (round 7 finding), so buyers arrive from search engines and
from the repo. Developer docs are the most linkable, indexable asset a technical product can
publish, and a page per API is the honest version of "SEO content": it is generated from the
same document the API serves, so it cannot drift.

The footer of every page says: if the page and the spec ever disagree, the spec is right.

## Build

`scripts/build_reference.py` downloads each spec (PowerShell does the fetch because urllib
fails on this host's certificate chain), then renders the HTML. Inline markdown from the spec
descriptions is rendered, not escaped: the first pass printed literal `**Honest scope:**` and
was fixed by adding a small md() helper.

## Generated content that stayed accurate

The generator prints the operation count per API and the total: 37. That matches the 33 unique
routes across the five specs, with four routes that answer both GET and POST. Verified live:

```
200 reference-emailcheck | curl examples: 5
200 reference-seo-audit  | curl examples: 8
200 reference-docparse   | curl examples: 7
200 reference-ai-text    | curl examples: 11
200 reference-pii-shield | curl examples: 6
```

## Also this round

The build log now carries an explicit disclosure: "I built these APIs and I sell them...
the pricing comparison page names where a competitor is cheaper. Treat the post as a build log,
not an independent review." The objective asked for marketing with disclosure; that line makes
it unambiguous.

## Numbers

27 sitemap URLs, all 200. IndexNow 200 OK. Endpoint integrity check passes: 33 routes, nothing
documented that does not exist.
