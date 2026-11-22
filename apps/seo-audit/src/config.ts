import type { ApiConfig } from "@api/core";

export const config: ApiConfig = {
  name: "seo-audit",
  title: "SEO Audit API",
  version: "1.0.0",
  summary: "On-page SEO audits in one call: metadata, headings, links, keywords, readability and a transparent 0-100 score.",
  description: [
    "Audit the HTML of a single public page and get back everything an SEO review needs, without a headless browser.",
    "",
    "**What one call returns:** status and timing for the fetch, the final URL after redirects, title and meta description with length warnings, canonical, robots directives, lang, charset, viewport, H1-H6 counts with the first three headings of each level, image and alt-text counts, internal vs external link counts, word count, text-to-HTML ratio, Flesch reading ease and grade level, Open Graph and Twitter card completeness, JSON-LD types, hreflang entries, HTTPS, response compression, and a 0-100 score built from 14 weighted checks whose weights sum to exactly 100.",
    "",
    "**Other endpoints:** head metadata only, every anchor with rel attributes, keyword frequency with density, readability on its own, robots.txt parsing and sitemap.xml parsing. POST /v1/text runs the readability and keyword analysis on text you already have, with no network call.",
    "",
    "**Honest scope:** this API audits a single public page's HTML. It does not crawl a whole site, does not render JavaScript (so client-side injected tags are invisible to it), and does not measure Core Web Vitals, Lighthouse metrics or real-user performance. Word and syllable statistics target Latin-script languages; CJK word segmentation is not implemented.",
    "",
    "**Built for:** SEO agencies doing first-pass page reviews, SaaS products embedding a site audit feature, growth marketers checking metadata before a launch.",
  ].join("\n"),
  baseUrl: "https://seo-audit.ayamk.in",
  tags: [
    { name: "Audit", description: "Full weighted on-page audit of one URL" },
    { name: "Metadata", description: "Head tags: title, description, canonical, social cards, structured data" },
    { name: "Links", description: "Anchor extraction and internal/external classification" },
    { name: "Content", description: "Keyword frequency and readability for a URL or raw text" },
    { name: "Crawling", description: "robots.txt and sitemap.xml inspection" },
  ],
  termsOfService: "https://example.com/terms",
  directRateLimitPerMinute: 60,
};