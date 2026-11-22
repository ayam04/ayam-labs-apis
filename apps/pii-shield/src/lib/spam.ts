/**
 * Deterministic spam scoring: eleven weighted heuristics combined into a 0-100
 * score. Every signal reports the points it contributed and the evidence that
 * triggered it, so a caller can explain the verdict.
 */

export const SPAM_BANDS = ["clean", "suspicious", "spam"] as const;
export type SpamBand = (typeof SPAM_BANDS)[number];

export interface SpamThresholds {
  suspicious: number;
  spam: number;
}

export const SPAM_THRESHOLDS: SpamThresholds = { suspicious: 25, spam: 60 };

export interface SpamFeatures {
  characters: number;
  words: number;
  links: number;
  shortenerLinks: number;
  exclamations: number;
  capsWords: number;
  emojis: number;
  repeatedRuns: number;
  hasPhone: boolean;
}

export interface SpamSignal {
  id: string;
  label: string;
  /** Maximum points this signal can contribute. */
  weight: number;
  /** Points actually contributed by this text. */
  points: number;
  evidence: string[];
}

export interface SpamResult {
  score: number;
  band: SpamBand;
  isSpam: boolean;
  signals: SpamSignal[];
  features: SpamFeatures;
  thresholds: SpamThresholds;
}

const SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
  "rebrand.ly",
  "shorturl.at",
  "rb.gy",
  "tiny.cc",
  "lnkd.in",
  "adf.ly",
  "bit.do",
  "s.id",
  "v.gd",
  "shrtco.de",
  "shorturl.gg",
]);

const MONEY_PHRASES = [
  "you have won",
  "you've won",
  "you have been selected",
  "claim your prize",
  "cash prize",
  "prize money",
  "lottery",
  "free money",
  "risk free",
  "100% free",
  "cash reward",
  "gift card",
  "million dollars",
  "million usd",
  "$1000",
  "$1,000",
  "guaranteed income",
  "no risk",
];

const URGENCY_PHRASES = [
  "act now",
  "limited time",
  "limited offer",
  "expires today",
  "expires soon",
  "only today",
  "last chance",
  "final notice",
  "urgent action",
  "respond within",
  "hurry up",
  "don't miss",
  "dont miss",
  "while supplies last",
  "today only",
  "immediate payment",
];

const PHISHING_PHRASES = [
  "verify your account",
  "confirm your account",
  "account will be suspended",
  "account suspended",
  "update your payment",
  "verify your identity",
  "login credentials",
  "one-time password",
  "otp code",
  "password expires",
  "click here to verify",
  "unusual sign-in",
];

const CRYPTO_PHRASES = [
  "bitcoin giveaway",
  "double your bitcoin",
  "seed phrase",
  "private key",
  "wallet address",
  "guaranteed returns",
  "guaranteed profit",
  "100% profit",
  "double your money",
  "investment opportunity",
  "airdrop",
  "usdt",
  "make money fast",
  "earn from home",
  "no experience needed",
  "passive income",
];

const LINK_RE = /(?:https?:\/\/|www\.)[^\s<>"']{2,2048}/gi;
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;
const CAPS_WORD_RE = /(?<![\p{L}])[A-Z][A-Z0-9]{2,}(?![\p{L}])/gu;
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'_-]*/gu;
const REPEAT_RE = /([A-Za-z!?.,])\1{3,}/g;
const PHONE_RE = /(?:\+\d{7,15}|\b\d{3}[-. ]\d{3}[-. ]\d{4}\b)/g;

function countMatches(text: string, pattern: RegExp): number {
  const regex = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    count += 1;
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
  }
  return count;
}

function phraseHits(haystack: string, phrases: readonly string[]): string[] {
  const hits: string[] = [];
  for (const phrase of phrases) {
    if (haystack.includes(phrase)) hits.push(phrase);
  }
  return hits;
}

