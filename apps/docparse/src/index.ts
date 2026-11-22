import { ApiError, ErrorCode, commonErrors, defineApi } from "@api/core";
import { createRoute } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { config } from "./config";
import { LIMITS } from "./lib/limits";
import { countWords } from "./lib/text";
import { extractPdfPages, extractPdfText, readPdfInfo } from "./lib/pdf";
import { extractDocxText } from "./lib/docx";
import { htmlToText } from "./lib/html";
import { htmlToMarkdown } from "./lib/markdown";
import { mediaType, readBinaryDocument, readHtmlDocument } from "./lib/input";
import type { RequestFacade } from "./lib/input";
import { parsePageRanges } from "./lib/ranges";
import {
  DocxTextResponseSchema,
  DocumentInputSchema,
  FormatsResponseSchema,
  HtmlInputSchema,
  HtmlMarkdownResponseSchema,
  HtmlTextResponseSchema,
  IncludeLinksQuerySchema,
  PagesQuerySchema,
  PdfInfoResponseSchema,
  PdfPagesResponseSchema,
  PdfTextResponseSchema,
  extractionErrors,
  multipartDocumentSchema,
} from "./schemas";
import type { DocumentInputBody, HtmlInputBody } from "./schemas";

/* eslint-disable @typescript-eslint/no-explicit-any */
const jsonContent = (schema: any) => ({ "application/json": { schema } });

const DOCUMENT_PATHS = new Set(["/v1/pdf/text", "/v1/pdf/info", "/v1/pdf/pages", "/v1/docx/text"]);
const HTML_PATHS = new Set(["/v1/html/text", "/v1/html/markdown"]);

const ENDPOINTS = [
  { method: "POST", path: "/v1/pdf/text", summary: "Extract full text and per-page text from a PDF" },
  { method: "POST", path: "/v1/pdf/info", summary: "Read PDF metadata, page count, version and size without extracting text" },
  { method: "POST", path: "/v1/pdf/pages", summary: "Extract only the pages you select from a PDF" },
  { method: "POST", path: "/v1/docx/text", summary: "Extract headings, list items, tables and paragraphs from a DOCX" },
  { method: "POST", path: "/v1/html/text", summary: "Extract readable main text, title and byline from HTML" },
  { method: "POST", path: "/v1/html/markdown", summary: "Convert HTML to clean markdown" },
  { method: "GET", path: "/v1/formats", summary: "List supported formats and limits" },
] as const;

const requestFacade = (c: {
  req: { header(name: string): string | undefined; formData(): Promise<FormData> };
}): RequestFacade => ({
  header: (name) => c.req.header(name),
  formData: () => c.req.formData(),
});

/**
 * Reads the validated JSON body. The document routes declare two content types
 * (JSON plus multipart), which makes @hono/zod-openapi type valid("json") as
 * never, so the cast lives here instead of in every handler.
 */
const jsonBodyOf = (c: any): DocumentInputBody => ((c.req.valid("json") as DocumentInputBody | undefined) ?? {});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Converts the router's own HTTPException into the shared error envelope. */
const httpExceptionGuard: MiddlewareHandler = async (c, next) => {
  try {
    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      const unsupported = error.status === 415;
      throw new ApiError(
        error.status,
        unsupported ? ErrorCode.UNSUPPORTED_MEDIA : ErrorCode.INVALID_INPUT,
        error.message || "Request rejected",
        {
          hint: unsupported ? "Check the Content-Type header and the request body shape in /openapi.json." : undefined,
        },
      );
    }
    throw error;
  }
};

/**
 * Rejects wrong content types and oversized bodies before route validation
 * and before any parser allocates a buffer.
 */
const bodyContractGuard: MiddlewareHandler = async (c, next) => {
  if (c.req.method.toUpperCase() !== "POST") return next();
  const path = c.req.path.replace(/\/+$/, "");
  const isDocumentPath = DOCUMENT_PATHS.has(path);
  const isHtmlPath = HTML_PATHS.has(path);
  if (!isDocumentPath && !isHtmlPath) return next();
  const contentType = c.req.header("content-type");
  const type = mediaType(contentType);
  const isJson = type === "application/json" || type.endsWith("+json");
  const isMultipart = type === "multipart/form-data";
  if (!isJson && !(isDocumentPath && isMultipart)) {
    throw new ApiError(415, ErrorCode.UNSUPPORTED_MEDIA, "Unsupported content type: " + (type || "(none)"), {
      hint: isDocumentPath
        ? 'Send application/json with a "url" or "base64" field, or multipart/form-data with a "file" part.'
        : 'Send application/json with an "html" or "url" field.',
    });
  }
  const limit = isHtmlPath ? LIMITS.maxHtmlBodyBytes : LIMITS.maxDocumentBodyBytes;
  const declared = Number(c.req.header("content-length") ?? "");
  if (Number.isFinite(declared) && declared > limit) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, "Request body is too large (" + declared + " bytes)", {
      hint: "Maximum request body size for this endpoint is " + limit + " bytes.",
    });
  }
  return next();
};

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

