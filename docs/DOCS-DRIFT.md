# Docs drift check - 2026-11-23 (round 27)

Round 26 was spent fixing eight published claims that the page cap invalidated. This round makes
that class of mistake fail a check instead of waiting for me to notice.

## `scripts/check-docs.mjs`

Two layers:

**Live comparison** (needs `SECRET_DOCPARSE`): reads `docparse /v1/formats` and compares every
`N pages per request/call/extraction` and `N MB` claim on the pages that describe DocParse
against the API's own limits. Any disagreement is printed as `DRIFT`.

**Stale-value scan** (offline, no credentials): flags values that were wrong once and must not
come back - `100 pages per request`, `$0.0005 per page`, `parity at $0.0005`, `10 ms CPU budget`,
`/v1/extract`. Sentences that explicitly retract a value ("used to claim", "corrected",
"previously") are excluded, so a page can quote its own old mistake honestly.

## Two false positives it produced, and the fixes

1. **5 MB** on the reference page was flagged against an 8 MB document cap. The API's HTML cap is
   5,000,000 bytes; the page said 5 MB. Both are honest descriptions of the same number, so the
   check now accepts decimal and binary interpretations.
2. **`$0.0005 per page`** on the pricing page was flagged even though the sentence is the
   correction: "This paragraph used to claim $0.0005 per page." The scan now drops sentences
   containing a retraction before matching.

## A Node bug worth recording

`process.exit(0)` while undici fetch handles are closing trips `Assertion failed:
!(handle->flags & UV_HANDLE_CLOSING)` on Node 24 / Windows, which turns a clean run into a
non-zero exit. Setting `process.exitCode` instead lets the event loop drain. Worth knowing
because the symptom looks like a failing check rather than a runtime bug.

## Wired into CI

```yaml
- run: pnpm -r test
# catches published numbers that no longer match the API (offline mode in CI)
- run: node scripts/check-docs.mjs .
```

Offline mode skips the numeric comparison (no secret, no network needed) and still runs the
stale-value scan, so the pipeline catches regressions on every push.

## Verified

```
offline mode: docs drift check: clean   exit 0
live mode:    docs drift check: clean   exit 0
```