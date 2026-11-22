import { ApiError, commonErrors, defineApi, jsonError } from "@api/core";
import { createRoute } from "@hono/zod-openapi";
import { config } from "./config";
import {
  ClassifyBodySchema,
  ClassifyResponseSchema,
  DetectLanguageResponseSchema,
  EntitiesResponseSchema,
  KeywordsBodySchema,
  KeywordsQuerySchema,
  KeywordsResponseSchema,
  ReadabilityResponseSchema,
  RewriteBodySchema,
  RewriteResponseSchema,
  StopwordsQuerySchema,
  StopwordsResponseSchema,
  SummarizeBodySchema,
  SummarizeResponseSchema,
  TextBodySchema,
  TranslateBodySchema,
  TranslateResponseSchema,
  SentimentResponseSchema,
} from "./schemas";
import { extractKeywords } from "./lib/keywords";
import { extractEntities } from "./lib/entities";
import { analyseSentiment } from "./lib/sentiment";
import { detectLanguage, type LanguageCode } from "./lib/language";
import { analyseReadability } from "./lib/readability";
import { LANGUAGE_NAMES, getStopwords, stopwordSummary } from "./lib/stopwords";
import { countWords, normalizeText } from "./lib/text";
import {
  CHAT_MODEL,
  TRANSLATE_MODEL,
  buildClassifyMessages,
  buildReduceMessages,
  buildRewriteMessages,
  buildSummaryMessages,
  chat,
  chunkText,
  parseClassificationOutput,
  parseRewriteOutput,
  translate,
  type WorkersAiBinding,
} from "./lib/ai";

/* eslint-disable @typescript-eslint/no-explicit-any */
const jsonContent = (schema: any) => ({ "application/json": { schema } });

interface AiTextBindings {
  AI?: WorkersAiBinding;
  [key: string]: unknown;
}

/** Characters per summarisation chunk: 12k characters is at most three chunks. */
const SUMMARY_CHUNK_CHARS = 4000;

function responseMeta(costClass: "free" | "neural", method: string, started: number, textCharacters: number) {
  return { costClass, method, durationMs: Date.now() - started, textCharacters };
}

function requireNonBlank(text: string): string {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new ApiError(400, "INVALID_INPUT", "text must contain at least one non-whitespace character", {
      hint: "Send plain text in the text field. HTML is not stripped, so strip markup before calling.",
    });
  }
  return normalized;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function summaryTokenBudget(maxWords: number): number {
  return Math.max(160, Math.min(700, Math.round(maxWords * 2.2) + 80));
}

/* ------------------------------------------------------------------ */
/* Deterministic routes                                                */
/* ------------------------------------------------------------------ */

const keywordsGetRoute = createRoute({
  method: "get",
  path: "/v1/keywords",
  tags: ["Text analysis"],
  summary: "Rank keywords and key phrases from plain text",
  description:
    "Single-document TF-IDF: sentences are documents, terms are 1/2/3-grams built from contiguous tokens. Stopwords in twelve languages are removed, dense and repeated phrases rank first. The GET variant accepts up to 8,000 characters because of URL length limits; use POST /v1/keywords for up to 100,000.",
  request: { query: KeywordsQuerySchema },
  responses: {
    200: { description: "Ranked keywords with density and IDF", content: jsonContent(KeywordsResponseSchema) },
    ...commonErrors,
  },
});

const keywordsPostRoute = createRoute({
  method: "post",
  path: "/v1/keywords",
  tags: ["Text analysis"],
  summary: "Rank keywords from a JSON body (up to 100,000 characters)",
  description:
    "Same scoring as the GET variant with a larger input limit. Returns the ranked keyword list, document statistics and a truncated flag.",
  request: { body: { content: jsonContent(KeywordsBodySchema), required: true } },
  responses: {
    200: { description: "Ranked keywords with density and IDF", content: jsonContent(KeywordsResponseSchema) },
    ...commonErrors,
  },
});

const entitiesRoute = createRoute({
  method: "post",
  path: "/v1/entities",
  tags: ["Text analysis"],
  summary: "Extract emails, URLs, phones, dates, money and more",
  description:
    "Deterministic regex extraction of eleven entity types with exact [start, end) UTF-16 spans and a confidence per type. No model, no network call. Overlaps are resolved by type priority, so a URL wins over an email embedded in it and a date wins over a phone number shaped like a date. At most 200 entities are returned per request, and at most 50 of any one type, so a wall of URLs cannot crowd out emails.",
  request: { body: { content: jsonContent(TextBodySchema), required: true } },
  responses: {
    200: { description: "Entity list, per-type counts and spans", content: jsonContent(EntitiesResponseSchema) },
    ...commonErrors,
  },
});

