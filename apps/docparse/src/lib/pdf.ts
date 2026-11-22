import { ApiError, ErrorCode } from "@api/core";
import { PDFDocument } from "pdf-lib";
import { getDocumentProxy } from "unpdf";
import { LIMITS } from "./limits";
import { detectPdfEncryption, looksLikePdf, readPdfVersion } from "./magic";
import { buildPageSelection } from "./ranges";
import { cleanDocumentText, cleanText, countWords, truncateText } from "./text";

/**
 * PDF extraction on top of unpdf (pdf.js) with pdf-lib as the metadata and
 * page-count fallback for files pdf.js refuses. Every entry point validates
 * the %PDF- signature first so a random upload fails with 422, not with a
 * pdf.js stack trace.
 */

export type PdfProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

export interface PdfMetadata {
  title: string | null;
  author: string | null;
  producer: string | null;
  creator: string | null;
  creationDate: string | null;
}

export const PDF_UNREADABLE_MESSAGE =
  "This file is not a readable PDF. It may be corrupt, password protected, or a scanned image.";

export const emptyPdfMetadata = (): PdfMetadata => ({
  title: null,
  author: null,
  producer: null,
  creator: null,
  creationDate: null,
});

function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed.slice(0, 500) : null;
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return null;
}

/**
 * Converts the PDF date syntax (`D:20240101120000+05'30'`) to ISO 8601 UTC.
 * Unparseable values are returned trimmed so callers still see the raw value.
 */
export function normalizePdfDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const isPdfSyntax = /^D:/i.test(trimmed) || /^\d{4}(?:\d{2}){2,5}(?:[+-]\d{2}'?\d{0,2}'?|Z)?$/i.test(trimmed);
  if (!isPdfSyntax) {
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? trimmed.slice(0, 40) : new Date(parsed).toISOString();
  }
  const match = /^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(trimmed);
  if (!match) {
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? trimmed.slice(0, 40) : new Date(parsed).toISOString();
  }
  const [, year, month = "01", day = "01", hour = "00", minute = "00", second = "00"] = match;
  const rest = trimmed.slice(match[0].length).trim();
  let offsetMinutes = 0;
  const offset = /^([+-])(\d{2})'?(\d{2})?/.exec(rest);
  if (offset) {
    const sign = offset[1] === "-" ? -1 : 1;
    offsetMinutes = sign * (Number(offset[2]) * 60 + Number(offset[3] ?? 0));
  } else if (/^Z$/i.test(rest)) {
    offsetMinutes = 0;
  }
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)) - offsetMinutes * 60_000;
  if (!Number.isFinite(utc)) return trimmed.slice(0, 40);
  const parsed = new Date(utc);
  return Number.isNaN(parsed.getTime()) ? trimmed.slice(0, 40) : parsed.toISOString();
}

/** Maps the pdf.js info dictionary (Title/Author/Producer/...) to our shape. */
export function metadataFromPdfInfo(info: Record<string, unknown> | null | undefined): PdfMetadata {
  if (!info) return emptyPdfMetadata();
  return {
    title: asText(info.Title),
    author: asText(info.Author),
    producer: asText(info.Producer),
    creator: asText(info.Creator),
    creationDate: normalizePdfDate(asText(info.CreationDate) ?? asText(info.ModDate)),
  };
}

/** Reads the same fields from a loaded pdf-lib document. */
export function metadataFromPdfLib(document: PDFDocument): PdfMetadata {
  const read = (getter: () => string | Date | undefined): string | null => {
    try {
      return asText(getter());
    } catch {
      return null;
    }
  };
  return {
    title: read(() => document.getTitle()),
    author: read(() => document.getAuthor()),
    producer: read(() => document.getProducer()),
    creator: read(() => document.getCreator()),
    creationDate: normalizePdfDate(read(() => document.getCreationDate())),
  };
}

/** pdf.js signals password requirements with a PasswordException. */
export function isPasswordError(error: unknown): boolean {
  if (!error) return false;
  const name = typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  if (name === "PasswordException") return true;
  const message = error instanceof Error ? error.message : String(error);
  return /password/i.test(message);
}

function passwordError(): ApiError {
  return new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "This PDF is password protected", {
    hint: "Encrypted PDFs are not decrypted by this API. Remove the password and send the file again.",
  });
}

function unreadableError(cause?: unknown): ApiError {
  return new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, PDF_UNREADABLE_MESSAGE, {
    hint: "Only text based PDFs are supported. Scanned pages without a text layer return little or no text, and this API has no OCR.",
    details: cause instanceof Error ? cause.message.slice(0, 200) : undefined,
  });
}

/** Signature check shared by every PDF endpoint. */
export function assertPdfSignature(bytes: Uint8Array): void {
  if (bytes.byteLength === 0) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "The uploaded file is empty");
  }
  if (!looksLikePdf(bytes)) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, PDF_UNREADABLE_MESSAGE, {
      hint: "The file does not start with a %PDF- header. Check that you uploaded the PDF itself, not a link or an HTML error page.",
    });
  }
}

