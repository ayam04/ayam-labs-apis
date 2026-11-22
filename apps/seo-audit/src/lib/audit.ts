import { ApiError, ErrorCode } from "@api/core";
import type {
  AuditResponse,
  Favicon,
  HreflangEntry,
  JsonLdAudit,
  JsonLdBlock,
  KeywordsResponse,
  LinksResponse,
  MetaResponse,
  OpenGraph,
  ReadabilityResponse,
  RobotsResponse,
  SitemapResponse,
  TextAnalysisResponse,
  TwitterCard,
} from "../schemas";
import {
  collectAuditFacts,
  collectLinkFacts,
  collectMetaFacts,
  HEADING_LEVELS,
  type LinkRecord,
  type MetaRecord,
} from "./rewrite";
import { analysisTextFor, analyzeReadability, byteLength, MAX_TEXT_CHARS, roundTo } from "./text";
import { collapseWhitespace, countParagraphs, extractJsonLdBlocks, extractVisibleText } from "./html";
import { parseRobotsMeta, summarizeJsonLdBlock } from "./meta";
import { analyzeKeywords, DEFAULT_KEYWORD_LIMIT, MAX_KEYWORD_LIMIT } from "./keywords";
import { evaluateAudit } from "./scoring";
import { fetchDocument, HTML_ACCEPT, HTML_MAX_BYTES, PLAIN_TEXT_ACCEPT, ROBOTS_MAX_BYTES, SITEMAP_MAX_BYTES, XML_ACCEPT } from "./http";
import { getRegistrableDomain, isSameRegistrableDomain, normalizeDomainInput, normalizeUrlInput } from "./urls";
import { parseRobots } from "./robots";
import { parseSitemap } from "./sitemap";

const MAX_LIST_FAVICONS = 20;
const MAX_LIST_HREFLANG = 200;
const MAX_JSON_LD_TYPES = 20;

interface MetaIndex {
  og: Map<string, string>;
  twitter: Map<string, string>;
  named: Map<string, string>;
}

function indexMetas(metas: MetaRecord[]): MetaIndex {
  const og = new Map<string, string>();
  const twitter = new Map<string, string>();
  const named = new Map<string, string>();
  for (const meta of metas) {
    const rawKey = (meta.property ?? meta.name ?? "").trim().toLowerCase();
    if (rawKey.length === 0) continue;
    const value = meta.content ?? "";
    if (rawKey.startsWith("og:")) {
      if (!og.has(rawKey)) og.set(rawKey, value);
    } else if (rawKey.startsWith("twitter:")) {
      if (!twitter.has(rawKey)) twitter.set(rawKey, value);
    } else if (meta.name !== null && !named.has(rawKey)) {
      named.set(rawKey, value);
    }
  }
  return { og, twitter, named };
}

function metaValue(source: Map<string, string>, key: string, maxChars: number): string | null {
  const value = source.get(key);
  if (value === undefined) return null;
  const normalized = collapseWhitespace(value);
  if (normalized.length === 0) return null;
  return normalized.slice(0, maxChars);
}

