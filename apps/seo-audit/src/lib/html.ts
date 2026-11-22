/**
 * Pure HTML helpers: entity decoding, visible-text extraction, heading capture
 * and JSON-LD block scanning. These run over the already size-capped body and do
 * not depend on the Worker runtime, so they are fully unit tested.
 */

import { collapseWhitespace, decodeEntities } from "./entities";

export { collapseWhitespace, decodeEntities };

const RAW_TEXT_ELEMENTS = "script|style|noscript|template|svg|iframe|object|canvas|head";
const BLOCK_ELEMENTS = "p|div|section|article|header|footer|main|aside|li|tr|h[1-6]|blockquote|figure|figcaption|pre|td|th|dd|dt|form|nav";

/** Removes comments, raw-text element bodies and tags, returning readable text. */
export function extractVisibleText(rawHtml: string): string {
  let value = String(rawHtml ?? "");
  value = value.replace(/<!--[\s\S]*?-->/g, " ");
  value = value.replace(new RegExp("<title\\b[^>]*>[\\s\\S]*?</title\\s*>", "gi"), " ");
  value = value.replace(new RegExp("<(" + RAW_TEXT_ELEMENTS + ")\\b[^>]*>[\\s\\S]*?</\\1\\s*>", "gi"), " ");
  value = value.replace(new RegExp("<(" + RAW_TEXT_ELEMENTS + ")\\b[^>]*/?>", "gi"), " ");
  value = value.replace(new RegExp("<\\/(" + BLOCK_ELEMENTS + ")\\s*>", "gi"), "\n");
  value = value.replace(/<br\s*\/?>/gi, "\n");
  value = value.replace(/<[^>]*>/g, " ");
  value = decodeEntities(value);
  value = value.replace(/\r\n?/g, "\n");
  value = value.replace(/[ \t\f\v\u00a0\u200b\ufeff]+/g, " ");
  value = value.replace(/ *\n */g, "\n");
  value = value.replace(/\n{3,}/g, "\n\n");
  return value.trim();
}

export interface HeadingEntry {
  level: number;
  text: string;
}

/** Hard cap so a pathological document cannot produce an unbounded array. */
export const MAX_HEADINGS = 500;
export const MAX_JSON_LD_BLOCKS = 20;

/** Extracts h1..h6 entries in document order (regex scan; text is flattened). */
export function extractHeadings(rawHtml: string): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const pattern = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
  let match = pattern.exec(rawHtml);
  while (match !== null && headings.length < MAX_HEADINGS) {
    const level = Number(match[1]);
    const inner = match[2] ?? "";
    const text = collapseWhitespace(decodeEntities(inner.replace(/<[^>]*>/g, " ")));
    headings.push({ level, text: text.slice(0, 300) });
    match = pattern.exec(rawHtml);
  }
  return headings;
}

/** Returns the raw JSON text of every script[type="application/ld+json"] block. */
export function extractJsonLdBlocks(rawHtml: string): string[] {
  const blocks: string[] = [];
  const pattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match = pattern.exec(rawHtml);
  while (match !== null && blocks.length < MAX_JSON_LD_BLOCKS) {
    const attributes = match[1] ?? "";
    if (/type\s*=\s*["']?\s*application\/ld\+json/i.test(attributes)) {
      const body = (match[2] ?? "").trim();
      if (body.length > 0) blocks.push(body.length > 100_000 ? body.slice(0, 100_000) : body);
    }
    match = pattern.exec(rawHtml);
  }
  return blocks;
}

/** Counts block-level elements; used as the paragraph count for HTML sources. */
export function countParagraphs(rawHtml: string): number {
  const matches = rawHtml.match(/<p\b[^>]*>/gi);
  return matches ? matches.length : 0;
}
