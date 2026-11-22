# PII Shield API

## Short description (max 120 chars)

Detect, redact and score PII, profanity and spam in one deterministic text call. No ML, no data leaves the edge.

## Long description (markdown)

### What it does

PII Shield runs one deterministic pass over a block of text and returns three things at once:

- **Personal data:** 19 detectors find emails, phone numbers, payment cards, IBANs, US SSNs, IPv4 and IPv6 addresses, URLs, birth dates, passport and licence numbers, postal addresses, person names, API keys, JWTs, crypto wallets, MAC addresses, GitHub tokens and AWS key ids. Checksum detectors only report values that pass their check: Luhn for cards, mod-97 for IBANs, base58check for Bitcoin addresses. Every finding has a 0-1 confidence, a validator name and a character range.
- **Redaction:** mask keeps the last N characters, label emits stable tokens such as [EMAIL_1] per distinct value, hash emits [EMAIL_3f9a21bc] from the first 8 hex characters of the value's SHA-256 so the same value correlates across documents without being stored.
- **Abuse signals:** a four language profanity lexicon (en, es, fr, de) that undoes leetspeak, repeated letters and separator tricks such as f.u.c.k, plus an 11 signal spam score where every signal reports the points it contributed and the phrase or count behind it.
- **A combined verdict:** /v1/moderation returns all three payloads plus allow / review / block, scored 45% PII risk, 35% spam, 20% profanity.

Everything is pure regex, checksums and small dictionaries, so responses are deterministic: identical input returns identical output, and no text ever leaves the Cloudflare edge.

**Honest limitation:** this is regex plus checksum based detection. It will miss unusual formats (card numbers split across lines, names outside the built-in given-name dictionary, non-Latin scripts) and it cannot know that a string is personal data without context. A bare date is reported at confidence 0.5 unless a birth keyword is nearby; passport and licence numbers need their usual labels; street addresses need a number and a recognised street suffix. Use minConfidence to trade recall for precision.

**Caps:** 200,000 characters per request, 2,000 findings, 100 profanity matches, 256 characters per finding value. Over-limit text is rejected with 413 before analysis starts.

### Endpoints at a glance

| Method | Path | One line |
|---|---|---|
| POST | /v1/scan | Find personal data and secrets, with counts, spans and a 0-100 risk summary |
| POST | /v1/redact | Return the text with findings masked, labelled or hashed |
| POST | /v1/profanity | Screen for profanity, sexual and promotional terms in en, es, fr, de |
| POST | /v1/spam | Score text 0-100 with 11 weighted heuristics and the evidence behind each one |
| POST | /v1/moderation | PII plus profanity plus spam plus a combined verdict in one call |
| GET | /v1/types | Detector, style, language and signal metadata for building a UI |

### Why use this instead of building it

- **It is already wired:** 19 detectors, three redaction styles, a four language lexicon and 11 spam heuristics, each with validation rules you would otherwise debug for a week (Luhn, IBAN mod-97, base58check, SSN area rules, IPv6 group counting, JWT structure).
- **One call, not four services:** /v1/moderation replaces a PII scrubber plus a profanity list plus a spam filter, and returns one verdict you can log.
- **Explainable output:** every finding carries confidence and validator, every spam signal carries its weight, points and evidence. Nothing is a black box score.
- **Safe by default:** no outbound calls, no storage, no logs of your text, and hashed redaction never echoes raw values back.
- **Cheap to run:** typical requests finish in single digit milliseconds; a 194,400 character document measured 34-48 ms on a local workerd instance.

### Code examples

Moderation (flagship):

```bash
curl -X POST "https://pii-shield.your-subdomain.workers.dev/v1/moderation" \
  -H "content-type: application/json" \
  -H "X-RapidAPI-Key: $RAPIDAPI_KEY" \
  -H "X-RapidAPI-Host: pii-shield.p.rapidapi.com" \
  -d '{"text":"WIN a $1000 gift card NOW!!! Verify your account at https://bit.ly/xk9 and call 555-123-4567. Email jane.doe@example.com."}'
```

```javascript
const response = await fetch("https://pii-shield.your-subdomain.workers.dev/v1/moderation", {
  method: "POST",
  headers: { "content-type": "application/json", "X-RapidAPI-Key": process.env.RAPIDAPI_KEY },
  body: JSON.stringify({ text: userMessage, minConfidence: 0.5, profanityLangs: ["en", "es"] }),
});
const { verdict, pii, profanity, spam } = await response.json();
if (verdict.action === "block") throw new Error("Message rejected: " + verdict.reasons.join("; "));
const safeText = pii.findings.length > 0 ? "contains " + pii.risk.detectedTypes.join(", ") : "clean";
```

