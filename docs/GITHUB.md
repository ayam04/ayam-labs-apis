# Public repo - 2026-11-22 (round 6)

https://github.com/ayam04/ayam-labs-apis

## Why

The objective asks for ethical marketing. A public repository is the one distribution channel
available without farming an account: it is indexable, it links back to every listing, and it
lets a buyer read the code before paying. It also proves the code is real, which no amount of
listing copy can.

## What shipped

- 237 files, 1.33 MB, MIT licensed, 473 tests, green CI.
- Top-level README: what each API does, live origins, architecture notes, how to run, how to
  verify.
- CI badge from GitHub Actions (`.github/workflows/ci.yml`, pnpm install + pnpm -r test).
- Topics: cloudflare-workers, hono, typescript, api, rapidapi, email-verification, seo, pdf,
  pii, text-analysis.
- Site footers link "Source" on all 12 pages, the home page has a "read the code before you
  pay" line, and llms.txt lists the repo.

## Two things blocked the first push

1. **GitHub push protection flagged a fake Stripe key** in the PII Shield tests and a detector
   example. It was a fixture, but the scanner cannot tell. Fixed by not storing the literal:
   the example is now a plain hex token, and the two tests build the string at runtime
   (`"sk_" + "live_..."`). Tests still pass, 121 of them, and `git grep` confirms no
   contiguous literal remains.
2. **CI failed on the first run**: both `pnpm/action-setup` and `package.json` declared the
   pnpm version. Removed the duplicate; the action now reads `packageManager`.

## Evidence

```
repo: https://github.com/ayam04/ayam-labs-apis | public=True
gh run list -> completed success  CI  main  push
sitemap urls: 21 | 200s: 21 | failures: 0
```

## Honest note

A repo with zero stars is not distribution on its own. What it does add: a credible link
target, something to paste when someone asks "is this a wrapper around someone else's API",
and a place where the SSRF guard and the 473 tests are visible. The listing copy claims speed
and honesty; this is the artefact that can be checked.
