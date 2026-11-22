import { ApiError, ErrorCode, notFound, readBytesLimited, readTextLimited, upstreamError } from "@api/core";
import { fetchPublicUrl } from "./fetch";
import { LIMITS } from "./limits";
import { decodeBase64Capped } from "./base64";
import { looksLikeHtml, looksLikePdf, looksLikeZip } from "./magic";

/**
 * Everything that turns a request into a bounded byte buffer or HTML string.
 * The multipart, base64 and url paths all end up in the same caps, so no
 * handler ever parses a document the size limits did not approve first.
 */

export interface RequestFacade {
  header(name: string): string | undefined;
  formData(): Promise<FormData>;
}

export interface DocumentJsonBody {
  url?: string;
  base64?: string;
}

export interface HtmlJsonBody {
  url?: string;
  html?: string;
}

export type DocumentKind = "pdf" | "docx";

export interface BinaryDocumentInput {
  bytes: Uint8Array;
  source: "file" | "base64" | "url";
  filename: string | null;
  contentType: string | null;
  fileSizeBytes: number;
}

export interface HtmlDocumentInput {
  html: string;
  source: "html" | "url";
  url: string | null;
  /** True when the downloaded HTML hit the 5 MB fetch cap. */
  inputTruncated: boolean;
}

/** Lowercased media type without parameters. */
export function mediaType(header: string | undefined): string {
  return (header ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isJsonContentType(header: string | undefined): boolean {
  const type = mediaType(header);
  return type === "application/json" || type.endsWith("+json");
}

export function isMultipartContentType(header: string | undefined): boolean {
  return mediaType(header) === "multipart/form-data";
}

/** 413 when the declared body length is above the cap. */
export function assertDeclaredLength(request: RequestFacade, maxBytes: number): void {
  const raw = request.header("content-length");
  if (!raw) return;
  const declared = Number(raw);
  if (!Number.isFinite(declared) || declared < 0) return;
  if (declared > maxBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Request body is too large (${declared} bytes)`, {
      hint: `Maximum request body size is ${maxBytes} bytes. Send a smaller document or pass a url.`,
    });
  }
}

function assertSignature(bytes: Uint8Array, kind: DocumentKind): void {
  if (bytes.byteLength === 0) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "The document is empty");
  }
  if (kind === "pdf" && !looksLikePdf(bytes)) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "This file is not a readable PDF. It may be corrupt, password protected, or a scanned image.", {
      hint: "The payload does not start with a %PDF- header. Check that the upload or url points at the PDF file itself.",
    });
  }
  if (kind === "docx" && !looksLikeZip(bytes)) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "This file is not a .docx document", {
      hint: "A .docx is a zip archive and must start with the PK signature (50 4B 03 04). Legacy .doc files must be saved as .docx first.",
    });
  }
}

interface UploadedFile {
  bytes: Uint8Array;
  filename: string | null;
  contentType: string | null;
}

async function readMultipartUpload(request: RequestFacade): Promise<UploadedFile> {
  assertDeclaredLength(request, LIMITS.maxDocumentBodyBytes + 2048);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Could not parse the multipart body", {
      hint: 'Send a multipart/form-data body with a "file" part containing the document.',
    });
  }
  const candidate = form.get("file") ?? form.get("document");
  if (candidate === null || candidate === undefined) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, 'The multipart body must include a "file" part', {
      hint: 'Use -F "file=@document.pdf" with curl, or append the File to a FormData object as "file".',
    });
  }
  if (typeof candidate === "string") {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, 'The "file" part must be a file upload, not a text field');
  }
  if (candidate.size === 0) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "The uploaded file is empty");
  }
  if (candidate.size > LIMITS.maxDocumentBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Uploaded file is too large (${candidate.size} bytes)`, {
      hint: `Maximum document size is ${LIMITS.maxDocumentBytes} bytes.`,
    });
  }
  const bytes = new Uint8Array(await candidate.arrayBuffer());
  if (bytes.byteLength > LIMITS.maxDocumentBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Uploaded file is too large (${bytes.byteLength} bytes)`, {
      hint: `Maximum document size is ${LIMITS.maxDocumentBytes} bytes.`,
    });
  }
  return { bytes, filename: candidate.name || null, contentType: candidate.type || null };
}

function mapUpstreamFailure(status: number, url: string): never {
  if (status === 404) throw notFound(`The target URL returned HTTP 404 (nothing to fetch at ${url})`);
  if (status === 401 || status === 403) throw upstreamError(`The target URL refused access (HTTP ${status})`);
  throw upstreamError(`The target URL returned HTTP ${status}`);
}

function filenameFromUrl(input: string): string | null {
  try {
    const url = new URL(input);
    const segments = url.pathname.split("/").filter((segment) => segment.length > 0);
    const last = segments[segments.length - 1];
    return last ? decodeURIComponent(last).slice(0, 200) : null;
  } catch {
    return null;
  }
}

async function fetchDocument(url: string, kind: DocumentKind): Promise<UploadedFile> {
  const accept =
    kind === "pdf"
      ? "application/pdf,application/octet-stream;q=0.9,*/*;q=0.5"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/zip,application/octet-stream;q=0.9,*/*;q=0.5";
  const response = await fetchPublicUrl(url, { timeoutMs: LIMITS.fetchTimeoutMs, headers: { accept } });
  if (!response.ok) mapUpstreamFailure(response.status, url);
  const { bytes } = await readBytesLimited(response, LIMITS.maxDocumentBytes);
  return { bytes, filename: filenameFromUrl(url), contentType: response.headers.get("content-type") };
}

/**
 * Resolves the document a request carries: a multipart "file" part, a base64
 * field or a url. Enforces the 8 MB cap and the format signature before any
 * parser runs.
 */
export async function readBinaryDocument(
  request: RequestFacade,
  body: DocumentJsonBody | null | undefined,
  kind: DocumentKind,
): Promise<BinaryDocumentInput> {
  const contentType = request.header("content-type");
  if (isMultipartContentType(contentType)) {
    const file = await readMultipartUpload(request);
    assertSignature(file.bytes, kind);
    return {
      bytes: file.bytes,
      source: "file",
      filename: file.filename,
      contentType: file.contentType,
      fileSizeBytes: file.bytes.byteLength,
    };
  }
  if (!isJsonContentType(contentType)) {
    throw new ApiError(415, ErrorCode.UNSUPPORTED_MEDIA, `Unsupported content type: ${mediaType(contentType) || "(none)"}`, {
      hint: 'Send application/json with a "url" or "base64" field, or multipart/form-data with a "file" part.',
    });
  }
  assertDeclaredLength(request, LIMITS.maxDocumentBodyBytes);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const base64 = typeof body?.base64 === "string" ? body.base64 : "";
  if (url && base64) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Provide exactly one of url or base64", {
      hint: "Send a single source per request so the payload size stays predictable.",
    });
  }
  if (base64) {
    const bytes = decodeBase64Capped(base64, LIMITS.maxDocumentBytes);
    assertSignature(bytes, kind);
    return { bytes, source: "base64", filename: null, contentType: null, fileSizeBytes: bytes.byteLength };
  }
  if (url) {
    const file = await fetchDocument(url, kind);
    assertSignature(file.bytes, kind);
    return {
      bytes: file.bytes,
      source: "url",
      filename: file.filename,
      contentType: file.contentType,
      fileSizeBytes: file.bytes.byteLength,
    };
  }
  throw new ApiError(400, ErrorCode.INVALID_INPUT, "No document provided", {
    hint: 'Provide exactly one of: a multipart "file" part, a "base64" field, or a "url" field.',
  });
}

/**
 * Resolves HTML from either the `html` field (500,000 character cap) or a
 * fetched url (5 MB cap, HTML-ish content types only).
 */
export async function readHtmlDocument(
  request: RequestFacade,
  body: HtmlJsonBody | null | undefined,
): Promise<HtmlDocumentInput> {
  const contentType = request.header("content-type");
  if (!isJsonContentType(contentType)) {
    throw new ApiError(415, ErrorCode.UNSUPPORTED_MEDIA, `Unsupported content type: ${mediaType(contentType) || "(none)"}`, {
      hint: 'Send application/json with an "html" or "url" field.',
    });
  }
  assertDeclaredLength(request, LIMITS.maxHtmlBodyBytes);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const html = typeof body?.html === "string" ? body.html : "";
  if (url && html) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Provide exactly one of url or html", {
      hint: "Send either the markup or the page address, not both.",
    });
  }
  if (html) {
    if (html.length > LIMITS.maxHtmlJsonChars) {
      throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `The html field is too long (${html.length} characters)`, {
        hint: `Maximum is ${LIMITS.maxHtmlJsonChars} characters. Pass the page as a url instead.`,
      });
    }
    if (!looksLikeHtml(html)) {
      throw new ApiError(400, ErrorCode.INVALID_INPUT, "The html field does not look like HTML", {
        hint: 'Expected markup such as "<p>text</p>". Use the url field to fetch a page instead.',
      });
    }
    return { html, source: "html", url: null, inputTruncated: false };
  }
  if (url) {
    const response = await fetchPublicUrl(url, {
      timeoutMs: LIMITS.fetchTimeoutMs,
      headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.8,application/xml;q=0.5,*/*;q=0.2" },
    });
    if (!response.ok) mapUpstreamFailure(response.status, url);
    const type = mediaType(response.headers.get("content-type") ?? "");
    if (type && !/^(text\/html|application\/xhtml\+xml|text\/plain|text\/xml|application\/xml)$/.test(type)) {
      throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, `The URL returned ${type}, not HTML`, {
        hint: "Only HTML and XHTML pages can be converted. For documents use the PDF or DOCX endpoints.",
      });
    }
    const { text, truncated } = await readTextLimited(response, LIMITS.maxFetchedHtmlBytes);
    if (!text.trim()) {
      throw new ApiError(400, ErrorCode.INVALID_INPUT, "The URL returned an empty body");
    }
    return { html: text, source: "url", url: response.url || url, inputTruncated: truncated };
  }
  throw new ApiError(400, ErrorCode.INVALID_INPUT, "No HTML provided", {
    hint: 'Provide exactly one of: an "html" field with the markup, or a "url" field pointing at the page.',
  });
}
