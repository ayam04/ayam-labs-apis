## TextMind API

Version 1.0.0. Marketplace base URL: `https://aitext.p.rapidapi.com`

### Endpoints

| Method | Path | Summary |
| --- | --- | --- |
| GET | `/v1/keywords` | Rank keywords and key phrases from plain text |
| POST | `/v1/keywords` | Rank keywords from a JSON body (up to 100,000 characters) |
| POST | `/v1/entities` | Extract emails, URLs, phones, dates, money and more |
| POST | `/v1/sentiment` | Score sentiment with a curated lexicon (free, deterministic) |
| POST | `/v1/detect-language` | Detect one of twelve languages with a confidence score |
| POST | `/v1/readability` | Flesch, Flesch-Kincaid and Gunning fog readability scores |
| GET | `/v1/stopwords` | List supported stopword lists, or fetch one language |
| POST | `/v1/summarize` | Summarise up to 12,000 characters with Llama 3.1 8B |
| POST | `/v1/rewrite` | Rewrite text in a chosen tone and return the model's notes |
| POST | `/v1/classify` | Zero-shot classification into 2-20 labels you supply |
| POST | `/v1/translate` | Translate up to 2,000 characters between twelve languages |

### Auth

Send both headers on every request. The marketplace rejects calls without them before they reach the API.

```
X-RapidAPI-Key: <your key>
X-RapidAPI-Host: aitext.p.rapidapi.com
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