async function openPdf(bytes: Uint8Array): Promise<PdfProxy> {
  assertPdfSignature(bytes);
  try {
    return await getDocumentProxy(bytes);
  } catch (error) {
    if (isPasswordError(error)) throw passwordError();
    throw unreadableError(error);
  }
}

async function disposePdf(pdf: PdfProxy): Promise<void> {
  try {
    await pdf.loadingTask.destroy();
  } catch {
    /* an already destroyed document is fine */
  }
}

async function readPageText(pdf: PdfProxy, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  try {
    const content = await page.getTextContent();
    const items = content.items as Array<{ str?: unknown; hasEOL?: boolean }>;
    let out = "";
    for (const item of items) {
      if (typeof item.str !== "string") continue;
      out += item.str;
      if (item.hasEOL) out += "\n";
    }
    return out;
  } finally {
    try {
      page.cleanup();
    } catch {
      /* cleanup is best effort */
    }
  }
}

async function readMetadata(pdf: PdfProxy): Promise<PdfMetadata> {
  try {
    const meta = await pdf.getMetadata();
    return metadataFromPdfInfo(meta.info as unknown as Record<string, unknown>);
  } catch {
    return emptyPdfMetadata();
  }
}

export interface PdfInfoResult {
  pageCount: number;
  metadata: PdfMetadata;
  pdfVersion: string | null;
  encrypted: boolean;
  fileSizeBytes: number;
}

/**
 * Fast path for /v1/pdf/info: no text extraction. pdf-lib parses the document
 * structure and reports encryption reliably; pdf.js is the fallback when
 * pdf-lib rejects a file it cannot handle.
 */
export async function readPdfInfo(bytes: Uint8Array): Promise<PdfInfoResult> {
  const pdfVersion = readPdfVersion(bytes);
  const encryptionHeuristic = detectPdfEncryption(bytes);
  const fileSizeBytes = bytes.byteLength;
  assertPdfSignature(bytes);
  try {
    const document = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    return {
      pageCount: document.getPageCount(),
      metadata: metadataFromPdfLib(document),
      pdfVersion,
      encrypted: document.isEncrypted || encryptionHeuristic,
      fileSizeBytes,
    };
  } catch {
    try {
      const pdf = await openPdf(bytes);
      try {
        return {
          pageCount: pdf.numPages,
          metadata: await readMetadata(pdf),
          pdfVersion,
          encrypted: encryptionHeuristic,
          fileSizeBytes,
        };
      } finally {
        await disposePdf(pdf);
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isPasswordError(error)) throw passwordError();
      throw unreadableError(error);
    }
  }
}

export interface PdfTextResult {
  text: string;
  pages: string[];
  pageCount: number;
  pagesReturned: number;
  truncated: boolean;
  metadata: PdfMetadata;
  encrypted: boolean;
}

/**
 * Extracts text from up to `maxPages` pages. Pages are read one at a time and
 * cleaned up immediately, so a 100 page PDF never holds more than one page of
 * pdf.js objects in memory at once.
 */
export async function extractPdfText(bytes: Uint8Array, maxPages = LIMITS.maxPdfPages): Promise<PdfTextResult> {
  const pdf = await openPdf(bytes);
  try {
    const pageCount = pdf.numPages;
    const limit = Math.max(0, Math.min(pageCount, maxPages));
    const pages: string[] = [];
    for (let page = 1; page <= limit; page += 1) {
      pages.push(cleanDocumentText(await readPageText(pdf, page)));
    }
    const joined = cleanText(pages.join("\n\n"));
    const capped = truncateText(joined, LIMITS.maxTextChars);
    return {
      text: capped.text,
      pages: pages.map((page) => truncateText(page, LIMITS.maxTextChars).text),
      pageCount,
      pagesReturned: pages.length,
      truncated: pageCount > limit || capped.truncated,
      metadata: await readMetadata(pdf),
      encrypted: detectPdfEncryption(bytes),
    };
  } finally {
    await disposePdf(pdf);
  }
}

export interface PdfPageResult {
  page: number;
  text: string;
  characters: number;
}

export interface PdfPagesResult {
  pageCount: number;
  pages: PdfPageResult[];
  outOfRange: number[];
  characters: number;
  words: number;
}

/** Extracts only the requested pages; missing pages are reported, not faked. */
export async function extractPdfPages(bytes: Uint8Array, requested: number[]): Promise<PdfPagesResult> {
  const pdf = await openPdf(bytes);
  try {
    const pageCount = pdf.numPages;
    const selection = buildPageSelection(requested, pageCount);
    const pages: PdfPageResult[] = [];
    for (const pageNumber of selection.pages) {
      const text = cleanDocumentText(await readPageText(pdf, pageNumber));
      const capped = truncateText(text, LIMITS.maxTextChars);
      pages.push({ page: pageNumber, text: capped.text, characters: capped.text.length });
    }
    const joined = cleanText(pages.map((page) => page.text).join("\n\n"));
    return {
      pageCount,
      pages,
      outOfRange: selection.outOfRange,
      characters: joined.length,
      words: countWords(joined),
    };
  } finally {
    await disposePdf(pdf);
  }
}
