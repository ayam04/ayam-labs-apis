import { z } from "@api/core";
import { MAX_KEYWORDS, DEFAULT_KEYWORDS } from "./lib/keywords";
import { MAX_TEXT_AI, MAX_TEXT_DETERMINISTIC, MAX_TEXT_QUERY, MAX_TEXT_TRANSLATE } from "./lib/text";
import { SUPPORTED_LANGUAGE_CODES } from "./lib/language";

/**
 * Shared response metadata. costClass tells a buyer whether a call ran on a
 * deterministic algorithm (free, zero marginal cost) or on Workers AI (neural,
 * billed per neuron).
 */
export const CostClassSchema = z.enum(["free", "neural"]).openapi({
  description:
    "free = deterministic algorithm, no model call, zero marginal cost. neural = one or more Cloudflare Workers AI model calls, billed per neuron and 1-3 s slower.",
  example: "free",
});

export const MetaSchema = z
  .object({
    costClass: CostClassSchema,
    method: z.string().openapi({
      description: "Algorithm version for deterministic endpoints, model id for AI endpoints.",
      example: "tf-idf-sentences-v1",
    }),
    durationMs: z.number().int().openapi({ description: "Server side processing time in milliseconds.", example: 4 }),
    textCharacters: z
      .number()
      .int()
      .openapi({ description: "Characters processed after trimming the input.", example: 412 }),
  })
  .openapi("ResponseMeta");

const textField = (limit: number, description: string, example: string) =>
  z
    .string()
    .min(1)
    .max(limit, { message: "text exceeds the " + limit + " character limit for this endpoint" })
    .openapi({ description: description, example: example });

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export const KeywordsQuerySchema = z.object({
  text: textField(
    MAX_TEXT_QUERY,
    "Plain text to analyse. The GET variant accepts up to 8,000 characters because of URL length limits; POST /v1/keywords accepts up to 100,000.",
    "Solar panels convert sunlight into electricity. Solar panels are cheaper than ever, and solar adoption keeps growing.",
  ),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_KEYWORDS)
    .default(DEFAULT_KEYWORDS)
    .openapi({
      param: { name: "limit", in: "query" },
      description: "Maximum number of keywords to return (1-" + MAX_KEYWORDS + ").",
      example: 10,
    }),
});

export const KeywordsBodySchema = z.object({
  text: textField(
    MAX_TEXT_DETERMINISTIC,
    "Plain text to analyse. HTML is not stripped: send plain text.",
    "Solar panels convert sunlight into electricity. Solar panels are cheaper than ever, and solar adoption keeps growing.",
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_KEYWORDS)
    .default(DEFAULT_KEYWORDS)
    .openapi({ description: "Maximum number of keywords to return (1-" + MAX_KEYWORDS + ").", example: 20 }),
});

export const TextBodySchema = z.object({
  text: textField(
    MAX_TEXT_DETERMINISTIC,
    "Plain text to analyse (up to 100,000 characters). HTML tags are not stripped, so send plain text.",
    "We shipped the new billing page on January 12, 2024 and support tickets dropped 38%. Contact billing@acme.io or call +1 415 555 2671. Our IBAN is DE89370400440532013000.",
  ),
});

export const SummarizeBodySchema = z.object({
  text: textField(
    MAX_TEXT_AI,
    "Text to summarise (up to 12,000 characters). Long input is split into sentence-aligned chunks and the partial summaries are merged.",
    "Acme reported record revenue in the third quarter, driven by strong demand for its industrial sensors. Margins improved because the company renegotiated component contracts. Management warned that shipping costs may rise next year, and that hiring will slow until the new factory in Ohio opens.",
  ),
  maxWords: z
    .number()
    .int()
    .min(30)
    .max(500)
    .default(120)
    .openapi({
      description: "Target summary length in words (30-500). This is a prompt instruction, not a hard truncation.",
      example: 80,
    }),
  style: z
    .enum(["bullets", "paragraph"])
    .default("paragraph")
    .openapi({ description: "Output shape requested from the model.", example: "paragraph" }),
});

