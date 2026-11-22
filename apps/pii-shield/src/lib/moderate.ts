/**
 * Combined moderation: PII + profanity + spam in a single deterministic pass.
 * The verdict is a transparent weighted blend; every reason is a short string
 * without raw personal data.
 */
import { scanText, type ScanResult } from "./pii";
import { checkProfanity, type ProfanityLang, type ProfanityResult } from "./profanity";
import { scoreSpam, type SpamResult } from "./spam";
import type { PiiType } from "./detectors";

export const MODERATION_ACTIONS = ["allow", "review", "block"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export interface ModerationOptions {
  piiTypes?: readonly PiiType[];
  minConfidence?: number;
  langs?: readonly ProfanityLang[];
}

export interface ModerationVerdict {
  action: ModerationAction;
  score: number;
  reasons: string[];
}

export interface ModerationResult {
  text: { characters: number; words: number };
  pii: ScanResult;
  profanity: ProfanityResult;
  spam: SpamResult;
  verdict: ModerationVerdict;
}

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'_-]*/gu;

function countWords(text: string): number {
  let count = 0;
  const regex = new RegExp(WORD_RE.source, "gu");
  while (regex.exec(text) !== null) count += 1;
  return count;
}

/** Run all three detectors and produce the combined verdict. */
export function moderate(text: string, options: ModerationOptions = {}): ModerationResult {
  const pii = scanText(text, { types: options.piiTypes, minConfidence: options.minConfidence });
  const profanity = checkProfanity(text, options.langs ?? ["en"]);
  const spam = scoreSpam(text);

  const reasons: string[] = [];
  const score = Math.round(pii.risk.score * 0.45 + spam.score * 0.35 + profanity.score * 0.2);

  if (pii.findings.length > 0) {
    const types = pii.risk.detectedTypes
      .slice(0, 6)
      .map((type) => type + " x" + (pii.counts[type] ?? 0))
      .join(", ");
    reasons.push("PII detected: " + types + " (risk " + pii.risk.level + " " + pii.risk.score + "/100)");
  }
  if (spam.score > 0) {
    reasons.push("Spam score " + spam.score + "/100 (" + spam.band + ")");
  }
  if (profanity.isProfane) {
    reasons.push(
      "Profanity: " +
        profanity.matches.length +
        " match(es), highest severity " +
        (profanity.highestSeverity ?? "none") +
        " (score " +
        profanity.score +
        "/100)",
    );
  }
  if (reasons.length === 0) reasons.push("No PII, profanity or spam signals found");

  let action: ModerationAction = "allow";
  if (spam.band === "spam" || pii.risk.level === "critical" || profanity.highestSeverity === "high") {
    action = "block";
  } else if (spam.band === "suspicious" || pii.risk.level === "medium" || pii.risk.level === "high" || profanity.isProfane) {
    action = "review";
  }

  return {
    text: { characters: text.length, words: countWords(text) },
    pii,
    profanity,
    spam,
    verdict: { action, score, reasons },
  };
}
