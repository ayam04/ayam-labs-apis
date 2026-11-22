import { z } from "@api/core";

/**
 * Every request and response shape for the SEO Audit API. Request fields carry a
 * description and example; response objects are named so /openapi.json renders
 * reusable components instead of anonymous blobs.
 */

/* ------------------------------------------------------------------ *
 * Shared building blocks
 * ------------------------------------------------------------------ */

export const CheckStatusSchema = z.enum(["pass", "warn", "fail"]).openapi({
  description: "Outcome of one weighted check: pass earns the full weight, warn half (rounded up), fail nothing.",
  example: "pass",
});

export const AuditCheckSchema = z
  .object({
    id: z.string().openapi({ description: "Stable check identifier, safe to switch on.", example: "title" }),
    label: z.string().openapi({ description: "Human readable check name.", example: "Title tag" }),
    status: CheckStatusSchema,
    weight: z.number().int().openapi({ description: "Maximum points this check can contribute. All weights sum to 100.", example: 15 }),
    points: z.number().int().openapi({ description: "Points actually earned for this page.", example: 15 }),
    message: z.string().openapi({ description: "What was found, in one sentence.", example: "Title is 42 characters, inside the 15-60 range." }),
  })
  .openapi("AuditCheck");

export const AuditScoreSchema = z
  .object({
    value: z.number().int().min(0).max(100).openapi({ description: "Weighted on-page score from 0 to 100.", example: 78 }),
    grade: z.enum(["A", "B", "C", "D", "F"]).openapi({ description: "Letter grade derived from value: A >= 90, B >= 80, C >= 70, D >= 60, F below.", example: "C" }),
    passed: z.number().int().openapi({ description: "Number of checks that passed.", example: 9 }),
    warned: z.number().int().openapi({ description: "Number of checks that produced a warning.", example: 3 }),
    failed: z.number().int().openapi({ description: "Number of checks that failed.", example: 2 }),
    checks: z.array(AuditCheckSchema).openapi({ description: "Every check with its weight, status and message. Weights always sum to 100." }),
  })
  .openapi("AuditScore");

export const ReadingLevelSchema = z
  .enum(["very easy", "easy", "fairly easy", "standard", "fairly difficult", "difficult", "very difficult", "insufficient text"])
  .openapi({ description: "Flesch reading-ease band.", example: "standard" });

export const LongestSentenceSchema = z
  .object({
    text: z.string().openapi({ description: "The longest sentence, truncated to 300 characters.", example: "The shop opened in 1998 and has sold..." }),
    wordCount: z.number().int().openapi({ description: "Words in that sentence.", example: 41 }),
    index: z.number().int().openapi({ description: "Zero based position of the sentence in the document.", example: 12 }),
  })
  .openapi("LongestSentence");

export const ReadabilityMetricsSchema = z
  .object({
    wordCount: z.number().int().openapi({ description: "Words found in the analysed text.", example: 812 }),
    sentenceCount: z.number().int().openapi({ description: "Sentences found. Line breaks always end a sentence.", example: 48 }),
    paragraphCount: z.number().int().openapi({ description: "Paragraphs: block elements for HTML, blank-line blocks for raw text.", example: 11 }),
    syllableCount: z.number().int().openapi({ description: "Estimated syllables across all words (heuristic vowel-group count).", example: 1310 }),
    complexWordCount: z.number().int().openapi({ description: "Words with three or more syllables that do not end in -ed, -es, -ing or -ly (Gunning-Fog input).", example: 121 }),
    charCount: z.number().int().openapi({ description: "Characters in the analysed text.", example: 4620 }),
    avgWordsPerSentence: z.number().openapi({ description: "Average words per sentence.", example: 16.92 }),
    avgSyllablesPerWord: z.number().openapi({ description: "Average syllables per word.", example: 1.61 }),
    fleschReadingEase: z.number().openapi({ description: "Flesch Reading Ease, clamped to 0-100. Higher is easier to read.", example: 62.4 }),
    fleschKincaidGrade: z.number().openapi({ description: "Flesch-Kincaid grade level, floored at 0. Approximate US school grade.", example: 8.2 }),
    gunningFogIndex: z.number().openapi({ description: "Gunning Fog index, floored at 0. Years of formal education needed.", example: 10.1 }),
    readingLevel: ReadingLevelSchema,
    longestSentence: LongestSentenceSchema,
    passiveVoiceHints: z.number().int().openapi({ description: "Sentences matching a be-verb plus participle pattern. A hint, not grammatical analysis.", example: 4 }),
    passiveVoiceRatePer100Sentences: z.number().openapi({ description: "Passive hints per 100 sentences.", example: 8.3 }),
  })
  .openapi("ReadabilityMetrics");

