# Edge caching - 2026-11-22 (round 7)

## The claim that was not true

The SEO Audit guide and long description said "results are cached per URL for 10 minutes".
Only EmailCheck actually cached anything (DNS answers, in `apps/emailcheck/src/lib/dns.ts`).
SEO Audit re-fetched and re-parsed every request.

## What was built

`apps/seo-audit/src/index.ts` now has `cachedAudit()`:

- key: the normalised URL, namespaced under `https://audit-cache.internal/`
- storage: `caches.default`, the Workers edge cache, TTL 600 seconds
- stores the response JSON only, never a page body, which keeps the privacy line honest
- guarded with `if (!cache)` so vitest, where `caches` is absent, still runs the real path
- the response carries `x-cache: hit|miss`, so a caller can see which they got

## Measured

```
first : {"ms":745,"cache":"miss","score":37}
second: {"ms":205,"cache":"hit","score":37}
third : {"ms":205,"cache":"hit","score":37}
speedup: 3.6x
```

Same score, same payload, 3.6x faster on repeat, and the origin fetch and parse do not run
again. 115 tests still pass, typecheck clean.

## Also measured this round: marketplace discoverability

Searched the hub for "email verification" in the logged-in browser. The results page is
dominated by **Sponsored Results** (MyEmailVerifier, Verifalia, Clearout) followed by web
results. EmailCheck did not appear in the first screen of either. Conclusion: a new listing
with zero subscribers does not surface on marketplace search without ad spend or a track
record, so traffic has to come from outside the marketplace. That is why the site, the
guides, the demos and the repo exist.
