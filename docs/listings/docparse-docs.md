## DocParse API

Version 1.0.0. Marketplace base URL: `https://docparse.p.rapidapi.com`

### Endpoints

| Method | Path | Summary |
| --- | --- | --- |
| POST | `/v1/pdf/text` | Extract full text and per-page text from a PDF |
| POST | `/v1/pdf/info` | Read PDF metadata, page count, version and size without extracting text |
| POST | `/v1/pdf/pages` | Extract only the pages you select from a PDF |
| POST | `/v1/docx/text` | Extract headings, list items, tables and paragraphs from a DOCX |
| POST | `/v1/html/text` | Extract readable main text, title and byline from HTML |
| POST | `/v1/html/markdown` | Convert HTML to clean markdown |
| GET | `/v1/formats` | List supported formats and limits |

### Auth

Send both headers on every request. The marketplace rejects calls without them before they reach the API.

```
X-RapidAPI-Key: <your key>
X-RapidAPI-Host: docparse.p.rapidapi.com
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
