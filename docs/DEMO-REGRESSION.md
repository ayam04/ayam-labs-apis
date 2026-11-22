# Demo regression: docparse was broken - 2026-11-22 (round 19)

## What the sweep found

A scripted pass over all five demo pages (`scripts/test-all-demos.py`) reported the docparse demo
as `SKIP (selector #demo-input missing)`. Chasing it surfaced two real bugs.

### Bug 1: the error handler printed [object Object]

```js
if (!res.ok) { status.textContent = data.error || ('Request failed (' + res.status + ')'); return; }
```

Every API returns the envelope `{error:{code,message,hint}}`, so `data.error` is an object and
`textContent` stringified it. Any failure on that page showed `[object Object]` and hid the
reason. Fixed to read `error.message || error.code`.

### Bug 2: arXiv-style PDF URLs took the HTML route

The Worker chose the upstream path by extension:

```ts
const path = /\.pdf($|\?)/i.test(target) ? "/v1/pdf/text" : "/v1/html/text";
```

`https://arxiv.org/pdf/1810.04805` has no `.pdf` suffix, so it went to the HTML route and the API
correctly answered 422 UNSUPPORTED_MEDIA (`The URL returned application/pdf, not HTML`). The
example placeholder in the demo is exactly that URL, so the demo's own sample failed.

Fixed with a fallback rather than a wider regex: try HTML, and if the answer is 422 with
UNSUPPORTED_MEDIA, retry the same URL through `/v1/pdf/text`. That handles content negotiation
without guessing from strings.

## Verified after the fix

```
pdf url (no .pdf suffix): status: Extracted. | 10448 words, 64238 characters, 16 pages
html url:                 status: Extracted.
404 url:                  The target URL returned HTTP 404 (nothing to fetch at ...)
all five demos:           emailcheck OK, seo-audit OK, docparse OK, ai-text OK, pii-shield OK
                          failures: 0
```

## Also this round

`gh repo edit --homepage https://labs.ayamk.in` - the repository had no website link in its sidebar.

## Lesson

The demos were last tested page by page, by hand, in earlier rounds. A one-line selector mismatch
silently skipped this page for weeks, and the page itself was broken for any visitor who clicked
the prefilled example. The suite is now a single command and exits non-zero on any failure.