function resolveAbsolute(href: string, base: string): string | null {
  try {
    const url = new URL(href, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function firstLinkHref(links: LinkRecord[], relName: string): string | null {
  for (const link of links) {
    if (link.rel.includes(relName) && link.href !== null && link.href.length > 0) return link.href;
  }
  return null;
}

function findCharset(metas: MetaRecord[], contentType: string | null): string | null {
  for (const meta of metas) {
    const value = meta.charset;
    if (value !== null && value.trim().length > 0) return value.trim().toLowerCase().slice(0, 40);
  }
  for (const meta of metas) {
    const equiv = (meta.httpEquiv ?? "").toLowerCase();
    if (equiv === "content-type") {
      const match = /charset\s*=\s*["']?([\w-]+)/i.exec(meta.content ?? "");
      if (match && match[1]) return match[1].toLowerCase();
    }
  }
  if (contentType !== null) {
    const match = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType);
    if (match && match[1]) return match[1].toLowerCase();
  }
  return null;
}

function isSameSite(canonical: string, pageUrl: string): boolean {
  try {
    const target = new URL(canonical, pageUrl);
    if (target.protocol !== "http:" && target.protocol !== "https:") return false;
    return isSameRegistrableDomain(target.hostname, new URL(pageUrl).hostname);
  } catch {
    return false;
  }
}

export function buildOpenGraph(source: Map<string, string>): OpenGraph {
  const title = metaValue(source, "og:title", 500);
  const description = metaValue(source, "og:description", 2000);
  const image = metaValue(source, "og:image", 2048);
  const url = metaValue(source, "og:url", 2048);
  const type = metaValue(source, "og:type", 100);
  const imageAlt = metaValue(source, "og:image:alt", 500);
  const siteName = metaValue(source, "og:site_name", 200);
  const locale = metaValue(source, "og:locale", 40);

  const missing: string[] = [];
  if (title === null) missing.push("og:title");
  if (description === null) missing.push("og:description");
  if (image === null) missing.push("og:image");
  if (url === null) missing.push("og:url");
  if (type === null) missing.push("og:type");

  return { title, description, image, imageAlt, url, type, siteName, locale, missing, complete: missing.length === 0 };
}

export function buildTwitterCard(source: Map<string, string>): TwitterCard {
  const card = metaValue(source, "twitter:card", 60);
  const title = metaValue(source, "twitter:title", 500);
  const description = metaValue(source, "twitter:description", 2000);
  const image = metaValue(source, "twitter:image", 2048);
  const site = metaValue(source, "twitter:site", 100);
  const creator = metaValue(source, "twitter:creator", 100);

  const missing: string[] = [];
  if (card === null) missing.push("twitter:card");
  if (title === null) missing.push("twitter:title");
  if (description === null) missing.push("twitter:description");
  if (image === null) missing.push("twitter:image");

  return { card, title, description, image, site, creator, missing, complete: missing.length === 0 };
}

export function buildJsonLdAudit(html: string): JsonLdAudit {
  const blocks = extractJsonLdBlocks(html);
  const items: JsonLdBlock[] = [];
  const types: string[] = [];
  let validBlocks = 0;
  for (const block of blocks) {
    const summary = summarizeJsonLdBlock(block);
    if (summary.valid) validBlocks += 1;
    for (const type of summary.types) {
      if (!types.includes(type) && types.length < MAX_JSON_LD_TYPES) types.push(type);
    }
    items.push(summary);
  }
  return { blocks: blocks.length, validBlocks, invalidBlocks: blocks.length - validBlocks, types, items };
}

export function buildHreflang(links: LinkRecord[], pageUrl: string): HreflangEntry[] {
  const entries: HreflangEntry[] = [];
  for (const link of links) {
    if (entries.length >= MAX_LIST_HREFLANG) break;
    if (!link.rel.includes("alternate") || link.hreflang === null || link.href === null) continue;
    entries.push({ hreflang: link.hreflang.slice(0, 35), href: resolveAbsolute(link.href, pageUrl) ?? link.href });
  }
  return entries;
}

export function buildFavicons(links: LinkRecord[], pageUrl: string): Favicon[] {
  const icons: Favicon[] = [];
  for (const link of links) {
    if (icons.length >= MAX_LIST_FAVICONS) break;
    const rel = link.rel.join(" ");
    if (link.href === null || !(rel.includes("icon"))) continue;
    icons.push({
      href: link.href,
      url: resolveAbsolute(link.href, pageUrl),
      rel: rel.length > 0 ? rel : null,
      sizes: link.sizes,
      type: link.type,
    });
  }
  return icons;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return DEFAULT_KEYWORD_LIMIT;
  return Math.max(1, Math.min(MAX_KEYWORD_LIMIT, Math.trunc(limit)));
}

interface TextSource {
  source: "url" | "text";
  url: string | null;
  finalUrl: string | null;
  statusCode: number | null;
  htmlBytes: number | null;
  truncated: boolean;
  text: string;
}

async function resolveTextSource(input: { url?: string | undefined; text?: string | undefined }): Promise<TextSource> {
  const hasUrl = typeof input.url === "string" && input.url.trim().length > 0;
  const hasText = typeof input.text === "string" && input.text.length > 0;

  if (hasUrl && hasText) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Send either url or text, not both", {
      hint: "Use ?url=https://example.com/page for a live page, or ?text=... for text you already have.",
      details: ["both url and text were provided"],
    });
  }
  if (!hasUrl && !hasText) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "One of url or text is required", {
      hint: "Use ?url=https://example.com/page or ?text=your+content",
    });
  }

  if (hasText) {
    const text = input.text as string;
    return {
      source: "text",
      url: null,
      finalUrl: null,
      statusCode: null,
      htmlBytes: null,
      truncated: text.length > MAX_TEXT_CHARS,
      text: analysisTextFor(text),
    };
  }

  const url = normalizeUrlInput(input.url as string);
  const document = await fetchDocument(url, { accept: HTML_ACCEPT, maxBytes: HTML_MAX_BYTES, requireHtml: true });
  const visible = extractVisibleText(document.body);
  return {
    source: "url",
    url: url.toString(),
    finalUrl: document.finalUrl,
    statusCode: document.statusCode,
    htmlBytes: document.bodyBytes,
    truncated: document.truncated || visible.length > MAX_TEXT_CHARS,
    text: analysisTextFor(visible),
  };
}

