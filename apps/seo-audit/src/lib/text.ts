/**
 * Text statistics and readability formulas. Deliberately dependency free: the
 * same functions serve the HTML endpoints and the raw-text endpoint, and they
 * are unit tested with hand-computed values.
 */

/** Hard cap on analysed text (characters), matching the marketplace limit. */
export const MAX_TEXT_CHARS = 100_000;

const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}'\u2019-]*/gu;

export type ReadingLevel =
  | "very easy"
  | "easy"
  | "fairly easy"
  | "standard"
  | "fairly difficult"
  | "difficult"
  | "very difficult"
  | "insufficient text";

export interface LongestSentence {
  text: string;
  wordCount: number;
  index: number;
}

export interface ReadabilityMetrics {
  wordCount: number;
  sentenceCount: number;
  paragraphCount: number;
  syllableCount: number;
  complexWordCount: number;
  charCount: number;
  avgWordsPerSentence: number;
  avgSyllablesPerWord: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFogIndex: number;
  readingLevel: ReadingLevel;
  longestSentence: LongestSentence;
  passiveVoiceHints: number;
  passiveVoiceRatePer100Sentences: number;
}

const SENTENCE_BREAK = /(?<=[.!?\u2026])\s+/;

/** Abbreviation dots are masked with this character while splitting sentences. */
const DOT_MASK = "\u0001";

const MULTI_DOT_ABBREVIATIONS = ["e.g", "i.e", "a.m", "p.m", "u.s", "u.k", "u.s.a", "ph.d"];

const SINGLE_DOT_ABBREVIATIONS = [
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "approx", "fig", "no",
  "inc", "ltd", "co", "al", "ed", "vol", "ch", "pp", "dept", "gov", "sen", "rep", "gen",
  "col", "lt", "sgt", "capt", "ft", "min", "max",
];

function maskAbbreviations(input: string): string {
  let output = input;
  for (const abbreviation of MULTI_DOT_ABBREVIATIONS) {
    const pattern = new RegExp("(^|[^\\p{L}])(" + abbreviation.replace(/\./g, "\\.") + ")\\.?", "giu");
    output = output.replace(pattern, (_match: string, prefix: string, word: string) => {
      return prefix + word.replace(/\./g, DOT_MASK) + DOT_MASK;
    });
  }
  for (const abbreviation of SINGLE_DOT_ABBREVIATIONS) {
    const pattern = new RegExp("(^|[^\\p{L}])(" + abbreviation + ")\\.", "giu");
    output = output.replace(pattern, (_match: string, prefix: string, word: string) => prefix + word + DOT_MASK);
  }
  return output;
}

/** Splits text into sentences. Line breaks always end a sentence (handles lists). */
export function splitSentences(input: string): string[] {
  if (!input) return [];
  const sentences: string[] = [];
  const blocks = input
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  for (const block of blocks) {
    const masked = maskAbbreviations(block);
    for (const piece of masked.split(SENTENCE_BREAK)) {
      const restored = piece.split(DOT_MASK).join(".").trim();
      if (restored.length > 0) sentences.push(restored);
    }
  }
  return sentences;
}

/** Word tokens: letters/digits with internal apostrophes or hyphens. */
export function tokenizeWords(input: string): string[] {
  if (!input) return [];
  const matches = input.match(WORD_PATTERN);
  return matches ?? [];
}

export function countWords(input: string): number {
  return tokenizeWords(input).length;
}

/**
 * Heuristic syllable count: one per maximal vowel group, with the classic
 * silent-e and "-le" corrections. Good enough for readability indexes, not a
 * pronunciation dictionary. Tokens without letters (numbers, symbols) count as
 * one beat so the averages stay sane.
 */
