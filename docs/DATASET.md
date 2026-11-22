# Free dataset as link bait - 2026-11-22 (round 10)

Page: https://labs.ayamk.in/disposable-domains.html
Files: /disposable-domains.txt (10,400 lines, text/plain), /disposable-domains.json (count,
updated, source, domains)

## Why publish the data for free

The EmailCheck worker already ships a 10,400 domain blocklist compiled into it
(`apps/emailcheck/src/data/disposable.json`). Publishing it as a static file costs nothing to
serve and gives the site the one thing a new domain cannot buy: something worth linking to.

People search for "disposable email domain list", "throwaway email domains txt" and "temporary
email domains list" every day, and the results are mostly stale gists. A dated, sorted,
deduplicated file with an update date and a schema.org Dataset block is a legitimate answer to
that query, and it cross-sells the API on the same page.

## What is on the page

- Download buttons for .txt and .json, plus the update date and exact count.
- Provenance: sourced from the community disposable-email-domains blocklist, deduplicated,
  lowercased, sorted. The page tells readers to check the upstream license before
  redistributing rather than asserting one.
- An honest limits section: a static list knows nothing about whether a domain accepts mail
  today, whether it is catch-all, or whether it appeared last week. That is the argument for
  the API without pretending the free file is worse than it is.
- A curl example with the real marketplace host and a link to the live demo.

## Verified

```
dataset page: 200 | count shown: True
txt: 200 | lines: 10400 | text/plain
json: count=10400 | domains=10400 | first=0-mail.com
sitemap urls: 28 | 200s: 28 | failures: 0
indexnow: 200 OK
```

## Notes

- Schema.org Dataset with two DataDownload entries, so it is eligible for dataset search.
- Linked from the EmailCheck product page ("Free domain list"), from the email guide, and from
  llms.txt.
- A typo ("lowecased") was caught in the screenshot and fixed before the final submit.