/** GET /v1/audit */
export async function runAudit(rawUrl: string): Promise<AuditResponse> {
  const started = Date.now();
  const url = normalizeUrlInput(rawUrl);
  const document = await fetchDocument(url, { accept: HTML_ACCEPT, maxBytes: HTML_MAX_BYTES, requireHtml: true });
  const parseStarted = Date.now();

  const facts = await collectAuditFacts(document.body, document.finalUrl);
  const visibleText = extractVisibleText(document.body);
  const readability = analyzeReadability(analysisTextFor(visibleText), {
    paragraphCount: countParagraphs(document.body) || undefined,
  });
  const htmlBytes = byteLength(document.body);
  const textBytes = byteLength(visibleText);

  const { og, twitter, named } = indexMetas(facts.metas);
  const robots = parseRobotsMeta(named.get("robots") ?? named.get("googlebot") ?? null);

  const canonicalHref = firstLinkHref(facts.links, "canonical");
  const canonical = canonicalHref === null ? null : (resolveAbsolute(canonicalHref, document.finalUrl) ?? canonicalHref.slice(0, 2048));
  const charset = findCharset(facts.metas, document.contentType);
  const viewport = metaValue(named, "viewport", 500);
  const themeColor = metaValue(named, "theme-color", 100);
  const description = metaValue(named, "description", 2000);
  const title = facts.title;

  const jsonLd = buildJsonLdAudit(document.body);
  const openGraph = buildOpenGraph(og);
  const twitterCard = buildTwitterCard(twitter);
  const hreflang = buildHreflang(facts.links, document.finalUrl);

  const headingCounts = facts.headings.counts;
  const headingTotal = HEADING_LEVELS.reduce((sum, level) => sum + headingCounts[level], 0);
  const missingAltPercent = facts.imageCount === 0 ? 0 : roundTo((facts.imagesMissingAlt / facts.imageCount) * 100, 1);

  const score = evaluateAudit({
    https: document.https,
    title,
    metaDescription: description,
    canonical,
    canonicalSameSite: canonical !== null && isSameSite(canonical, document.finalUrl),
    lang: facts.lang,
    headingCounts,
    imageCount: facts.imageCount,
    imagesMissingAlt: facts.imagesMissingAlt,
    internalLinks: facts.anchors.internal,
    jsonLdBlocks: jsonLd.blocks,
    jsonLdValidBlocks: jsonLd.validBlocks,
    jsonLdTypes: jsonLd.types.length,
    openGraph: { title: openGraph.title !== null, description: openGraph.description !== null, image: openGraph.image !== null },
    twitter: { card: twitterCard.card !== null, title: twitterCard.title !== null, description: twitterCard.description !== null },
    viewport: viewport !== null,
    charset: charset !== null,
  });

  return {
    requestedUrl: url.toString(),
    finalUrl: document.finalUrl,
    redirected: document.redirected,
    redirectChainLength: document.redirectChainLength,
    statusCode: document.statusCode,
    https: document.https,
    contentType: document.contentType,
    contentEncoding: document.contentEncoding,
    bodyBytes: document.bodyBytes,
    truncated: document.truncated || visibleText.length > MAX_TEXT_CHARS,
    timings: { fetchMs: document.fetchMs, parseMs: Date.now() - parseStarted, totalMs: Date.now() - started },
    page: {
      title,
      titleLength: title === null ? 0 : title.length,
      titleTooLong: title !== null && title.length > 60,
      metaDescription: description,
      metaDescriptionLength: description === null ? 0 : description.length,
      metaDescriptionTooLong: description !== null && description.length > 160,
      canonical,
      robots,
      lang: facts.lang,
      charset,
      viewport,
      themeColor,
      metaTagCount: facts.metaTagCount,
      linkTagCount: facts.linkTagCount,
    },
    headings: { counts: headingCounts, total: headingTotal, texts: facts.headings.texts },
    images: { total: facts.imageCount, missingAlt: facts.imagesMissingAlt, emptyAlt: facts.imagesEmptyAlt, missingAltPercent },
    links: {
      total: facts.anchors.total,
      internal: facts.anchors.internal,
      external: facts.anchors.external,
      other: facts.anchors.other,
      nofollow: facts.anchors.nofollow,
      sponsored: facts.anchors.sponsored,
      ugc: facts.anchors.ugc,
      emptyAnchorText: facts.anchors.emptyText,
    },
    content: {
      wordCount: readability.wordCount,
      sentenceCount: readability.sentenceCount,
      paragraphCount: readability.paragraphCount,
      htmlBytes,
      textBytes,
      textToHtmlRatioPercent: htmlBytes > 0 ? roundTo((textBytes / htmlBytes) * 100, 1) : 0,
    },
    readability,
    openGraph,
    twitter: twitterCard,
    jsonLd,
    hreflang,
    score,
  };
}

