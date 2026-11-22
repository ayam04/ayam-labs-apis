# PDF extraction failure: correction - 2026-11-22 (round 21)

## I was wrong yesterday

Round 20 claimed: *"pdf.js needs tens of milliseconds of CPU and the Workers Free plan allows
10 ms per request, so dense PDFs cannot fit."* That was a diagnosis built on one document and one
bad measurement window, and it was published on /docparse and in the PDF guide.

The account's `usage_model` is **standard**, not bundled:

```
$ GET /accounts/<id>/workers/scripts/docparse/settings
usage_model: "standard"
```

So the 10 ms framing was wrong. The note is corrected on both pages: it now says what was
observed rather than what I assumed, and states that the cause is still under investigation.

## What the measurements actually show

Workers analytics, last 7 days, `docparse`:

```
success            803 requests   cpu p50 762us  p99 681915us  p999 1464099us
exceededResources   20 requests   cpu p50 10000us p99 553767us
```

For comparison, `emailcheck` over the same window: 896 requests, 0 errors, cpu p50 726us.

So: about 2.4% of docparse requests hit a resource limit, and normal requests are sub-millisecond
in CPU. That is not a product that cannot parse PDFs; it is a product with an intermittent
failure mode on a subset of documents.

## What is ruled out

| hypothesis | test | result |
| --- | --- | --- |
| transport (URL fetch) | same bytes sent as base64 | fails the same way |
| page count | `pages=1` | succeeded once at 1360 ms, then failed at 1372 ms minutes later |
| route-specific | `/v1/pdf/info`, `/v1/pdf/text`, `/v1/pdf/pages` | all three fail in the same waves |
| worker dead | `/health`, `/v1/formats`, `/v1/html/text` | all 200 throughout |

The failure arrives in ~200 ms once a window starts, which is too fast for a CPU limit to be
consumed naturally, and the same request succeeds after a pause. That pattern looks more like
isolate recycling or memory pressure than a hard CPU ceiling, but I have not proven it and I am
not going to publish another confident wrong answer.

## What changed in the product

Nothing in the worker. A speculative retry, page cap or size guard would have been a guess on top
of a misdiagnosis, and a cap would silently degrade output for files that currently work.

## What is on the site now

Both /docparse and the PDF guide carry the measured version: 20 of 823 requests over seven days,
HTML 503 (error 1102) instead of a JSON envelope, DOCX and HTML unaffected, retry or split with
/v1/pdf/pages, cause under investigation.

## Next step if it matters

Run `wrangler tail docparse --status error` while a failing document is retried to capture the real
exception, and watch `cpuTimeP999` against the account limits. Both need the failing document in
hand, which is worth doing before changing any code.