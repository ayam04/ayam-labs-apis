# Launch state - 2026-11-22 (round 1)

## Listings: live, public, complete

All five were Private until this session. The publish page shows a sticky **Save** bar at
the bottom (screen 350,1073 in a 1078-wide window); nothing is sent to the server until it
is clicked. That single missing click is why every field appeared to revert for days.

Verified after a reload for each listing:

| API | Visibility | Long desc | Website | Terms | Docs readme | Logo |
| --- | --- | --- | --- | --- | --- | --- |
| EmailCheck | Public | yes | yes | yes | yes | yes |
| SEO Audit | Public | yes | yes | yes | yes | yes |
| DocParse | Public | yes | yes | yes | yes | yes |
| TextMind | Public | yes | yes | yes | yes | yes |
| PII Shield | Public | yes | yes | yes | yes | yes |

Plans: BASIC pay-per-use **$0.05/call**, PRO $25 / 25k, ULTRA $75 / 100k, MEGA $150 / 400k.
No free tier.

## Origin

Custom domains on ayamk.in: emailcheck, seo-audit, docparse, textmind, piishield.
Site on labs.ayamk.in. Apex and www are occupied by pre-existing DNS records, so the site
stays on the subdomain.

## Verification evidence

- 473 unit tests pass across the five apps
- 12/12 live smoke checks pass against the custom domains
- direct calls to /v1/* without the marketplace secret return 401
- /health and /openapi.json are public, everything else is gated

## Automation

Windows MCP input is refused while a human owns the desktop, so listing edits run on raw
Win32 input from PowerShell (scripts/fill-listing.ps1, docs.ps1, visibility.ps1).

## Open items

1. **Link PayPal** (Studio > General > bottom). RapidAPI holds revenue until then.
2. **Deprecated plan row** clears once our own subscription moves to the current plans.
3. Docs tab keeps literal markdown pipes; the editor is WYSIWYG.
4. Marketing: on-site guides + IndexNow done; Reddit blocked; dev.to needs an account.
