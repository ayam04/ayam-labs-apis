## What this does

Finds and removes personal data in text before it reaches a log, a model or a third party.

Nineteen detectors cover emails, phone numbers, credit cards (with Luhn validation), IBANs, SSNs, IP addresses, API keys, JWTs, bearer tokens, passports, national IDs, dates of birth, postcodes, addresses, names, and more. Each finding carries a type, a position and a confidence.

## Endpoints

- **POST /v1/scan** - detect PII and return findings with offsets and validators
- **POST /v1/redact** - replace findings; styles are mask, label or hash
- **POST /v1/profanity** - profanity screening with obfuscation handling
- **POST /v1/spam** - weighted heuristic spam score
- **POST /v1/moderation** - PII, profanity and spam in one call
- **GET /v1/types** - every detector, what it matches, how it validates

## What to expect

Fully deterministic, no model, no network call. Most payloads are processed in under 50ms. Redaction is reversible only by you, because nothing is stored.

## Limits, stated plainly

Regex and checksum detectors catch structured data well. Freeform names and addresses rely on heuristics and can miss unusual formats, which is why every finding comes with a confidence score and an offset so you can review before publishing.
