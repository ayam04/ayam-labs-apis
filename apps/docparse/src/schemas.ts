import { jsonError, z } from "@api/core";
import { LIMITS } from "./lib/limits";

/* ------------------------------------------------------------------ *
 * Shared pieces
 * ------------------------------------------------------------------ */

/** Errors specific to document parsing, added to the core error set. */
export const extractionErrors = {
  413: jsonError("Payload or document exceeds the documented size limits"),
  415: jsonError("Content type is neither application/json nor multipart/form-data"),
  422: jsonError("The document could not be parsed (corrupt, encrypted or not the expected format)"),
} as const;

export const PdfMetadataSchema = z
  .object({
    title: z.string().nullable().openapi({ example: "Attention Is All You Need", description: "Title from the PDF information dictionary, when present." }),
    author: z.string().nullable().openapi({ example: "Ashish Vaswani et al.", description: "Author string from the PDF information dictionary." }),
    producer: z.string().nullable().openapi({ example: "pdfTeX-1.40.17", description: "Producer reported by the tool that wrote the PDF." }),
    creator: z.string().nullable().openapi({ example: "LaTeX with hyperref", description: "Creator application reported by the PDF." }),
    creationDate: z
      .string()
      .nullable()
      .openapi({
        example: "2017-06-12T00:00:00.000Z",
        description: "Creation (or modification) date converted to ISO 8601 UTC. Unparseable PDF dates are returned as the raw trimmed string.",
      }),
  })
  .openapi("PdfMetadata");

export const InputSourceSchema = z
  .enum(["file", "base64", "url"])
  .openapi({ example: "file", description: "Where the document bytes came from: multipart upload, base64 field, or a fetched url." });

/* ------------------------------------------------------------------ *
 * Request bodies
 * ------------------------------------------------------------------ */

export const DocumentInputSchema = z
  .object({
    url: z
      .string()
      .max(LIMITS.maxUrlLength)
      .optional()
      .openapi({
        description:
          "Public http(s) URL of the PDF or DOCX. Fetched through the SSRF guard, 12 s timeout, 8 MB cap. Provide exactly one of url, base64 or a multipart 'file' part.",
        example: "https://arxiv.org/pdf/1706.03762",
      }),
    base64: z
      .string()
      .max(LIMITS.maxBase64Chars)
      .optional()
      .openapi({
        description:
          "Base64 or data: URL encoded document, 8 MB maximum after decoding. Rejected with 413 above that, before decoding. Prefer multipart or url for large files.",
        example: "JVBERi0xLjcKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2c+PgplbmRvYmoK",
      }),
  })
  .openapi("DocumentInput");

/**
 * Raw OpenAPI schema for the multipart form. It is intentionally not a zod
 * schema: the body is read with request.formData() in the handler so a large
 * upload is never buffered by a validation middleware first.
 */
export const multipartDocumentSchema: {
  type: "object";
  required: string[];
  properties: Record<string, { type: "string"; format: string; description: string }>;
} = {
  type: "object",
  required: ["file"],
  properties: {
    file: {
      type: "string",
      format: "binary",
      description: "The PDF or DOCX file itself. Maximum 8 MB; the signature is checked before parsing.",
    },
  },
};

export const HtmlInputSchema = z
  .object({
    url: z
      .string()
      .max(LIMITS.maxUrlLength)
      .optional()
      .openapi({
        description:
          "Public http(s) URL of an HTML page. Fetched through the SSRF guard, 12 s timeout, 5 MB text cap; only html, xhtml, xml and text/plain responses are accepted.",
        example: "https://example.com",
      }),
    html: z
      .string()
      .max(LIMITS.maxHtmlJsonChars)
      .optional()
      .openapi({
        description:
          "Markup to convert, up to 500,000 characters. Scripts, styles, nav, header, footer and aside blocks are stripped. Provide exactly one of html or url.",
        example: "<h1>Invoice 1042</h1><p>Total: <strong>49.00 EUR</strong></p>",
      }),
  })
  .openapi("HtmlInput");

/* ------------------------------------------------------------------ *
 * Queries
 * ------------------------------------------------------------------ */

