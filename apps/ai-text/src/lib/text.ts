/**
 * Text utilities shared by every endpoint.
 *
 * Everything here is pure and dependency free so it also runs under vitest in
 * Node (no Workers runtime APIs).
 */

/** Hard cap for deterministic endpoints (keywords, entities, sentiment, language, readability). */
export const MAX_TEXT_DETERMINISTIC = 100_000;
/** Hard cap for AI endpoints (summarize, rewrite, classify). */
export const MAX_TEXT_AI = 12_000;
/** Hard cap for AI translation, which is the most expensive call. */
export const MAX_TEXT_TRANSLATE = 2_000;
/** Query strings cannot carry 100k characters in practice; GET variants stop at this. */
export const MAX_TEXT_QUERY = 8_000;

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const WORD_RE = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*/gu;

/** Normalises line endings, strips zero width characters and trims both ends. */
export function normalizeText(input: string): string {
  return input.replace(/\r\n?/g, "\n").replace(ZERO_WIDTH, "").trim();
}

/**
 * Lowercases and splits into word tokens (letters, digits, inner apostrophes).
 * CJK text without spaces becomes one long run of characters; see the docs note.
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();
  for (const match of lower.matchAll(WORD_RE)) tokens.push(match[0]);
  return tokens;
}

/** Word count using the same tokenizer as the keyword and readability code. */
export function countWords(text: string): number {
  return tokenize(text).length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Rounds to a fixed number of decimals without emitting -0. */
export function round(value: number, digits = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Sentence splitter. Splits on . ! ? and ellipses followed by whitespace or the
 * end of the text, and keeps a small list of common abbreviations (Dr., e.g.,
 * etc.) from ending a sentence. Abbreviations outside that list still split.
 */
const ABBREVIATIONS = new Set([
  "mr.",
  "mrs.",
  "ms.",
  "dr.",
  "prof.",
  "sr.",
  "jr.",
  "st.",
  "vs.",
  "etc.",
  "e.g.",
  "i.e.",
  "inc.",
  "ltd.",
  "co.",
  "no.",
  "fig.",
  "approx.",
  "dept.",
  "est.",
  "al.",
]);

function endsWithAbbreviation(before: string): boolean {
  const match = /([\p{L}.]+)$/u.exec(before);
  if (!match) return false;
  return ABBREVIATIONS.has(match[1].toLowerCase() + ".");
}

export function splitSentences(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const sentences: string[] = [];
  for (const block of normalized.split(/\n+/)) {
    const line = block.trim();
    if (!line) continue;
    let start = 0;
    const terminator = /[.!?\u2026]+(?=\s|$)/gu;
    let match: RegExpExecArray | null = terminator.exec(line);
    while (match !== null) {
      const end = match.index + match[0].length;
      const before = line.slice(0, match.index);
      if (!endsWithAbbreviation(before)) {
        const piece = line.slice(start, end).trim();
        if (piece) sentences.push(piece);
        start = end;
      }
      match = terminator.exec(line);
    }
    const tail = line.slice(start).trim();
    if (tail) sentences.push(tail);
  }
  return sentences;
}

/** Truncates a string and appends an ellipsis marker when it was cut. */
export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) return { text, truncated: false };
  return { text: text.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "\u2026", truncated: true };
}

/** Collapses runs of whitespace into single spaces (used for model output). */
export function collapseWhitespace(text: string): string {
  return text.replace(/[ \t\f\v]+/g, " ").replace(/ *\n */g, "\n").trim();
}

/** Counts characters, words and sentences in one pass for response meta. */
export function textStats(text: string): { characters: number; words: number; sentences: number } {
  return {
    characters: text.length,
    words: countWords(text),
    sentences: splitSentences(text).length,
  };
}
