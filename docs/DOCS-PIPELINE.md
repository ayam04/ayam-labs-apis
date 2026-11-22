# The generated-docs cycle - 2026-11-23 (round 28)

## What broke, again

Round 27 corrected the `pages` example in the spec from `1,3,5-7` (5 pages) to `1,3,5` (3 pages).
Round 28 started by running every published example:

```
BAD 400 POST /v1/pdf/pages?pages=1%2C3%2C5-7  Too many pages requested (5)
total: 44 | failures: 1
```

The spec was right and the *deployed page* was wrong, because `build_reference.py` renders from
spec snapshots in `.tmp`, and the snapshot predated the fix. The generator had no idea the
published example was now rejected by its own API.

## Two permanent tools instead of two temporary ones

`scripts/check-examples.mjs` started as a throwaway in `.tmp`. It now lives in the repo: it
extracts every `curl` block from the published pages, rewrites the marketplace host to the origin
host, swaps the API key header for the proxy secret, executes it, and fails on anything that is
not 2xx. 44 examples, currently 0 failures.

`scripts/refresh-docs.ps1` does the whole cycle in one command:

1. download the five live `/openapi.json` files
2. regenerate the reference pages
3. deploy the site
4. run `check-docs.mjs` (limits and stale values)
5. run `check-examples.mjs` (every published curl)

Because the snapshot refresh is step 1 of the same command that rebuilds the pages, the two can
no longer diverge without the run failing at step 5.

## Verified

```
1/5 downloading live specs        5 files, 16-54 KB each
2/5 regenerating reference pages  total endpoints documented: 37
3/5 deploying the site            current version id returned
4/5 docs drift check              docs drift check: clean
5/5 executing examples            total: 44 | failures: 0
```

## README

The Verification section now says what it is for: "Nothing below is a style check. Each one fails
when a published claim stops being true." Five commands, three of which run without credentials
(which is what CI uses).

## Note on running it

`pwsh -File scripts/refresh-docs.ps1` from a nested shell produced no output on this host;
invoking it as `& ./scripts/refresh-docs.ps1` from an interactive session works and prints the
five steps. Not a script bug I could reproduce outside nested invocation, so it is recorded rather
than "fixed".