const pdfTextRoute = createRoute({
  method: "post",
  path: "/v1/pdf/text",
  tags: ["Extraction"],
  summary: "Extract full text and per-page text from a PDF",
  description:
    "Returns cleaned text, per page text, page count, words, characters and the PDF metadata dictionary. Accepts a multipart/form-data body with a 'file' part, or JSON with either a 'url' or a 'base64' field. Text extraction stops at " + LIMITS.maxPdfPages + " pages per call and the response reports truncated=true; fetch further pages with /v1/pdf/pages. Text based PDFs only: scanned pages return little or no text. A request body is required in practice: it is listed as optional because two content types are accepted (multipart upload or JSON).",
  request: {
    body: {
      content: {
        "application/json": { schema: DocumentInputSchema },
        "multipart/form-data": { schema: multipartDocumentSchema },
      },
      required: false,
    },
  },
  responses: {
    200: { description: "Extracted PDF text and metadata", content: jsonContent(PdfTextResponseSchema) },
    ...extractionErrors,
    ...commonErrors,
  },
});

const pdfInfoRoute = createRoute({
  method: "post",
  path: "/v1/pdf/info",
  tags: ["Extraction"],
  summary: "Read PDF metadata, page count, version and size without extracting text",
  description:
    "Fast path: parses the document structure and returns pageCount, the metadata dictionary, the PDF header version, the encryption flag and the file size. No text is extracted. Accepts the same multipart, base64 or url input as /v1/pdf/text. A request body is required in practice: it is listed as optional because two content types are accepted (multipart upload or JSON).",
  request: {
    body: {
      content: {
        "application/json": { schema: DocumentInputSchema },
        "multipart/form-data": { schema: multipartDocumentSchema },
      },
      required: false,
    },
  },
  responses: {
    200: { description: "PDF structure and metadata", content: jsonContent(PdfInfoResponseSchema) },
    ...extractionErrors,
    ...commonErrors,
  },
});

const pdfPagesRoute = createRoute({
  method: "post",
  path: "/v1/pdf/pages",
  tags: ["Extraction"],
  summary: "Extract only the pages you select from a PDF",
  description:
    "Extracts text from the pages named in ?pages=1,3,5-7 (single pages, inclusive ranges, comma separated, up to " + LIMITS.maxSelectedPages + " pages per call). Only the selected pages are parsed, so a 500 page contract costs one page of work. Page numbers past the end of the document are listed in outOfRange and never padded. Body is a multipart 'file' part or JSON with 'url' or 'base64'. A request body is required in practice: it is listed as optional because two content types are accepted (multipart upload or JSON).",
  request: {
    query: PagesQuerySchema,
    body: {
      content: {
        "application/json": { schema: DocumentInputSchema },
        "multipart/form-data": { schema: multipartDocumentSchema },
      },
      required: false,
    },
  },
  responses: {
    200: { description: "Text of the selected pages", content: jsonContent(PdfPagesResponseSchema) },
    ...extractionErrors,
    ...commonErrors,
  },
});

const docxTextRoute = createRoute({
  method: "post",
  path: "/v1/docx/text",
  tags: ["Extraction"],
  summary: "Extract headings, list items, tables and paragraphs from a DOCX",
  description:
    "Unzips the .docx, reads word/document.xml and converts it to text: Heading and Title styles become #/## prefixes, numbered and bulleted paragraphs become '- ' items, tables become pipe tables, everything else becomes a paragraph. Returns paragraph, heading, list and table counts plus word and character totals. Accepts multipart, base64 or url input, 8 MB maximum. A request body is required in practice: it is listed as optional because two content types are accepted (multipart upload or JSON).",
  request: {
    body: {
      content: {
        "application/json": { schema: DocumentInputSchema },
        "multipart/form-data": { schema: multipartDocumentSchema },
      },
      required: false,
    },
  },
  responses: {
    200: { description: "Extracted DOCX text and structure counts", content: jsonContent(DocxTextResponseSchema) },
    ...extractionErrors,
    ...commonErrors,
  },
});