export const KeywordTermSchema = z
  .object({
    term: z.string().openapi({ description: "Lowercased term. One or two words.", example: "keyword research" }),
    wordCount: z.union([z.literal(1), z.literal(2)]).openapi({ description: "1 for a single word, 2 for a two word phrase.", example: 2 }),
    count: z.number().int().openapi({ description: "Occurrences in the analysed text.", example: 7 }),
    densityPercent: z.number().openapi({ description: "Occurrences as a percentage of all words.", example: 0.86 }),
    score: z.number().openapi({ description: "count x IDF-style weight. Used only for ranking inside this response.", example: 36.4 }),
    importance: z.number().int().min(0).max(100).openapi({ description: "Score relative to the top term, 0-100.", example: 100 }),
  })
  .openapi("KeywordTerm");

export const DensityEntrySchema = z
  .object({
    term: z.string().openapi({ example: "keyword research" }),
    count: z.number().int().openapi({ example: 7 }),
    densityPercent: z.number().openapi({ example: 0.86 }),
  })
  .openapi("KeywordDensity");

export const KeywordAnalysisSchema = z
  .object({
    totalWords: z.number().int().openapi({ description: "All word tokens, including stopwords and short words.", example: 812 }),
    uniqueWords: z.number().int().openapi({ description: "Distinct tokens after lowercasing.", example: 301 }),
    stopwordCount: z.number().int().openapi({ description: "Tokens removed as stopwords or site-chrome words.", example: 344 }),
    stopwordRatePercent: z.number().openapi({ description: "Share of tokens that were stopwords.", example: 42.4 }),
    termCount: z.number().int().openapi({ description: "Distinct scored terms (unigrams plus bigrams) before the limit is applied.", example: 214 }),
    unigramCount: z.number().int().openapi({ description: "Distinct single word terms.", example: 158 }),
    bigramCount: z.number().int().openapi({ description: "Distinct two word phrases.", example: 56 }),
    terms: z.array(KeywordTermSchema).max(100).openapi({ description: "Ranked terms, capped by the limit parameter." }),
    densityTop10: z.array(DensityEntrySchema).max(10).openapi({ description: "Density percentages for the top ten terms." }),
  })
  .openapi("KeywordAnalysis");

export const OpenGraphSchema = z
  .object({
    title: z.string().nullable().openapi({ example: "Acme Analytics - product analytics without the setup" }),
    description: z.string().nullable().openapi({ example: "Track activation, retention and revenue in one place." }),
    image: z.string().nullable().openapi({ example: "https://acme.example/og.png" }),
    imageAlt: z.string().nullable().openapi({ example: "Acme dashboard screenshot" }),
    url: z.string().nullable().openapi({ example: "https://acme.example/" }),
    type: z.string().nullable().openapi({ example: "website" }),
    siteName: z.string().nullable().openapi({ example: "Acme Analytics" }),
    locale: z.string().nullable().openapi({ example: "en_US" }),
    missing: z.array(z.string()).openapi({ description: "Recommended og: fields that are absent.", example: ["og:image"] }),
    complete: z.boolean().openapi({ description: "True when og:title, og:description, og:image, og:url and og:type are all present.", example: false }),
  })
  .openapi("OpenGraph");

export const TwitterCardSchema = z
  .object({
    card: z.string().nullable().openapi({ example: "summary_large_image" }),
    title: z.string().nullable().openapi({ example: "Acme Analytics" }),
    description: z.string().nullable().openapi({ example: "Track activation, retention and revenue in one place." }),
    image: z.string().nullable().openapi({ example: "https://acme.example/twitter.png" }),
    site: z.string().nullable().openapi({ example: "@acme" }),
    creator: z.string().nullable().openapi({ example: "@acmehq" }),
    missing: z.array(z.string()).openapi({ description: "Recommended twitter: fields that are absent.", example: ["twitter:image"] }),
    complete: z.boolean().openapi({ description: "True when twitter:card, twitter:title, twitter:description and twitter:image are all present.", example: false }),
  })
  .openapi("TwitterCard");