export const RewriteBodySchema = z.object({
  text: textField(
    MAX_TEXT_AI,
    "Text to rewrite (up to 12,000 characters). Meaning is preserved; nothing is translated.",
    "we got the thing working lol, it was a config typo. gonna ship it tomorrow if nothing explodes",
  ),
  tone: z
    .enum(["professional", "casual", "concise", "friendly"])
    .default("professional")
    .openapi({ description: "Tone the model is asked to use.", example: "professional" }),
});

export const ClassifyBodySchema = z.object({
  text: textField(
    MAX_TEXT_AI,
    "Text to classify (up to 12,000 characters).",
    "My card was charged twice and nobody answered my emails for a week.",
  ),
  labels: z
    .array(
      z
        .string()
        .min(1)
        .max(60)
        .openapi({ description: "One candidate label.", example: "billing" }),
    )
    .min(2)
    .max(20)
    .openapi({
      description:
        "Candidate labels, 2-20, each at most 60 characters. The model picks exactly one; scores for every label are returned.",
      example: ["billing", "shipping", "product defect", "account access", "other"],
    }),
});

export const TranslateBodySchema = z.object({
  text: textField(
    MAX_TEXT_TRANSLATE,
    "Text to translate (up to 2,000 characters). Plain text only: markup is translated as text.",
    "Your invoice is attached. Please pay it within 14 days.",
  ),
  target: z
    .enum(SUPPORTED_LANGUAGE_CODES)
    .openapi({ description: "Target language code. M2M100 supports many more, but this API validates this twelve-language set.", example: "es" }),
  source: z
    .enum(SUPPORTED_LANGUAGE_CODES)
    .optional()
    .openapi({
      description: "Source language code. Omit it and the built-in detector guesses; if the guess is unreliable the request fails with 400 instead of guessing wrong.",
      example: "en",
    }),
});

export const StopwordsQuerySchema = z.object({
  lang: z
    .enum(SUPPORTED_LANGUAGE_CODES)
    .optional()
    .openapi({
      param: { name: "lang", in: "query" },
      description: "Return the stopword list for this language. Omit it to list every supported language with its stopword count.",
      example: "en",
    }),
});

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

export const KeywordSchema = z
  .object({
    term: z.string().openapi({ description: "Term, lowercased, n-gram tokens joined by a single space.", example: "solar panels" }),
    ngram: z.number().int().min(1).max(3).openapi({ description: "Number of tokens in the term.", example: 2 }),
    count: z.number().int().openapi({ description: "Occurrences in the text.", example: 3 }),
    sentenceHits: z.number().int().openapi({ description: "Number of sentences containing the term (document frequency).", example: 2 }),
    idf: z.number().openapi({ description: "Inverse document frequency over sentences, ln((1+S)/(1+df)) + 1.", example: 1.4055 }),
    density: z.number().openapi({ description: "Percentage of token positions where the term occurs.", example: 4.286 }),
    score: z.number().openapi({ description: "Relative relevance 0-100, where 100 is the best term in this text.", example: 100 }),
  })
  .openapi("Keyword");

export const KeywordStatsSchema = z
  .object({
    characters: z.number().int().openapi({ example: 96 }),
    words: z.number().int().openapi({ description: "Token count, stopwords included.", example: 14 }),
    uniqueWords: z.number().int().openapi({ example: 11 }),
    sentences: z.number().int().openapi({ example: 2 }),
    stopwordCount: z.number().int().openapi({ description: "Tokens that are stopwords in any supported language.", example: 4 }),
    stopwordRatio: z.number().openapi({ example: 0.2857 }),
    candidateTerms: z.number().int().openapi({ description: "Distinct unigrams, bigrams and trigrams scored.", example: 34 }),
  })
  .openapi("KeywordStats");

export const KeywordsResponseSchema = z
  .object({
    keywords: z.array(KeywordSchema),
    stats: KeywordStatsSchema,
    truncated: z.boolean().openapi({ description: "True when more keywords were found than the limit allowed.", example: false }),
    meta: MetaSchema,
  })
  .openapi("KeywordsResponse");

