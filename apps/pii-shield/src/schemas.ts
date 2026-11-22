import { z } from "@api/core";
import { PII_TYPES } from "./lib/detectors";
import { MODERATION_ACTIONS } from "./lib/moderate";
import { PROFANITY_LANGS, SEVERITIES, TERM_CATEGORIES } from "./lib/profanity";
import { REDACTION_STYLES } from "./lib/redact";
import { SPAM_BANDS } from "./lib/spam";
import { MAX_BODY_TEXT_CHARS, MAX_TEXT_CHARS } from "./lib/limits";

const TEXT_DESCRIPTION =
  "Free text to analyse. Up to " +
  MAX_TEXT_CHARS.toLocaleString("en-US") +
  " characters; longer payloads are rejected with 413 PAYLOAD_TOO_LARGE before any analysis runs.";

/** ------------------------------------------------------------------ inputs */

export const PiiTypeSchema = z.enum(PII_TYPES).openapi({
  description: "Detector id. See GET /v1/types for the full catalogue.",
  example: "EMAIL",
});

export const TextBodySchema = z.object({
  text: z.string().min(1).max(MAX_BODY_TEXT_CHARS).openapi({
    description: TEXT_DESCRIPTION,
    example: "Contact Jane Doe at jane.doe@example.com or +1 (555) 123-4567.",
  }),
});

export const ScanBodySchema = z.object({
  text: z.string().min(1).max(MAX_BODY_TEXT_CHARS).openapi({
    description: TEXT_DESCRIPTION,
    example: "Card 4111 1111 1111 1111, SSH from 203.0.113.42, key AKIAIOSFODNN7EXAMPLE.",
  }),
  types: z
    .array(PiiTypeSchema)
    .min(1)
    .max(PII_TYPES.length)
    .optional()
    .openapi({
      description: "Restrict the scan to these detectors. Omit to run all 19 detectors.",
      example: ["EMAIL", "CREDIT_CARD"],
    }),
  minConfidence: z.number().min(0).max(1).optional().openapi({
    description:
      "Drop findings below this confidence (0-1). Heuristic detectors report low confidence: PERSON_NAME 0.45-0.72, API_KEY 0.4-0.55, DATE_OF_BIRTH 0.5-0.78. Use 0.6 to keep only strong matches. Defaults to 0.",
    example: 0.6,
  }),
});

export const RedactBodySchema = z.object({
  text: z.string().min(1).max(MAX_BODY_TEXT_CHARS).openapi({
    description: TEXT_DESCRIPTION,
    example: "Hi, I am Jane Doe. Reach me at jane.doe@example.com or 555-123-4567.",
  }),
  types: z
    .array(PiiTypeSchema)
    .min(1)
    .max(PII_TYPES.length)
    .optional()
    .openapi({ description: "Restrict redaction to these detectors. Omit to redact everything.", example: ["EMAIL", "PHONE"] }),
  minConfidence: z.number().min(0).max(1).optional().openapi({
    description: "Only redact findings at or above this confidence (0-1). Defaults to 0.",
    example: 0.5,
  }),
  style: z.enum(REDACTION_STYLES).optional().openapi({
    description:
      "mask: keep the last 'keepLast' characters of each value. label: replace with [TYPE_n], the same label for the same value. hash: replace with [TYPE_xxxxxxxx], the first 8 hex characters of the SHA-256 of the value. Defaults to mask.",
    example: "mask",
  }),
  keepLast: z.number().int().min(0).max(8).optional().openapi({
    description:
      "mask style only: how many trailing characters of each matched value stay readable (0-8, default 4). At least one character of every match is always masked.",
    example: 4,
  }),
});

export const ProfanityBodySchema = z.object({
  text: z.string().min(1).max(MAX_BODY_TEXT_CHARS).openapi({
    description: TEXT_DESCRIPTION,
    example: "This sh1t is f.u.c.k.ing unbelievable!!!",
  }),
  langs: z
    .array(z.enum(PROFANITY_LANGS))
    .min(1)
    .max(PROFANITY_LANGS.length)
    .optional()
    .openapi({
      description: "Languages to screen. Supported: en, es, fr, de. Defaults to [\"en\"].",
      example: ["en", "es"],
    }),
});

