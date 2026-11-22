# RapidAPI listing template

Every product needs one file: `docs/listings/<slug>.md`. RapidAPI's search and
conversion are driven by this text, so write it for a developer who is comparing
five similar APIs in a browser tab.

```md
# <Product Name>

## Short description (max 120 chars)

## Long description (markdown)
### What it does
### Endpoints at a glance  (table: method + path + one line)
### Why use this instead of building it
### Code examples (curl, JavaScript fetch, Python requests)
### Pricing
| Plan | Price | Requests/month | Overage |
### Use cases (3-5 concrete)
### FAQ (5 real questions)
```

Rules:
- Lead with the outcome. "Validate 10,000 emails a minute without bouncing" beats
  "REST API with JSON responses".
- Always include the honest limitation (what the API does not do).
- Include at least one runnable example per endpoint.
- Pricing: BASIC free (small quota), PRO $25, ULTRA $75, MEGA $150, priced per
  request package, with an overage rate in the $0.001-0.01 range.
