# Docs drifted from behaviour after the page cap - 2026-11-23 (round 26)

## The problem

Round 25 capped PDF extraction at 4 pages per call to stay inside the measured CPU budget. That
made a set of published claims false, and none of them were in code paths the tests cover:

| where | claim | reality after the cap |
| --- | --- | --- |
| compare-pricing | "a 100-page PDF is $0.0005 per page, parity with the cheapest OCR" | $1.25 per 100 pages, 17x the market |
| compare-pricing table | "DocParse, 100-page PDF: $0.05 per call, parity" | 25 calls |
| docparse FAQ | "8MB or 100 pages per request" | 4 pages |
| docparse page | "8MB input, 100 pages per request" | 4 pages |
| OpenAPI spec (`info.description`) | "100 pages per PDF request" | 4 pages |
| OpenAPI spec (`/v1/pdf/text`) | "Text extraction stops at 100 pages" | 4 pages |
| OpenAPI spec (`/v1/pdf/pages`) | "up to 100 pages" | 4 pages |
| docs/listings/docparse*.md | 100 pages in several places | 4 pages |

The spec matters most: it is what RapidAPI and the site's generated reference pages show, so the
same wrong number was on three surfaces.

## The fix

Descriptions in `src/config.ts`, `src/index.ts` and `src/schemas.ts` now interpolate
`LIMITS.maxPdfPages` / `LIMITS.maxSelectedPages` instead of hardcoding a number, so the next cap
change propagates by itself. `config.ts` needed an import added; typecheck caught that.

Pricing corrected to the arithmetic: $0.05 per call, 4 pages per call, so a 100-page document is
25 calls and $1.25, which is **$0.0125 per page** - about 17x PennyOCR and Textract, about 3x
cheaper than Sidian. The corrected paragraph says explicitly that it used to claim $0.0005.

## Verified

```
live spec: 'Text extraction stops at 4 pages per call'   (no '100 pages' anywhere in the spec)
live spec info: '4 pages per PDF request'
/v1/formats: maxPdfPages 4, maxSelectedPages 4
reference-docparse: says 4 pages, no 100-page text
docparse page: no '100 pages' text
grep marketing/site/public/*.html for '100 pages': no matches
```

## A checking mistake worth recording

Twice this round I concluded the deploy was stale because `Invoke-WebRequest` still showed the old
text. It was the HTTP cache, not the server: the local file and a cache-busted request were both
correct. The reference page had been right for a while. Verify with `?cb=<random>`, or trust the
file, before blaming a deploy.