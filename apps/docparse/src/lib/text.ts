/* Dash and quote variants that PDF generators, Word and web pages emit. */
const DASHES = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63]/g;
const SINGLE_QUOTES = /[\u2018\u2019\u201A\u201B\u2032\uFF07]/g;
const DOUBLE_QUOTES = /[\u201C\u201D\u201E\u201F\u2033\uFF02]/g;
const NO_BREAK_SPACES = /[\u00A0\u1680\u2000-\u2006\u2007\u202F\u205F\u3000]/g;
const ZERO_WIDTH = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Normalises text that came out of a PDF, DOCX or HTML page: line endings,
 * unicode dashes/quotes/spaces, control characters and zero width joiners.
 * Pure function, no runtime dependencies.
 */
export function normalizeUnicode(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS, " ")
    .replace(NO_BREAK_SPACES, " ")
    .replace(ZERO_WIDTH, "")
    .replace(DASHES, "-")
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00AD/g, "")
    .replace(/\t/g, " ");
}

/** Removes trailing spaces and tabs on every line. */
export function trimTrailingSpaces(input: string): string {
  return input.replace(/[ \t]+$/gm, "");
}

/** Collapses runs of three or more newlines to a single blank line. */
export function collapseBlankLines(input: string): string {
  return input.replace(/\n{3,}/g, "\n\n");
}

/** Collapses runs of spaces (but never newlines) to a single space. */
export function collapseSpaces(input: string): string {
  return input.replace(/[^\S\n]+/g, " ");
}

/** Removes leading indentation from every line. */
export function stripLineIndent(input: string): string {
  return input.replace(/^[ \t]+/gm, "");
}

/**
 * Full clean-up pipeline: unicode normalisation, space folding, trailing space
 * removal, blank line collapsing and edge trimming. Paragraph breaks are kept
 * and leading indentation is left alone so structured output (nested list
 * items, tables) keeps its shape.
 */
export function cleanText(input: string): string {
  if (!input) return "";
  return collapseBlankLines(trimTrailingSpaces(collapseSpaces(normalizeUnicode(input)))).trim();
}

/**
 * Clean-up for flat prose (PDF pages, readable HTML) where leading indentation
 * is extraction noise rather than structure.
 */
export function cleanDocumentText(input: string): string {
  if (!input) return "";
  return stripLineIndent(cleanText(input));
}

/** Word count that treats `don't` and `state-of-the-art` as single words. */
export function countWords(input: string): number {
  if (!input) return 0;
  const matches = input.match(/[\p{L}\p{N}][\p{L}\p{N}'_\-]*/gu);
  return matches ? matches.length : 0;
}

/** Truncates on a word boundary and reports whether anything was dropped. */
export function truncateText(input: string, maxChars: number): { text: string; truncated: boolean } {
  if (maxChars <= 0) return { text: "", truncated: input.length > 0 };
  if (input.length <= maxChars) return { text: input, truncated: false };
  const slice = input.slice(0, maxChars);
  const boundary = slice.lastIndexOf(" ");
  const text = (boundary > maxChars * 0.6 ? slice.slice(0, boundary) : slice).trimEnd();
  return { text, truncated: true };
}

/**
 * Picks a byline-ish opening paragraph: the first block of 40-600 characters
 * with at least six words. Falls back to the first shorter paragraph, and
 * finally to the first line. Returns null for empty input.
 */
export function firstByline(input: string, maxChars = 400): string | null {
  if (!input) return null;
  const blocks = input.split(/\n\s*\n/);
  for (const block of blocks) {
    const line = collapseSpaces(block).trim();
    if (line.length >= 40 && line.length <= 600 && countWords(line) >= 6) {
      return truncateText(line, maxChars).text;
    }
  }
  for (const block of blocks) {
    const line = collapseSpaces(block).trim();
    if (line.length >= 20 && countWords(line) >= 3) return truncateText(line, maxChars).text;
  }
  const firstLine = collapseSpaces(input.split("\n")[0] ?? "").trim();
  return firstLine ? truncateText(firstLine, maxChars).text : null;
}

/** Normalises a string for comparison: lowercase, collapsed whitespace. */
export function normalizeForMatch(input: string): string {
  return collapseSpaces(normalizeUnicode(input)).trim().toLowerCase();
}

