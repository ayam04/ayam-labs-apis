# Bulk demo - 2026-11-22 (round 14)

Page: https://labs.ayamk.in/demo-bulk.html

## Why

The pricing research (round 5) concluded that a single verification at $0.05 is ten times the
market, while a bulk call of 100 addresses is ten times cheaper. That is the most useful thing
the product can say about itself, and until now a visitor had no way to check it.

## What it does

Paste up to 20 addresses, one per line, and the page POSTs them to /api/demo/emailcheck-bulk on
the site Worker, which forwards to the real /v1/bulk endpoint with the proxy secret. The response
renders as summary counts, a per-address table (verdict, score, flags, reason) and a cost line
computed from the actual number of addresses.

## Verified end to end

```
summary: 8 TOTAL 4 DELIVERABLE 3 RISKY 1 UNDELIVERABLE 3 DISPOSABLE 3 ROLE ACCOUNTS
rows: 8
  ayam.khan@gmail.com    deliverable 88  freeProvider, hasMx, hasARecord
  info@stripe.com        deliverable 75  roleAccount, hasMx, hasARecord
  someone@mailinator.com risky       25  disposable, hasMx, hasARecord
cost: 8 addresses in one call - $0.006250 per address on the pay-as-you-go rate - 54ms of server work
empty input: 400 {"error":"Paste at least one email, one per line"}
```

The cost line is deliberately honest: with 8 addresses the per-address cost is above the market
rate, and the page says so. At the 100-address cap it reads $0.0005, which is the claim.

## Guard rails

- 20 addresses per demo call, 10 calls per visitor per day, counted in the edge cache.
- Input is split on whitespace, commas and semicolons, trimmed and filtered before the call.
- Empty input returns 400 with a readable message instead of an upstream error.

## Linked

EmailCheck product page ("Bulk demo"), the email demo strip, the email verification guide's
bulk-maths section, sitemap (30 URLs) and the RSS feed.