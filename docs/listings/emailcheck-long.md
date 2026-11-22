## What this does

One request tells you whether an email address can actually receive mail.

It checks, in order: syntax and RFC length limits, MX records, A/AAAA fallback, whether the domain is a known disposable provider, whether the local part is a role account (support@, admin@, noreply@), whether the domain is a free provider, and whether the address looks like a typo of a common domain. It returns a 0-100 score with the specific reasons, so you can gate a signup form on a number instead of a boolean.

## Endpoints

- **GET /v1/verify** - single address, full detail
- **POST /v1/bulk** - up to 100 addresses in one call, per-address results
- **GET /v1/domain** - MX, SPF/DMARC presence and provider for a domain
- **GET /v1/disposable** - DNS-free check against a 10,400 domain blocklist

## What to expect

The worker reports 16ms of its own execution time; a measured client round trip was 172ms p50 from India. DNS answers are cached at the edge for 10 minutes, so repeated checks of the same domain cost one lookup. The disposable list ships inside the Worker, so that check costs nothing.

## Limits, stated plainly

This API does not send an email and does not open an SMTP conversation, so it cannot tell you whether a specific mailbox exists. A domain with valid MX can still reject the address. It tells you whether the domain is real and whether the address is plausible, which is the part that filters most bad signups. If you need SMTP verification, say so before buying.
