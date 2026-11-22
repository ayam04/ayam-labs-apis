# TextMind API

## Short description (max 120 chars)

Summarise, extract, score and classify text. Six endpoints are free and deterministic; AI endpoints are optional.

## Long description (markdown)

### What it does

TextMind is one HTTP API for the text chores every product eventually needs: pulling keywords and entities out of free text, scoring sentiment, detecting the language, measuring readability, summarising, rewriting, classifying and translating.

It is deliberately split in two.

**Deterministic endpoints (costClass "free").** No model, no network call, no per-request cost, and the same input always returns the same output:

- `/v1/keywords` - TF-IDF over sentences with stopword removal and 1/2/3-grams, plus density per term.
- `/v1/entities` - emails, URLs, phone numbers, dates, money, percentages, hashtags, @mentions, IPv4, IBAN (mod-97 checked) and UUIDs, each with exact `[start, end)` spans.
- `/v1/sentiment` - a curated 435-entry AFINN-style lexicon with negation handling, a score in [-1, 1], per-sentence breakdown and the strongest positive and negative words.
- `/v1/detect-language` - twelve languages, scored by script, stopword coverage and character trigrams, with a confidence value and the top three candidates.
- `/v1/readability` - Flesch reading ease, Flesch-Kincaid grade, Gunning fog, syllable estimate, counts, averages and the longest sentence.
- `/v1/stopwords` - the stopword lists themselves, per language.

**Neural endpoints (costClass "neural").** These call Cloudflare Workers AI only where generation genuinely adds value: `/v1/summarize` (with chunking for long input), `/v1/rewrite` (tone), `/v1/classify` (zero-shot, your labels) and `/v1/translate` (M2M100). Every response says which model ran.

**Honest limits.** Sentiment is a word list: it misses sarcasm, irony and emoji, and it is English only. Language detection uses short built-in samples per language, so inputs shorter than about three words are often ambiguous - check `isReliable`. Readability formulas are calibrated for English. AI endpoints call Cloudflare Workers AI models; latency 1-3 s is typical and output quality depends on the model, so treat the text as a draft, not as verified fact. If the AI binding is unavailable or a model call fails, AI endpoints answer 503 `AI_UNAVAILABLE` with a hint - never a 500. Plain text is expected: HTML is not stripped.

### Endpoints at a glance

| Method | Path | One line |
|---|---|---|
| GET | /v1/keywords | Rank keywords and phrases (up to 8,000 characters in the URL) |
| POST | /v1/keywords | Rank keywords and phrases (up to 100,000 characters) |
| POST | /v1/entities | Extract eleven entity types with exact spans and confidence |
| POST | /v1/sentiment | Lexicon sentiment score, label, per-sentence breakdown |
| POST | /v1/detect-language | Detect one of twelve languages with confidence |
| POST | /v1/readability | Flesch, Flesch-Kincaid and Gunning fog scores |
| GET | /v1/stopwords | List supported stopword languages, or one language's words |
| POST | /v1/summarize | Summarise up to 12,000 characters with Llama 3.1 8B |
| POST | /v1/rewrite | Rewrite in professional, casual, concise or friendly tone |
| POST | /v1/classify | Zero-shot classification into 2-20 of your labels |
| POST | /v1/translate | Translate up to 2,000 characters between twelve languages |

Every response carries `meta.costClass` (`free` or `neural`), `meta.method`, `meta.durationMs` and `meta.textCharacters`, so you can see what a call cost you.

### Why use this instead of building it

- **No OpenAI bill for the boring parts.** Keyword ranking, entity spans and sentiment are measured, not generated. They cost nothing per request, they never hallucinate and they never change under you.
- **Entity spans you can slice.** Every entity returns `[start, end)` UTF-16 offsets. Highlighting text in an editor or a chat view is a one-liner, not a re-parse.
- **One dependency, twelve languages.** Language detection and stopword filtering ship with the API. No spaCy, no fastText, no model download at build time.
- **AI when you want it, not always.** The four AI endpoints are opt in. Point your free path at the deterministic routes and add summarisation only for the requests that need it.
- **Boring reliability.** Size caps, documented error codes and a stable OpenAPI document generated from the same source the handlers use.

### Code examples

Keywords (deterministic, free):

```bash
curl -G "https://ai-text.<your-subdomain>.workers.dev/v1/keywords" \
  --data-urlencode "text=Solar panels convert sunlight into electricity. Solar panels are cheaper than ever." \
  --data-urlencode "limit=5"
```

```javascript
const params = new URLSearchParams({ text: longArticle, limit: "20" });
const response = await fetch("https://ai-text.<your-subdomain>.workers.dev/v1/keywords?" + params, {
  headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY },
});
const { keywords, stats, meta } = await response.json();
console.log(keywords[0].term, keywords[0].score, meta.costClass); // "solar panels" 100 "free"
```

Entities with spans:

```python
import requests

r = requests.post(
    "https://ai-text.<your-subdomain>.workers.dev/v1/entities",
    headers={"X-RapidAPI-Key": KEY},
    json={"text": "Pay invoice 1,250.50 USD by January 12, 2024. Questions: billing@acme.io"},
    timeout=15,
)
data = r.json()
for entity in data["entities"]:
    print(entity["type"], entity["value"], entity["start"], entity["end"])
# money "1,250.50 USD" / date "January 12, 2024" / email "billing@acme.io"
```

