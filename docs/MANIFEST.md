# Verification manifest - 2026-11-23 (round 29)

## Why

Every claim on the site so far was written by me and checked by me. A buyer has no reason to
believe "37 endpoints, 473 tests" beyond my word. The manifest turns that into something they can
fetch, diff and re-derive.

## `https://labs.ayamk.in/verification.json`

Generated, not authored. `scripts/build-manifest.mjs` reads, for each API:

- `/openapi.json` for the title, version and counted operations
- `/health` for live status
- `/v1/formats` for the advertised limits (where the API exposes them)

and writes:

```json
{ "generatedAt": "2026-11-22T18:55:40Z",
  "totals": { "apis": 5, "endpoints": 37 },
  "prices": { "payPerUseUsd": 0.05, "tiers": { "pro": 25, "ultra": 75, "mega": 150 }, "freeTier": false },
  "tests": { "count": 473, "runner": "vitest" },
  "apis": [ { "name": "EmailCheck", "host": "emailcheck.ayamk.in", "endpoints": 5, "health": "ok", ... } ] }
```

Linked from /performance and /pricing under "Verify this yourself", in the sitemap and in
llms.txt. The JSON is a static asset, so it costs nothing to serve and caches at the edge.

## Test counts were wrong in four places

Docparse grew from 128 to 131 tests this week. The blog post, the queued article and three docs
still said 470. Corrected to **473** everywhere, and the manifest now carries the number so there
is one place to update rather than six.

The drift checker warns when `verification.json` is more than 30 days old, which is the signal to
re-run the manifest rather than a reason to fail a build.

## The refresh cycle is now six steps

```
1/6 download live specs       5 files
2/6 regenerate references     37 endpoints documented
3/6 deploy the site
4/6 docs drift check          clean (manifest 0 days old, 37 endpoints)
5/6 execute published curls   total 44, failures 0
6/6 refresh the manifest      wrote verification.json: 5 APIs, 37 endpoints
```

Smoke suite 14/14 afterwards. `pwsh scripts/refresh-docs.ps1` is the one command that keeps
spec, site, drift check, examples and manifest in step.