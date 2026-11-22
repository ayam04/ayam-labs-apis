# Accuracy pass - round 3

## What was wrong

The long descriptions and two guides listed endpoints that do not exist. Caught by
testing `POST /v1/mask` and getting a 404, then diffing every documented path against
the live OpenAPI documents.

| Claimed | Reality |
| --- | --- |
| PII Shield `/v1/mask`, `/v1/hash`, `/v1/validate`, `/v1/detectors` | those are **styles and types**, not routes. Real routes: scan, redact, profanity, spam, moderation, types |
| SEO Audit `/v1/headings`, `/v1/images`, `/v1/structured-data` | do not exist. Real routes: audit, meta, links, keywords, readability, robots, sitemap, POST /v1/text |
| SEO Audit `GET /v1/text` | it is POST |
| TextMind "extract JSON" | does not exist. Real extras: readability, translate, stopwords |

## What was fixed

- `marketing/site/public/guides-pii-redaction.html`: endpoint table replaced with the six
  real routes; added a "Redaction styles" section explaining that mask, label and hash are
  parameters on `/v1/redact`, not endpoints.
- `marketing/site/public/guides-seo-audit.html`: endpoint list replaced.
- `docs/listings/{seo-audit,pii-shield,ai-text}-long.md`: corrected, then re-pasted into
  the live listings.
- `docs/listings/*-docs.md`: regenerated from the live specs by
  `scripts/build-listing-docs-live.mjs` instead of stale local copies.
- Docs tabs on seo-audit, ai-text and pii-shield re-pasted with the corrected tables.

## Regression guard

`scripts/check-endpoints.mjs` fetches all five specs, collects the 33 real routes, then
scans every site page and every listing doc for `/v1/...` tokens and fails on anything
unknown. Current result: **all documented paths exist in a live spec**.

Run it after any copy change: `node scripts/check-endpoints.mjs <repo>`.

## Careless-paste incident

While re-pasting long descriptions with fixed screen coordinates, three listings shifted by
one field: the long description landed in Short Description and the website URL landed in
Long Description. Detected by reading the field values back, then repaired one listing at a
time using coordinates read from the accessibility tree plus Tab navigation between fields.
All five now verified field by field:

| API | short | long | website | terms | visibility |
| --- | --- | --- | --- | --- | --- |
| EmailCheck | ok | ok | ok | ok | Public |
| SEO Audit | ok | ok | ok | ok | Public |
| DocParse | ok | ok | ok | ok | Public |
| TextMind | ok | ok | ok | ok | Public |
| PII Shield | ok | ok | ok | ok | Public |

Lesson recorded: never paste into these forms by fixed coordinates. Read the box position
from the page every time, or move between fields with Tab from a known-good field.