Sentiment:

```bash
curl -X POST "https://ai-text.<your-subdomain>.workers.dev/v1/sentiment" \
  -H "content-type: application/json" \
  -d '{"text":"I love this product, it is great! But the billing page is terrible."}'
```

Language detection:

```javascript
const res = await fetch("https://ai-text.<your-subdomain>.workers.dev/v1/detect-language", {
  method: "POST",
  headers: { "content-type": "application/json", "X-RapidAPI-Key": process.env.RAPIDAPI_KEY },
  body: JSON.stringify({ text: "Le renard brun rapide saute par-dessus le chien paresseux." }),
});
const { language, confidence, candidates } = await res.json(); // "fr", 0.5-0.9, top 3
```

Readability:

```bash
curl -X POST "https://ai-text.<your-subdomain>.workers.dev/v1/readability" \
  -H "content-type: application/json" \
  -d '{"text":"This is a simple sentence. It has short words."}'
```

Stopwords:

```bash
curl "https://ai-text.<your-subdomain>.workers.dev/v1/stopwords?lang=en"
```

Summarise (neural):

```bash
curl -X POST "https://ai-text.<your-subdomain>.workers.dev/v1/summarize" \
  -H "content-type: application/json" \
  -d '{"text":"<up to 12,000 characters>","maxWords":80,"style":"bullets"}'
```

```python
r = requests.post(
    "https://ai-text.<your-subdomain>.workers.dev/v1/summarize",
    headers={"X-RapidAPI-Key": KEY},
    json={"text": article, "maxWords": 80, "style": "bullets"},
    timeout=30,
)
if r.status_code == 503:
    print("AI endpoint unavailable:", r.json()["error"]["code"])  # AI_UNAVAILABLE
else:
    print(r.json()["summary"], r.json()["model"])
```

Rewrite (neural):

```bash
curl -X POST "https://ai-text.<your-subdomain>.workers.dev/v1/rewrite" \
  -H "content-type: application/json" \
  -d '{"text":"we got the thing working lol","tone":"professional"}'
```

Classify (neural, zero shot):

```javascript
const res = await fetch("https://ai-text.<your-subdomain>.workers.dev/v1/classify", {
  method: "POST",
  headers: { "content-type": "application/json", "X-RapidAPI-Key": process.env.RAPIDAPI_KEY },
  body: JSON.stringify({
    text: "My card was charged twice and nobody answered my emails.",
    labels: ["billing", "shipping", "product defect", "account access", "other"],
  }),
});
const { choice, scores, scoreSource } = await res.json();
```

Translate (neural):

```bash
curl -X POST "https://ai-text.<your-subdomain>.workers.dev/v1/translate" \
  -H "content-type: application/json" \
  -d '{"text":"Your invoice is attached.","source":"en","target":"es"}'
```

### Pricing

| Plan | Price | Requests/month | Overage |
|---|---|---|---|
| BASIC | Free | 1,000 | - |
| PRO | 25 USD | 50,000 | 0.002 USD / request |
| ULTRA | 75 USD | 250,000 | 0.0015 USD / request |
| MEGA | 150 USD | 1,000,000 | 0.001 USD / request |

AI endpoints use more compute per call than deterministic ones. Compare `meta.costClass` in responses and route the high-volume paths to the free endpoints.

### Use cases

1. **Support ticket triage.** Sentiment and keywords on the ticket body, zero-shot classification into billing/shipping/defect queues, then summarise only the long threads.
2. **Content and SEO tooling.** Keyword density and readability before publishing, entity extraction to link names, amounts and dates automatically.
3. **Lead and inbound parsing.** Pull emails, phones, company URLs, budgets and delivery dates out of pasted inquiry text in one call.
4. **Multilingual forms.** Detect the language of user-submitted text before deciding whether to auto-translate it, and stop accepting mixed-language input by accident.
5. **Migration and QA audits.** Score readability and language across an entire documentation set with a loop, without sending private text to a third-party LLM.

### FAQ

**Do the AI endpoints work on every plan?**
They work when the deployed worker has the Cloudflare Workers AI binding available. When it is not, they answer 503 `AI_UNAVAILABLE` with a hint, and the deterministic endpoints keep working. In Cloudflare's local development emulator the AI binding is not supported, so expect 503 there.

**How accurate is the sentiment score?**
It is a word list, not a trained classifier. Short, plainly worded reviews work well. Sarcasm ("great, another outage"), emoji and non-English text do not. The response returns the matched words so you can see exactly why a score came out the way it did.

**Why does keyword extraction prefer phrases?**
Sentences are treated as documents, so you get a real inverse sentence frequency. Bigrams and trigrams get a length bonus and phrases never cross a sentence boundary. Repeated phrases beat one-off phrases, which is what you want for tags and keyphrase lists.

**Is my text stored?**
Deterministic endpoints compute in memory and store nothing. AI endpoints send your text to Cloudflare Workers AI for the duration of the call. There is no database, no queue and no log of request bodies.

**What are the size limits?**
100,000 characters for deterministic POST endpoints (8,000 for the keywords GET variant, because URLs are short), 12,000 characters for summarize/rewrite/classify and 2,000 characters for translate. JSON bodies are capped at 512 KB. Over-limit requests get a 400 that names the exact limit, not a truncated result.
