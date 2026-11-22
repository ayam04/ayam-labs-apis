# Live demos - 2026-11-22 (round 4)

Every product now has a working demo on the site. No signup, no key, no card.

| Page | Input | Runs |
| --- | --- | --- |
| /demo.html | email address | /v1/verify |
| /demo-seo-audit.html | URL | /v1/audit |
| /demo-docparse.html | URL (PDF or HTML) | /v1/pdf/text or /v1/html/text |
| /demo-textmind.html | text | /v1/sentiment plus /v1/keywords |
| /demo-pii-shield.html | text | /v1/redact |

## How it works

The site Worker (marketing/site/src/index.ts) exposes POST /api/demo/<app>. It validates
the input, checks a per-IP-per-app-per-day budget in `caches.default` (10 calls), then calls
the real API on its custom domain with the marketplace proxy secret. Demo traffic never
touches a marketplace plan, so a demo call costs no quota.

Secrets on the ayam-labs-site Worker: EMAILCHECK_SECRET, SEO_SECRET, DOCPARSE_SECRET,
AITEXT_SECRET, PII_SECRET. All five set with `wrangler secret put`.

## Verified end to end in a real browser

| Page | Rendered result |
| --- | --- |
| demo-seo-audit | score 37, grade F, 5 passed / 1 warning / 8 failed on example.com |
| demo-docparse | title "Example Domain", 25 words |
| demo-textmind | label neutral, keywords chips |
| demo-pii-shield | "Hi, I am **** Doe. Email ****************.com or call ********4567. Card on file: ****" |
| demo | score 88, deliverable, Google Workspace / Gmail |

## Errors found while building

1. The generated pages emitted `var payload = url: ...` because the template's braces were
   consumed by Python's `str.format`. Fixed by escaping to `{{ {payload} }}`. Symptom was a
   silent "Unexpected token ':'" and a page that never updated.
2. The PII demo seeded the textarea with a sentence containing no PII, so it rendered a
   boring no-op. Seed replaced with a ticket containing a name, email, phone, card and IP.
   Then found the replacement text was inside a non-f-string, so it rendered "{seed}". Both
   fixed and re-verified.

## Guard rails

- Input length capped before the upstream call (email 254, url 2000, text 5000).
- URL inputs must start with http(s), so the demo cannot be used as a blind SSRF probe
  through this Worker.
- 429 past the budget with a message pointing at the listing.
- Upstream failures return 504 with a short message, never an empty 200.