const sentimentRoute = createRoute({
  method: "post",
  path: "/v1/sentiment",
  tags: ["Text analysis"],
  summary: "Score sentiment with a curated lexicon (free, deterministic)",
  description:
    "Sums word valences from a built-in AFINN-style lexicon and normalises them to [-1, 1]. Negators within two tokens flip and halve a word's valence. Returns per-sentence scores for the first 20 sentences plus the strongest positive and negative tokens. Word lists do not understand sarcasm, irony, emoji or non-English text.",
  request: { body: { content: jsonContent(TextBodySchema), required: true } },
  responses: {
    200: { description: "Normalised score, label, per-sentence breakdown", content: jsonContent(SentimentResponseSchema) },
    ...commonErrors,
  },
});

const detectLanguageRoute = createRoute({
  method: "post",
  path: "/v1/detect-language",
  tags: ["Text analysis"],
  summary: "Detect one of twelve languages with a confidence score",
  description:
    "Combines written-script detection (Cyrillic, Arabic, Devanagari, Han) with stopword coverage and character-trigram similarity for the eight Latin-script languages. Returns the best language, a confidence in [0, 1], the top three candidates and the script mix. Short inputs (under about three words) are often unreliable; check isReliable.",
  request: { body: { content: jsonContent(TextBodySchema), required: true } },
  responses: {
    200: { description: "Language, confidence, candidates and script shares", content: jsonContent(DetectLanguageResponseSchema) },
    ...commonErrors,
  },
});

const readabilityRoute = createRoute({
  method: "post",
  path: "/v1/readability",
  tags: ["Text analysis"],
  summary: "Flesch, Flesch-Kincaid and Gunning fog readability scores",
  description:
    "Standard English readability formulas with an estimated syllable count (vowel-group heuristic, no dictionary). Returns Flesch reading ease, Flesch-Kincaid grade, Gunning fog, word/sentence/syllable counts, averages and the longest sentence. Formulas are English-calibrated, so treat other languages as indicative only.",
  request: { body: { content: jsonContent(TextBodySchema), required: true } },
  responses: {
    200: { description: "Readability scores, counts and averages", content: jsonContent(ReadabilityResponseSchema) },
    ...commonErrors,
  },
});

const stopwordsRoute = createRoute({
  method: "get",
  path: "/v1/stopwords",
  tags: ["Reference"],
  summary: "List supported stopword lists, or fetch one language",
  description:
    "Without lang, returns every supported language with its stopword count. With lang, also returns the full curated list for that language. These are the lists used by keyword extraction and language detection.",
  request: { query: StopwordsQuerySchema },
  responses: {
    200: { description: "Supported languages and optional word list", content: jsonContent(StopwordsResponseSchema) },
    ...commonErrors,
  },
});

/* ------------------------------------------------------------------ */
/* AI routes                                                           */
/* ------------------------------------------------------------------ */

const aiErrorResponses = {
  503: jsonError("Workers AI binding unavailable or the model call failed (code AI_UNAVAILABLE)"),
};

const summarizeRoute = createRoute({
  method: "post",
  path: "/v1/summarize",
  tags: ["AI text"],
  summary: "Summarise up to 12,000 characters with Llama 3.1 8B",
  description:
    "Calls Cloudflare Workers AI. Input is trimmed, split into sentence-aligned chunks of 4,000 characters and summarised; when there is more than one chunk the partial summaries are merged in a final call, so a 12,000 character request uses at most four model calls. Returns the summary, the compression ratio and the model id. Latency is typically 1-3 s and quality depends on the model. Returns 503 AI_UNAVAILABLE when the binding is missing or the model fails.",
  request: { body: { content: jsonContent(SummarizeBodySchema), required: true } },
  responses: {
    200: { description: "Summary, compression ratio and model id", content: jsonContent(SummarizeResponseSchema) },
    ...aiErrorResponses,
    ...commonErrors,
  },
});

const rewriteRoute = createRoute({
  method: "post",
  path: "/v1/rewrite",
  tags: ["AI text"],
  summary: "Rewrite text in a chosen tone and return the model's notes",
  description:
    "Calls Cloudflare Workers AI (Llama 3.1 8B) and asks for the rewritten text followed by a NOTES section. The notes are the model's own, capped at five lines; if the model ignores the format the notes array is empty and the whole answer is returned as the rewritten text. One model call per request. Returns 503 AI_UNAVAILABLE when the binding is missing or the model fails.",
  request: { body: { content: jsonContent(RewriteBodySchema), required: true } },
  responses: {
    200: { description: "Rewritten text, model notes and model id", content: jsonContent(RewriteResponseSchema) },
    ...aiErrorResponses,
    ...commonErrors,
  },
});

