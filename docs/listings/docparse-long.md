## What this does

Turns documents into text and structure without a browser or a Python runtime in your stack.

A single POST takes a URL or base64 payload and returns clean text, per-page text, metadata, headings, tables and list items, depending on the endpoint. PDF, DOCX and HTML are all handled in the Worker.

## Endpoints

- **POST /v1/pdf/text** - full text plus per-page text, page count and word count
- **POST /v1/pdf/info** - metadata, page count, PDF version and size, without extracting text
- **POST /v1/pdf/pages** - extract only the pages you ask for
- **POST /v1/docx/text** - headings, list items, tables and paragraphs from a DOCX
- **POST /v1/html/text** - main readable text, title and byline from HTML
- **POST /v1/html/markdown** - HTML to clean markdown
- **GET /v1/formats** - supported formats and size limits

## What to expect

A 100-page PDF extracts in roughly 3 seconds. A 16-page paper takes under a second. Files are held in memory only for the duration of the request and never written to storage.

## Limits, stated plainly

Scanned PDFs have no text layer, so they return empty text - this is not an OCR service. Encrypted or password-protected files are rejected with a clear error. Size limits are documented on /v1/formats.