export const ModerationBodySchema = z.object({
  text: z.string().min(1).max(MAX_BODY_TEXT_CHARS).openapi({
    description: TEXT_DESCRIPTION,
    example:
      "WIN a $1000 gift card NOW!!! Verify your account at https://bit.ly/xk9 and call 555-123-4567. Email jane.doe@example.com.",
  }),
  piiTypes: z
    .array(PiiTypeSchema)
    .min(1)
    .max(PII_TYPES.length)
    .optional()
    .openapi({ description: "Restrict the PII pass to these detectors. Omit to run all of them.", example: ["EMAIL", "PHONE"] }),
  minConfidence: z.number().min(0).max(1).optional().openapi({
    description: "Minimum confidence for PII findings (0-1). Defaults to 0.",
    example: 0.5,
  }),
  profanityLangs: z
    .array(z.enum(PROFANITY_LANGS))
    .min(1)
    .max(PROFANITY_LANGS.length)
    .optional()
    .openapi({ description: "Languages for the profanity pass. Defaults to [\"en\"].", example: ["en"] }),
});

/** ----------------------------------------------------------------- outputs */

export const FindingSchema = z
  .object({
    type: PiiTypeSchema,
    value: z.string().openapi({
      description: "Matched substring. Truncated to 256 characters when longer (see valueTruncated).",
      example: "jane.doe@example.com",
    }),
    start: z.number().int().min(0).openapi({ description: "0-based UTF-16 start offset in the submitted text.", example: 17 }),
    end: z.number().int().min(0).openapi({ description: "0-based end offset, exclusive.", example: 37 }),
    confidence: z.number().min(0).max(1).openapi({
      description: "Detector confidence for this match. Checksum-backed detections are 0.9 and above; heuristics are lower.",
      example: 0.99,
    }),
    validator: z.string().optional().openapi({
      description: "Validator applied to the match, when any.",
      example: "email-syntax",
    }),
    detail: z.string().optional().openapi({
      description: "Optional detector specific note: card brand, IBAN country, wallet chain, entropy estimate.",
      example: "visa",
    }),
    valueTruncated: z.boolean().optional().openapi({
      description: "True when the original value was longer than 256 characters and value holds only its prefix.",
      example: true,
    }),
  })
  .openapi("Finding");

export const SpanSchema = z
  .object({
    start: z.number().int().min(0).openapi({ example: 17 }),
    end: z.number().int().min(0).openapi({ example: 37 }),
    length: z.number().int().min(0).openapi({ example: 20 }),
    types: z.array(PiiTypeSchema).openapi({ description: "Detectors merged into this span.", example: ["EMAIL"] }),
  })
  .openapi("Span");

export const RiskSchema = z
  .object({
    level: z.enum(["none", "low", "medium", "high", "critical"]).openapi({
      description: "Risk band derived from the score. It never contains the raw values.",
      example: "medium",
    }),
    score: z.number().min(0).max(100).openapi({
      description: "0-100 weighted risk score: per-detector weight, with a small multiplier for repeated hits.",
      example: 42,
    }),
    detectedTypes: z.array(PiiTypeSchema).openapi({
      description: "Distinct detector ids that produced at least one finding, sorted.",
      example: ["CREDIT_CARD", "EMAIL"],
    }),
  })
  .openapi("RiskSummary");

export const CountsSchema = z.record(z.string(), z.number().int()).openapi({
  description: "Findings per detector id. Detectors with no findings are omitted.",
  example: { EMAIL: 2, PHONE: 1 },
});

export const ScanResponseSchema = z
  .object({
    textLength: z.number().int().min(0).openapi({ description: "Characters analysed.", example: 64 }),
    findings: z.array(FindingSchema).openapi({ description: "Non-overlapping findings sorted by start offset (maximum 2,000)." }),
    counts: CountsSchema,
    spans: z.array(SpanSchema).openapi({ description: "Merged, non-overlapping character spans that a redactor would replace." }),
    risk: RiskSchema,
    truncated: z.boolean().openapi({ description: "True when more than 2,000 findings were detected and the list was cut.", example: false }),
    durationMs: z.number().openapi({ description: "Server side processing time.", example: 4 }),
  })
  .openapi("ScanResult");