const htmlTextRoute = createRoute({
  method: "post",
  path: "/v1/html/text",
  tags: ["Conversion"],
  summary: "Extract readable main text, title and byline from HTML",
  description:
    "Strips scripts, styles, nav, header, footer, aside and forms, then returns the readable text with paragraph breaks, the document title, a byline-ish first paragraph and word count. Pass ?includeLinks=true to also get the outbound links (up to 200, http/https/mailto/tel only, relative links resolved). Send either an 'html' field (500,000 characters) or a 'url' (5 MB, 12 s timeout).",
  request: {
    query: IncludeLinksQuerySchema,
    body: {
      content: { "application/json": { schema: HtmlInputSchema } },
      required: true,
    },
  },
  responses: {
    200: { description: "Readable text, title and optional links", content: jsonContent(HtmlTextResponseSchema) },
    ...extractionErrors,
    ...commonErrors,
  },
});

const htmlMarkdownRoute = createRoute({
  method: "post",
  path: "/v1/html/markdown",
  tags: ["Conversion"],
  summary: "Convert HTML to clean markdown",
  description:
    "Converts HTML to markdown with HTMLRewriter: ATX headings, bold/italic/strike, inline code, fenced code blocks with a language hint, links, images, ordered and unordered lists, blockquotes, horizontal rules, pipe tables and paragraphs. Scripts, styles and page chrome are dropped, javascript: and data: URLs are removed, and the output contains no HTML tags. Send either an 'html' field (500,000 characters) or a 'url' (5 MB, 12 s timeout).",
  request: {
    body: {
      content: { "application/json": { schema: HtmlInputSchema } },
      required: true,
    },
  },
  responses: {
    200: { description: "Markdown conversion", content: jsonContent(HtmlMarkdownResponseSchema) },
    ...extractionErrors,
    ...commonErrors,
  },
});

const formatsRoute = createRoute({
  method: "get",
  path: "/v1/formats",
  tags: ["Reference"],
  summary: "List supported formats and limits",
  description:
    "Documentation as data: the input formats this API accepts, the endpoint for each, every enforced size and page limit, and the list of things it deliberately does not do. Call this once at integration time instead of hard coding limits.",
  responses: {
    200: { description: "Formats, limits and endpoints", content: jsonContent(FormatsResponseSchema) },
    ...commonErrors,
  },
});

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */

const app = defineApi(config, (app) => {
  app.use("*", httpExceptionGuard);
  app.use("*", bodyContractGuard);

  app.openapi(pdfTextRoute, async (c) => {
    const started = Date.now();
    const body = jsonBodyOf(c);
    const document = await readBinaryDocument(requestFacade(c), body, "pdf");
    const result = await extractPdfText(document.bytes, LIMITS.maxPdfPages);
    return c.json(
      {
        text: result.text,
        pages: result.pages,
        pageCount: result.pageCount,
        pagesReturned: result.pagesReturned,
        truncated: result.truncated,
        characters: result.text.length,
        words: countWords(result.text),
        metadata: result.metadata,
        encrypted: result.encrypted,
        fileSizeBytes: document.fileSizeBytes,
        source: document.source,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(pdfInfoRoute, async (c) => {
    const started = Date.now();
    const body = jsonBodyOf(c);
    const document = await readBinaryDocument(requestFacade(c), body, "pdf");
    const result = await readPdfInfo(document.bytes);
    return c.json(
      {
        pageCount: result.pageCount,
        metadata: result.metadata,
        pdfVersion: result.pdfVersion,
        encrypted: result.encrypted,
        fileSizeBytes: document.fileSizeBytes,
        source: document.source,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(pdfPagesRoute, async (c) => {
    const started = Date.now();
    const { pages } = c.req.valid("query");
    const selection = parsePageRanges(pages);
    const body = jsonBodyOf(c);
    const document = await readBinaryDocument(requestFacade(c), body, "pdf");
    const result = await extractPdfPages(document.bytes, selection.pages);
    return c.json(
      {
        pageCount: result.pageCount,
        requested: selection.ranges,
        pages: result.pages,
        outOfRange: result.outOfRange,
        characters: result.characters,
        words: result.words,
        fileSizeBytes: document.fileSizeBytes,
        source: document.source,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(docxTextRoute, async (c) => {
    const started = Date.now();
    const body = jsonBodyOf(c);
    const document = await readBinaryDocument(requestFacade(c), body, "docx");
    const result = extractDocxText(document.bytes);
    return c.json(
      {
        text: result.text,
        paragraphs: result.paragraphs,
        headings: result.headings,
        listItems: result.listItems,
        tables: result.tables,
        words: result.words,
        characters: result.characters,
        truncated: result.truncated,
        fileSizeBytes: document.fileSizeBytes,
        source: document.source,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(htmlTextRoute, async (c) => {
    const started = Date.now();
    const { includeLinks } = c.req.valid("query");
    const body = c.req.valid("json") as HtmlInputBody;
    const document = await readHtmlDocument(requestFacade(c), body);
    const wantsLinks = includeLinks === "true";
    const result = await htmlToText(document.html, { includeLinks: wantsLinks, baseUrl: document.url });
    return c.json(
      {
        url: document.url,
        source: document.source,
        title: result.title,
        byline: result.byline,
        text: result.text,
        characters: result.characters,
        words: result.words,
        links: wantsLinks ? result.links : null,
        truncated: result.truncated,
        inputTruncated: document.inputTruncated,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(htmlMarkdownRoute, async (c) => {
    const started = Date.now();
    const body = c.req.valid("json") as HtmlInputBody;
    const document = await readHtmlDocument(requestFacade(c), body);
    const result = await htmlToMarkdown(document.html, { baseUrl: document.url });
    return c.json(
      {
        url: document.url,
        source: document.source,
        title: result.title,
        markdown: result.markdown,
        characters: result.characters,
        words: result.words,
        truncated: result.truncated,
        inputTruncated: document.inputTruncated,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(formatsRoute, (c) =>
    c.json(
      {
        formats: [
          {
            format: "PDF",
            extensions: [".pdf"],
            contentType: "application/pdf",
            endpoints: ["/v1/pdf/text", "/v1/pdf/info", "/v1/pdf/pages"],
            maxInputBytes: LIMITS.maxDocumentBytes,
            notes:
              "Text based PDFs only. Scanned pages return little or no text (no OCR). Encrypted files return 422. Up to " + LIMITS.maxPdfPages + " pages per extraction.",
          },
          {
            format: "DOCX",
            extensions: [".docx"],
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            endpoints: ["/v1/docx/text"],
            maxInputBytes: LIMITS.maxDocumentBytes,
            notes:
              "WordprocessingML only. Legacy .doc, .rtf and .odt must be saved as .docx first. Images, headers, footers and footnotes are not extracted.",
          },
          {
            format: "HTML",
            extensions: [".html", ".htm"],
            contentType: "text/html",
            endpoints: ["/v1/html/text", "/v1/html/markdown"],
            maxInputBytes: LIMITS.maxFetchedHtmlBytes,
            notes:
              "Post markup in the html field (500,000 characters) or a url (5 MB, 12 s timeout). Scripts and page chrome are stripped, never executed.",
          },
        ],
        limits: {
          maxDocumentBytes: LIMITS.maxDocumentBytes,
          maxBase64Chars: LIMITS.maxBase64Chars,
          maxPdfPages: LIMITS.maxPdfPages,
          maxSelectedPages: LIMITS.maxSelectedPages,
          maxPageRangeTokens: LIMITS.maxPageRangeTokens,
          maxHtmlJsonChars: LIMITS.maxHtmlJsonChars,
          maxFetchedHtmlBytes: LIMITS.maxFetchedHtmlBytes,
          maxTextChars: LIMITS.maxTextChars,
          maxLinks: LIMITS.maxLinks,
          maxUrlLength: LIMITS.maxUrlLength,
          fetchTimeoutMs: LIMITS.fetchTimeoutMs,
        },
        endpoints: ENDPOINTS.map((endpoint) => ({ method: endpoint.method, path: endpoint.path, summary: endpoint.summary })),
        notSupported: [
          "Scanned PDF pages and images: no OCR engine is bundled, so they return little or no text",
          "Legacy .doc, .rtf, .odt and .pages files",
          "Spreadsheets, presentations and e-books (XLSX, PPTX, EPUB)",
          "Password protected or certificate encrypted PDFs",
          "Writing, editing, merging or repairing documents",
          "Running JavaScript or fetching assets inside HTML",
        ],
      },
      200,
    ),
  );
});

export default app;
