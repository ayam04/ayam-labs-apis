## PII Shield API

Version 1.0.0. Marketplace base URL: `https://piishield.p.rapidapi.com`

### Endpoints

| Method | Path | Summary |
| --- | --- | --- |
| POST | `/v1/scan` | Detect personal data and secrets in free text |
| POST | `/v1/redact` | Return the text with personal data masked, labelled or hashed |
| POST | `/v1/profanity` | Screen text for profanity, sexual and promotional terms |
| POST | `/v1/spam` | Score text from 0 to 100 with 11 spam heuristics |
| POST | `/v1/moderation` | Combined PII, profanity and spam moderation in one call |
| GET | `/v1/types` | List every detector, redaction style and spam signal |

### Auth

Send both headers on every request. The marketplace rejects calls without them before they reach the API.

```
X-RapidAPI-Key: <your key>
X-RapidAPI-Host: piishield.p.rapidapi.com
```

### Errors

Every failure returns the same envelope:

```json
{ "error": { "code": "INVALID_INPUT", "message": "...", "hint": "..." }, "requestId": "uuid", "timestamp": "ISO-8601" }
```

| Status | Code | When |
| --- | --- | --- |
| 400 | INVALID_INPUT | Missing or unparsable parameters |
| 401 | UNAUTHORIZED | Missing or invalid marketplace credentials |
| 404 | NOT_FOUND | No route matches the path |
| 413 | PAYLOAD_TOO_LARGE | Body above the documented cap |
| 429 | RATE_LIMITED | Plan quota exceeded |
| 5xx | UPSTREAM_ERROR | Retry quoting the requestId to support |

### Support

Open a discussion on the listing, or email ayamullahkhan04@gmail.com with the requestId.