export const RobotsMetaSchema = z
  .object({
    raw: z.string().nullable().openapi({ description: "Raw content of the robots meta tag.", example: "index, follow, max-snippet:-1" }),
    index: z.boolean().openapi({ description: "False when a noindex/none directive is present.", example: true }),
    follow: z.boolean().openapi({ description: "False when a nofollow/none directive is present.", example: true }),
    directives: z.array(z.string()).openapi({ description: "Lowercased directives as written.", example: ["index", "follow", "max-snippet:-1"] }),
  })
  .openapi("RobotsMeta");

export const JsonLdSummarySchema = z
  .object({
    type: z.string().nullable().openapi({ example: "Product" }),
    name: z.string().nullable().openapi({ example: "Acme Pro plan" }),
    headline: z.string().nullable().openapi({ example: null }),
    description: z.string().nullable().openapi({ example: "Everything in Starter, plus SSO." }),
    url: z.string().nullable().openapi({ example: "https://acme.example/pro" }),
    author: z.string().nullable().openapi({ example: null }),
    datePublished: z.string().nullable().openapi({ example: null }),
  })
  .openapi("JsonLdSummary");

export const JsonLdBlockSchema = z
  .object({
    valid: z.boolean().openapi({ description: "Whether the block parsed as JSON.", example: true }),
    types: z.array(z.string()).openapi({ description: "Every @type found, including inside @graph.", example: ["Article", "BreadcrumbList"] }),
    keys: z.array(z.string()).openapi({ description: "Top level property names, @context excluded, capped at 25.", example: ["@type", "headline", "author"] }),
    summary: JsonLdSummarySchema,
    error: z.string().nullable().openapi({ description: "Why the block could not be parsed, when valid is false.", example: null }),
  })
  .openapi("JsonLdBlock");

export const JsonLdAuditSchema = z
  .object({
    blocks: z.number().int().openapi({ description: "Number of script[type=application/ld+json] blocks found.", example: 2 }),
    validBlocks: z.number().int().openapi({ description: "Blocks that parsed as JSON.", example: 2 }),
    invalidBlocks: z.number().int().openapi({ description: "Blocks that did not parse.", example: 0 }),
    types: z.array(z.string()).openapi({ description: "Distinct schema.org types found across all blocks, capped at 20.", example: ["Article", "BreadcrumbList"] }),
    items: z.array(JsonLdBlockSchema).max(20).openapi({ description: "Per block details, capped at 20 blocks." }),
  })
  .openapi("JsonLdAudit");

export const HreflangEntrySchema = z
  .object({
    hreflang: z.string().openapi({ example: "de-DE" }),
    href: z.string().openapi({ example: "https://acme.example/de/" }),
  })
  .openapi("HreflangEntry");

export const FaviconSchema = z
  .object({
    href: z.string().openapi({ description: "href exactly as written.", example: "/favicon-32.png" }),
    url: z.string().nullable().openapi({ description: "Resolved absolute URL.", example: "https://acme.example/favicon-32.png" }),
    rel: z.string().nullable().openapi({ example: "icon" }),
    sizes: z.string().nullable().openapi({ example: "32x32" }),
    type: z.string().nullable().openapi({ example: "image/png" }),
  })
  .openapi("Favicon");

export const HeadingCountsSchema = z
  .object({
    h1: z.number().int().openapi({ example: 1 }),
    h2: z.number().int().openapi({ example: 6 }),
    h3: z.number().int().openapi({ example: 9 }),
    h4: z.number().int().openapi({ example: 0 }),
    h5: z.number().int().openapi({ example: 0 }),
    h6: z.number().int().openapi({ example: 0 }),
  })
  .openapi("HeadingCounts");

export const HeadingTextsSchema = z
  .object({
    h1: z.array(z.string()).max(3).openapi({ example: ["Acme Analytics"] }),
    h2: z.array(z.string()).max(3).openapi({ example: ["Why teams switch", "How pricing works", "FAQ"] }),
    h3: z.array(z.string()).max(3).openapi({ example: ["Built for product teams"] }),
    h4: z.array(z.string()).max(3).openapi({ example: [] }),
    h5: z.array(z.string()).max(3).openapi({ example: [] }),
    h6: z.array(z.string()).max(3).openapi({ example: [] }),
  })
  .openapi("HeadingTexts");

/* ------------------------------------------------------------------ *
 * Endpoint payloads
 * ------------------------------------------------------------------ */

