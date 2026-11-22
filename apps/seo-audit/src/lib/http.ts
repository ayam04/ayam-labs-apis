import { ApiError, ErrorCode, readTextLimited, safeFetch, upstreamError } from "@api/core";

/**
 * Outbound fetch wrapper around @api/core safeFetch (SSRF checks on every
 * redirect hop). Adds the product limits: 10 s timeout, body cap, content-type
 * policy and the fields the audit reports (final URL, compression, timing).
 */

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 5;
export const HTML_MAX_BYTES = 2_000_000;
export const ROBOTS_MAX_BYTES = 512_000;
export const SITEMAP_MAX_BYTES = 5_000_000;

export const HTML_ACCEPT = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1";
export const PLAIN_TEXT_ACCEPT = "text/plain,text/*;q=0.9,*/*;q=0.1";
export const XML_ACCEPT = "application/xml,text/xml,text/plain;q=0.9,*/*;q=0.1";

export interface FetchedDocument {
  requestedUrl: string;
  finalUrl: string;
  redirected: boolean;
  redirectChainLength: number;
  statusCode: number;
  contentType: string | null;
  contentEncoding: string | null;
  bodyBytes: number;
  truncated: boolean;
  fetchMs: number;
  body: string;
  https: boolean;
}

export interface FetchOptions {
  /** Accept header sent to the origin. */
  accept: string;
  /** Hard cap on bytes read from the body. */
  maxBytes: number;
  /** Reject non-HTML responses with 415 (used by the HTML endpoints). */
  requireHtml: boolean;
}

/** True for text/html and application/xhtml+xml (a missing type is treated as HTML). */
export function isHtmlContentType(contentType: string | null): boolean {
  if (contentType === null) return true;
  const lower = contentType.toLowerCase();
  return lower.includes("text/html") || lower.includes("application/xhtml+xml");
}

function looksLikeHtml(body: string): boolean {
  const head = body.slice(0, 4000).toLowerCase();
  return (
    head.includes("<!doctype") ||
    head.includes("<html") ||
    head.includes("<head") ||
    head.includes("<body") ||
    head.includes("<meta") ||
    head.includes("<title") ||
    head.includes("<div") ||
    head.includes("<p") ||
    head.includes("<a ")
  );
}

/**
 * GETs a user supplied URL through safeFetch and reads the body under a byte cap.
 * Throws ApiError for blocked targets, timeouts, oversized bodies and (when
 * requireHtml) non-HTML content types.
 */
export async function fetchDocument(target: URL, options: FetchOptions): Promise<FetchedDocument> {
  const requestedUrl = target.toString();
  const started = Date.now();

  let response: Response;
  try {
    response = await safeFetch(target, {
      timeoutMs: FETCH_TIMEOUT_MS,
      maxRedirects: MAX_REDIRECTS,
      headers: { accept: options.accept },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw upstreamError("Could not reach the target URL");
  }

  const fetchMs = Date.now() - started;
  const finalUrl = response.url && response.url.length > 0 ? response.url : requestedUrl;
  const contentType = response.headers.get("content-type");
  const contentEncoding = response.headers.get("content-encoding");

  if (options.requireHtml && !isHtmlContentType(contentType)) {
    throw new ApiError(415, ErrorCode.UNSUPPORTED_MEDIA, "The target did not return an HTML document", {
      hint: "These endpoints only parse HTML pages. Use /v1/sitemap for XML or /v1/robots for robots.txt.",
      details: { contentType: contentType ?? "missing", statusCode: response.status },
    });
  }

  let read: { text: string; truncated: boolean; bytes: number };
  try {
    read = await readTextLimited(response, options.maxBytes);
  } catch (error) {
    if (error instanceof ApiError && error.status === 413) {
      throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, "The response body is larger than the " + options.maxBytes + " byte limit", {
        hint: "Audit a lighter page, or use POST /v1/text with the text you already have.",
        details: { limitBytes: options.maxBytes },
      });
    }
    throw error;
  }

  if (options.requireHtml && !looksLikeHtml(read.text)) {
    throw new ApiError(415, ErrorCode.UNSUPPORTED_MEDIA, "The response body does not look like HTML", {
      hint: "The target returned a non-HTML body (an image, a PDF or an empty response).",
      details: { contentType: contentType ?? "missing", statusCode: response.status, bytes: read.bytes },
    });
  }

  const redirected = finalUrl !== requestedUrl;
  return {
    requestedUrl,
    finalUrl,
    redirected,
    redirectChainLength: redirected ? 1 : 0,
    statusCode: response.status,
    contentType,
    contentEncoding,
    bodyBytes: read.bytes,
    truncated: read.truncated,
    fetchMs,
    body: read.text,
    https: finalUrl.startsWith("https:"),
  };
}