export const HashEntrySchema = z
  .object({
    hash: z.string().openapi({ description: "First 8 hex characters of the SHA-256 of the value.", example: "9f2b7c4d" }),
    type: PiiTypeSchema,
    occurrences: z.number().int().min(1).openapi({ description: "How often this exact value occurred.", example: 2 }),
    firstStart: z.number().int().min(0).openapi({ description: "Offset of the first occurrence.", example: 17 }),
  })
  .openapi("HashMapping");

export const RedactResponseSchema = z
  .object({
    redactedText: z.string().openapi({ description: "Input text with every finding replaced according to style.", example: "Contact Jane Doe at ***@***.com." }),
    style: z.enum(REDACTION_STYLES).openapi({ example: "mask" }),
    keepLast: z.number().int().min(0).max(8).openapi({ description: "Effective keepLast for style mask; 0 for the other styles.", example: 4 }),
    replacementCount: z.number().int().min(0).openapi({ example: 2 }),
    changed: z.boolean().openapi({ description: "False when nothing matched and redactedText equals the input.", example: true }),
    findings: z.array(FindingSchema),
    counts: CountsSchema,
    spans: z.array(SpanSchema),
    risk: RiskSchema,
    mapping: z.array(HashEntrySchema).optional().openapi({
      description: "Present only for style hash. Correlates identical values without echoing them; it is a fingerprint, not a reversible cipher.",
    }),
    truncated: z.boolean().openapi({ example: false }),
    durationMs: z.number().openapi({ example: 5 }),
  })
  .openapi("RedactResult");

export const ProfanityMatchSchema = z
  .object({
    term: z.string().openapi({ description: "Normalised lexicon term that matched.", example: "fuck" }),
    matched: z.string().openapi({ description: "Substring exactly as it appeared in the input.", example: "f.u.c.k" }),
    start: z.number().int().min(0).openapi({ example: 12 }),
    end: z.number().int().min(0).openapi({ example: 19 }),
    severity: z.enum(SEVERITIES).openapi({ example: "high" }),
    category: z.enum(TERM_CATEGORIES).openapi({ description: "profanity | sexual | promotional", example: "profanity" }),
    lang: z.enum(PROFANITY_LANGS).openapi({ example: "en" }),
    masked: z.string().openapi({ description: "First character plus asterisks, safe to log.", example: "f******" }),
    snippet: z.string().openapi({ description: "About 25 characters of context on each side with the match itself masked.", example: "...this f****** is..." }),
    obfuscated: z.boolean().openapi({ description: "True when leetspeak, repeated letters or separators had to be undone.", example: true }),
  })
  .openapi("ProfanityMatch");

export const ProfanityResponseSchema = z
  .object({
    isProfane: z.boolean().openapi({ description: "True when at least one lexicon term matched.", example: true }),
    score: z.number().min(0).max(100).openapi({
      description: "Weighted severity score: low 10, medium 25, high 50 per match, capped at 100.",
      example: 50,
    }),
    highestSeverity: z.enum(SEVERITIES).nullable().openapi({ example: "high" }),
    counts: z
      .object({ low: z.number().int(), medium: z.number().int(), high: z.number().int() })
      .openapi({ description: "Matches per severity.", example: { low: 0, medium: 0, high: 1 } }),
    matches: z.array(ProfanityMatchSchema).openapi({ description: "Matches sorted by offset, maximum 100." }),
    languages: z.array(z.enum(PROFANITY_LANGS)).openapi({ example: ["en"] }),
    truncated: z.boolean().openapi({ example: false }),
    durationMs: z.number().openapi({ example: 3 }),
  })
  .openapi("ProfanityResult");

export const SpamSignalSchema = z
  .object({
    id: z.string().openapi({ example: "shortener_link" }),
    label: z.string().openapi({ example: "Link shortener domain" }),
    weight: z.number().int().min(0).openapi({ description: "Maximum points this signal can contribute.", example: 14 }),
    points: z.number().int().min(0).openapi({ description: "Points this text contributed.", example: 10 }),
    evidence: z.array(z.string()).openapi({
      description: "Short, value-free evidence strings (counts and matched phrases).",
      example: ["bit.ly"],
    }),
  })
  .openapi("SpamSignal");