export const AuditResponseSchema = z
  .object({
    requestedUrl: z.string().openapi({ description: "Normalised URL that was requested.", example: "https://acme.example/pricing" }),
    finalUrl: z.string().openapi({ description: "URL of the response actually parsed, after redirects.", example: "https://acme.example/pricing/" }),
    redirected: z.boolean().openapi({ description: "True when the final URL differs from the requested URL.", example: false }),
    redirectChainLength: z
      .number()
      .int()
      .openapi({ description: "0 for a direct hit, 1 when at least one redirect was followed. The runtime exposes only the final URL, so a multi hop chain is reported as 1.", example: 0 }),
    statusCode: z.number().int().openapi({ description: "HTTP status of the final response. Pages are still parsed when the origin returns 4xx/5xx.", example: 200 }),
    https: z.boolean().openapi({ description: "Whether the page was served over HTTPS.", example: true }),
    contentType: z.string().nullable().openapi({ description: "Content-Type reported by the origin.", example: "text/html; charset=utf-8" }),
    contentEncoding: z.string().nullable().openapi({ description: "Content-Encoding reported by the origin, when present.", example: "gzip" }),
    bodyBytes: z.number().int().openapi({ description: "Bytes read from the body, after decompression.", example: 48213 }),
    truncated: z.boolean().openapi({ description: "True when the page exceeded the 2 MB audit cap and was cut off.", example: false }),
    timings: z
      .object({
        fetchMs: z.number().int().openapi({ description: "Time to receive response headers.", example: 214 }),
        parseMs: z.number().int().openapi({ description: "Time spent parsing and scoring the body.", example: 31 }),
        totalMs: z.number().int().openapi({ description: "End to end handler time.", example: 249 }),
      })
      .openapi("AuditTimings"),
    page: z
      .object({
        title: z.string().nullable().openapi({ example: "Pricing - Acme Analytics" }),
        titleLength: z.number().int().openapi({ description: "Characters in the normalised title, 0 when absent.", example: 27 }),
        titleTooLong: z.boolean().openapi({ description: "True when the title exceeds 60 characters.", example: false }),
        metaDescription: z.string().nullable().openapi({ example: "Simple usage based pricing for product teams." }),
        metaDescriptionLength: z.number().int().openapi({ example: 47 }),
        metaDescriptionTooLong: z.boolean().openapi({ description: "True when the description exceeds 160 characters.", example: false }),
        canonical: z.string().nullable().openapi({ example: "https://acme.example/pricing" }),
        robots: RobotsMetaSchema,
        lang: z.string().nullable().openapi({ example: "en" }),
        charset: z.string().nullable().openapi({ description: "Declared character encoding, from meta charset or Content-Type.", example: "utf-8" }),
        viewport: z.string().nullable().openapi({ description: "Raw viewport meta content.", example: "width=device-width, initial-scale=1" }),
        themeColor: z.string().nullable().openapi({ example: "#0f172a" }),
        metaTagCount: z.number().int(), 
        linkTagCount: z.number().int(),
      })
      .openapi("AuditPage"),
    headings: z
      .object({
        counts: HeadingCountsSchema,
        total: z.number().int().openapi({ description: "Total h1-h6 elements.", example: 16 }),
        texts: HeadingTextsSchema,
      })
      .openapi("AuditHeadings"),
    images: z
      .object({
        total: z.number().int().openapi({ example: 12 }),
        missingAlt: z.number().int().openapi({ description: "Images with no alt attribute at all.", example: 2 }),
        emptyAlt: z.number().int().openapi({ description: "Images with an empty alt attribute (treated as decorative).", example: 3 }),
        missingAltPercent: z.number().openapi({ example: 16.7 }),
      })
      .openapi("AuditImages"),
    links: z
      .object({
        total: z.number().int().openapi({ example: 64 }),
        internal: z.number().int().openapi({ example: 41 }),
        external: z.number().int().openapi({ example: 19 }),
        other: z.number().int().openapi({ description: "mailto:, tel:, javascript: and other non-http hrefs.", example: 4 }),
        nofollow: z.number().int().openapi({ example: 5 }),
        sponsored: z.number().int().openapi({ example: 0 }),
        ugc: z.number().int().openapi({ example: 0 }),
        emptyAnchorText: z.number().int().openapi({ description: "Anchors whose visible text is empty.", example: 3 }),
      })
      .openapi("AuditLinks"),
    content: z
      .object({
        wordCount: z.number().int().openapi({ example: 812 }),
        sentenceCount: z.number().int().openapi({ example: 48 }),
        paragraphCount: z.number().int().openapi({ example: 11 }),
        htmlBytes: z.number().int().openapi({ description: "UTF-8 bytes of the HTML body.", example: 48213 }),
        textBytes: z.number().int().openapi({ description: "UTF-8 bytes of the visible text.", example: 5120 }),
        textToHtmlRatioPercent: z.number().openapi({ description: "Visible text bytes as a percentage of HTML bytes.", example: 10.6 }),
      })
      .openapi("AuditContent"),
    readability: ReadabilityMetricsSchema,
    openGraph: OpenGraphSchema,
    twitter: TwitterCardSchema,
    jsonLd: JsonLdAuditSchema,
    hreflang: z.array(HreflangEntrySchema).max(200).openapi({ description: "link rel=alternate hreflang entries, capped at 200." }),
    score: AuditScoreSchema,
  })
  .openapi("AuditResponse");