export function countSyllables(rawWord: string): number {
  const word = String(rawWord ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (word.length === 0) return 1;
  if (word.length <= 3) return 1;
  // "table", "little", "people": the final -le is its own syllable
  if (/[^aeiouy]le$/.test(word)) {
    const stemGroups = word.slice(0, -2).match(/[aeiouy]+/g);
    return Math.max(1, (stemGroups ? stemGroups.length : 0) + 1);
  }
  let stripped = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  stripped = stripped.replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch Reading Ease (see https://en.wikipedia.org/wiki/Flesch-Kincaid_readability_tests). */
export function fleschReadingEase(wordCount: number, sentenceCount: number, syllableCount: number): number {
  if (wordCount <= 0 || sentenceCount <= 0) return 0;
  return 206.835 - 1.015 * (wordCount / sentenceCount) - 84.6 * (syllableCount / wordCount);
}

/** Flesch-Kincaid Grade Level. */
export function fleschKincaidGrade(wordCount: number, sentenceCount: number, syllableCount: number): number {
  if (wordCount <= 0 || sentenceCount <= 0) return 0;
  return 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
}

/** Gunning Fog index from the words/sentences ratio and the complex-word count. */
export function gunningFog(wordCount: number, sentenceCount: number, complexWordCount: number): number {
  if (wordCount <= 0 || sentenceCount <= 0) return 0;
  return 0.4 * (wordCount / sentenceCount + 100 * (complexWordCount / wordCount));
}

/** Rounds to a fixed number of decimals (half away from zero). */
export function roundTo(value: number, digits = 1): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

export function readingLevelFor(score: number): ReadingLevel {
  if (score >= 90) return "very easy";
  if (score >= 80) return "easy";
  if (score >= 70) return "fairly easy";
  if (score >= 60) return "standard";
  if (score >= 50) return "fairly difficult";
  if (score >= 30) return "difficult";
  return "very difficult";
}

const PASSIVE_VOICE = /\b(?:am|is|are|was|were|be|been|being)\b(?:\s+\w+ly)?\s+\w+(?:ed|en|wn)\b/gi;

/**
 * Words with three or more syllables that do not end in a common suffix. This is
 * the usual practical approximation of the Gunning-Fog "complex word".
 */
export function isComplexWord(word: string): boolean {
  const lower = word.toLowerCase();
  if (countSyllables(lower) < 3) return false;
  if (/(?:ed|es|ing|ly)$/.test(lower)) return false;
  return true;
}

export interface ReadabilityOptions {
  /** Override the paragraph count (the HTML collector counts block elements). */
  paragraphCount?: number;
}

/** Full readability analysis for a block of plain text. */
export function analyzeReadability(rawText: string, options: ReadabilityOptions = {}): ReadabilityMetrics {
  const text = String(rawText ?? "");
  const words = tokenizeWords(text);
  const sentences = splitSentences(text);
  const paragraphs = options.paragraphCount ?? text.split(/\n+/).filter((block) => block.trim().length > 0).length;

  let syllableCount = 0;
  let complexWordCount = 0;
  for (const word of words) {
    syllableCount += countSyllables(word);
    if (isComplexWord(word)) complexWordCount += 1;
  }

  const wordCount = words.length;
  const sentenceCount = sentences.length;

  let longest: LongestSentence = { text: "", wordCount: 0, index: 0 };
  for (let index = 0; index < sentences.length; index += 1) {
    const sentence = sentences[index] as string;
    const length = tokenizeWords(sentence).length;
    if (length > longest.wordCount) {
      longest = { text: sentence.slice(0, 300), wordCount: length, index };
    }
  }

  const passiveVoiceHints = text.match(PASSIVE_VOICE)?.length ?? 0;
  const rawFlesch = fleschReadingEase(wordCount, sentenceCount, syllableCount);
  const clampedFlesch = Math.max(0, Math.min(100, rawFlesch));

  return {
    wordCount,
    sentenceCount,
    paragraphCount: paragraphs,
    syllableCount,
    complexWordCount,
    charCount: text.length,
    avgWordsPerSentence: sentenceCount > 0 ? roundTo(wordCount / sentenceCount, 2) : 0,
    avgSyllablesPerWord: wordCount > 0 ? roundTo(syllableCount / wordCount, 2) : 0,
    fleschReadingEase: wordCount > 0 && sentenceCount > 0 ? roundTo(clampedFlesch, 1) : 0,
    fleschKincaidGrade: wordCount > 0 && sentenceCount > 0 ? roundTo(Math.max(0, fleschKincaidGrade(wordCount, sentenceCount, syllableCount)), 1) : 0,
    gunningFogIndex: wordCount > 0 && sentenceCount > 0 ? roundTo(Math.max(0, gunningFog(wordCount, sentenceCount, complexWordCount)), 1) : 0,
    readingLevel: wordCount === 0 || sentenceCount === 0 ? "insufficient text" : readingLevelFor(clampedFlesch),
    longestSentence: longest,
    passiveVoiceHints,
    passiveVoiceRatePer100Sentences: sentenceCount > 0 ? roundTo((passiveVoiceHints / sentenceCount) * 100, 1) : 0,
  };
}

/** Truncates to the analysis cap; callers flag `truncated` when this applies. */
export function analysisTextFor(value: string, maxChars: number = MAX_TEXT_CHARS): string {
  const text = String(value ?? "");
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

/** UTF-8 byte length, used for the text-to-HTML ratio. */
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
