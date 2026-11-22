# Ayam Labs APIs

[![CI](https://github.com/ayam04/ayam-labs-apis/actions/workflows/ci.yml/badge.svg)](https://github.com/ayam04/ayam-labs-apis/actions/workflows/ci.yml)

Five production APIs on Cloudflare Workers, sold through the RapidAPI marketplace.
TypeScript, Hono and zod-openapi, one shared core package, 470 tests.

- Site: https://labs.ayamk.in
- Listings: https://rapidapi.com/ayamullahkhan04

| API | Origin | What it does |
| --- | --- | --- |
| EmailCheck | https://emailcheck.ayamk.in | syntax, MX/A/AAAA, disposable blocklist, role accounts, typo suggestions, 0-100 score |
| SEO Audit | https://seo-audit.ayamk.in | 14 weighted on-page checks, links, headings, structured data, sitemap and robots parsing |
| DocParse | https://docparse.ayamk.in | PDF text with per-page output, DOCX structure, HTML to text or markdown |
| TextMind | https://textmind.ayamk.in | sentiment, keywords, entities, language, readability plus summaries, rewrites, labels, translation |
| PII Shield | https://pii-shield.ayamk.in | 19 detectors, redact with mask/label/hash, profanity, spam, moderation |

Every API is live and open for a real request. `/health` and `/openapi.json` are public;
every `/v1` route requires the marketplace proxy secret.

## Layout

```
apps/         five workers, one directory each
packages/core shared app factory, error envelope, SSRF-safe fetch, auth guard
marketing/    the static site worker (labs.ayamk.in)
scripts/      smoke tests, listing doc builders, endpoint integrity check
docs/         launch notes, pricing research, accuracy log
```

## Design notes

- **One app factory.** `packages/core/src/app.ts` builds each worker: request id, timing
  headers, CORS, an error envelope (`{error:{code,message,hint},requestId}`), and an
  OpenAPI document emitted as 3.0.3 because the marketplace importer only accepts that.
- **Auth.** `packages/core/src/guard.ts` compares `x-rapidapi-proxy-secret` against the
  worker secret. RapidAPI appends that header at the edge, so a direct call without it gets
  401 and cannot burn a customer's quota.
- **SSRF.** Every URL input goes through `packages/core/src/lib/net.ts`: DNS-over-HTTPS
  resolution, private range checks on IP literals, redirect and size limits.
- **No database.** Nothing needs persistence, so there is no MongoDB, no KV, no D1. The
  demo rate limiter uses the edge cache and nothing else.

## Development

```bash
pnpm install
pnpm -r test                 # 470 tests
pnpm --filter emailcheck dev # wrangler dev
pnpm --filter emailcheck deploy
```

Secrets are set with `wrangler secret put RAPIDAPI_PROXY_SECRET`, never committed.

## Verification

Nothing below is a style check. Each one fails when a published claim stops being true.

```bash
node scripts/smoke.mjs                     # 14 live calls across all five APIs
node scripts/check-endpoints.mjs .         # every documented path exists in a live spec
node scripts/check-docs.mjs .              # published limits match the API; corrected values stay gone
node scripts/check-examples.mjs .          # all 44 curl samples on the site actually run
pwsh -File scripts/refresh-docs.ps1        # rebuild generated docs from live specs, then run all of the above
```

`check-examples.mjs` needs the proxy secrets in the environment (`SECRET_EMAILCHECK`,
`SECRET_SEO_AUDIT`, `SECRET_DOCPARSE`, `SECRET_AI_TEXT`, `SECRET_PII_SHIELD`); the other three run
without credentials (`check-docs` skips the numeric comparison and still runs the stale-value scan,
which is what CI uses).

The API reference pages under `marketing/site/public/reference-*.html` are generated from frozen
copies of each `/openapi.json` in `.tmp`. If a spec changes and the copy does not, the site keeps
publishing examples the API rejects. `refresh-docs.ps1` exists so that cycle cannot half-happen:
download specs, regenerate, deploy, then prove every example still runs.

## License

MIT, see LICENSE.