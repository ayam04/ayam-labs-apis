# PDF extraction and the Workers CPU budget - 2026-11-22 (round 20)

## What I was doing

Executing all 44 curl examples published on the site against the live APIs. Nineteen failed at
first; I fixed the generator (it never resolved `$ref`, never put query params in the URL, and
sent both `url` and `base64` into an endpoint that accepts exactly one). That took it to 2.

Those 2 were not documentation bugs:

```
POST /v1/pdf/text  503  <!DOCTYPE html> ... error code: 1102
644b-...           503  <!DOCTYPE html> ... error code: 1102
```

1102 is Cloudflare's *Worker exceeded CPU time limit*, and it is served as an HTML error page,
so a buyer sees a Cloudflare error rather than our JSON envelope.

## Measured boundary

| document | route | result |
| --- | --- | --- |
| orimi 1-page, ~20 KB | /v1/pdf/text | 200, 670 ms wall |
| orimi 1-page | /v1/pdf/info | 200, 1661 ms |
| arXiv 1810.04805, 16 pages | /v1/pdf/info | 200, 418 ms |
| arXiv 1810.04805, 16 pages | /v1/pdf/text | 503 x4 in a row, then 200 once (1030 ms) |
| arXiv 1706.03762, 15 pages | /v1/pdf/text and /info | 503 |
| HTML input | /v1/html/text | 200, 202 ms |
| GET /v1/formats, /health | - | 200, 187-570 ms |

Ranges do not save it: `pages=1`, `1-4`, `1-8` all returned 1102 on that file in the same window,
because pdf.js must parse the document structure before it can honour a page selection.

## Cause

`apps/docparse/src/lib/pdf.ts` uses pdf.js through unpdf. pdf.js is a full PDF engine: it
inflates content streams, parses font tables and maps glyphs. That is tens of milliseconds of CPU
on a dense LaTeX paper. The Workers **Free** plan allows **10 ms CPU per request**, so a real
document sits right on the cliff: simple files fit, dense ones do not, and the same file can
succeed or fail depending on what the isolate has already warmed.

## Why not just add a size guard

I considered refusing documents above a byte threshold with a clear 422. I did not ship it:

- the cheap signal (input size) does not track the real cost (font and content-stream work), so a
  threshold picked from two data points would reject documents that currently work;
- a 422 for a perfectly normal 900 KB PDF is a worse product than an occasional 503,
- and it would paper over a capacity decision that belongs to you.

## The actual fix

Move the five Workers to the **Paid** plan ($5/month for the account). That raises CPU from 10 ms
to 30 s per request, which is three orders of magnitude of headroom, and pdf.js stops being
marginal. Nothing in the code changes. I cannot make a billing change on your account.

Until then, the honest thing is to say so on the page a buyer reads first.

## Also true

- DOCX, HTML and the cheap PDF routes are unaffected; only heavy PDF text extraction on dense
  files is at risk.
- The site's demo shares the same worker, so it hits the same wall on big PDFs.
- 42 of 44 published examples now run green; the two remaining ones are real documents on a
  capacity limit, not wrong documentation.