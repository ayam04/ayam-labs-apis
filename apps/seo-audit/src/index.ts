import { ApiError, ErrorCode, commonErrors, defineApi, jsonError } from "@api/core";
import { createRoute } from "@hono/zod-openapi";
import { config } from "./config";
import {
  AuditQuerySchema,
  AuditResponseSchema,
  KeywordsQuerySchema,
  KeywordsResponseSchema,
  LinksQuerySchema,
  LinksResponseSchema,
  MetaQuerySchema,
  MetaResponseSchema,
  ReadabilityQuerySchema,
  ReadabilityResponseSchema,
  RobotsQuerySchema,
  RobotsResponseSchema,
  SitemapQuerySchema,
  SitemapResponseSchema,
  TextAnalysisResponseSchema,
  TextBodySchema,
} from "./schemas";
import { runAudit, runKeywords, runLinks, runMetadata, runReadability, runRobots, runSitemap, runTextAnalysis } from "./lib/audit";

/* eslint-disable @typescript-eslint/no-explicit-any */
const jsonContent = (schema: any) => ({ "application/json": { schema } });

/**
 * Ten minute edge cache for audits of the same URL. Auditing is the expensive route here
 * (fetch plus parse), and the same URL is commonly audited repeatedly during a build.
 * Bodies are never stored: only the response JSON, keyed by the normalised URL.
 */
const AUDIT_TTL_SECONDS = 600;

async function cachedAudit(url: string): Promise<{ body: unknown; cached: boolean }> {
  const key = new Request("https://audit-cache.internal/" + encodeURIComponent(url));
  const cache = (globalThis as any).caches?.default as Cache | undefined;
  if (!cache) return { body: await runAudit(url), cached: false };

  const hit = await cache.match(key);
  if (hit) return { body: await hit.json(), cached: true };

  const body = await runAudit(url);
  const stored = new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "max-age=" + AUDIT_TTL_SECONDS },
  });
  await cache.put(key, stored);
  return { body, cached: false };
}

/** Same as the marketplace-wide JSON body limit. */
const MAX_JSON_BODY_BYTES = 512 * 1024;

const htmlErrors = {
  413: jsonError("Target document is larger than the size limit"),
  415: jsonError("Target is not an HTML document"),
};

const auditRoute = createRoute({
  method: "get",
  path: "/v1/audit",
  tags: ["Audit"],
  summary: "Run a full weighted on-page audit of one URL",
  description:
    "Fetches the page (10 s timeout, 2 MB cap, redirects followed through the SSRF-safe fetcher) and returns title and meta description with length warnings, canonical, robots directives, lang, charset, viewport, H1-H6 counts with the first three headings of each level, image and alt-text counts, internal vs external link counts, word count, text-to-HTML ratio, Flesch reading ease and grade, Open Graph and Twitter completeness, JSON-LD types, hreflang entries, HTTPS, compression, timings, and a 0-100 score from 14 weighted checks that always sum to 100. Pages that return 4xx/5xx are still parsed and the status is reported.",
  request: { query: AuditQuerySchema },
  responses: {
    200: { description: "Full audit report", content: jsonContent(AuditResponseSchema) },
    ...commonErrors,
    ...htmlErrors,
  },
});

const metaRoute = createRoute({
  method: "get",
  path: "/v1/meta",
  tags: ["Metadata"],
  summary: "Extract head metadata, social cards and structured data",
  description:
    "Returns only the document head: title, meta description, canonical, robots meta, lang, charset, viewport, theme-color, every og:* and twitter:* tag with a completeness summary, one parsed summary per JSON-LD block, favicon links and hreflang entries. The same 2 MB cap and 10 s timeout apply.",
  request: { query: MetaQuerySchema },
  responses: {
    200: { description: "Head metadata", content: jsonContent(MetaResponseSchema) },
    ...commonErrors,
    ...htmlErrors,
  },
});

const linksRoute = createRoute({
  method: "get",
  path: "/v1/links",
  tags: ["Links"],
  summary: "Extract every anchor and classify internal vs external",
  description:
    "Parses all <a href> elements, resolves them against the final URL and classifies each as internal (same registrable domain), external or other (mailto/tel/javascript). Returns total counts, rel attribute counts, an empty-anchor-text count and up to 500 links with their anchor text, rel list and target. The truncated flag is set when the page has more than 500 anchors.",
  request: { query: LinksQuerySchema },
  responses: {
    200: { description: "Anchor report", content: jsonContent(LinksResponseSchema) },
    ...commonErrors,
    ...htmlErrors,
  },
});

