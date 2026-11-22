import type { ApiConfig } from "@api/core";

export const config: ApiConfig = {
  name: "ai-text",
  title: "TextMind API",
  version: "1.0.0",
  summary: "Summarise, extract, score and classify text. Deterministic endpoints are free; AI endpoints are optional.",
  description: [
    "One API for text understanding. Six endpoints run deterministic algorithms with zero marginal cost, four call Cloudflare Workers AI when you need generation rather than measurement.",
    "",
    "**Deterministic (costClass \"free\", no model, stable output):** keyword extraction with TF-IDF over sentences and 1/2/3-grams, entity extraction with exact spans, lexicon sentiment with per-sentence breakdown, language detection across twelve languages, readability metrics and the stopword reference lists.",
    "",
    "**Neural (costClass \"neural\", Workers AI binding required):** summarisation with chunking, tone rewriting, zero-shot classification and translation. These return 503 AI_UNAVAILABLE when the binding is missing or a model call fails, never a 500.",
    "",
    "**Honest limits:** sentiment is a curated word list, so sarcasm, emoji and irony are missed. Language detection uses short built-in samples and is unreliable below about three words. Readability formulas are English-calibrated. AI output quality and factual accuracy depend on the model, and typical latency is 1-3 seconds. Plain text is expected: HTML is not stripped.",
    "",
    "**Built for:** support ticket triage, CMS and SEO content tooling, lead qualification from free text, migration audits, moderation pre-screens, and any product that needs a few text features without an OpenAI bill.",
  ].join("\n"),
  baseUrl: "https://textmind.ayamk.in",
  tags: [
    { name: "Text analysis", description: "Deterministic, free text analysis. No model calls." },
    { name: "AI text", description: "Workers AI powered rewriting, summarising, classification and translation." },
    { name: "Reference", description: "Static reference data used by the analysis endpoints." },
  ],
  termsOfService: "https://example.com/terms",
  directRateLimitPerMinute: 60,
};