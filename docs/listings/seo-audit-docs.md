## SEO Audit API

Version 1.0.0. Marketplace base URL: `https://seoaudit.p.rapidapi.com`

### Endpoints

| Method | Path | Summary |
| --- | --- | --- |
| GET | `/v1/audit` | Run a full weighted on-page audit of one URL |
| GET | `/v1/meta` | Extract head metadata, social cards and structured data |
| GET | `/v1/links` | Extract every anchor and classify internal vs external |
| GET | `/v1/keywords` | Rank keywords and phrases with frequency and density |
| GET | `/v1/readability` | Score readability with Flesch, Flesch-Kincaid and Gunning Fog |
| GET | `/v1/robots` | Fetch and parse a domain's robots.txt |
| GET | `/v1/sitemap` | Parse a sitemap or sitemap index |
| POST | `/v1/text` | Run readability and keyword analysis on raw text |

### Auth

Send both headers on every request. The marketplace rejects calls without them before they reach the API.

```
X-RapidAPI-Key: <your key>
X-RapidAPI-Host: seoaudit.p.rapidapi.com
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