/** GET /v1/meta */
export async function runMetadata(rawUrl: string): Promise<MetaResponse> {
  const started = Date.now();
  const url = normalizeUrlInput(rawUrl);
  const document = await fetchDocument(url, { accept: HTML_ACCEPT, maxBytes: HTML_MAX_BYTES, requireHtml: true });
  const facts = await collectMetaFacts(document.body);

  const { og, twitter, named } = indexMetas(facts.metas);
  const robots = parseRobotsMeta(named.get("robots") ?? named.get("googlebot") ?? null);
  const canonicalHref = firstLinkHref(facts.links, "canonical");
  const canonical = canonicalHref === null ? null : (resolveAbsolute(canonicalHref, document.finalUrl) ?? canonicalHref.slice(0, 2048));
  const description = metaValue(named, "description", 2000);

  return {
    requestedUrl: url.toString(),
    finalUrl: document.finalUrl,
    statusCode: document.statusCode,
    https: document.https,
    contentType: document.contentType,
    bodyBytes: document.bodyBytes,
    title: facts.title,
    titleLength: facts.title === null ? 0 : facts.title.length,
    metaDescription: description,
    metaDescriptionLength: description === null ? 0 : description.length,
    canonical,
    robots,
    lang: facts.lang,
    charset: findCharset(facts.metas, document.contentType),
    viewport: metaValue(named, "viewport", 500),
    themeColor: metaValue(named, "theme-color", 100),
    openGraph: buildOpenGraph(og),
    twitter: buildTwitterCard(twitter),
    jsonLd: buildJsonLdAudit(document.body),
    favicons: buildFavicons(facts.links, document.finalUrl),
    hreflang: buildHreflang(facts.links, document.finalUrl),
    metaTagCount: facts.metaTagCount,
    linkTagCount: facts.linkTagCount,
    durationMs: Date.now() - started,
  };
}

/** GET /v1/links */
export async function runLinks(rawUrl: string): Promise<LinksResponse> {
  const started = Date.now();
  const url = normalizeUrlInput(rawUrl);
  const document = await fetchDocument(url, { accept: HTML_ACCEPT, maxBytes: HTML_MAX_BYTES, requireHtml: true });
  const facts = await collectLinkFacts(document.body, document.finalUrl);

  let siteHost = "";
  try {
    siteHost = new URL(document.finalUrl).hostname;
  } catch {
    siteHost = "";
  }

  return {
    requestedUrl: url.toString(),
    finalUrl: document.finalUrl,
    statusCode: document.statusCode,
    siteHost,
    registrableDomain: getRegistrableDomain(siteHost),
    total: facts.total,
    internal: facts.internal,
    external: facts.external,
    other: facts.other,
    nofollow: facts.nofollow,
    sponsored: facts.sponsored,
    ugc: facts.ugc,
    emptyAnchorText: facts.emptyText,
    returned: facts.links.length,
    truncated: facts.total > facts.links.length,
    relCounts: facts.relCounts,
    links: facts.links,
    durationMs: Date.now() - started,
  };
}

/** GET /v1/keywords */
export async function runKeywords(input: { url?: string | undefined; text?: string | undefined; limit?: number | undefined }): Promise<KeywordsResponse> {
  const started = Date.now();
  const source = await resolveTextSource(input);
  const analysis = analyzeKeywords(source.text, clampLimit(input.limit));
  return {
    source: source.source,
    url: source.url,
    finalUrl: source.finalUrl,
    statusCode: source.statusCode,
    htmlBytes: source.htmlBytes,
    truncated: source.truncated,
    analysis,
    durationMs: Date.now() - started,
  };
}

