# Traffic and URL canonicalisation - 2026-11-22 (round 15)

## Real traffic, for the first time

Cloudflare zone analytics is readable with the wrangler OAuth token, so `scripts/traffic.mjs`
now prints a weekly report without the dashboard. Numbers for the last 7 days on ayamk.in:

```
ads.ayamk.in        241948    (another project of yours, not this portfolio)
dsh.ayamk.in         13448
ayamk.in              5264
labs.ayamk.in         2468    <- the marketing site
www.ayamk.in          2432
textmind.ayamk.in     1130
emailcheck.ayamk.in    910
piishield.ayamk.in     903
docparse.ayamk.in      832
seo-audit.ayamk.in     592
```

Plus roughly 120 requests each to `phpmyadmin.`, `mysql.`, `jenkins.`, `sso.`, `portal.`, `db.`,
`uploads.` and similar names: bot scans probing for admin panels through the wildcard.

## What the site traffic actually is

Top paths on labs.ayamk.in: `/` 132, favicon 55, styles.css 51, app.js 39, /compare-pricing 32,
/guides 27, /demo 24, /emailcheck 23, /blog-five-apis 23.

Honest reading: a large share of that is my own testing this session (smoke tests, Playwright
runs of five demo pages, link crawls). There is no evidence of meaningful organic traffic yet.

## The 504s were mine

24 requests returned 504 on `/` and the demo pages, from IN, US and CA. A burst test of 48
requests across four pages returned 48 x 200, so they were aborted client requests from my own
browser tests, not a site fault. Recorded rather than guessed.

## The real bug: every canonical URL was a redirect

The Workers assets layer canonicalises `.html` away, so every URL I had published returned 307:

```
307  /emailcheck.html  -> /emailcheck
307  /guides.html     -> /guides
307  /demo.html       -> /demo
```

Meanwhile the sitemap, every canonical tag, every internal link and everything submitted to
IndexNow used the `.html` form. That is a redirect chain on every indexed URL and a canonical
that disagrees with the served address.

Fixed by rewriting to the form the edge actually serves: 31 pages, the sitemap and the feed.

```
sitemap urls: 30 | direct 200: 30 | redirects: 0 | failures: 0
canonical on /emailcheck: https://labs.ayamk.in/emailcheck
canonical matches served url: true
```

Re-run `scripts/traffic.mjs 7` any time to see whether anything real is arriving.