const keywordsRoute = createRoute({
  method: "get",
  path: "/v1/keywords",
  tags: ["Content"],
  summary: "Rank keywords and phrases with frequency and density",
  description:
    "Accepts either ?url= (visible text is extracted from the page) or ?text= (raw text, no network). Returns single words and two word phrases after stopword removal, each with occurrences, density percentage and an IDF-style importance score, plus density percentages for the top ten. The ranking uses a bundled frequency prior, not a live corpus.",
  request: { query: KeywordsQuerySchema },
  responses: {
    200: { description: "Keyword analysis", content: jsonContent(KeywordsResponseSchema) },
    ...commonErrors,
    ...htmlErrors,
  },
});

const readabilityRoute = createRoute({
  method: "get",
  path: "/v1/readability",
  tags: ["Content"],
  summary: "Score readability with Flesch, Flesch-Kincaid and Gunning Fog",
  description:
    "Accepts either ?url= or ?text=. Returns Flesch reading ease (0-100), Flesch-Kincaid grade, Gunning Fog index, word/sentence/paragraph/syllable counts, average words per sentence, the longest sentence with its position, and a passive-voice hint count. Syllables are counted heuristically, so treat grades as estimates.",
  request: { query: ReadabilityQuerySchema },
  responses: {
    200: { description: "Readability metrics", content: jsonContent(ReadabilityResponseSchema) },
    ...commonErrors,
    ...htmlErrors,
  },
});

const robotsRoute = createRoute({
  method: "get",
  path: "/v1/robots",
  tags: ["Crawling"],
  summary: "Fetch and parse a domain's robots.txt",
  description:
    "Fetches only <origin>/robots.txt and returns the user-agent groups with their allow/disallow rules and line numbers, crawl-delay, sitemap URLs, the non-standard Host value and any directives that were ignored. A missing file returns found=false with its status code instead of an error. Gzipped or HTML responses are reported, never parsed as rules.",
  request: { query: RobotsQuerySchema },
  responses: {
    200: { description: "Parsed robots.txt", content: jsonContent(RobotsResponseSchema) },
    ...commonErrors,
  },
});

const sitemapRoute = createRoute({
  method: "get",
  path: "/v1/sitemap",
  tags: ["Crawling"],
  summary: "Parse a sitemap or sitemap index",
  description:
    "Fetches one sitemap URL and parses it as an <urlset> (up to 500 URLs with lastmod, changefreq and priority), a <sitemapindex> (up to 200 child sitemaps) or a plain text URL list. It does not follow child sitemaps. Gzipped .xml.gz files are rejected with 415; pass the decompressed XML URL.",
  request: { query: SitemapQuerySchema },
  responses: {
    200: { description: "Parsed sitemap", content: jsonContent(SitemapResponseSchema) },
    ...commonErrors,
    415: jsonError("Sitemap is gzipped and cannot be parsed"),
  },
});

const textRoute = createRoute({
  method: "post",
  path: "/v1/text",
  tags: ["Content"],
  summary: "Run readability and keyword analysis on raw text",
  description:
    "No network call. Send up to 100,000 characters of text and receive the readability metrics and keyword ranking in one response. Larger payloads are rejected with 413, and JSON bodies above 512 KB are rejected before parsing.",
  request: { body: { content: jsonContent(TextBodySchema), required: true } },
  responses: {
    200: { description: "Combined text analysis", content: jsonContent(TextAnalysisResponseSchema) },
    ...commonErrors,
    413: jsonError("Text exceeds the 100,000 character limit"),
  },
});

const app = defineApi(config, (app) => {
  app.use("/v1/text", async (c, next) => {
    const declared = Number(c.req.header("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > MAX_JSON_BODY_BYTES) {
      throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, "Request body is larger than 512 KB", {
        hint: "Send at most 100,000 characters of text.",
      });
    }
    await next();
  });

  app.openapi(auditRoute, async (c) => {
    const { url } = c.req.valid("query");
    const { body, cached } = await cachedAudit(url);
    c.header("x-cache", cached ? "hit" : "miss");
    return c.json(body, 200);
  });

  app.openapi(metaRoute, async (c) => {
    const { url } = c.req.valid("query");
    return c.json(await runMetadata(url), 200);
  });

  app.openapi(linksRoute, async (c) => {
    const { url } = c.req.valid("query");
    return c.json(await runLinks(url), 200);
  });

  app.openapi(keywordsRoute, async (c) => {
    const { url, text, limit } = c.req.valid("query");
    return c.json(await runKeywords({ url, text, limit }), 200);
  });

  app.openapi(readabilityRoute, async (c) => {
    const { url, text } = c.req.valid("query");
    return c.json(await runReadability({ url, text }), 200);
  });

  app.openapi(robotsRoute, async (c) => {
    const { domain } = c.req.valid("query");
    return c.json(await runRobots(domain), 200);
  });

  app.openapi(sitemapRoute, async (c) => {
    const { url } = c.req.valid("query");
    return c.json(await runSitemap(url), 200);
  });

  app.openapi(textRoute, async (c) => {
    const { text, limit } = c.req.valid("json");
    return c.json(runTextAnalysis(text, limit), 200);
  });
});

export default app;
