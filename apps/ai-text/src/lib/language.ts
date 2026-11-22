/**
 * Language detection over twelve languages.
 *
 * Two signals are combined:
 *
 *  1. written script share (Cyrillic, Arabic, Devanagari, Han) - decisive when a
 *     text is written in one of them,
 *  2. for Latin script: stopword coverage plus character trigram cosine
 *     similarity against a short built-in sample per language.
 *
 *   score = 0.65 * stopword coverage + 0.35 * trigram similarity, scaled by the
 *           share of Latin letters in the text.
 *
 * The samples are a few sentences each, so closely related languages (Spanish
 * and Portuguese, Swedish and Dutch) can be confused on very short inputs. The
 * confidence value reflects the margin between the best and second candidate.
 */
import { LANGUAGE_NAMES, STOPWORDS, foldAccents } from "./stopwords";
import { clamp, normalizeText, round, tokenize } from "./text";

export const SUPPORTED_LANGUAGE_CODES = ["en", "es", "fr", "de", "it", "pt", "nl", "sv", "ru", "ar", "hi", "zh"] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number];

const SCRIPT_LANGUAGES = ["ru", "ar", "hi", "zh"] as const;
const LATIN_LANGUAGES = ["en", "es", "fr", "de", "it", "pt", "nl", "sv"] as const;

const SAMPLES: Readonly<Record<string, string>> = {
  en: "The quick brown fox jumps over the lazy dog. We should consider how the new policy will affect our customers and the business.",
  es: "El r\u00E1pido zorro marr\u00F3n salta sobre el perro perezoso. Debemos considerar c\u00F3mo la nueva pol\u00EDtica afectar\u00E1 a nuestros clientes y al negocio.",
  fr: "Le renard brun rapide saute par-dessus le chien paresseux. Nous devons r\u00E9fl\u00E9chir \u00E0 la mani\u00E8re dont cette nouvelle politique affectera nos clients.",
  de: "Der schnelle braune Fuchs springt \u00FCber den faulen Hund. Wir m\u00FCssen \u00FCberlegen, wie sich die neue Richtlinie auf unsere Kunden auswirkt.",
  it: "La veloce volpe marrone salta sopra il cane pigro. Dobbiamo considerare come la nuova politica influenzer\u00E0 i nostri clienti.",
  pt: "A r\u00E1pida raposa marrom salta sobre o c\u00E3o pregui\u00E7oso. Precisamos considerar como a nova pol\u00EDtica afetar\u00E1 os nossos clientes.",
  nl: "De snelle bruine vos springt over de luie hond. We moeten nadenken over hoe het nieuwe beleid onze klanten zal be\u00EFnvloeden.",
  sv: "Den snabba bruna r\u00E4ven hoppar \u00F6ver den lata hunden. Vi m\u00E5ste \u00F6verv\u00E4ga hur den nya policyn kommer att p\u00E5verka v\u00E5ra kunder.",
  ru: "\u0411\u044B\u0441\u0442\u0440\u0430\u044F \u043A\u043E\u0440\u0438\u0447\u043D\u0435\u0432\u0430\u044F \u043B\u0438\u0441\u0430 \u043F\u0440\u044B\u0433\u0430\u0435\u0442 \u0447\u0435\u0440\u0435\u0437 \u043B\u0435\u043D\u0438\u0432\u0443\u044E \u0441\u043E\u0431\u0430\u043A\u0443. \u041D\u0430\u043C \u043D\u0443\u0436\u043D\u043E \u043F\u043E\u0434\u0443\u043C\u0430\u0442\u044C \u043E \u0442\u043E\u043C, \u043A\u0430\u043A \u043D\u043E\u0432\u0430\u044F \u043F\u043E\u043B\u0438\u0442\u0438\u043A\u0430 \u043F\u043E\u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u043D\u0430\u0448\u0438\u0445 \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432.",
  ar: "\u0627\u0644\u062B\u0639\u0644\u0628 \u0627\u0644\u0628\u0646\u064A \u0627\u0644\u0633\u0631\u064A\u0639 \u064A\u0642\u0641\u0632 \u0641\u0648\u0642 \u0627\u0644\u0643\u0644\u0628 \u0627\u0644\u0643\u0633\u0648\u0644. \u0646\u062D\u062A\u0627\u062C \u0625\u0644\u0649 \u0627\u0644\u062A\u0641\u0643\u064A\u0631 \u0641\u064A \u0643\u064A\u0641\u064A\u0629 \u062A\u0623\u062B\u064A\u0631 \u0627\u0644\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0639\u0644\u0649 \u0639\u0645\u0644\u0627\u0626\u0646\u0627.",
  hi: "\u0924\u0947\u091C\u093C \u092D\u0942\u0930\u0940 \u0932\u094B\u092E\u0921\u093C\u0940 \u0906\u0932\u0938\u0940 \u0915\u0941\u0924\u094D\u0924\u0947 \u0915\u0947 \u090A\u092A\u0930 \u0915\u0942\u0926\u0924\u0940 \u0939\u0948\u0964 \u0939\u092E\u0947\u0902 \u092F\u0939 \u0935\u093F\u091A\u093E\u0930 \u0915\u0930\u0928\u093E \u091A\u093E\u0939\u093F\u090F \u0915\u093F \u0928\u0908 \u0928\u0940\u0924\u093F \u0939\u092E\u093E\u0930\u0947 \u0917\u094D\u0930\u093E\u0939\u0915\u094B\u0902 \u0915\u094B \u0915\u0948\u0938\u0947 \u092A\u094D\u0930\u092D\u093E\u0935\u093F\u0924 \u0915\u0930\u0947\u0917\u0940\u0964",
  zh: "\u654F\u6377\u7684\u68D5\u8272\u72D0\u72F8\u8DF3\u8FC7\u4E86\u61D2\u72D7\u3002\u6211\u4EEC\u9700\u8981\u8003\u8651\u65B0\u653F\u7B56\u5C06\u5982\u4F55\u5F71\u54CD\u6211\u4EEC\u7684\u5BA2\u6237\u548C\u4E1A\u52A1\u3002",
};