export const MetaResponseSchema = z
  .object({
    requestedUrl: z.string().openapi({ example: "https://acme.example/pricing" }),
    finalUrl: z.string().openapi({ example: "https://acme.example/pricing" }),
    statusCode: z.number().int().openapi({ example: 200 }),
    https: z.boolean().openapi({ example: true }),
    contentType: z.string().nullable().openapi({ example: "text/html; charset=utf-8" }),
    bodyBytes: z.number().int().openapi({ example: 48213 }),
    title: z.string().nullable().openapi({ example: "Pricing - Acme Analytics" }),
    titleLength: z.number().int().openapi({ example: 27 }),
    metaDescription: z.string().nullable().openapi({ example: "Simple usage based pricing for product teams." }),
    metaDescriptionLength: z.number().int().openapi({ example: 47 }),
    canonical: z.string().nullable().openapi({ example: "https://acme.example/pricing" }),
    robots: RobotsMetaSchema,
    lang: z.string().nullable().openapi({ example: "en" }),
    charset: z.string().nullable().openapi({ example: "utf-8" }),
    viewport: z.string().nullable().openapi({ example: "width=device-width, initial-scale=1" }),
    themeColor: z.string().nullable().openapi({ example: "#0f172a" }),
    openGraph: OpenGraphSchema,
    twitter: TwitterCardSchema,
    jsonLd: JsonLdAuditSchema,
    favicons: z.array(FaviconSchema).max(20).openapi({ description: "icon, shortcut icon and apple-touch-icon links, capped at 20." }),
    hreflang: z.array(HreflangEntrySchema).max(200),
    metaTagCount: z.number().int().openapi({ example: 21 }),
    linkTagCount: z.number().int().openapi({ example: 14 }),
    durationMs: z.number().int().openapi({ example: 231 }),
  })
  .openapi("MetaResponse");

export const LinkTypeSchema = z.enum(["internal", "external", "other"]).openapi({
  description: "internal = same registrable domain, external = different registrable domain, other = mailto/tel/javascript/non-http.",
  example: "internal",
});

export const LinkEntrySchema = z
  .object({
    href: z.string().openapi({ description: "href exactly as written in the document, trimmed.", example: "/pricing" }),
    url: z.string().nullable().openapi({ description: "Absolute URL after resolution, null for non-http schemes.", example: "https://acme.example/pricing" }),
    type: LinkTypeSchema,
    text: z.string().openapi({ description: "Visible anchor text, whitespace collapsed, capped at 300 characters.", example: "See pricing" }),
    rel: z.array(z.string()).openapi({ example: ["nofollow", "noopener"] }),
    target: z.string().nullable().openapi({ example: "_blank" }),
    nofollow: z.boolean().openapi({ example: false }),
  })
  .openapi("LinkEntry");

export const LinksResponseSchema = z
  .object({
    requestedUrl: z.string().openapi({ example: "https://acme.example/" }),
    finalUrl: z.string().openapi({ example: "https://acme.example/" }),
    statusCode: z.number().int().openapi({ example: 200 }),
    siteHost: z.string().openapi({ description: "Hostname of the audited page.", example: "acme.example" }),
    registrableDomain: z.string().openapi({ description: "Registrable domain used for internal/external classification.", example: "acme.example" }),
    total: z.number().int().openapi({ description: "Every anchor counted, including those beyond the list cap.", example: 64 }),
    internal: z.number().int().openapi({ example: 41 }),
    external: z.number().int().openapi({ example: 19 }),
    other: z.number().int().openapi({ example: 4 }),
    nofollow: z.number().int().openapi({ example: 5 }),
    sponsored: z.number().int().openapi({ example: 0 }),
    ugc: z.number().int().openapi({ example: 0 }),
    emptyAnchorText: z.number().int().openapi({ example: 3 }),
    returned: z.number().int().openapi({ description: "Number of entries in the links array.", example: 64 }),
    truncated: z.boolean().openapi({ description: "True when the page had more than 500 anchors.", example: false }),
    relCounts: z
      .object({
        nofollow: z.number().int().openapi({ example: 5 }),
        sponsored: z.number().int().openapi({ example: 0 }),
        ugc: z.number().int().openapi({ example: 0 }),
        noopener: z.number().int().openapi({ example: 12 }),
        noreferrer: z.number().int().openapi({ example: 3 }),
        other: z.number().int().openapi({ description: "Links with a rel attribute not covered above.", example: 8 }),
      })
      .openapi("RelCounts"),
    links: z.array(LinkEntrySchema).max(500),
    durationMs: z.number().int().openapi({ example: 189 }),
  })
  .openapi("LinksResponse");