export const PagesQuerySchema = z.object({
  pages: z
    .string()
    .min(1)
    .max(500)
    .openapi({
      param: { name: "pages", in: "query" },
      example: "1,3,5",
      description:
        "Page selection. Single pages and inclusive ranges, comma separated. Up to " + LIMITS.maxSelectedPages + " pages and 64 tokens per call, page numbers 1-10000.",
    }),
});

export const IncludeLinksQuerySchema = z.object({
  includeLinks: z
    .enum(["true", "false"])
    .optional()
    .openapi({
      param: { name: "includeLinks", in: "query" },
      example: "true",
      description: "When true, the response also lists the outbound links of the page (up to 200, http, https, mailto and tel only).",
    }),
});

/* ------------------------------------------------------------------ *
 * Responses
 * ------------------------------------------------------------------ */

export const PdfTextResponseSchema = z
  .object({
    text: z.string().openapi({ example: "Attention Is All You Need\nAshish Vaswani...", description: "Full extracted text, cleaned and with paragraph breaks preserved." }),
    pages: z.array(z.string()).openapi({ description: "Per page text, in page order. One entry per extracted page." }),
    pageCount: z.number().int().openapi({ example: 15, description: "Pages in the document as reported by the PDF itself." }),
    pagesReturned: z.number().int().openapi({ example: 15, description: "Pages included in the pages array (capped at 100)." }),
    truncated: z
      .boolean()
      .openapi({ example: false, description: "True when the PDF had more pages than one call extracts, or the text exceeded 1,000,000 characters." }),
    characters: z.number().int().openapi({ example: 41230, description: "Characters in text." }),
    words: z.number().int().openapi({ example: 6731, description: "Words in text." }),
    metadata: PdfMetadataSchema,
    encrypted: z
      .boolean()
      .openapi({ example: false, description: "True when the file carries an /Encrypt dictionary. Text is only returned when it opened without a password." }),
    fileSizeBytes: z.number().int().openapi({ example: 2213424, description: "Size of the decoded document." }),
    source: InputSourceSchema,
    durationMs: z.number().int().openapi({ example: 631, description: "Server side handling time for the whole call, including any download." }),
  })
  .openapi("PdfTextResult");

export const PdfInfoResponseSchema = z
  .object({
    pageCount: z.number().int().openapi({ example: 15, description: "Pages in the document." }),
    metadata: PdfMetadataSchema,
    pdfVersion: z.string().nullable().openapi({ example: "1.5", description: "PDF header version such as 1.4 or 1.7, or null when the header is malformed." }),
    encrypted: z.boolean().openapi({ example: false, description: "True when the PDF is encrypted (pdf-lib reports it authoritatively)." }),
    fileSizeBytes: z.number().int().openapi({ example: 2213424, description: "Size of the decoded document." }),
    source: InputSourceSchema,
    durationMs: z.number().int().openapi({ example: 44, description: "Server side handling time. No text is extracted on this path." }),
  })
  .openapi("PdfInfoResult");

export const PdfPageSchema = z
  .object({
    page: z.number().int().openapi({ example: 5, description: "1-based page number." }),
    characters: z.number().int().openapi({ example: 2871, description: "Characters extracted from this page." }),
    text: z.string().openapi({ example: "3. Model Architecture", description: "Text of this page, cleaned." }),
  })
  .openapi("PdfPageText");

export const PdfPagesResponseSchema = z
  .object({
    pageCount: z.number().int().openapi({ example: 15, description: "Pages in the document." }),
    requested: z.string().openapi({ example: "1,3,5", description: "Normalised selection that was processed." }),
    pages: z.array(PdfPageSchema).openapi({ description: "Extracted pages, ascending by page number." }),
    outOfRange: z.array(z.number().int()).openapi({ example: [], description: "Requested page numbers past the end of the document. These are skipped, never padded." }),
    characters: z.number().int().openapi({ example: 9412, description: "Characters across all returned pages." }),
    words: z.number().int().openapi({ example: 1502, description: "Words across all returned pages." }),
    fileSizeBytes: z.number().int().openapi({ example: 2213424, description: "Size of the decoded document." }),
    source: InputSourceSchema,
    durationMs: z.number().int().openapi({ example: 240, description: "Server side handling time for the whole call." }),
  })
  .openapi("PdfPagesResult");

