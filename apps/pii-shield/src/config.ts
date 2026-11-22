import type { ApiConfig } from "@api/core";

export const config: ApiConfig = {
  name: "pii-shield",
  title: "PII Shield API",
  version: "1.0.0",
  summary: "Detect, redact and score personal data, profanity and spam in text. Deterministic, zero upstream calls.",
  description: [
    "One deterministic pass over a piece of text that tells you what personal data it contains, what to replace, how abusive it is and how spammy it looks.",
    "",
    "**Detect:** 19 detectors - email, phone, payment cards (Luhn), IBAN (mod-97), US SSN, IPv4/IPv6, URL, birth dates, passport and licence numbers (label driven), postal addresses, person names (dictionary heuristic), API keys (entropy heuristic), JWTs, crypto wallets (base58check verified), MAC addresses, GitHub tokens and AWS key ids. Findings carry a 0-1 confidence and never overlap.",
    "",
    "**Redact:** three styles. Mask keeps the last N characters, label emits stable [EMAIL_1] tokens per distinct value, hash emits [EMAIL_xxxxxxxx] from the first 8 hex characters of the value's SHA-256 so identical values correlate across documents.",
    "",
    "**Screen:** a four language profanity lexicon (en, es, fr, de) that undoes leetspeak, repeated letters and single-character separators, plus an 11 signal spam score with the points and evidence behind every signal.",
    "",
    "**Limits, stated plainly:** detection is regex plus checksum plus small dictionaries. It will miss unusual formats (spaced-out card numbers, names outside the dictionary, non-Latin scripts) and it cannot know whether a string is personal data without context - a bare date is reported at confidence 0.5 unless a birth keyword is nearby. Passport, licence and street addresses need their usual labels. No ML model, no data leaves the edge, no upstream calls: identical input always returns identical output.",
    "",
    "**Built for:** LLM prompt sanitisers, customer support desks, log pipelines, UGC platforms, GDPR/SOC2 evidence runs.",
  ].join("\n"),
  baseUrl: "https://piishield.ayamk.in",
  tags: [
    { name: "Scan", description: "Find personal data without changing the text" },
    { name: "Redact", description: "Replace personal data with masks, labels or hashes" },
    { name: "Screening", description: "Profanity, spam and the combined moderation verdict" },
    { name: "Catalogue", description: "Machine readable detector and signal metadata" },
  ],
  termsOfService: "https://example.com/terms",
  directRateLimitPerMinute: 120,
};