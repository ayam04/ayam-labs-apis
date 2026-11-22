## EmailCheck API

Version 1.0.0. Marketplace base URL: `https://emailcheck.p.rapidapi.com`

### Endpoints

| Method | Path | Summary |
| --- | --- | --- |
| GET | `/v1/verify` | Verify a single email address |
| POST | `/v1/verify` | Verify a single email address (JSON body) |
| POST | `/v1/bulk` | Verify up to 100 addresses in one request |
| GET | `/v1/domain` | Inspect a domain's email infrastructure |
| GET | `/v1/disposable` | Check a domain against the disposable mailbox blocklist |

### Auth

Send both headers on every request. The marketplace rejects calls without them before they reach the API.

```
X-RapidAPI-Key: <your key>
X-RapidAPI-Host: emailcheck.p.rapidapi.com
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
