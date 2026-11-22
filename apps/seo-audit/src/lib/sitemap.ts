/**
 * sitemap.xml parser (urlset and sitemapindex), plus plain-text sitemaps.
 *
 * Workers have no DOMParser, so this is a bounded regex scan over the already
 * size-capped body. It handles CDATA, entities and namespace prefixes, and caps
 * every list it returns.
 */

import { decodeEntities } from "./entities";

export const MAX_SITEMAP_URLS = 500;
export const MAX_CHILD_SITEMAPS = 200;

export interface SitemapUrlEntry {
  loc: string;
  lastModified: string | null;
  changeFrequency: string | null;
  priority: number | null;
}

export interface SitemapChildEntry {
  loc: string;
  lastModified: string | null;
}

export interface SitemapParseResult {
  isIndex: boolean;
  format: "xml" | "text" | "unknown";
  urls: SitemapUrlEntry[];
  sitemaps: SitemapChildEntry[];
  totalLocCount: number;
  truncatedUrls: boolean;
  truncatedSitemaps: boolean;
}

/** Reads the text of the first matching child tag, handling CDATA. */
function readTag(block: string, tag: string): string | null {
  const pattern = new RegExp("<(?:" + tag + "|\\w+:" + tag + ")\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?" + tag + "\\s*>", "i");
  const match = pattern.exec(block);
  if (!match) return null;
  let value = (match[1] ?? "").trim();
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(value);
  if (cdata && cdata[1] !== undefined) value = cdata[1].trim();
  value = decodeEntities(value);
  return value.length > 0 ? value.slice(0, 2000) : null;
}

function countMatches(input: string, pattern: RegExp): number {
  const matches = input.match(pattern);
  return matches ? matches.length : 0;
}

function parsePriority(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

function emptyResult(): SitemapParseResult {
  return {
    isIndex: false,
    format: "unknown",
    urls: [],
    sitemaps: [],
    totalLocCount: 0,
    truncatedUrls: false,
    truncatedSitemaps: false,
  };
}

/** Parses an XML or plain-text sitemap. Never throws. */
export function parseSitemap(rawBody: string): SitemapParseResult {
  const body = String(rawBody ?? "").replace(/^\ufeff/, "").trim();
  const result = emptyResult();
  if (body.length === 0) return result;

  const isXmlIndex = /<sitemapindex[\s>]/i.test(body);
  const isXmlUrlset = /<urlset[\s>]/i.test(body);
  const hasUrlBlocks = /<url[\s>]/i.test(body);
  const hasSitemapBlocks = /<sitemap[\s>]/i.test(body);

  if (isXmlIndex || (hasSitemapBlocks && !isXmlUrlset && !hasUrlBlocks)) {
    result.format = "xml";
    result.isIndex = true;
    const pattern = /<sitemap\b[\s\S]*?<\/sitemap\s*>/gi;
    let match = pattern.exec(body);
    while (match !== null) {
      const block = match[0];
      const loc = readTag(block, "loc");
      if (loc !== null) {
        if (result.sitemaps.length < MAX_CHILD_SITEMAPS) {
          result.sitemaps.push({ loc, lastModified: readTag(block, "lastmod") });
        } else {
          result.truncatedSitemaps = true;
        }
        result.totalLocCount += 1;
      }
      match = pattern.exec(body);
    }
    return result;
  }

  if (isXmlUrlset || hasUrlBlocks) {
    result.format = "xml";
    const pattern = /<url\b[\s\S]*?<\/url\s*>/gi;
    let match = pattern.exec(body);
    while (match !== null) {
      const block = match[0];
      const loc = readTag(block, "loc");
      if (loc !== null) {
        if (result.urls.length < MAX_SITEMAP_URLS) {
          result.urls.push({
            loc,
            lastModified: readTag(block, "lastmod"),
            changeFrequency: readTag(block, "changefreq"),
            priority: parsePriority(readTag(block, "priority")),
          });
        } else {
          result.truncatedUrls = true;
        }
        result.totalLocCount += 1;
      }
      match = pattern.exec(body);
    }
    return result;
  }

  // Plain text sitemap: one absolute URL per line.
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const urlish = lines.filter((line) => /^https?:\/\//i.test(line));
  if (urlish.length > 0 && !body.includes("<")) {
    result.format = "text";
    result.totalLocCount = urlish.length;
    for (const line of urlish) {
      if (result.urls.length < MAX_SITEMAP_URLS) result.urls.push({ loc: line.slice(0, 2000), lastModified: null, changeFrequency: null, priority: null });
      else result.truncatedUrls = true;
    }
    return result;
  }

  // Unknown shape: still report how many <loc> entries the file claims to have.
  result.totalLocCount = countMatches(body, /<loc[\s>]/gi);
  return result;
}