export const EntityTypeSchema = z
  .enum(["email", "url", "phone", "date", "money", "percent", "hashtag", "mention", "ipv4", "iban", "uuid"])
  .openapi({ description: "Entity type.", example: "email" });

export const EntitySchema = z
  .object({
    type: EntityTypeSchema,
    value: z.string().openapi({ description: "Matched text exactly as it appears in the input.", example: "billing@acme.io" }),
    start: z.number().int().openapi({ description: "Span start, inclusive, in UTF-16 code units.", example: 118 }),
    end: z.number().int().openapi({ description: "Span end, exclusive, in UTF-16 code units.", example: 134 }),
    confidence: z
      .number()
      .openapi({ description: "Fixed confidence per pattern: uuid 0.99, email 0.98, percent 0.97, ipv4 0.97, url 0.96, hashtag 0.95, mention 0.93, iban 0.90 (also passes an ISO 13616 mod-97 checksum), money 0.90, date 0.85, phone 0.60 (pattern match only).", example: 0.98 }),
  })
  .openapi("Entity");

export const EntityCountsSchema = z
  .object({
    email: z.number().int(),
    url: z.number().int(),
    phone: z.number().int(),
    date: z.number().int(),
    money: z.number().int(),
    percent: z.number().int(),
    hashtag: z.number().int(),
    mention: z.number().int(),
    ipv4: z.number().int(),
    iban: z.number().int(),
    uuid: z.number().int(),
  })
  .openapi("EntityCounts");

export const EntitiesResponseSchema = z
  .object({
    entities: z.array(EntitySchema),
    counts: EntityCountsSchema,
    total: z.number().int().openapi({ example: 5 }),
    truncated: z.boolean().openapi({ description: "True when a cap was hit: 200 entities overall or 50 per type.", example: false }),
    label: z.literal("deterministic").openapi({ description: "This endpoint is regex based, never model based.", example: "deterministic" }),
    meta: MetaSchema,
  })
  .openapi("EntitiesResponse");

export const SentimentTokenSchema = z
  .object({
    token: z.string().openapi({ example: "great" }),
    valence: z.number().int().openapi({ description: "Lexicon valence of the word before negation handling, -5 to 5.", example: 3 }),
    count: z.number().int().openapi({ example: 2 }),
    contribution: z.number().openapi({ description: "Sum of effective valences, negated occurrences included.", example: 6 }),
  })
  .openapi("SentimentToken");

export const SentenceSentimentSchema = z
  .object({
    index: z.number().int().openapi({ description: "0-based sentence index.", example: 0 }),
    text: z.string().openapi({ description: "Sentence text, truncated to 280 characters.", example: "The update is great." }),
    truncated: z.boolean().openapi({ example: false }),
    tokens: z.number().int().openapi({ example: 4 }),
    rawScore: z.number().openapi({ description: "Sum of effective valences in this sentence.", example: 3 }),
    score: z.number().openapi({ description: "Normalised sentence score in [-1, 1].", example: 0.15 }),
    label: z.enum(["positive", "neutral", "negative"]).openapi({ example: "positive" }),
  })
  .openapi("SentenceSentiment");

export const SentimentResponseSchema = z
  .object({
    score: z.number().openapi({ description: "Normalised score in [-1, 1]: sum of effective valences divided by (5 x token count).", example: 0.0815 }),
    comparative: z
      .number()
      .openapi({ description: "AFINN style comparative: sum of effective valences divided by token count, in [-5, 5].", example: 0.5714 }),
    rawScore: z.number().openapi({ description: "Raw sum of effective valences.", example: 4 }),
    label: z.enum(["positive", "neutral", "negative"]).openapi({ description: "positive when score >= 0.1, negative when score <= -0.1, otherwise neutral.", example: "positive" }),
    tokens: z.number().int().openapi({ description: "Token count used for normalisation.", example: 7 }),
    matchedTokens: z.number().int().openapi({ description: "Tokens found in the lexicon.", example: 2 }),
    negatedTokens: z.number().int().openapi({ description: "Tokens whose valence was flipped by a negator.", example: 0 }),
    sentences: z.array(SentenceSentimentSchema),
    sentencesReturned: z.number().int().openapi({ example: 1 }),
    sentencesTotal: z.number().int().openapi({ example: 1 }),
    topPositive: z.array(SentimentTokenSchema),
    topNegative: z.array(SentimentTokenSchema),
    lexiconSize: z.number().int().openapi({ description: "Number of words in the built-in lexicon.", example: 397 }),
    meta: MetaSchema,
  })
  .openapi("SentimentResponse");