function hostOf(url: string): string | null {
  const cleaned = url.replace(/^www\./i, "").replace(/^https?:\/\//i, "");
  const host = cleaned.split(/[/?#]/)[0]?.toLowerCase() ?? "";
  return host.length > 0 ? host : null;
}

function signal(id: string, label: string, weight: number, points: number, evidence: string[] = []): SpamSignal {
  return { id, label, weight, points: Math.max(0, Math.min(weight, Math.round(points))), evidence };
}

/** Score a text with the full heuristic set. Deterministic, no IO. */
export function scoreSpam(text: string): SpamResult {
  const lower = text.toLowerCase();
  const links = text.match(LINK_RE) ?? [];
  const linkHosts = links.map((link) => hostOf(link));
  const shortenerHosts = linkHosts.filter((host): host is string => host !== null && SHORTENERS.has(host));
  const words = countMatches(text, WORD_RE);
  const capsWords = countMatches(text, CAPS_WORD_RE);
  const exclamations = countMatches(text, /!/g);
  const emojis = countMatches(text, EMOJI_RE);
  const repeatedRuns = countMatches(text, REPEAT_RE);
  const hasPhone = countMatches(text, PHONE_RE) > 0;

  const features: SpamFeatures = {
    characters: text.length,
    words,
    links: links.length,
    shortenerLinks: shortenerHosts.length,
    exclamations,
    capsWords,
    emojis,
    repeatedRuns,
    hasPhone,
  };

  const signals: SpamSignal[] = [];

  const exclamationDensity = words > 0 ? exclamations / words : exclamations;
  if (exclamations >= 2) {
    signals.push(
      signal("exclamation_density", "Exclamation mark density", 16, exclamations * 2 + exclamationDensity * 24, [
        exclamations + " exclamation marks in " + words + " words",
      ]),
    );
  }

  const capsRatio = words > 0 ? capsWords / words : 0;
  if (capsWords >= 2 && capsRatio >= 0.2) {
    const points = capsRatio >= 0.5 ? 14 : capsRatio >= 0.35 ? 10 : 6;
    signals.push(
      signal("caps_ratio", "Shouting (ALL CAPS words)", 14, points, [
        capsWords + " all-caps words (" + Math.round(capsRatio * 100) + "% of text)",
      ]),
    );
  }

  if (links.length >= 2) {
    signals.push(
      signal("link_count", "Multiple links", 16, (links.length - 1) * 8, [links.length + " links"]),
    );
  }

  if (shortenerHosts.length > 0) {
    signals.push(
      signal("shortener_link", "Link shortener domain", 14, shortenerHosts.length * 10, [...new Set(shortenerHosts)].slice(0, 3)),
    );
  }

  const money = phraseHits(lower, MONEY_PHRASES);
  if (money.length > 0) {
    signals.push(signal("money_prize", "Money or prize promise", 20, money.length * 7, money.slice(0, 3)));
  }

  const urgency = phraseHits(lower, URGENCY_PHRASES);
  if (urgency.length > 0) {
    signals.push(signal("urgency", "Artificial urgency", 14, urgency.length * 5, urgency.slice(0, 3)));
  }

  const phishing = phraseHits(lower, PHISHING_PHRASES);
  if (phishing.length > 0) {
    signals.push(signal("phishing_request", "Credential or account phishing", 14, phishing.length * 7, phishing.slice(0, 3)));
  }

  if (emojis >= 3) {
    signals.push(signal("emoji_density", "Excessive emoji", 10, emojis * 2 + 2, [emojis + " emoji characters"]));
  }

  if (repeatedRuns >= 1) {
    signals.push(signal("repeated_chars", "Repeated characters", 8, repeatedRuns * 4, [repeatedRuns + " repeated-character runs"]));
  }

  if (hasPhone && links.length >= 1) {
    signals.push(signal("phone_plus_link", "Phone number combined with a link", 14, 14, ["phone number and link in the same message"]));
  }

  const crypto = phraseHits(lower, CRYPTO_PHRASES);
  if (crypto.length > 0) {
    signals.push(signal("crypto_scam", "Crypto or get-rich-quick phrasing", 20, crypto.length * 10, crypto.slice(0, 3)));
  }

  const score = Math.min(100, signals.reduce((total, item) => total + item.points, 0));
  const band: SpamBand = score >= SPAM_THRESHOLDS.spam ? "spam" : score >= SPAM_THRESHOLDS.suspicious ? "suspicious" : "clean";

  return {
    score,
    band,
    isSpam: band === "spam",
    signals,
    features,
    thresholds: { ...SPAM_THRESHOLDS },
  };
}

/** Catalogue used by /v1/types so the weights are discoverable. */
export const SPAM_SIGNAL_META: readonly { id: string; label: string; weight: number; description: string }[] = [
  { id: "exclamation_density", label: "Exclamation mark density", weight: 16, description: "Two or more '!' and the ratio of '!' to words." },
  { id: "caps_ratio", label: "Shouting (ALL CAPS words)", weight: 14, description: "Share of words written in capitals (3+ letters)." },
  { id: "link_count", label: "Multiple links", weight: 16, description: "One extra link is normal; two or more is a bulk signature." },
  { id: "shortener_link", label: "Link shortener domain", weight: 14, description: "bit.ly, tinyurl and 16 other shortener hosts." },
  { id: "money_prize", label: "Money or prize promise", weight: 20, description: "Prize, lottery and free-money phrases." },
  { id: "urgency", label: "Artificial urgency", weight: 14, description: "'act now', 'last chance', 'today only' style pressure." },
  { id: "phishing_request", label: "Credential or account phishing", weight: 14, description: "Account verification and payment update requests." },
  { id: "emoji_density", label: "Excessive emoji", weight: 10, description: "Three or more emoji characters." },
  { id: "repeated_chars", label: "Repeated characters", weight: 8, description: "Runs of four or more identical characters." },
  { id: "phone_plus_link", label: "Phone number combined with a link", weight: 14, description: "The classic cold-outreach spam shape." },
  { id: "crypto_scam", label: "Crypto or get-rich-quick phrasing", weight: 20, description: "Giveaway, seed phrase and guaranteed-return phrases." },
];
