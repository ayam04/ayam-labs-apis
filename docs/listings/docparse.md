# DocParse API

## Short description (max 120 chars)

Extract clean text and structure from PDF, DOCX and HTML. Pages, headings, lists, tables, markdown. Built for RAG.

## Long description (markdown)

### What it does

DocParse turns documents into text your pipeline can index, chunk or parse. No PDF viewer, no OCR guesswork, no regex on HTML: one HTTP call returns cleaned text plus the structure you need to keep it useful.

- **PDF text**: full text, per page text, page count, words, characters and the metadata dictionary (title, author, producer, creator, creation date).
- **PDF info**: page count, metadata, PDF version, encryption flag and size, without extracting a single page of text.
- **PDF pages**: only the pages you ask for, e.g. ?pages=1,3,5-7.
- **DOCX text**: headings keep their # level, list items become "- " entries, tables become pipe tables, paragraphs stay paragraphs.
- **HTML text**: readable main text with paragraph breaks, page title, a byline-ish opening paragraph and optional outbound links. Nav, header, footer, aside, script, style and form content is dropped.
- **HTML markdown**: headings, bold, italic, strike, inline code, fenced code blocks, links, images, ordered and unordered lists, blockquotes, horizontal rules, pipe tables. No HTML tags in the output.
- **Formats**: the supported formats and every enforced limit, as JSON.

Input is flexible: multipart upload with a `file` part, a base64 field, or a public `url`. Text is normalised on the way out: unicode dashes and quotes folded, trailing spaces removed, 3+ blank lines collapsed to one, paragraph breaks kept.

**Honest limitation: text-based PDFs only; scanned PDFs return little or no text (no built-in OCR).** Password protected PDFs return 422, legacy .doc/.rtf/.odt files return 422, and DOCX images, headers, footers and footnotes are not extracted.

### Endpoints at a glance

| Method | Path | One line |
|---|---|---|
| POST | /v1/pdf/text | Full text, per page text, metadata, word count |
| POST | /v1/pdf/info | Page count, metadata, version, encryption, size. No text extraction |
| POST | /v1/pdf/pages?pages=1,3,5-7 | Text for the pages you select, up to 100 |
| POST | /v1/docx/text | Headings, list items, tables and paragraphs, with counts |
| POST | /v1/html/text?includeLinks=true | Readable text, title, byline, optional links |
| POST | /v1/html/markdown | Clean markdown conversion |
| GET | /v1/formats | Supported formats, limits and what is not supported |

### Why use this instead of building it

- PDF text extraction that survives real files: pdf.js based, with a pdf-lib fallback for metadata and page counts, capped at 100 pages and 8 MB per call.
- DOCX parsing without an office suite: the zip is read directly and `word/document.xml` is walked for heading styles, list numbering and table structure.
- HTML handled with a real streaming rewriter (HTMLRewriter), not regex. Scripts and chrome are stripped before anything is tokenised, and markdown output is checked for stray tags.
- Limits are enforced before parsing: 413 above 8 MB, 422 for the wrong format, 400 for a bad page selection. You get the same errors every time.
- One dependency-free Worker at 10 to 300 ms per call. No queue, no storage, no SDK to install.

Running it yourself means maintaining pdf.js edge cases, WordprocessingML quirks, HTML boilerplate removal and SSRF-safe URL fetching. This is one endpoint.

### Code examples

Upload a PDF by multipart:

```bash
curl -X POST "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/pdf/text" \
  -H "X-RapidAPI-Key: YOUR_KEY" -H "X-RapidAPI-Host: docparse.p.rapidapi.com" \
  -F "file=@report.pdf;type=application/pdf"
```

```js
const body = new FormData();
body.append("file", fileInput.files[0]);
const res = await fetch("https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/pdf/text", {
  method: "POST",
  headers: { "X-RapidAPI-Key": process.env.RAPIDAPI_KEY, "X-RapidAPI-Host": "docparse.p.rapidapi.com" },
  body,
});
const { text, pages, pageCount } = await res.json();
```

```python
import requests

with open("report.pdf", "rb") as handle:
    response = requests.post(
        "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/pdf/text",
        headers={"X-RapidAPI-Key": "YOUR_KEY", "X-RapidAPI-Host": "docparse.p.rapidapi.com"},
        files={"file": ("report.pdf", handle, "application/pdf")},
        timeout=30,
    )
print(response.json()["text"][:400])
```

PDF by url, and PDF info without text extraction:

```bash
curl -X POST "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/pdf/text" \
  -H "content-type: application/json" \
  -d '{"url":"https://arxiv.org/pdf/1706.03762"}'

curl -X POST "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/pdf/info" \
  -H "content-type: application/json" \
  -d '{"base64":"JVBERi0xLjcK..."}'
```

Specific pages:

```bash
curl -X POST "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/pdf/pages?pages=1,3,5-7" \
  -H "content-type: application/json" \
  -d '{"url":"https://example.com/contract.pdf"}'
```

DOCX:

```bash
curl -X POST "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/docx/text" \
  -F "file=@notes.docx;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document"
```

HTML to text, with links:

```bash
curl -X POST "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/html/text?includeLinks=true" \
  -H "content-type: application/json" \
  -d '{"url":"https://example.com"}'
```

HTML to markdown:

```bash
curl -X POST "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/html/markdown" \
  -H "content-type: application/json" \
  -d '{"html":"<h1>Invoice 1042</h1><p>Total: <strong>49.00 EUR</strong></p>"}'
```

Formats and limits:

```bash
curl "https://docparse.YOUR-SUBDOMAIN.workers.dev/v1/formats"
```

### Response shape

```json
{
  "text": "DocParse fixture - page 1\nPage one. The invoice total is 49.00 EUR.",
  "pages": ["DocParse fixture - page 1\nPage one. The invoice total is 49.00 EUR."],
  "pageCount": 3,
  "pagesReturned": 3,
  "truncated": false,
  "characters": 207,
  "words": 36,
  "metadata": {
    "title": "DocParse fixture report",
    "author": "DocParse test suite",
    "producer": "pdf-lib",
    "creator": "docparse fixture generator",
    "creationDate": "2024-05-06T07:08:09.000Z"
  },
  "encrypted": false,
  "fileSizeBytes": 1617,
  "source": "file",
  "durationMs": 126
}
```

### Pricing

| Plan | Price | Requests/month | Overage |
|---|---|---|---|
| BASIC | Free | 250 | hard cap, upgrade to continue |
| PRO | $25 | 5,000 | $0.005 per request |
| ULTRA | $75 | 25,000 | $0.003 per request |
| MEGA | $150 | 100,000 | $0.002 per request |

Overage is charged from the request package (RapidAPI billing), not per megabyte. A request that returns 400, 413 or 422 is still a request; validation errors are free of charge only when RapidAPI itself rejects the call.

### Use cases

1. **RAG ingestion**: chunk and embed PDF and DOCX text without shipping a PDF library into your worker or lambda.
2. **Invoice and contract processing**: pull page counts and metadata first, then only the pages you need (for example the totals page).
3. **Resume parsers**: headings, list items and tables from DOCX resumes keep their structure, which makes section splitting reliable.
4. **Note-taking and read-later tools**: convert a saved article to markdown with links and images intact.
5. **Support and legal triage**: extract readable text from a customer's HTML export or PDF attachment before classification.

### FAQ

**Does it OCR scanned PDFs?**
No. There is no OCR engine in the Worker. A scanned page has no text layer, so you get an empty or near empty page. Use an OCR service first, then send the searchable PDF here.

**What happens with password protected PDFs?**
They return 422 with a clear message. The API never guesses or brute forces passwords. /v1/pdf/info still reports the encryption flag when the file can be read structurally.

**Can I send a file by URL instead of uploading?**
Yes. The url field is fetched server side through an SSRF guard: private, loopback, link-local and metadata addresses are rejected on every redirect hop, with a 12 s timeout and a 5 MB cap for HTML, 8 MB for documents.

**How are DOCX tables handled?**
Best effort. Each row becomes a pipe table row, cells are flattened to one line, and merged cells are duplicated as separate columns. Complex nested tables keep their text, not their layout.

**How large can a document be?**
8 MB per PDF or DOCX, 100 pages per PDF request, 500,000 characters for an inline HTML field, 5 MB of HTML by URL, and 1,000,000 characters per response. Anything above returns 413 PAYLOAD_TOO_LARGE, and a 120 page PDF returns the first 100 pages with truncated=true.

**What does truncated mean on /v1/pdf/text?**
The document had more than 100 pages, or the extracted text passed 1,000,000 characters. pagesReturned tells you how many pages are in the pages array.

**Is the output deterministic?**
Text output is deterministic for the same input and version. durationMs and requestId are the only fields that change between identical calls.