export interface LanguageCandidate {
  language: string;
  name: string;
  /** Detection score in [0, 1]; meaningful only relative to the other candidates. */
  score: number;
}

export interface ScriptShares {
  latin: number;
  cyrillic: number;
  arabic: number;
  devanagari: number;
  han: number;
  other: number;
}

export interface LanguageResult {
  /** Detected ISO 639-1 code, or "unknown" when no signal was found. */
  language: string;
  languageName: string;
  /** Detector confidence in [0, 1]. */
  confidence: number;
  isReliable: boolean;
  candidates: LanguageCandidate[];
  scripts: ScriptShares;
  words: number;
  method: "unicode-script" | "stopword+trigram" | "none";
}

function trigramProfile(text: string): Map<string, number> {
  const cleaned = foldAccents(text.toLowerCase())
    .replace(/[^\p{L} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const profile = new Map<string, number>();
  for (let index = 0; index + 3 <= cleaned.length; index += 1) {
    const gram = cleaned.slice(index, index + 3);
    profile.set(gram, (profile.get(gram) ?? 0) + 1);
  }
  return profile;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const value of a.values()) normA += value * value;
  for (const value of b.values()) normB += value * value;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const [gram, value] of small) {
    const other = large.get(gram);
    if (other !== undefined) dot += value * other;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const SAMPLE_PROFILES: ReadonlyMap<string, Map<string, number>> = new Map(
  Object.entries(SAMPLES).map(([code, sample]) => [code, trigramProfile(sample)]),
);

const STOPWORD_SETS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries(STOPWORDS).map(([code, words]) => [code, new Set((words as string[]).map((word) => foldAccents(word.toLowerCase())))]),
);

function scriptShares(text: string): ScriptShares {
  let latin = 0;
  let cyrillic = 0;
  let arabic = 0;
  let devanagari = 0;
  let han = 0;
  let other = 0;
  for (const character of text) {
    if (/\p{Script=Latin}/u.test(character)) latin += 1;
    else if (/\p{Script=Cyrillic}/u.test(character)) cyrillic += 1;
    else if (/\p{Script=Arabic}/u.test(character)) arabic += 1;
    else if (/\p{Script=Devanagari}/u.test(character)) devanagari += 1;
    else if (/\p{Script=Han}/u.test(character)) han += 1;
    else if (/\p{L}/u.test(character)) other += 1;
  }
  const total = latin + cyrillic + arabic + devanagari + han + other;
  if (total === 0) return { latin: 0, cyrillic: 0, arabic: 0, devanagari: 0, han: 0, other: 0 };
  return {
    latin: round(latin / total, 3),
    cyrillic: round(cyrillic / total, 3),
    arabic: round(arabic / total, 3),
    devanagari: round(devanagari / total, 3),
    han: round(han / total, 3),
    other: round(other / total, 3),
  };
}

export function detectLanguage(text: string): LanguageResult {
  const normalized = normalizeText(text);
  const scripts = scriptShares(normalized);
  const tokens = tokenize(foldAccents(normalized.toLowerCase()));
  const words = tokens.length;
  const scores = new Map<string, number>();

  const scriptShareByLanguage: Record<string, number> = {
    ru: scripts.cyrillic,
    ar: scripts.arabic,
    hi: scripts.devanagari,
    zh: scripts.han,
  };

  for (const code of SCRIPT_LANGUAGES) scores.set(code, scriptShareByLanguage[code]);

  if (scripts.latin > 0) {
    const profile = trigramProfile(normalized);
    const seen = new Set(tokens);
    for (const code of LATIN_LANGUAGES) {
      const stopwordSet = STOPWORD_SETS.get(code) as ReadonlySet<string>;
      let hits = 0;
      for (const token of seen) if (stopwordSet.has(token)) hits += 1;
      // Coverage is measured over the vocabulary, not the raw token count, so a
      // long document that repeats the same few stopwords still scores fairly.
      const coverage = seen.size === 0 ? 0 : Math.min(1, hits / seen.size);
      const sample = SAMPLE_PROFILES.get(code) as Map<string, number>;
      const similarity = cosineSimilarity(profile, sample);
      const score = (0.65 * coverage + 0.35 * similarity) * scripts.latin;
      scores.set(code, score);
    }
  }

  const ranked = SUPPORTED_LANGUAGE_CODES.map((code) => ({
    language: code,
    name: LANGUAGE_NAMES[code],
    score: round(Math.max(0, scores.get(code) ?? 0), 4),
  })).sort((a, b) => b.score - a.score || a.language.localeCompare(b.language));

  const best = ranked[0];
  const second = ranked[1] ? ranked[1].score : 0;
  const margin = best.score <= 0 ? 0 : (best.score - second) / best.score;
  const confidence = round(clamp(0.7 * margin + 0.3 * Math.min(1, best.score * 2), 0, 0.99), 3);
  const noSignal = best.score < 0.04;
  const winner = noSignal ? "unknown" : best.language;
  const method = noSignal
    ? "none"
    : (SCRIPT_LANGUAGES as readonly string[]).includes(winner)
      ? "unicode-script"
      : "stopword+trigram";

  return {
    language: winner,
    languageName: noSignal ? "Unknown" : LANGUAGE_NAMES[winner],
    confidence: noSignal ? 0 : confidence,
    isReliable: !noSignal && confidence >= 0.4 && words >= 3,
    candidates: ranked.slice(0, 3),
    scripts,
    words,
    method,
  };
}
