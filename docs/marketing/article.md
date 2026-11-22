# Five APIs on Cloudflare Workers, and the four bugs that nearly shipped

Five products, 37 endpoints, 470 tests, one deploy command each. Here is the architecture, the pricing maths, and the four bugs that would have made the whole thing useless.

## The shape of the thing

One pnpm workspace, five Workers, one shared package. Each Worker is its own product with its own name, its own key, its own quota and its own failure domain. A bug in the PDF parser cannot take down email verification, and I can ship one without redeploying the other four.

The shared package does the boring, dangerous work once: error envelope, CORS, request ids, timing headers, OpenAPI generation, SSRF-safe fetching, and the RapidAPI proxy-secret check. Every route in every app is registered through `app.openapi(createRoute(...), handler)` so the spec is generated from the same source of truth as the handler. There is no hand-written YAML to drift out of date.

That gave me 37 endpoints and 470 unit tests. Every app passes `tsc --noEmit` and every route was answered with a real curl before it was listed anywhere.

## Why these five

APIs on a marketplace sell on search intent, not on cleverness. Someone types "email verification api" because their signup flow is leaking bounces. They are not looking for a platform. So the product has to name the job, not the technology.

I avoided the categories that look lucrative and are legally toxic: scraped social profiles, real estate listings, job feeds. Those are someone else's data with someone else's terms attached. Everything here computes something from input you send, or fetches a page you asked about.

## The four bugs

**1. The SSRF guard rejected every hostname.** My `validateHostname()` ran the hostname through the private-IP blocker. That blocker reports "blocked" for any string that is not a parseable IP, so `example.com` looked like a private range. Every fetch-based endpoint returned 400 before making a single request.

**2. A UTF-8 BOM broke the OpenAPI import.** PowerShell's `Set-Content -Encoding UTF8` writes a byte order mark. The importer saw three junk bytes before `{` and refused the file. The error pointed at JSON syntax, not encoding, which is why it cost half an hour.

**3. The model I pinned was deprecated.** `@cf/meta/llama-3.1-8b-instruct` resolved to a retired backing model. The replacement ignored the chat `messages` array and only accepted a plain `prompt`, which produced fluent nonsense: a 118 word "summary" that repeated instructions until it ran out of tokens. Fix was a chat-native model, a parser that accepts both response shapes, and a prompt fallback.

**4. The proxy secret had a trailing newline.** `wrangler secret put` from a shell pipe stored `uuid\n`, so every marketplace request returned 401. Trimming both sides fixed it. If I had only tested "direct calls are rejected" I would have shipped an API that rejected everyone.

## Pricing, with the real numbers

The marketplace takes a flat 25% and pays out through PayPal after roughly two months. A $25 subscription is about $18.75 to me, arriving in the new year.

The free tier is deliberately small: 100 requests a month. A free tier that covers the use case kills the paid tier. 100 calls is enough to wire the integration and see real output, not enough to run a production list cleaning job.

Marginal cost per call is close to zero for three of the five. The exceptions are priced for: the neural endpoints bill per token, and the fetch-based ones make live network calls.

## What I would tell the next person

Build one endpoint you can explain in a sentence, then make the response explain itself. Every verdict ships with the reasons behind it, because the moment a buyer cannot explain a score to their manager, they stop trusting the API and cancel.

Write the limitation into the product. EmailCheck says outright that it cannot prove a mailbox exists without an SMTP handshake. Buyers forgive a documented limit. They do not forgive discovering one in production.

And test the path a customer actually takes. The proxy-secret bug survived local testing, unit tests and a live smoke suite, and was only caught by running a request through the marketplace itself.

*Disclosure: I build and operate every API mentioned. Build log: https://ayam-labs-site.ayamullahkhan04.workers.dev/blog-five-apis.html*