export const DocxTextResponseSchema = z
  .object({
    text: z
      .string()
      .openapi({
        example: "# Quarterly report\n\nRevenue grew 12% year on year.\n\n- North region\n- South region",
        description: "Extracted text. Headings become #/## prefixes, list items become '- ', tables become pipe tables.",
      }),
    paragraphs: z.number().int().openapi({ example: 42, description: "Paragraph blocks found in word/document.xml (excluding table cells)." }),
    headings: z.number().int().openapi({ example: 5, description: "Paragraphs that used a Heading/Title style." }),
    listItems: z.number().int().openapi({ example: 9, description: "Paragraphs that carried Word list numbering." }),
    tables: z.number().int().openapi({ example: 2, description: "Tables rendered as pipe tables." }),
    words: z.number().int().openapi({ example: 810, description: "Words in text." }),
    characters: z.number().int().openapi({ example: 5204, description: "Characters in text." }),
    truncated: z.boolean().openapi({ example: false, description: "True when the document exceeded the block or character cap." }),
    fileSizeBytes: z.number().int().openapi({ example: 34211, description: "Size of the .docx upload." }),
    source: InputSourceSchema,
    durationMs: z.number().int().openapi({ example: 39, description: "Server side handling time for the whole call." }),
  })
  .openapi("DocxTextResult");

export const HtmlLinkSchema = z
  .object({
    text: z.string().openapi({ example: "Pricing", description: "Anchor text, collapsed and truncated to 200 characters." }),
    href: z.string().openapi({ example: "https://example.com/pricing", description: "Absolute http(s), mailto or tel URL. Relative links are resolved against the page URL." }),
  })
  .openapi("HtmlLink");

export const HtmlTextResponseSchema = z
  .object({
    url: z.string().nullable().openapi({ example: "https://example.com", description: "Page that was fetched (after redirects), or null when the html field was posted." }),
    source: z.enum(["html", "url"]).openapi({ example: "url", description: "Where the markup came from." }),
    title: z.string().nullable().openapi({ example: "Example Domain", description: "Document title from <title>, falling back to the first <h1>." }),
    byline: z.string().nullable().openapi({ example: "This domain is for use in illustrative examples in documents.", description: "First substantial paragraph, capped at 400 characters. Intended as a summary or byline hint." }),
    text: z.string().openapi({ example: "Example Domain\n\nThis domain is for use in illustrative examples...", description: "Readable main text. Chrome (nav, header, footer, aside), scripts, styles and forms are stripped." }),
    characters: z.number().int().openapi({ example: 412, description: "Characters in text." }),
    words: z.number().int().openapi({ example: 71, description: "Words in text." }),
    links: z
      .array(HtmlLinkSchema)
      .nullable()
      .openapi({ description: "Outbound links, only present when ?includeLinks=true. Null otherwise." }),
    truncated: z.boolean().openapi({ example: false, description: "True when the extracted text exceeded 1,000,000 characters." }),
    inputTruncated: z.boolean().openapi({ example: false, description: "True when the fetched page exceeded the 5 MB download cap, so only part of it was converted." }),
    durationMs: z.number().int().openapi({ example: 96, description: "Server side handling time for the whole call." }),
  })
  .openapi("HtmlTextResult");

