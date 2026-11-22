# Social cards - 2026-11-22 (round 16)

## Why

Every page was missing `og:image`. Any link shared to Twitter, LinkedIn, Discord, Slack or
WhatsApp rendered as a bare URL. That is a silent conversion loss on the one distribution
channel that does not need an account: someone else sharing the link.

## What shipped

Six 1200x630 cards in /og, generated with PIL in the site's own visual language (dark panel,
accent corner ticks, Sora/Segoe bold headline, mono subline):

| card | used by |
| --- | --- |
| emailcheck.png, seo-audit.png, docparse.png, ai-text.png, pii-shield.png | the matching product page |
| site.png | everything else: guides, references, demos, pricing, blog, dataset |

Added to all 31 pages: `og:image`, `og:image:width`, `og:image:height`, `og:image:alt`,
`twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.

## Verified

```
og image: 200 | image/png | 35352 bytes
og:image present: True
twitter card present: True
guide uses site card: True
```

## Note

The cards are static PNGs served from the assets binding, about 30KB each, so they cost nothing
at runtime and cache at the edge. Regenerating them is `python scripts/build_og.py`.