export const SpamFeaturesSchema = z
  .object({
    characters: z.number().int().min(0).openapi({ example: 120 }),
    words: z.number().int().min(0).openapi({ example: 18 }),
    links: z.number().int().min(0).openapi({ example: 2 }),
    shortenerLinks: z.number().int().min(0).openapi({ example: 1 }),
    exclamations: z.number().int().min(0).openapi({ example: 5 }),
    capsWords: z.number().int().min(0).openapi({ example: 4 }),
    emojis: z.number().int().min(0).openapi({ example: 0 }),
    repeatedRuns: z.number().int().min(0).openapi({ example: 1 }),
    hasPhone: z.boolean().openapi({ example: true }),
  })
  .openapi("SpamFeatures");

export const SpamResponseSchema = z
  .object({
    score: z.number().min(0).max(100).openapi({ description: "Sum of the contributing signal points, capped at 100.", example: 62 }),
    band: z.enum(SPAM_BANDS).openapi({ description: "clean < 25, suspicious 25-59, spam 60 and above.", example: "spam" }),
    isSpam: z.boolean().openapi({ example: true }),
    signals: z.array(SpamSignalSchema).openapi({ description: "Only signals that contributed points are returned." }),
    features: SpamFeaturesSchema,
    thresholds: z.object({ suspicious: z.number().int(), spam: z.number().int() }).openapi({
      description: "Band thresholds applied to the score.",
      example: { suspicious: 25, spam: 60 },
    }),
    durationMs: z.number().openapi({ example: 2 }),
  })
  .openapi("SpamResult");

export const ModerationVerdictSchema = z
  .object({
    action: z.enum(MODERATION_ACTIONS).openapi({
      description:
        "allow: nothing found. review: PII at medium/high risk, suspicious spam or any profanity. block: spam band, critical PII or a high severity profanity match.",
      example: "block",
    }),
    score: z.number().min(0).max(100).openapi({
      description: "Weighted blend: 45% PII risk, 35% spam score, 20% profanity score.",
      example: 55,
    }),
    reasons: z.array(z.string()).openapi({
      description: "Human readable reasons. Detector ids, counts and scores only, never raw values.",
      example: ["PII detected: EMAIL x1, PHONE x1 (risk medium 40/100)", "Spam score 62/100 (spam)"],
    }),
  })
  .openapi("ModerationVerdict");

export const ModerationResponseSchema = z
  .object({
    text: z
      .object({ characters: z.number().int().min(0), words: z.number().int().min(0) })
      .openapi({ description: "Input size.", example: { characters: 140, words: 22 } }),
    pii: ScanResponseSchema,
    profanity: ProfanityResponseSchema,
    spam: SpamResponseSchema,
    verdict: ModerationVerdictSchema,
    durationMs: z.number().openapi({ example: 8 }),
  })
  .openapi("ModerationResult");

export const DetectorSchema = z
  .object({
    id: PiiTypeSchema,
    label: z.string().openapi({ example: "Payment card number" }),
    description: z.string().openapi({ example: "13-19 digit number that passes the Luhn checksum." }),
    example: z.string().openapi({ example: "4111 1111 1111 1111" }),
    validator: z.string().nullable().openapi({ description: "Named validator, or null for pattern-only detectors.", example: "luhn" }),
    confidenceRange: z.object({ min: z.number(), max: z.number() }).openapi({ example: { min: 0.9, max: 0.97 } }),
    riskWeight: z.number().int().openapi({ description: "Contribution of a single hit to the risk score.", example: 42 }),
  })
  .openapi("Detector");

export const TypesResponseSchema = z
  .object({
    detectors: z.array(DetectorSchema),
    redactionStyles: z.array(z.enum(REDACTION_STYLES)).openapi({ example: ["mask", "label", "hash"] }),
    profanityLanguages: z.array(z.enum(PROFANITY_LANGS)).openapi({ example: ["en", "es", "fr", "de"] }),
    spamSignals: z.array(z.object({ id: z.string(), label: z.string(), weight: z.number().int(), description: z.string() })),
    spamBands: z.array(z.enum(SPAM_BANDS)).openapi({ example: ["clean", "suspicious", "spam"] }),
    limits: z
      .object({
        maxTextCharacters: z.number().int().openapi({ example: 200000 }),
        maxFindings: z.number().int().openapi({ example: 2000 }),
        maxProfanityMatches: z.number().int().openapi({ example: 100 }),
        maxFindingValueCharacters: z.number().int().openapi({ example: 256 }),
      })
      .openapi({ description: "Hard caps applied to every request and response." }),
  })
  .openapi("DetectorCatalogue");