const classifyRoute = createRoute({
  method: "post",
  path: "/v1/classify",
  tags: ["AI text"],
  summary: "Zero-shot classification into 2-20 labels you supply",
  description:
    "Calls Cloudflare Workers AI and asks the model for one label plus a score per label, in JSON. Scores are normalised relevance values, not calibrated probabilities: when the model returns no numbers the winning label scores 1 and the rest 0 and scoreSource says \"choice-only\". Labels the model invents are dropped. Returns 503 AI_UNAVAILABLE when the binding is missing or the model fails.",
  request: { body: { content: jsonContent(ClassifyBodySchema), required: true } },
  responses: {
    200: { description: "Sorted label scores, chosen label and model id", content: jsonContent(ClassifyResponseSchema) },
    ...aiErrorResponses,
    ...commonErrors,
  },
});

const translateRoute = createRoute({
  method: "post",
  path: "/v1/translate",
  tags: ["AI text"],
  summary: "Translate up to 2,000 characters between twelve languages",
  description:
    "Calls Cloudflare Workers AI with M2M100 (1.2B parameters). Source language is optional: when omitted the built-in detector runs first and the request fails with 400 instead of guessing if the detection is unreliable. One model call per request, typically 1-3 s. Returns 503 AI_UNAVAILABLE when the binding is missing or the model fails.",
  request: { body: { content: jsonContent(TranslateBodySchema), required: true } },
  responses: {
    200: { description: "Translated text and both language codes", content: jsonContent(TranslateResponseSchema) },
    ...aiErrorResponses,
    ...commonErrors,
  },
});

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