export const LanguageCandidateSchema = z
  .object({
    language: z.string().openapi({ example: "en" }),
    name: z.string().openapi({ example: "English" }),
    score: z.number().openapi({ description: "Detection score in [0, 1]; only meaningful relative to the other candidates.", example: 0.4512 }),
  })
  .openapi("LanguageCandidate");

export const ScriptSharesSchema = z
  .object({
    latin: z.number().openapi({ example: 1 }),
    cyrillic: z.number().openapi({ example: 0 }),
    arabic: z.number().openapi({ example: 0 }),
    devanagari: z.number().openapi({ example: 0 }),
    han: z.number().openapi({ example: 0 }),
    other: z.number().openapi({ example: 0 }),
  })
  .openapi("ScriptShares");

export const DetectLanguageResponseSchema = z
  .object({
    language: z.string().openapi({ description: "Detected ISO 639-1 code, or \"unknown\" when no signal was found.", example: "en" }),
    languageName: z.string().openapi({ example: "English" }),
    confidence: z.number().openapi({ description: "Detector confidence in [0, 1], driven by the margin over the runner-up.", example: 0.742 }),
    isReliable: z.boolean().openapi({ description: "True when confidence >= 0.4 and at least 3 words were seen.", example: true }),
    candidates: z.array(LanguageCandidateSchema).openapi({ description: "Top three candidates, best first." }),
    scripts: ScriptSharesSchema,
    words: z.number().int().openapi({ example: 12 }),
    method: z.enum(["unicode-script", "stopword+trigram", "none"]).openapi({ example: "stopword+trigram" }),
    meta: MetaSchema,
  })
  .openapi("DetectLanguageResponse");

export const LongestSentenceSchema = z
  .object({
    index: z.number().int().openapi({ example: 1 }),
    words: z.number().int().openapi({ example: 21 }),
    characters: z.number().int().openapi({ example: 132 }),
    text: z.string().openapi({ description: "Sentence text, truncated to 240 characters.", example: "However, the second sentence is considerably longer." }),
    truncated: z.boolean().openapi({ example: false }),
  })
  .openapi("LongestSentence");

export const ReadabilityResponseSchema = z
  .object({
    fleschReadingEase: z.number().openapi({ description: "Flesch reading ease. Higher is easier; 60-70 is plain English.", example: 62.18 }),
    fleschKincaidGrade: z.number().openapi({ description: "Flesch-Kincaid grade level (US school year).", example: 8.71 }),
    gunningFog: z.number().openapi({ description: "Gunning fog index, based on words with three or more syllables.", example: 9.2 }),
    gradeLevel: z.string().openapi({ description: "Human readable band derived from the Flesch-Kincaid grade.", example: "grade 9-12" }),
    counts: z.object({
      characters: z.number().int(),
      letters: z.number().int(),
      words: z.number().int(),
      uniqueWords: z.number().int(),
      sentences: z.number().int(),
      syllables: z.number().int(),
      complexWords: z.number().int(),
    }),
    averages: z.object({
      wordsPerSentence: z.number(),
      syllablesPerWord: z.number(),
      charactersPerWord: z.number(),
      readingTimeSeconds: z.number().openapi({ description: "Reading time at 200 words per minute.", example: 8.4 }),
    }),
    longestSentence: LongestSentenceSchema.nullable(),
    meta: MetaSchema,
  })
  .openapi("ReadabilityResponse");

export const StopwordLanguageSchema = z
  .object({
    code: z.string().openapi({ example: "en" }),
    name: z.string().openapi({ example: "English" }),
    count: z.number().int().openapi({ description: "Number of stopwords in this language.", example: 132 }),
  })
  .openapi("StopwordLanguage");

