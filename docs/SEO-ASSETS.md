# SEO assets - 2026-11-22 (round 13)

## Added this round

**FAQPage structured data on all five product pages, 20 questions total**, generated from the
visible details/summary blocks so the markup matches what a reader sees, which Google requires.

```
emailcheck  faq questions: 4 | first: Does it tell me if a specific inbox exists?
seo-audit   faq questions: 4 | first: Will it work on JavaScript-heavy sites?
docparse    faq questions: 4 | first: Can it read scanned PDFs?
ai-text     faq questions: 4 | first: Which endpoints cost nothing?
pii-shield  faq questions: 4 | first: Is this a substitute for a DLP product?
```

**RSS feed at /feed.xml**, 15 items (build log, 6 guides, 5 API references, dataset, pricing
comparison, latency page), valid XML, discovered from all 30 pages via a rel=alternate link,
referenced in robots.txt and llms.txt.

## Link integrity

A crawler walks all 29 sitemap pages, extracts every internal href, fetches it and confirms
both the page and any anchor exist.

```
unique internal links checked: 34
no broken internal links or anchors
```

That check exists because the nav was edited across 30 pages in earlier rounds and nothing had
verified the result.

## Still true

29 sitemap URLs, all 200. IndexNow re-submitted (200 OK).

## Blocked

Publishing to dev.to, Hashnode and Reddit still needs a session or an API key. Both publish
paths are written and verified to fail cleanly without credentials:

- scripts/publish_devto_api.py (needs DEVTO_API_KEY)
- scripts/publish_hashnode_api.py (needs HASHNODE_TOKEN + HASHNODE_PUBLICATION_ID)
- scripts/publish_devto.py (browser fallback, exits 2 with a clear message when logged out)