export const TextSourceSchema = z.enum(["url", "text"]).openapi({
  description: "Where the analysed text came from.",
  example: "url",
});

export const KeywordsResponseSchema = z
  .object({
    source: TextSourceSchema,
    url: z.string().nullable().openapi({ description: "Requested URL when source is url.", example: "https://acme.example/blog/post" }),
    finalUrl: z.string().nullable().openapi({ example: "https://acme.example/blog/post" }),
    statusCode: z.number().int().nullable().openapi({ description: "HTTP status of the fetched page, null for raw text.", example: 200 }),
    htmlBytes: z.number().int().nullable().openapi({ description: "Bytes of HTML read, null for raw text.", example: 48213 }),
    truncated: z.boolean().openapi({ description: "True when the page hit the 2 MB cap or the text hit the 100,000 character cap.", example: false }),
    analysis: KeywordAnalysisSchema,
    durationMs: z.number().int().openapi({ example: 204 }),
  })
  .openapi("KeywordsResponse");

export const ReadabilityResponseSchema = z
  .object({
    source: TextSourceSchema,
    url: z.string().nullable().openapi({ example: "https://acme.example/blog/post" }),
    finalUrl: z.string().nullable().openapi({ example: "https://acme.example/blog/post" }),
    statusCode: z.number().int().nullable().openapi({ example: 200 }),
    htmlBytes: z.number().int().nullable().openapi({ example: 48213 }),
    truncated: z.boolean().openapi({ description: "True when the page hit the 2 MB cap or the text hit the 100,000 character cap.", example: false }),
    readability: ReadabilityMetricsSchema,
    durationMs: z.number().int().openapi({ example: 198 }),
  })
  .openapi("ReadabilityResponse");

export const RobotsRuleSchema = z
  .object({
    path: z.string().openapi({ description: "Path or pattern as written.", example: "/admin/" }),
    line: z.number().int().openapi({ description: "1-based line number in robots.txt.", example: 6 }),
  })
  .openapi("RobotsRule");

export const RobotsGroupSchema = z
  .object({
    userAgents: z.array(z.string()).max(32).openapi({ description: "Lowercased user agents sharing this rule set.", example: ["*"] }),
    allow: z.array(RobotsRuleSchema).max(500),
    disallow: z.array(RobotsRuleSchema).max(500),
    crawlDelay: z.number().nullable().openapi({ description: "Crawl-delay in seconds, when the group declares one.", example: null }),
  })
  .openapi("RobotsGroup");

export const RobotsResponseSchema = z
  .object({
    domain: z.string().openapi({ description: "Hostname that was queried.", example: "acme.example" }),
    origin: z.string().openapi({ description: "Origin the robots.txt was fetched from.", example: "https://acme.example" }),
    robotsUrl: z.string().openapi({ example: "https://acme.example/robots.txt" }),
    statusCode: z.number().int().openapi({ description: "HTTP status of /robots.txt (404 when the file does not exist).", example: 200 }),
    found: z.boolean().openapi({ description: "True when a robots.txt body was returned and parsed.", example: true }),
    https: z.boolean().openapi({ example: true }),
    contentType: z.string().nullable().openapi({ example: "text/plain" }),
    bytes: z.number().int().openapi({ example: 312 }),
    groupCount: z.number().int().openapi({ example: 2 }),
    ruleCount: z.number().int().openapi({ description: "Allow plus disallow rules parsed.", example: 9 }),
    groups: z.array(RobotsGroupSchema).max(200),
    sitemaps: z.array(z.string()).max(200).openapi({ description: "Absolute sitemap URLs declared in the file.", example: ["https://acme.example/sitemap.xml"] }),
    host: z.string().nullable().openapi({ description: "value of the non-standard Host directive, when present.", example: null }),
    unknownDirectives: z.array(z.string()).max(20).openapi({ description: "Directive names that were ignored.", example: ["clean-param"] }),
    lineCount: z.number().int().openapi({ example: 24 }),
    truncated: z.boolean().openapi({ description: "True when a cap was hit (20,000 lines, 200 groups, 500 rules per group).", example: false }),
    looksLikeHtml: z.boolean().openapi({ description: "True when /robots.txt returned an HTML page instead of plain text.", example: false }),
    durationMs: z.number().int().openapi({ example: 143 }),
  })
  .openapi("RobotsResponse");

