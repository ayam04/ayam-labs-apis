# PDF CPU limit: confirmed and handled - 2026-11-22 (round 22)

## The evidence that settles it

`wrangler tail docparse --status error` while retrying the 775 KB, 16-page arXiv PDF:

```
wall 165ms  cpu 20ms  outcome exceededCpu
wall  42ms  cpu 10ms  outcome exceededCpu
wall  48ms  cpu 10ms  outcome exceededCpu
```

`outcome: exceededCpu` with `cpuTime` at 10-20 ms. The per-request CPU budget really is about
10 ms, which is the Workers Free allowance. Round 20 said that without evidence; round 21
retracted it as unproven. The tail output is the evidence both attempts lacked.

## The fix

`apps/docparse/src/lib/pdf.ts` now carries a guard on the full-document path:

```ts
export const AUTO_PDF_MAX_BYTES = 400 * 1024;
export function guardPdfCpuBudget(bytes: Uint8Array, pageSelection: string | null): void
```

`extractPdfText` refuses documents above 400 KB with a 413 PAYLOAD_TOO_LARGE and a hint that
names the CPU budget and the escape hatch. `/v1/pdf/pages` passes an explicit selection and skips
the guard; `/v1/pdf/info` is metadatum-only and stays available.

400 KB is calibrated from measurement, not vibes: a 20 KB one-page file parses in budget, a
775 KB dense 16-page file dies at 10 ms.

## Verified live

```
big   /v1/pdf/text       413  861ms  {error:{code:PAYLOAD_TOO_LARGE, message:'This document is too large...'}}
big   /v1/pdf/pages?1    200  651ms  page 1 text extracted
small /v1/pdf/text       200  593ms  full text
big   /v1/pdf/info       200  395ms  pageCount 16, metadata
```

The opaque Cloudflare HTML 503 is gone for the common case: a buyer now gets our JSON envelope,
a code, a reason and instructions.

## Tests

Three new unit tests pin the behaviour: large document refused on the full path, page selection
allowed whatever the size, small documents allowed. docparse is at **131 tests passing** (was 128).

## Still true

The real capacity fix is a paid Workers plan (30 s CPU instead of 10 ms), at which point
`AUTO_PDF_MAX_BYTES` can be raised or removed. That is a billing decision, not a code change.