export const StopwordsResponseSchema = z
  .object({
    languages: z.array(StopwordLanguageSchema),
    selected: z
      .object({
        code: z.string().openapi({ example: "en" }),
        name: z.string().openapi({ example: "English" }),
        count: z.number().int().openapi({ example: 132 }),
        words: z.array(z.string()).openapi({ example: ["a", "about", "above"] }),
      })
      .nullable()
      .openapi({ description: "Populated only when the lang query parameter was sent." }),
    meta: MetaSchema,
  })
  .openapi("StopwordsResponse");

export const SummarizeResponseSchema = z
  .object({
    summary: z.string().openapi({ example: "Acme posted record revenue on strong sensor demand, improved margins through renegotiated contracts, and warned of higher shipping costs and slower hiring." }),
    style: z.enum(["bullets", "paragraph"]),
    maxWords: z.number().int().openapi({ example: 120 }),
    inputWords: z.number().int().openapi({ example: 58 }),
    summaryWords: z.number().int().openapi({ example: 24 }),
    compressionRatio: z.number().openapi({ description: "summaryWords / inputWords. Lower means more compression.", example: 0.41 }),
    chunks: z.number().int().openapi({ description: "How many sentence-aligned chunks the input was split into (1 when it fit in one call).", example: 1 }),
    model: z.string().openapi({ example: "@cf/openai/gpt-oss-20b" }),
    meta: MetaSchema,
  })
  .openapi("SummarizeResponse");

export const RewriteResponseSchema = z
  .object({
    rewrittenText: z.string().openapi({ example: "The configuration typo is fixed and the change is ready to ship tomorrow, assuming no further issues." }),
    notes: z
      .array(z.string())
      .openapi({ description: "Up to five short notes the model returned after NOTES:. Empty when the model did not use the requested format.", example: ["Removed filler and slang", "Kept the original meaning"] }),
    tone: z.enum(["professional", "casual", "concise", "friendly"]),
    inputWords: z.number().int().openapi({ example: 19 }),
    outputWords: z.number().int().openapi({ example: 16 }),
    model: z.string().openapi({ example: "@cf/openai/gpt-oss-20b" }),
    meta: MetaSchema,
  })
  .openapi("RewriteResponse");

export const ClassificationScoreSchema = z
  .object({
    label: z.string().openapi({ example: "billing" }),
    score: z.number().openapi({ description: "Normalised relevance in [0, 1]; scores sum to 1 when the model returned numbers.", example: 0.71 }),
  })
  .openapi("ClassificationScore");

export const ClassifyResponseSchema = z
  .object({
    scores: z.array(ClassificationScoreSchema).openapi({ description: "Every requested label, best first." }),
    choice: z.string().openapi({ description: "The label the model picked. Always one of the labels you sent.", example: "billing" }),
    confidence: z.number().openapi({ description: "Score of the chosen label after normalisation.", example: 0.71 }),
    scoreSource: z
      .enum(["model", "choice-only"])
      .openapi({ description: "\"model\" when the model returned numeric scores for the labels, \"choice-only\" when it only named a winner (the winner then scores 1 and the rest 0).", example: "model" }),
    model: z.string().openapi({ example: "@cf/openai/gpt-oss-20b" }),
    meta: MetaSchema,
  })
  .openapi("ClassifyResponse");

export const TranslateResponseSchema = z
  .object({
    translatedText: z.string().openapi({ example: "Su factura está adjunta. Páguela en un plazo de 14 días." }),
    sourceLanguage: z.string().openapi({ description: "Language used as the source. Detected when you omitted source.", example: "en" }),
    sourceLanguageDetected: z.boolean().openapi({ description: "True when the source language came from the built-in detector.", example: false }),
    targetLanguage: z.string().openapi({ example: "es" }),
    characters: z.number().int().openapi({ example: 54 }),
    model: z.string().openapi({ example: "@cf/meta/m2m100-1.2b" }),
    meta: MetaSchema,
  })
  .openapi("TranslateResponse");