```python
import os, requests

r = requests.post(
    "https://pii-shield.your-subdomain.workers.dev/v1/redact",
    headers={"X-RapidAPI-Key": os.environ["RAPIDAPI_KEY"]},
    json={"text": prompt, "style": "hash", "minConfidence": 0.6},
    timeout=10,
)
data = r.json()
print(data["redactedText"])           # [PERSON_NAME_...] wrote to [EMAIL_1a2b3c4d]
print(data["risk"]["level"], data["risk"]["score"])   # medium 22
print(data["mapping"])                # hash -> occurrences, no raw values
```

Scan only, restricted to cards and emails:

```bash
curl -X POST "https://pii-shield.your-subdomain.workers.dev/v1/scan" \
  -H "content-type: application/json" \
  -d '{"text":"Pay with 4111 1111 1111 1111 or email jane@example.com","types":["CREDIT_CARD","EMAIL"],"minConfidence":0.6}'
```

Profanity in four languages:

```bash
curl -X POST "https://pii-shield.your-subdomain.workers.dev/v1/profanity" \
  -H "content-type: application/json" \
  -d '{"text":"This sh1t is f.u.c.k.ing awful","langs":["en","fr"]}'
```

Spam score:

```bash
curl -X POST "https://pii-shield.your-subdomain.workers.dev/v1/spam" \
  -H "content-type: application/json" \
  -d '{"text":"ACT NOW!!! Limited time offer. https://bit.ly/abc call 555-123-4567"}'
```

Catalogue:

```bash
curl "https://pii-shield.your-subdomain.workers.dev/v1/types"
```

### Pricing

| Plan | Price | Requests/month | Overage |
|---|---|---|---|
| BASIC | Free | 1,000 | hard cap |
| PRO | $25 | 25,000 | $0.002 per request |
| ULTRA | $75 | 100,000 | $0.0015 per request |
| MEGA | $150 | 300,000 | $0.001 per request |

Every plan is the same API with the same limits. RapidAPI enforces the quota; direct calls to the worker are limited to 120 requests per minute per IP.

### Use cases

- **LLM prompt sanitisers:** redact names, emails and keys before a prompt reaches a model, and hash values so the same customer maps to the same token across prompts.
- **Customer support inboxes:** run /v1/moderation on inbound tickets, auto-tag spam, and strip card numbers before tickets land in a shared queue.
- **Log pipelines:** scan structured log lines for tokens and IP addresses, emit only the risk band and detector ids.
- **UGC and marketplaces:** block high severity profanity and spam pitches before they hit a feed, with the matched term masked so it is safe to store.
- **GDPR and SOC2 evidence:** prove that a data field is detected, redacted and reason-coded, with a deterministic, repeatable result you can re-run in an audit.

### FAQ

**Does it call an LLM or any upstream service?**
No. Every detector is local regex, checksum or dictionary logic running in the worker. No text is stored, logged or forwarded.

**Will it find every piece of personal data?**
No. It is regex plus checksum based detection. Unusual formats, non-Latin scripts and names outside the given-name dictionary are missed, and context matters: "1990-04-17" is reported as a birth date candidate at confidence 0.5, not as a confirmed date of birth. Tune with minConfidence and types.

**What do the confidence values mean?**
Checksum backed detections (cards 0.97, IBAN 0.97, GitHub and AWS tokens 0.99, JWTs 0.95) are close to certain. Heuristics are deliberately low: person names 0.45-0.72, API keys 0.4-0.55, dates 0.5-0.78, addresses 0.62.

**Can I reverse the hash style?**
Not cryptographically. The hash is the first 8 hex characters of SHA-256, so it is a fingerprint for correlation only, and the mapping never pairs a hash with a raw value. If your own pipeline needs the pair, join `mapping[].firstStart` with `findings[].start`: the findings already carry the value and its offset.

**Which languages are supported?**
Profanity: en, es, fr, de. PII detection is format driven (emails, cards, IBANs, IPs, tokens) and works on any Latin-script text; the person-name dictionary is English biased. The lexicon contains ordinary profanity, sexual and promotional spam terms only, no slurs.

**Is it deterministic and fast?**
Yes. Same input, same output, no time or randomness in the result. Measured locally: about 1 ms for a short chat message, 34-48 ms for a 194,400 character document at the 200,000 character cap.

**What happens with a very long document?**
Text over 200,000 characters returns 413 PAYLOAD_TOO_LARGE. Split the document and call the endpoint per chunk; findings are capped at 2,000 per response with a `truncated` flag.
