import { ApiError, commonErrors, defineApi } from "@api/core";
import { createRoute } from "@hono/zod-openapi";
import { config } from "./config";
import {
  ModerationBodySchema,
  ModerationResponseSchema,
  ProfanityBodySchema,
  ProfanityResponseSchema,
  RedactBodySchema,
  RedactResponseSchema,
  ScanBodySchema,
  ScanResponseSchema,
  SpamResponseSchema,
  TextBodySchema,
  TypesResponseSchema,
} from "./schemas";
import { DETECTORS } from "./lib/detectors";
import { MAX_TEXT_CHARS, MAX_FINDINGS_OUTPUT, MAX_PROFANITY_OUTPUT, MAX_FINDING_VALUE_CHARS } from "./lib/limits";
import { scanText } from "./lib/pii";
import { redactText, REDACTION_STYLES } from "./lib/redact";
import { checkProfanity, PROFANITY_LANGS } from "./lib/profanity";
import { scoreSpam, SPAM_SIGNAL_META, SPAM_BANDS } from "./lib/spam";
import { moderate } from "./lib/moderate";

/* eslint-disable @typescript-eslint/no-explicit-any */
const jsonContent = (schema: any) => ({ "application/json": { schema } });

/** Reject oversized input before any detector runs. */
function enforceTextLimit(text: string): void {
  if (text.length > MAX_TEXT_CHARS) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Text exceeds the " + MAX_TEXT_CHARS + " character limit", {
      details: { length: text.length, limit: MAX_TEXT_CHARS },
      hint: "Split the document into chunks of at most " + MAX_TEXT_CHARS + " characters and call the endpoint per chunk.",
    });
  }
}

const scanRoute = createRoute({
  method: "post",
  path: "/v1/scan",
  tags: ["Scan"],
  summary: "Detect personal data and secrets in free text",
  description:
    "Runs every requested detector over the text and returns non-overlapping findings sorted by offset, counts per detector, merged replacement spans and a 0-100 risk summary. Checksum backed detectors (Luhn, IBAN mod-97, base58check) only report values that pass their check; heuristics such as PERSON_NAME and API_KEY report confidence below 0.6. Maximum 2,000 findings per response.",
  request: { body: { content: jsonContent(ScanBodySchema), required: true } },
  responses: {
    200: { description: "Scan result", content: jsonContent(ScanResponseSchema) },
    ...commonErrors,
  },
});

const redactRoute = createRoute({
  method: "post",
  path: "/v1/redact",
  tags: ["Redact"],
  summary: "Return the text with personal data masked, labelled or hashed",
  description:
    "Same detection pass as /v1/scan, then replaces each finding. mask keeps the last keepLast characters, label uses stable [TYPE_n] tokens per distinct value, hash uses [TYPE_xxxxxxxx] built from the first 8 hex characters of the value's SHA-256 and additionally returns a mapping of hash to occurrence count. Raw values are never echoed in the mapping.",
  request: { body: { content: jsonContent(RedactBodySchema), required: true } },
  responses: {
    200: { description: "Redaction result", content: jsonContent(RedactResponseSchema) },
    ...commonErrors,
  },
});

const profanityRoute = createRoute({
  method: "post",
  path: "/v1/profanity",
  tags: ["Screening"],
  summary: "Screen text for profanity, sexual and promotional terms",
  description:
    "Matches a hand written lexicon in English, Spanish, French and German after undoing leetspeak (0 to o, 1 to i, @ to a), repeated letters and single-character punctuation separators such as f.u.c.k. Every match reports its severity (low/medium/high), category, a masked term and a masked context snippet. No slurs are shipped in the lexicon.",
  request: { body: { content: jsonContent(ProfanityBodySchema), required: true } },
  responses: {
    200: { description: "Profanity result", content: jsonContent(ProfanityResponseSchema) },
    ...commonErrors,
  },
});

const spamRoute = createRoute({
  method: "post",
  path: "/v1/spam",
  tags: ["Screening"],
  summary: "Score text from 0 to 100 with 11 spam heuristics",
  description:
    "Additive heuristic scoring: exclamation density, ALL CAPS ratio, link count, shortener domains, money and prize phrases, urgency phrases, credential phishing, emoji density, repeated characters, phone plus link, and crypto scam phrasing. Returns the score, the band (clean, suspicious or spam) and every contributing signal with its maximum weight, awarded points and short evidence strings.",
  request: { body: { content: jsonContent(TextBodySchema), required: true } },
  responses: {
    200: { description: "Spam score", content: jsonContent(SpamResponseSchema) },
    ...commonErrors,
  },
});