export const HtmlMarkdownResponseSchema = z
  .object({
    url: z.string().nullable().openapi({ example: "https://example.com", description: "Page that was fetched, or null when the html field was posted." }),
    source: z.enum(["html", "url"]).openapi({ example: "url", description: "Where the markup came from." }),
    title: z.string().nullable().openapi({ example: "Example Domain", description: "Document title from <title>, falling back to the first <h1>." }),
    markdown: z
      .string()
      .openapi({
        example: "# Example Domain\n\nThis domain is for use in illustrative examples. [More information...](https://www.iana.org/domains/example)",
        description: "Markdown with headings, emphasis, links, images, lists, blockquotes, fenced code blocks, pipe tables and paragraphs. No HTML tags.",
      }),
    characters: z.number().int().openapi({ example: 388, description: "Characters in markdown." }),
    words: z.number().int().openapi({ example: 71, description: "Words in markdown." }),
    truncated: z.boolean().openapi({ example: false, description: "True when the markdown exceeded 1,000,000 characters." }),
    inputTruncated: z.boolean().openapi({ example: false, description: "True when the fetched page exceeded the 5 MB download cap." }),
    durationMs: z.number().int().openapi({ example: 101, description: "Server side handling time for the whole call." }),
  })
  .openapi("HtmlMarkdownResult");

export const InputFormatSchema = z
  .object({
    format: z.string().openapi({ example: "PDF" }),
    extensions: z.array(z.string()).openapi({ example: [".pdf"] }),
    contentType: z.string().openapi({ example: "application/pdf" }),
    endpoints: z.array(z.string()).openapi({ example: ["/v1/pdf/text", "/v1/pdf/info", "/v1/pdf/pages"] }),
    maxInputBytes: z.number().int().openapi({ example: LIMITS.maxDocumentBytes }),
    notes: z.string().openapi({ example: "Text based PDFs only; scanned pages return little or no text (no OCR)." }),
  })
  .openapi("InputFormat");

export const FormatLimitsSchema = z
  .object({
    maxDocumentBytes: z.number().int().openapi({ example: LIMITS.maxDocumentBytes, description: "Largest accepted PDF or DOCX, after base64 decoding." }),
    maxBase64Chars: z.number().int().openapi({ example: LIMITS.maxBase64Chars, description: "Longest accepted base64 string in a JSON body." }),
    maxPdfPages: z.number().int().openapi({ example: LIMITS.maxPdfPages, description: "Pages extracted by /v1/pdf/text before truncation." }),
    maxSelectedPages: z.number().int().openapi({ example: LIMITS.maxSelectedPages, description: "Pages one /v1/pdf/pages call may select." }),
    maxPageRangeTokens: z.number().int().openapi({ example: LIMITS.maxPageRangeTokens, description: "Comma separated tokens accepted in the pages parameter." }),
    maxHtmlJsonChars: z.number().int().openapi({ example: LIMITS.maxHtmlJsonChars, description: "Characters accepted in the html field." }),
    maxFetchedHtmlBytes: z.number().int().openapi({ example: LIMITS.maxFetchedHtmlBytes, description: "Bytes downloaded when converting a page by url." }),
    maxTextChars: z.number().int().openapi({ example: LIMITS.maxTextChars, description: "Characters returned in a single text or markdown response." }),
    maxLinks: z.number().int().openapi({ example: LIMITS.maxLinks, description: "Links returned when includeLinks=true." }),
    maxUrlLength: z.number().int().openapi({ example: LIMITS.maxUrlLength, description: "Longest accepted url field." }),
    fetchTimeoutMs: z.number().int().openapi({ example: LIMITS.fetchTimeoutMs, description: "Outbound fetch timeout for user supplied URLs." }),
  })
  .openapi("FormatLimits");

export const EndpointSummarySchema = z
  .object({
    method: z.string().openapi({ example: "POST" }),
    path: z.string().openapi({ example: "/v1/pdf/text" }),
    summary: z.string().openapi({ example: "Extract full text and per-page text from a PDF" }),
  })
  .openapi("EndpointSummary");

export const FormatsResponseSchema = z
  .object({
    formats: z.array(InputFormatSchema),
    limits: FormatLimitsSchema,
    endpoints: z.array(EndpointSummarySchema),
    notSupported: z.array(z.string()).openapi({
      example: ["Scanned PDF pages and images (no OCR engine is bundled)"],
      description: "Things this API deliberately does not do, so nobody buys it for the wrong job.",
    }),
  })
  .openapi("FormatsResult");

export type DocumentInputBody = z.infer<typeof DocumentInputSchema>;
export type HtmlInputBody = z.infer<typeof HtmlInputSchema>;
