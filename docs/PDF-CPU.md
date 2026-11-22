# CPU budget across all five workers - 2026-11-22 (round 25)

Same method as the docparse bisect, applied portfolio-wide: read `cpuTime` percentiles from
Cloudflare analytics (microseconds in the API) instead of guessing from wall time.

## Where each worker sits, last 7 days

| script | requests | errors | p50 | p99 | p999 |
| --- | --- | --- | --- | --- | --- |
| ai-text | 1159 | 0 | 0.7 ms | 20.2 ms | 43.4 ms |
| pii-shield | 993 | 0 | 0.6 ms | 18.4 ms | 29.9 ms |
| emailcheck | 923 | 0 | 0.8 ms | 18.2 ms | 64.0 ms |
| docparse | 879 | **34** | 0.8 ms | **681.9 ms** | **1464.1 ms** |
| seo-audit | 585 | 0 | 1.6 ms | 52.2 ms | 594.3 ms |

Four of five workers live under 25 ms at p99 with zero errors. docparse was the only one on the
cliff, which matches the failure reports.

## The cap, and why it is four and not eight

Round 24 set the cap at 8 pages from a measured 285-316 ms. Under repetition, 8 still failed:

```
full 1: 200 truncated ok      full 5: 503 206ms  <- failed
pages 1-8: 503 203ms          pages 9-16: 200
```

So the cap is **4 pages** (measured 188-223 ms), which held for five consecutive runs:

```
full 1: 200 886ms  full 2: 200 334ms  full 3: 200 285ms  full 4: 200 301ms  full 5: 200 325ms
pages 1-4: 200 pages returned 4
pages 5-8: 200 pages returned 4
pages 9-16: 400 covers more than 4 pages
formats: maxPdfPages 4, maxSelectedPages 4
```

Zero failures on the path that produced six failures out of six two rounds ago.

## The trade-off, stated plainly

A 16-page document now takes four calls instead of one. That is worse ergonomics and better
than a 503. `/v1/pdf/info` still answers in one call for the whole file, and DOCX and HTML routes
are untouched.

## What carries the limit to callers

`GET /v1/formats` advertises `maxPdfPages` and `maxSelectedPages`, both now 4, so a client can read
the budget instead of discovering it through a failure. The product page and the PDF guide state
the measured numbers and the slicing pattern.