const moderationRoute = createRoute({
  method: "post",
  path: "/v1/moderation",
  tags: ["Screening"],
  summary: "Combined PII, profanity and spam moderation in one call",
  description:
    "Flagship endpoint: one pass returns the full PII scan, the profanity result, the spam score and a combined verdict (allow, review or block) scored 45% PII risk, 35% spam and 20% profanity. Every reason names detector ids, counts and scores only - never raw values.",
  request: { body: { content: jsonContent(ModerationBodySchema), required: true } },
  responses: {
    200: { description: "Combined moderation result", content: jsonContent(ModerationResponseSchema) },
    ...commonErrors,
  },
});

const typesRoute = createRoute({
  method: "get",
  path: "/v1/types",
  tags: ["Catalogue"],
  summary: "List every detector, redaction style and spam signal",
  description:
    "Machine readable metadata for the whole API: detector id, label, description, example, validator, confidence range and risk weight; the three redaction styles; the four profanity languages; the 11 spam signals with weights; and the hard request and response caps. Use it to build a UI or to pick the types you pass to /v1/scan.",
  responses: {
    200: { description: "Detector catalogue", content: jsonContent(TypesResponseSchema) },
    ...commonErrors,
  },
});

const app = defineApi(config, (app) => {
  app.openapi(scanRoute, (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    enforceTextLimit(body.text);
    const result = scanText(body.text, { types: body.types, minConfidence: body.minConfidence });
    return c.json(
      {
        textLength: result.textLength,
        findings: result.findings,
        counts: result.counts,
        spans: result.spans,
        risk: result.risk,
        truncated: result.truncated,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(redactRoute, (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    enforceTextLimit(body.text);
    const result = redactText(body.text, {
      types: body.types,
      minConfidence: body.minConfidence,
      style: body.style,
      keepLast: body.keepLast,
    });
    return c.json(
      {
        redactedText: result.redactedText,
        style: result.style,
        keepLast: result.keepLast,
        replacementCount: result.replacementCount,
        changed: result.changed,
        findings: result.findings,
        counts: result.counts,
        spans: result.spans,
        risk: result.risk,
        ...(result.mapping ? { mapping: result.mapping } : {}),
        truncated: result.truncated,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(profanityRoute, (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    enforceTextLimit(body.text);
    const result = checkProfanity(body.text, body.langs ?? ["en"]);
    return c.json(
      {
        isProfane: result.isProfane,
        score: result.score,
        highestSeverity: result.highestSeverity,
        counts: result.counts,
        matches: result.matches,
        languages: result.languages,
        truncated: result.truncated,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(spamRoute, (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    enforceTextLimit(body.text);
    const result = scoreSpam(body.text);
    return c.json(
      {
        score: result.score,
        band: result.band,
        isSpam: result.isSpam,
        signals: result.signals,
        features: result.features,
        thresholds: result.thresholds,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(moderationRoute, (c) => {
    const started = Date.now();
    const body = c.req.valid("json");
    enforceTextLimit(body.text);
    const result = moderate(body.text, {
      piiTypes: body.piiTypes,
      minConfidence: body.minConfidence,
      langs: body.profanityLangs,
    });
    return c.json(
      {
        text: result.text,
        pii: {
          textLength: result.pii.textLength,
          findings: result.pii.findings,
          counts: result.pii.counts,
          spans: result.pii.spans,
          risk: result.pii.risk,
          truncated: result.pii.truncated,
          durationMs: Date.now() - started,
        },
        profanity: {
          isProfane: result.profanity.isProfane,
          score: result.profanity.score,
          highestSeverity: result.profanity.highestSeverity,
          counts: result.profanity.counts,
          matches: result.profanity.matches,
          languages: result.profanity.languages,
          truncated: result.profanity.truncated,
          durationMs: Date.now() - started,
        },
        spam: {
          score: result.spam.score,
          band: result.spam.band,
          isSpam: result.spam.isSpam,
          signals: result.spam.signals,
          features: result.spam.features,
          thresholds: result.spam.thresholds,
          durationMs: Date.now() - started,
        },
        verdict: result.verdict,
        durationMs: Date.now() - started,
      },
      200,
    );
  });

  app.openapi(typesRoute, (c) => {
    return c.json(
      {
        detectors: DETECTORS.map((detector) => ({
          id: detector.id,
          label: detector.label,
          description: detector.description,
          example: detector.example,
          validator: detector.validator,
          confidenceRange: detector.confidenceRange,
          riskWeight: detector.riskWeight,
        })),
        redactionStyles: [...REDACTION_STYLES],
        profanityLanguages: [...PROFANITY_LANGS],
        spamSignals: SPAM_SIGNAL_META.map((signal) => ({
          id: signal.id,
          label: signal.label,
          weight: signal.weight,
          description: signal.description,
        })),
        spamBands: [...SPAM_BANDS],
        limits: {
          maxTextCharacters: MAX_TEXT_CHARS,
          maxFindings: MAX_FINDINGS_OUTPUT,
          maxProfanityMatches: MAX_PROFANITY_OUTPUT,
          maxFindingValueCharacters: MAX_FINDING_VALUE_CHARS,
        },
      },
      200,
    );
  });
});

export default app;
