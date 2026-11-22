# Keyword work - 2026-11-22 (round 18)

Evidence: Google autocomplete (`suggestqueries.google.com/complete/search?client=firefox`), which
returns real query completions rather than a vendor's estimate. Fetched via PowerShell because
web_fetch returns processed text, not the raw JSON array.

## What people actually type

```
email verification api -> free | github | chrome | reddit | key
disposable email domains -> github | list | npm | js | database
pdf to text api -> free | open source | converter | ocr | best | extract text
redact pii -> meaning | from pdf | npm | data | core | python
seo audit api -> free | analysis | report | site audit
```

## Titles retuned to match

| page | before | after |
| --- | --- | --- |
| /emailcheck | EmailCheck API - Email verification | Email verification API - validate an address without sending mail |
| /docparse | DocParse API - Document extraction | PDF to text API - extract text from PDF, DOCX and HTML |
| /pii-shield | PII Shield API - Privacy and safety | PII redaction API - find and mask personal data in text |
| /seo-audit | SEO Audit API - On-page analysis | SEO audit API - on-page analysis in one request |

Descriptions rewritten to carry the same phrases, plus the honest limits: DocParse now says in
its own meta description that scanned pages are not OCR'd.

Note on "free": it is the most common completion for every commercial query. There is no free
tier by design (your call in round 6), so the pages compete on "try it with no key" instead of
claiming free. Bidding against "free" intent with a paid product wastes the visit.

## The gap the data exposed: "redact pii from pdf"

PII Shield redacts text. DocParse turns PDFs into text. Neither page addressed the combined
query, which is a real completion and a common compliance job.

New guide: https://labs.ayamk.in/guides-redact-pdf

- the two-step flow with working code (extract, then scan or redact)
- which redaction style to pick and why
- where it stops: scanned PDFs are not OCR'd, the output is text with placeholders rather than
  a pixel-level redaction burned into the file, and table layout is lost
- the cost of the pair at $0.05 a call

Linked from the PII Shield and DocParse product pages, the guides index, the sitemap and the feed.

## Verified

```
sitemap urls: 31 | direct 200: 31 | redirects: 0 | failures: 0
unique internal links checked: 36
no broken internal links or anchors
indexnow: 200 OK
```