const app = defineApi<AiTextBindings>(config, (app) => {
  /**
   * JSON bodies are parsed by the validator middleware, which throws on
   * malformed JSON and would surface as a 500. This guard turns that into a
   * documented 400 and enforces the 512 KB body limit from the build guide.
   */
  app.use("/v1/*", async (c, next) => {
    if (c.req.method !== "POST") {
      await next();
      return;
    }
    const declaredLength = Number(c.req.header("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > 512 * 1024) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds the 512 KB limit", {
        hint: "Send a smaller payload. Text fields are capped at 100,000 characters (12,000 for AI endpoints).",
      });
    }
    const contentType = (c.req.header("content-type") ?? "").toLowerCase();
    if (!contentType.includes("application/json")) {
      await next();
      return;
    }
    try {
      await c.req.raw.clone().json();
    } catch {
      throw new ApiError(400, "INVALID_INPUT", "Request body must be a valid JSON object", {
        hint: "Send Content-Type: application/json with a JSON object body, for example {\"text\": \"your text\"}.",
      });
    }
    await next();
  });

  app.openapi(keywordsGetRoute, async (c) => {
    const started = Date.now();
    const { text, limit } = c.req.valid("query");
    const normalized = requireNonBlank(text);
    const result = extractKeywords(normalized, limit);
    return c.json(
      {
        keywords: result.keywords,
        stats: result.stats,
        truncated: result.truncated,
        meta: responseMeta("free", "tf-idf-sentences-v1", started, normalized.length),
      },
      200,
    );
  });

  app.openapi(keywordsPostRoute, async (c) => {
    const started = Date.now();
    const { text, limit } = c.req.valid("json");
    const normalized = requireNonBlank(text);
    const result = extractKeywords(normalized, limit);
    return c.json(
      {
        keywords: result.keywords,
        stats: result.stats,
        truncated: result.truncated,
        meta: responseMeta("free", "tf-idf-sentences-v1", started, normalized.length),
      },
      200,
    );
  });

  app.openapi(entitiesRoute, async (c) => {
    const started = Date.now();
    const { text } = c.req.valid("json");
    const normalized = requireNonBlank(text);
    const result = extractEntities(normalized);
    return c.json(
      {
        entities: result.entities,
        counts: result.counts,
        total: result.total,
        truncated: result.truncated,
        label: "deterministic" as const,
        meta: responseMeta("free", "regex-entities-v1", started, normalized.length),
      },
      200,
    );
  });

  app.openapi(sentimentRoute, async (c) => {
    const started = Date.now();
    const { text } = c.req.valid("json");
    const normalized = requireNonBlank(text);
    const result = analyseSentiment(normalized);
    return c.json(
      { ...result, meta: responseMeta("free", "afinn-lexicon-v1", started, normalized.length) },
      200,
    );
  });

  app.openapi(detectLanguageRoute, async (c) => {
    const started = Date.now();
    const { text } = c.req.valid("json");
    const normalized = requireNonBlank(text);
    const result = detectLanguage(normalized);
    return c.json(
      { ...result, meta: responseMeta("free", "script-stopword-trigram-v1", started, normalized.length) },
      200,
    );
  });

  app.openapi(readabilityRoute, async (c) => {
    const started = Date.now();
    const { text } = c.req.valid("json");
    const normalized = requireNonBlank(text);
    const result = analyseReadability(normalized);
    return c.json(
      { ...result, meta: responseMeta("free", "readability-en-v1", started, normalized.length) },
      200,
    );
  });

  app.openapi(stopwordsRoute, async (c) => {
    const started = Date.now();
    const { lang } = c.req.valid("query");
    const languages = stopwordSummary();
    const words = lang ? getStopwords(lang) : null;
    const selected =
      lang && words
        ? { code: lang, name: LANGUAGE_NAMES[lang] ?? lang, count: words.length, words: [...words] }
        : null;
    return c.json(
      { languages, selected, meta: responseMeta("free", "curated-stopwords-v1", started, 0) },
      200,
    );
  });

  app.openapi(summarizeRoute, async (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    const text = requireNonBlank(body.text);
    const chunks = chunkText(text, SUMMARY_CHUNK_CHARS);
    const inputWords = countWords(text);
    const perChunkWords = Math.max(40, Math.ceil(body.maxWords / chunks.length) + 20);

    let summary: string;
    if (chunks.length === 1) {
      summary = await chat(c.env.AI, buildSummaryMessages(chunks[0], body.maxWords, body.style), {
        maxTokens: summaryTokenBudget(body.maxWords),
        temperature: 0.3,
      });
    } else {
      const partials: string[] = [];
      for (const chunk of chunks) {
        partials.push(
          await chat(c.env.AI, buildSummaryMessages(chunk, perChunkWords, "paragraph"), {
            maxTokens: summaryTokenBudget(perChunkWords),
            temperature: 0.3,
          }),
        );
      }
      summary = await chat(c.env.AI, buildReduceMessages(partials, body.maxWords, body.style), {
        maxTokens: summaryTokenBudget(body.maxWords),
        temperature: 0.3,
      });
    }

    const summaryWords = countWords(summary);
    return c.json(
      {
        summary,
        style: body.style,
        maxWords: body.maxWords,
        inputWords,
        summaryWords,
        compressionRatio: inputWords === 0 ? 0 : round4(summaryWords / inputWords),
        chunks: chunks.length,
        model: CHAT_MODEL,
        meta: responseMeta("neural", CHAT_MODEL, started, text.length),
      },
      200,
    );
  });

  app.openapi(rewriteRoute, async (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    const text = requireNonBlank(body.text);
    const inputWords = countWords(text);
    const raw = await chat(c.env.AI, buildRewriteMessages(text, body.tone), {
      maxTokens: Math.max(200, Math.min(900, inputWords * 3 + 160)),
      temperature: 0.4,
    });
    const parsed = parseRewriteOutput(raw);
    return c.json(
      {
        rewrittenText: parsed.rewrittenText,
        notes: parsed.notes,
        tone: body.tone,
        inputWords,
        outputWords: countWords(parsed.rewrittenText),
        model: CHAT_MODEL,
        meta: responseMeta("neural", CHAT_MODEL, started, text.length),
      },
      200,
    );
  });

  app.openapi(classifyRoute, async (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    const text = requireNonBlank(body.text);
    const raw = await chat(c.env.AI, buildClassifyMessages(text, body.labels), {
      maxTokens: 400,
      temperature: 0.2,
    });
    const parsed = parseClassificationOutput(raw, body.labels);
    return c.json(
      {
        scores: parsed.scores.map((score) => ({ label: score.label, score: round4(score.score) })),
        choice: parsed.choice,
        confidence: parsed.confidence,
        scoreSource: parsed.scoreSource,
        model: CHAT_MODEL,
        meta: responseMeta("neural", CHAT_MODEL, started, text.length),
      },
      200,
    );
  });

  app.openapi(translateRoute, async (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    const text = requireNonBlank(body.text);

    let source = body.source;
    let detected = false;
    if (!source) {
      const detection = detectLanguage(text);
      if (detection.language === "unknown" || !detection.isReliable) {
        throw new ApiError(400, "INVALID_INPUT", "Could not determine the source language with enough confidence", {
          hint: "Pass the source language explicitly, for example source: \"en\".",
        });
      }
      source = detection.language as LanguageCode;
      detected = true;
    }
    if (source === body.target) {
      throw new ApiError(400, "INVALID_INPUT", "source and target languages must differ", {
        hint: "Remove the source parameter to auto-detect, or choose a different target.",
      });
    }

    const translatedText = await translate(c.env.AI, text, source, body.target);
    return c.json(
      {
        translatedText,
        sourceLanguage: source,
        sourceLanguageDetected: detected,
        targetLanguage: body.target,
        characters: text.length,
        model: TRANSLATE_MODEL,
        meta: responseMeta("neural", TRANSLATE_MODEL, started, text.length),
      },
      200,
    );
  });
});

export default app;
