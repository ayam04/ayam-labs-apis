/**
 * Readability metrics.
 *
 * All three formulas are the standard English ones, so they are only
 * meaningful for English prose:
 *
 *   Flesch reading ease   = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words)
 *   Flesch-Kincaid grade  = 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59
 *   Gunning fog           = 0.4 * ((words / sentences) + 100 * complexWords / words)
 *
 * Syllables are estimated with a vowel-group heuristic (no dictionary lookup),
 * which is accurate to roughly one syllable on unusual words.
 */
import { normalizeText, round, splitSentences, tokenize, truncateText } from "./text";

const VOWEL_GROUP = /[aeiouy]+/g;
const CONSONANT_LE = /[^aeiouy]le$/;
const READING_WORDS_PER_MINUTE = 200;
const LONGEST_SENTENCE_TEXT_LIMIT = 240;

export interface ReadabilityCounts {
  characters: number;
  letters: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  syllables: number;
  complexWords: number;
}

export interface ReadabilityAverages {
  wordsPerSentence: number;
  syllablesPerWord: number;
  charactersPerWord: number;
  readingTimeSeconds: number;
}

export interface LongestSentence {
  index: number;
  words: number;
  characters: number;
  text: string;
  truncated: boolean;
}

export interface ReadabilityResult {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  gunningFog: number;
  gradeLevel: string;
  counts: ReadabilityCounts;
  averages: ReadabilityAverages;
  longestSentence: LongestSentence | null;
}

/**
 * Estimates syllables in an English word using vowel groups:
 * silent trailing "e" is dropped, a final consonant + "le" counts as a syllable,
 * and every word gets at least one syllable.
 */
export function estimateSyllables(word: string): number {
  const letters = word.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length === 0) return 0;
  if (letters.length <= 3) return 1;
  if (CONSONANT_LE.test(letters)) {
    const stem = letters.slice(0, -2);
    const groups = stem.match(VOWEL_GROUP);
    return (groups ? groups.length : 0) + 1;
  }
  let prepared = letters;
  if (prepared.endsWith("e") && !prepared.endsWith("ee")) prepared = prepared.slice(0, -1);
  const groups = prepared.match(VOWEL_GROUP);
  return Math.max(1, groups ? groups.length : 0);
}

/** Gunning fog "complex word": three or more syllables, ignoring common suffixes. */
export function isComplexWord(word: string): boolean {
  if (/(?:es|ed|ing)$/i.test(word)) return false;
  return estimateSyllables(word) >= 3;
}

export function gradeLabel(grade: number): string {
  if (!Number.isFinite(grade) || grade <= 0) return "not enough text";
  if (grade <= 5) return "grade 5 or below";
  if (grade <= 8) return "grade 6-8";
  if (grade <= 12) return "grade 9-12";
  if (grade <= 16) return "college";
  return "postgraduate";
}

export function analyseReadability(text: string): ReadabilityResult {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const sentences = splitSentences(normalized);
  const words = tokens.length;
  const sentenceCount = sentences.length;

  let letters = 0;
  for (const character of normalized) if (/\p{L}/u.test(character)) letters += 1;

  let syllables = 0;
  let complexWords = 0;
  for (const token of tokens) {
    syllables += estimateSyllables(token);
    if (isComplexWord(token)) complexWords += 1;
  }

  const wordsPerSentence = sentenceCount === 0 ? 0 : words / sentenceCount;
  const syllablesPerWord = words === 0 ? 0 : syllables / words;
  const charactersPerWord = words === 0 ? 0 : letters / words;

  const fleschReadingEase =
    words === 0 || sentenceCount === 0
      ? 0
      : 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const fleschKincaidGrade =
    words === 0 || sentenceCount === 0
      ? 0
      : 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  const gunningFog =
    words === 0 || sentenceCount === 0
      ? 0
      : 0.4 * (wordsPerSentence + (100 * complexWords) / words);

  let longestSentence: LongestSentence | null = null;
  sentences.forEach((sentence, index) => {
    const sentenceWords = tokenize(sentence).length;
    if (!longestSentence || sentenceWords > longestSentence.words) {
      const display = truncateText(sentence, LONGEST_SENTENCE_TEXT_LIMIT);
      longestSentence = {
        index,
        words: sentenceWords,
        characters: sentence.length,
        text: display.text,
        truncated: display.truncated,
      };
    }
  });

  return {
    fleschReadingEase: round(fleschReadingEase, 2),
    fleschKincaidGrade: round(fleschKincaidGrade, 2),
    gunningFog: round(gunningFog, 2),
    gradeLevel: gradeLabel(fleschKincaidGrade),
    counts: {
      characters: normalized.length,
      letters,
      words,
      uniqueWords: new Set(tokens).size,
      sentences: sentenceCount,
      syllables,
      complexWords,
    },
    averages: {
      wordsPerSentence: round(wordsPerSentence, 2),
      syllablesPerWord: round(syllablesPerWord, 3),
      charactersPerWord: round(charactersPerWord, 2),
      readingTimeSeconds: round((words / READING_WORDS_PER_MINUTE) * 60, 1),
    },
    longestSentence,
  };
}
