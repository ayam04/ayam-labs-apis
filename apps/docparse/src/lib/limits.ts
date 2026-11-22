/**
 * Every hard cap the API enforces. Kept in one place so the limits returned by
 * GET /v1/formats and the limits the handlers actually apply cannot drift.
 */
export const LIMITS = {
  /** Largest accepted PDF or DOCX payload, after base64 decoding. */
  maxDocumentBytes: 8 * 1024 * 1024,
  /**
   * Maximum number of base64 characters accepted in a JSON body. Slightly above
   * the decoded 8 MB cap so an oversized payload fails with 413 from the byte
   * check instead of a generic validation error.
   */
  maxBase64Chars: 12_500_000,
  /** Request body cap for document endpoints (base64 of 8 MB plus JSON overhead). */
  maxDocumentBodyBytes: 12 * 1024 * 1024,
  /**
   * Pages extracted by /v1/pdf/text before the response is marked truncated.
   *
   * Bounded by measured CPU, not by taste: on a 775 KB, 16-page LaTeX PDF, pdf.js costs
   * roughly 30 ms of CPU per page (1 page 77-224 ms, 4 pages 188-223 ms, 8 pages 285-316 ms,
   * 16 pages 421-513 ms) and this deployment terminates requests around 500 ms of CPU
   * ("outcome": "exceededCpu"). Eight pages still failed intermittently under repetition, so
   * the cap is four, which measured 188-223 ms. Callers who need more pass explicit ranges to
   * /v1/pdf/pages.
   */
  maxPdfPages: 4,
  /** Pages a single /v1/pdf/pages call may select, same CPU budget as maxPdfPages. */
  maxSelectedPages: 4,
  /** Range tokens (comma separated chunks) accepted by /v1/pdf/pages. */
  maxPageRangeTokens: 64,
  /** Highest page number accepted in a range expression. */
  maxPageNumber: 10_000,
  /** Raw HTML accepted in a JSON body (characters). */
  maxHtmlJsonChars: 500_000,
  /** Request body cap for the HTML endpoints. */
  maxHtmlBodyBytes: 1_100_000,
  /** HTML fetched from a URL (bytes). */
  maxFetchedHtmlBytes: 5_000_000,
  /** Characters returned in a text or markdown response. */
  maxTextChars: 1_000_000,
  /** Links collected by /v1/html/text?includeLinks=true. */
  maxLinks: 200,
  /** URL length accepted for the "url" field. */
  maxUrlLength: 2048,
  /** Outbound fetch timeout for user supplied URLs. */
  fetchTimeoutMs: 12_000,
  /** Uncompressed size cap for word/document.xml inside a .docx. */
  maxDocxXmlBytes: 16 * 1024 * 1024,
  /** Paragraph blocks parsed from a .docx before truncation. */
  maxDocxBlocks: 20_000,
  /** Table rows parsed from a .docx table. */
  maxDocxRows: 2_000,
  /** Cells kept per .docx table row. */
  maxDocxCells: 64,
} as const;

export type Limits = typeof LIMITS;