# Measured latency - 2026-11-22 (round 8)

Page: https://labs.ayamk.in/performance.html
Script: `.tmp/bench.mjs` (12 sequential calls per endpoint, 4 for the model and PDF rows,
Node fetch from one residential connection in Asia, full body read included).

| Endpoint | p50 | p95 | fastest |
| --- | --- | --- | --- |
| emailcheck /v1/verify | 172 ms | 554 ms | 147 ms |
| emailcheck /v1/bulk (10 addresses) | 163 ms | 185 ms | 156 ms |
| seo-audit /v1/audit, uncached | 595 ms | 1359 ms | 267 ms |
| seo-audit /v1/audit, cached | 211 ms | 227 ms | 199 ms |
| docparse /v1/html/text | 181 ms | 470 ms | 159 ms |
| docparse /v1/pdf/text, 16 pages | 596 ms | 668 ms | 433 ms |
| textmind /v1/sentiment | 152 ms | 409 ms | 142 ms |
| textmind /v1/summarize | 2405 ms | 2939 ms | 2095 ms |
| pii-shield /v1/redact | 174 ms | 486 ms | 164 ms |

## The useful separation

Responses carry `x-response-time-ms: 16` and
`Server-Timing: cfEdge;dur=7, cfOrigin;dur=0, cfWorker;dur=21`. So of a 172 ms round trip,
about 16 ms is the Worker. The remaining ~150 ms is the distance between the client and the
edge location. That number cannot be improved by changing server code, and quoting a bare
"under 100ms" invites a buyer to measure something they will never see.

## Claims corrected

| Old claim | Where | New text |
| --- | --- | --- |
| "under 100ms warm" | emailcheck product page | worker reports 16ms; client round trip 172ms p50 measured from India |
| "Warm responses land under 200ms" | emailcheck listing long description | same, with the measured figure |
| "answer in under 100ms" | ai-text listing long description | single-digit ms server side, 152ms p50 round trip; neural 1-3s, 2.4s measured |
| "under 100ms" table cell | ai-text guide | 152ms p50 client round trip |

## Notes

- p95 is 2-3x p50 on several rows because this is a handful of sequential calls from one
  machine, not a load test. That is stated on the page rather than hidden.
- The cached audit row is the first public evidence that the round-7 cache works for a
  caller: 595 ms uncached against 211 ms cached.
