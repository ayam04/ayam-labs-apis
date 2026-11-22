# PDF CPU budget: measured and bounded - 2026-11-22 (round 24)

Three rounds of guessing, one controlled experiment. This is the version that holds.

## The experiment

One document (775 KB, 16 pages, dense LaTeX), one transport (base64, so no network variance),
five page counts, three trials each, 18 seconds apart, with `wrangler tail` capturing `cpuTime`
per request via a unique `x-request-id`.

| pages | cpu (ms), three trials | result |
| --- | --- | --- |
| 1 | 77 / 163 / 224 | 3 OK |
| 2 | 81 / 94 / 169 | 3 OK |
| 4 | 188 / 203 / 223 | 3 OK |
| 8 | 285 / 296 / 316 | 3 OK |
| 16 | 421 / 485 / 513 | 2 OK, 1 `exceededCpu` |

## What that settles

- **CPU scales with page count**, roughly 30 ms per page on this document.
- **The ceiling is around 500 ms of CPU** on this deployment. The one failure died at 513 ms;
  successes sat at 421 and 485 ms. That is why it was intermittent: 16 pages sat on the cliff.
- It is **not** a 10 ms Free-plan budget (round 22's claim). A sibling worker was measured at
  158 ms CPU on a successful request, and these successes ran past 400 ms.
- It is **not** a transport problem and **not** a per-route problem.

An earlier measurement of `pages=1-16` failing at 3025 ms wall is consistent with this: the
failure happens after the CPU budget is spent, not at the start.

## The fix

`LIMITS.maxPdfPages` and `LIMITS.maxSelectedPages` are now **8**, chosen from the table: 8 pages
measured 285-316 ms, leaving ~40% headroom under the ceiling for denser documents.

- `/v1/pdf/text` returns the first 8 pages with `"truncated": true`. Callers fetch the rest with
  `/v1/pdf/pages?pages=9-16`.
- `/v1/pdf/pages` rejects ranges over 8 pages with a 400 that names the limit.
- The byte guard stays at 3 MB for pathological payloads only; the page cap does the real work.

## Verified live

```
full text attempt 1: 200  1129ms pages 16 truncated true
full text attempt 2: 200   797ms pages 16 truncated true
full text attempt 3: 200   445ms pages 16 truncated true
pages=1-16: 400 {error:{code:INVALID_INPUT, message:'Page range "1-16" covers more than 8 pages'}}
```

Three consecutive runs of the document that failed six times out of six yesterday, now answering
every time. Smoke suite 14/14, docparse 131 tests.

## Correction trail, for the record

Round 20 asserted a 10 ms budget with no evidence. Round 21 retracted it. Round 22 re-asserted it
from tail output that only showed *a* kill, not the ceiling. Round 23 found a 158 ms CPU success
that disproved it. Round 24 measured the curve and set the cap from it.