/** GET /v1/readability */
export async function runReadability(input: { url?: string | undefined; text?: string | undefined }): Promise<ReadabilityResponse> {
  const started = Date.now();
  const source = await resolveTextSource(input);
  const readability = analyzeReadability(source.text);
  return {
    source: source.source,
    url: source.url,
    finalUrl: source.finalUrl,
    statusCode: source.statusCode,
    htmlBytes: source.htmlBytes,
    truncated: source.truncated,
    readability,
    durationMs: Date.now() - started,
  };
}

/** POST /v1/text */
export function runTextAnalysis(rawText: string, limit?: number | undefined): TextAnalysisResponse {
  const started = Date.now();
  const text = String(rawText ?? "");
  if (text.trim().length === 0) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "text must not be blank", {
      hint: "Send at least one word of text in the request body.",
    });
  }
  if (text.length > MAX_TEXT_CHARS) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, "text is longer than " + MAX_TEXT_CHARS + " characters", {
      hint: "Split the document and analyse it in chunks of 100,000 characters or fewer.",
      details: { length: text.length, limit: MAX_TEXT_CHARS },
    });
  }
  const readability = analyzeReadability(text);
  const keywords = analyzeKeywords(text, clampLimit(limit));
  return {
    charCount: text.length,
    wordCount: readability.wordCount,
    truncated: false,
    readability,
    keywords,
    durationMs: Date.now() - started,
  };
}

/** GET /v1/robots */
export async function runRobots(rawDomain: string): Promise<RobotsResponse> {
  const started = Date.now();
  const domain = normalizeDomainInput(rawDomain);
  const robotsUrl = new URL("/robots.txt", domain.origin);
  const document = await fetchDocument(robotsUrl, { accept: PLAIN_TEXT_ACCEPT, maxBytes: ROBOTS_MAX_BYTES, requireHtml: false });

  const head = document.body.slice(0, 2000).toLowerCase();
  const looksLikeHtml = head.includes("<html") || head.includes("<!doctype html");
  const found = document.statusCode === 200 && document.body.trim().length > 0 && !looksLikeHtml;

  const parsed = parseRobots(found ? document.body : "");
  const lineCount = found ? parsed.lineCount : 0;

  return {
    domain: domain.hostname,
    origin: domain.origin,
    robotsUrl: robotsUrl.toString(),
    statusCode: document.statusCode,
    found,
    https: domain.https,
    contentType: document.contentType,
    bytes: document.bodyBytes,
    groupCount: parsed.groups.length,
    ruleCount: parsed.ruleCount,
    groups: parsed.groups,
    sitemaps: parsed.sitemaps,
    host: parsed.host,
    unknownDirectives: parsed.unknownDirectives,
    lineCount,
    truncated: parsed.truncated,
    looksLikeHtml,
    durationMs: Date.now() - started,
  };
}

/** GET /v1/sitemap */
export async function runSitemap(rawUrl: string): Promise<SitemapResponse> {
  const started = Date.now();
  const url = normalizeUrlInput(rawUrl);
  const document = await fetchDocument(url, { accept: XML_ACCEPT, maxBytes: SITEMAP_MAX_BYTES, requireHtml: false });

  const contentType = (document.contentType ?? "").toLowerCase();
  const looksGzipped =
    contentType.includes("gzip") ||
    /\.gz(?:$|\?)/i.test(document.finalUrl) ||
    document.body.charCodeAt(0) === 0x1f;

  if (looksGzipped) {
    throw new ApiError(415, ErrorCode.UNSUPPORTED_MEDIA, "Gzipped sitemaps are not supported", {
      hint: "Pass the URL of a decompressed sitemap .xml file.",
      details: { contentType: document.contentType, statusCode: document.statusCode },
    });
  }

  const parsed = parseSitemap(document.body);
  return {
    url: url.toString(),
    finalUrl: document.finalUrl,
    statusCode: document.statusCode,
    https: document.https,
    contentType: document.contentType,
    bytes: document.bodyBytes,
    isIndex: parsed.isIndex,
    format: parsed.format,
    sitemapCount: parsed.sitemaps.length,
    urlCount: parsed.urls.length,
    totalEntries: parsed.totalLocCount,
    sitemaps: parsed.sitemaps,
    urls: parsed.urls,
    truncatedUrls: parsed.truncatedUrls,
    truncatedSitemaps: parsed.truncatedSitemaps,
    durationMs: Date.now() - started,
  };
}
