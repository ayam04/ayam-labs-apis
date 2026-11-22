import { ApiError, ErrorCode } from "@api/core";
import { LIMITS } from "./limits";

export interface ParsedPageRanges {
  /** Pages in ascending order, duplicates removed. */
  pages: number[];
  /** Compact echo of the request, e.g. "1,3,5". */
  ranges: string;
  /** Number of comma separated tokens in the input. */
  tokens: number;
}

/**
 * Parses a page selection such as "1,3,5" (or "1-4", "2-4").
 * Rejects zero, negative, reversed, non numeric and oversized selections.
 */
export function parsePageRanges(
  input: string,
  options: { maxPages?: number; maxPageNumber?: number; maxTokens?: number } = {},
): ParsedPageRanges {
  const maxPages = options.maxPages ?? LIMITS.maxSelectedPages;
  const maxPageNumber = options.maxPageNumber ?? LIMITS.maxPageNumber;
  const maxTokens = options.maxTokens ?? LIMITS.maxPageRangeTokens;
  const trimmed = (input ?? "").trim();
  if (!trimmed) {
    throw new ApiError(400, ErrorCode.MISSING_PARAMETER, "Missing required parameter: pages", {
      hint: 'Pass a page selection such as ?pages=1,3,5.',
    });
  }
  // Whitespace inside a token is tolerated: "1, 3 , 5 - 7" is the same request.
  const tokens = trimmed.split(",").map((token) => token.replace(/\s+/g, ""));
  if (tokens.length > maxTokens) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, `Too many page tokens (${tokens.length})`, {
      hint: `Split the selection into batches of at most ${maxTokens} tokens.`,
    });
  }
  const selected = new Set<number>();
  for (const token of tokens) {
    if (!token) {
      throw new ApiError(400, ErrorCode.INVALID_INPUT, "Empty page token in the pages parameter", {
        hint: 'Use a comma separated list such as 1,3,5.',
      });
    }
    const single = /^(\d{1,5})$/.exec(token);
    if (single) {
      const page = Number(single[1]);
      validatePage(page, maxPageNumber, token);
      selected.add(page);
      continue;
    }
    const range = /^(\d{1,5})-(\d{1,5})$/.exec(token);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      validatePage(start, maxPageNumber, token);
      validatePage(end, maxPageNumber, token);
      if (end < start) {
        throw new ApiError(400, ErrorCode.INVALID_INPUT, `Reversed page range "${token}"`, {
          hint: "Write the smaller page number first, e.g. 5-7.",
        });
      }
      if (end - start + 1 > maxPages) {
        throw new ApiError(400, ErrorCode.INVALID_INPUT, `Page range "${token}" covers more than ${maxPages} pages`, {
          hint: `Request at most ${maxPages} pages per call.`,
        });
      }
      for (let page = start; page <= end; page += 1) selected.add(page);
      continue;
    }
    throw new ApiError(400, ErrorCode.INVALID_INPUT, `Invalid page selection "${token}"`, {
      hint: 'Pages must look like 4 or 5-7, separated by commas: ?pages=1,3,5.',
    });
  }
  const pages = [...selected].sort((a, b) => a - b);
  if (pages.length > maxPages) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, `Too many pages requested (${pages.length})`, {
      hint: `Request at most ${maxPages} pages per call.`,
    });
  }
  return { pages, ranges: formatPageRanges(pages), tokens: tokens.length };
}

function validatePage(page: number, maxPageNumber: number, token: string): void {
  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, `Invalid page number in "${token}"`, {
      hint: "Page numbers start at 1.",
    });
  }
  if (page > maxPageNumber) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, `Page number ${page} is above the supported maximum`, {
      hint: `The highest accepted page number is ${maxPageNumber}.`,
    });
  }
}

/** Renders page numbers as a compact range string: [1,2,3,5] -> "1-3,5". */
export function formatPageRanges(pages: number[]): string {
  if (pages.length === 0) return "";
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0] as number;
  let previous = start;
  for (let index = 1; index < sorted.length; index += 1) {
    const page = sorted[index] as number;
    if (page === previous + 1) {
      previous = page;
      continue;
    }
    parts.push(start === previous ? String(start) : `${start}-${previous}`);
    start = page;
    previous = page;
  }
  parts.push(start === previous ? String(start) : `${start}-${previous}`);
  return parts.join(",");
}

export interface PageSelection {
  /** Pages that exist in the document, ascending. */
  pages: number[];
  /** Requested pages beyond the end of the document. */
  outOfRange: number[];
}

/** Drops pages past the end of the document and reports them separately. */
export function buildPageSelection(pages: number[], totalPages: number): PageSelection {
  if (!Number.isInteger(totalPages) || totalPages < 0) {
    throw new ApiError(500, ErrorCode.INTERNAL_ERROR, "Document reported an invalid page count");
  }
  const selected: number[] = [];
  const outOfRange: number[] = [];
  for (const page of [...new Set(pages)].sort((a, b) => a - b)) {
    if (page >= 1 && page <= totalPages) selected.push(page);
    else outOfRange.push(page);
  }
  return { pages: selected, outOfRange };
}
