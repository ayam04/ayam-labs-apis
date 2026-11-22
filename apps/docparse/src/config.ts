import type { ApiConfig } from "@api/core";

export const config: ApiConfig = {
  name: "docparse",
  title: "DocParse API",
  version: "1.0.0",
  summary: "Extract clean text and structure from PDF, DOCX and HTML for RAG pipelines and document automation.",
  description: [
    "Turn documents into clean text your pipeline can actually use.",
    "",
    "**PDF** endpoints return the full text and per page text of a PDF, its metadata and page count without extracting text, or just the pages you ask for (?pages=1,3,5-7). Text is cleaned: unicode dashes and quotes normalised, trailing spaces removed, blank lines collapsed, paragraph breaks kept. Input can be a multipart upload, a base64 field, or a url.",
    "",
    "**DOCX** returns paragraph text where headings carry their # level, list items become - entries and tables become pipe tables. Word's XML is parsed, nothing else.",
    "",
    "**HTML** turns a page or fragment into readable text (nav, header, footer, aside, scripts and styles stripped) or into markdown with headings, emphasis, links, images, lists, blockquotes, fenced code blocks and pipe tables.",
    "",
    "Every limit is documented and enforced: 8 MB input, 100 pages per PDF request, 5 MB of fetched HTML, 1,000,000 characters per response. Timeouts on outbound fetches are 12 s.",
    "",
    "**Honest scope:** text based PDFs only. Scanned pages return little or no text because no OCR engine is bundled. Encrypted PDFs return 422. Legacy .doc, .rtf and .odt files are not supported. DOCX images, headers, footers and footnotes are not extracted.",
    "",
    "**Built for:** RAG ingestion, invoice and contract parsing, resume parsing, note-taking tools, documentation pipelines.",
  ].join("\n"),
  baseUrl: "https://docparse.ayamk.in",
  tags: [
    { name: "Extraction", description: "Text and structure out of PDF and DOCX files" },
    { name: "Conversion", description: "HTML to readable text or markdown" },
    { name: "Reference", description: "Supported formats, caps and limits" },
  ],
  termsOfService: "https://example.com/terms",
  directRateLimitPerMinute: 60,
};