export const SitemapUrlSchema = z
  .object({
    loc: z.string().openapi({ example: "https://acme.example/pricing" }),
    lastModified: z.string().nullable().openapi({ example: "2026-10-01T09:12:00+00:00" }),
    changeFrequency: z.string().nullable().openapi({ example: "weekly" }),
    priority: z.number().nullable().openapi({ example: 0.8 }),
  })
  .openapi("SitemapUrl");

export const SitemapChildSchema = z
  .object({
    loc: z.string().openapi({ example: "https://acme.example/sitemap-blog.xml" }),
    lastModified: z.string().nullable().openapi({ example: "2026-11-02T10:00:00+00:00" }),
  })
  .openapi("SitemapChild");

export const SitemapResponseSchema = z
  .object({
    url: z.string().openapi({ description: "Requested sitemap URL.", example: "https://acme.example/sitemap.xml" }),
    finalUrl: z.string().openapi({ example: "https://acme.example/sitemap.xml" }),
    statusCode: z.number().int().openapi({ example: 200 }),
    https: z.boolean().openapi({ example: true }),
    contentType: z.string().nullable().openapi({ example: "application/xml" }),
    bytes: z.number().int().openapi({ example: 18234 }),
    isIndex: z.boolean().openapi({ description: "True when the document is a <sitemapindex>.", example: false }),
    format: z.enum(["xml", "text", "unknown"]).openapi({ description: "Detected sitemap format.", example: "xml" }),
    sitemapCount: z.number().int().openapi({ description: "Child sitemaps returned (index documents only).", example: 0 }),
    urlCount: z.number().int().openapi({ description: "URLs returned (urlset documents only).", example: 420 }),
    totalEntries: z.number().int().openapi({ description: "Total <loc> entries found before any cap.", example: 420 }),
    sitemaps: z.array(SitemapChildSchema).max(200).openapi({ description: "Child sitemaps, capped at 200." }),
    urls: z.array(SitemapUrlSchema).max(500).openapi({ description: "URL entries, capped at 500." }),
    truncatedUrls: z.boolean().openapi({ description: "True when more than 500 URL entries were present.", example: false }),
    truncatedSitemaps: z.boolean().openapi({ description: "True when more than 200 child sitemaps were present.", example: false }),
    durationMs: z.number().int().openapi({ example: 176 }),
  })
  .openapi("SitemapResponse");

export const TextAnalysisResponseSchema = z
  .object({
    charCount: z.number().int().openapi({ description: "Characters analysed (capped at 100,000).", example: 418 }),
    wordCount: z.number().int().openapi({ example: 74 }),
    truncated: z.boolean().openapi({ description: "True when the input exceeded 100,000 characters and was cut off.", example: false }),
    readability: ReadabilityMetricsSchema,
    keywords: KeywordAnalysisSchema,
    durationMs: z.number().int().openapi({ example: 6 }),
  })
  .openapi("TextAnalysisResponse");

/* ------------------------------------------------------------------ *
 * Request schemas
 * ------------------------------------------------------------------ */

export const AuditQuerySchema = z.object({
  url: z
    .string()
    .min(3)
    .max(2048)
    .openapi({
      param: { name: "url", in: "query" },
      description: "Absolute http(s) URL of the page to audit. A bare hostname is upgraded to https://.",
      example: "https://acme.example/pricing",
    }),
});

export const MetaQuerySchema = z.object({
  url: z
    .string()
    .min(3)
    .max(2048)
    .openapi({
      param: { name: "url", in: "query" },
      description: "Page whose head metadata should be extracted.",
      example: "https://acme.example/pricing",
    }),
});

export const LinksQuerySchema = z.object({
  url: z
    .string()
    .min(3)
    .max(2048)
    .openapi({
      param: { name: "url", in: "query" },
      description: "Page whose anchors should be extracted. At most 500 links are returned.",
      example: "https://acme.example/",
    }),
});

