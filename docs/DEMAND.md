# Demand and pricing research - 2026-11-22

Purpose: check whether the $0.05/call price is sane per niche, and where each product actually
sits against the market. Numbers below are from public pricing pages fetched today, with links.

## Anchors collected

### Email verification

| Source | Price | Per email |
| --- | --- | --- |
| [EmailListVerify](https://emaillistverify.com/pricing), credit packs, EUR, 2026-11-15 | €5 / 1,000 credits, falling to €2.16 / 1,000 at 25k | **€0.005 → €0.0022** |

Market shape: credit packs, one credit per address, expires never. Typical entry price is
around half a cent per address.

### Document text extraction

| Source | Price | Per page |
| --- | --- | --- |
| [PennyOCR](https://pennyocr.com/pdf-ocr-api/), 2026-08-30 | $0.75 / 1,000 pages | **$0.00075** |
| [AWS Textract](https://aws.amazon.com/textract/pricing/) as quoted by PennyOCR | $1.50 / 1,000 pages | **$0.0015** |
| [Sidian DataGuard](https://sidian.io/api-pricing) Growth plan | $799/mo for 20,000 pages, then $0.04/page | **$0.04** (OCR + PII) |

Two markets here: raw text extraction is a commodity at a tenth of a cent per page; document
AI with redaction and structure sells at 4 cents per page.

### PII redaction

No clean standalone commodity price; it is usually bundled into document AI ($0.04/page at
Sidian) or given away as a feature of a bigger platform.

## Where our $0.05/call lands

| API | Unit | Our cost per unit | Market anchor | Verdict |
| --- | --- | --- | --- | --- |
| EmailCheck, single | 1 address | $0.05 | $0.005 | **10x market.** Wrong fit for one-at-a-time |
| EmailCheck, bulk | 100 addresses | **$0.0005** per address | $0.005 | **10x cheaper than market.** Real advantage |
| DocParse, 100-page PDF | page | **$0.0005** per page | $0.00075 | at parity with the cheapest OCR |
| DocParse, 1-page file | page | $0.05 per page | $0.00075 | 66x market. Penalises small files |
| SEO Audit | 1 URL | $0.05 | none direct (credit tools charge more per crawl) | fine |
| TextMind | 1 call | $0.05 | LLM call ~$0.001-0.01 | fine for neural, expensive for the free-tier methods |
| PII Shield | 1 scan, up to 200k chars | $0.05 | bundled at $0.04/page | fine, and it is one call not per page |

## Conclusions

1. **EmailCheck must be sold through the bulk endpoint.** At $0.05 a single verification is
   ten times the market. At 100 per call it is a fifth of a cent per address, ten times
   cheaper than the credit-pack vendors. The product page, the guide and the demo should all
   lead with that arithmetic instead of hiding it.
2. **DocParse pricing is a shape problem, not a level problem.** Per call suits long documents
   and punishes short ones. Either state the per-page math honestly or price per page.
3. **The $0.05 flat rate is fine for SEO Audit, TextMind and PII Shield**, where one call maps
   to one meaningful unit of work and no direct commodity anchor exists.
4. **Nothing here justifies a free tier.** The market is credit-based and prepaid; a metered
   entry price with no minimum is already more generous than a pack you must buy up front.

## What changed as a result

- Added `/compare-pricing.html`: the arithmetic above, with sources and a date.
- EmailCheck page and guide now lead with the bulk economics.
- No price change made: the user set $0.05 explicitly. The recommendation is recorded, not
  applied unilaterally.
