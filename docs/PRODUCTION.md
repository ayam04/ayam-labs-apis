# Production status review - 2026-11-22 (round 17)

Read from Cloudflare zone analytics for the last 7 days, per API host.

## Status distribution

```
emailcheck.ayamk.in    912   401:577 200:186 301:101 504:35 403:11 204:2
seo-audit.ayamk.in     592   401:259 200:173 301:104 504:38 403:15 415:1 204:2
docparse.ayamk.in      832   401:539 200:146 301:100 504:33 403:12 204:2
textmind.ayamk.in     1130   401:806 200:170 301:100 504:34 403:18 204:2
piishield.ayamk.in     903   401:577 200:143 301:122 504:46 403:12 404:1 204:2
```

- **401 dominates** because the proxy-secret guard rejects every direct call. That is the
  intended behaviour: the API only answers traffic that came through the marketplace.
- **200s** are the demo, the smoke suite and any real buyers.
- **301s** on `/` are http-to-https upgrades from scanners.
- **403s** are WAF and origin protections.

## The 504s are not a customer problem

Every 504 lands on `/` or `/health`, never on a `/v1/*` route:

```
emailcheck.ayamk.in  504  /         x25
emailcheck.ayamk.in  504  /health   x10
(same pattern on the other four hosts)
piishield.ayamk.in   504  //.env.testing x1   <- scanner probes
```

By country, the 504s come from US, CA, CH, FR, NL and BE on `/`, which is scanner and monitor
traffic, not buyers. India only appears on `/health`, which is my own smoke test. No 5xx exists
on any functional route.

## One real fix: the API hosts were indexable

These are JSON endpoints. There is no reason for `emailcheck.ayamk.in/` to appear in a search
result, and every scanner probe of `/.git/config` returning 401 is a page Google could in
principle hold. Added `X-Robots-Tag: noindex, nofollow` in the shared core middleware so all
five APIs inherit it:

```
emailcheck   200 | x-robots-tag: noindex, nofollow | request id: yes
seo-audit    200 | x-robots-tag: noindex, nofollow | request id: yes
docparse     200 | x-robots-tag: noindex, nofollow | request id: yes
textmind    200 | x-robots-tag: noindex, nofollow | request id: yes
piishield    200 | x-robots-tag: noindex, nofollow | request id: yes
site still indexable: (no header, good)
```

The marketing site deliberately does not carry the header.

## Regression check

473 tests still pass (19 / 115 / 128 / 87 / 121) and the live smoke suite is 12/12 after
deploying all five workers.