const limitParam = z.coerce
  .number()
  .int()
  .min(1)
  .max(100)
  .default(20)
  .openapi({
    param: { name: "limit", in: "query" },
    description: "How many ranked terms to return (1-100, default 20).",
    example: 20,
  });

export const KeywordsQuerySchema = z.object({
  url: z
    .string()
    .min(3)
    .max(2048)
    .optional()
    .openapi({
      param: { name: "url", in: "query" },
      description: "Fetch this page and analyse its visible text. Send either url or text, not both.",
      example: "https://acme.example/blog/post",
    }),
  text: z
    .string()
    .min(1)
    .max(20000)
    .optional()
    .openapi({
      param: { name: "text", in: "query" },
      description: "Analyse this raw text instead of fetching a URL (max 20,000 characters in a query string; POST /v1/text accepts up to 100,000).",
      example: "Keyword research is the practice of finding the terms people search for.",
    }),
  limit: limitParam,
});

export const ReadabilityQuerySchema = z.object({
  url: z
    .string()
    .min(3)
    .max(2048)
    .optional()
    .openapi({
      param: { name: "url", in: "query" },
      description: "Fetch this page and score its visible text. Send either url or text, not both.",
      example: "https://acme.example/blog/post",
    }),
  text: z
    .string()
    .min(1)
    .max(20000)
    .optional()
    .openapi({
      param: { name: "text", in: "query" },
      description: "Score this raw text instead of fetching a URL (max 20,000 characters in a query string).",
      example: "The cat sat on the mat. The dog ran in the park.",
    }),
});

export const RobotsQuerySchema = z.object({
  domain: z
    .string()
    .min(3)
    .max(2048)
    .openapi({
      param: { name: "domain", in: "query" },
      description: "Domain to inspect, with or without scheme. Only /robots.txt is fetched.",
      example: "acme.example",
    }),
});

export const SitemapQuerySchema = z.object({
  url: z
    .string()
    .min(3)
    .max(2048)
    .openapi({
      param: { name: "url", in: "query" },
      description: "Absolute URL of a sitemap.xml or sitemap index. Gzipped (.xml.gz) files are rejected.",
      example: "https://acme.example/sitemap.xml",
    }),
});

export const TextBodySchema = z.object({
  text: z
    .string()
    .min(1)
    .max(500_000)
    .openapi({
      description: "Raw text to analyse. Up to 100,000 characters are scored; longer input is truncated and flagged.",
      example: "Keyword research is the practice of finding the terms people type into search engines. Good research starts with intent.",
    }),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .openapi({ description: "How many ranked terms to return (1-100, default 20).", example: 20 }),
});

/* ------------------------------------------------------------------ *
 * Inferred types used by the handlers
 * ------------------------------------------------------------------ */

export type AuditResponse = z.infer<typeof AuditResponseSchema>;
export type MetaResponse = z.infer<typeof MetaResponseSchema>;
export type LinksResponse = z.infer<typeof LinksResponseSchema>;
export type KeywordsResponse = z.infer<typeof KeywordsResponseSchema>;
export type ReadabilityResponse = z.infer<typeof ReadabilityResponseSchema>;
export type RobotsResponse = z.infer<typeof RobotsResponseSchema>;
export type SitemapResponse = z.infer<typeof SitemapResponseSchema>;
export type TextAnalysisResponse = z.infer<typeof TextAnalysisResponseSchema>;
export type AuditScore = z.infer<typeof AuditScoreSchema>;
export type AuditCheck = z.infer<typeof AuditCheckSchema>;
export type ReadabilityMetrics = z.infer<typeof ReadabilityMetricsSchema>;
export type KeywordAnalysis = z.infer<typeof KeywordAnalysisSchema>;
export type OpenGraph = z.infer<typeof OpenGraphSchema>;
export type TwitterCard = z.infer<typeof TwitterCardSchema>;
export type JsonLdAudit = z.infer<typeof JsonLdAuditSchema>;
export type JsonLdBlock = z.infer<typeof JsonLdBlockSchema>;
export type HreflangEntry = z.infer<typeof HreflangEntrySchema>;
export type Favicon = z.infer<typeof FaviconSchema>;
export type LinkEntry = z.infer<typeof LinkEntrySchema>;
export type RobotsGroup = z.infer<typeof RobotsGroupSchema>;
export type RobotsMeta = z.infer<typeof RobotsMetaSchema>;
