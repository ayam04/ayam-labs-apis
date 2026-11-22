# Publishing checklist

## The blocker: every listing is Private

Confirmed on 2026-11-21 by scrolling each listing's General tab: all five read
**"API Project is Private - It's not visible on the Hub and new users can't access it"**.

The toggle renders as Public when clicked, but the change is never sent to the server,
so a reload shows Private again. Nothing is purchasable until this is fixed, which
also means the marketplace links cannot convert.

### Manual fix (about 40 seconds per API)

1. Open the Studio -> Hub Listing -> General for the API.
2. Scroll to **Visibility**.
3. Tick *"I confirm that I own or have rights to publish this API"*.
4. Flip the toggle to on. The card should read *"API Project is Public"*.
5. Click **Save** at the bottom of the page (a Save / Discard bar appears once the form is dirty).
6. Reload and confirm the card still reads Public.

### Automated fix (needs Chrome closed for ~10 seconds)

Chrome locks its cookie database, so the session cannot be read while it runs.
Close Chrome once and the same session can be driven over the DevTools protocol,
which sends trusted events that the page actually saves. That also unlocks the
long descriptions and the Docs tab, which have the same problem.

## What to paste where

| Field | Source | Value |
| --- | --- | --- |
| Short Description | in place | do not change, it reads well |
| Long Description | `docs/listings/<slug>-long.md` | markdown, 1 paragraph + sections |
| Website | static | `https://labs.ayamk.in/<slug>.html` |
| Terms of Use | static | `https://labs.ayamk.in/legal.html` |
| Docs tab | `docs/listings/<slug>-docs.md` | markdown, endpoints + auth + errors |
| Logo | uploaded | done, do not touch |

Page slugs: emailcheck, seo-audit, docparse, ai-text, pii-shield.
(TextMind's site page is /ai-text.html, PII Shield's is /pii-shield.html.)

## Already done

- logos on all five
- plans: pay as you go $0.05/call, then $25 / $75 / $150 monthly tiers
- no free tier anywhere
- custom domains on ayamk.in, TLS issued
- marketplace proxy secret wired, direct calls rejected with 401
