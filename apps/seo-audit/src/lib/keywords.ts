/**
 * Keyword extraction: unigram/bigram frequencies with an IDF-style prior,
 * stopword removal and density percentages. Pure and unit tested.
 */

import { roundTo, splitSentences, tokenizeWords } from "./text";
import { COMMON_WORDS, STOPWORDS } from "./stopwords";

export const DEFAULT_KEYWORD_LIMIT = 20;
export const MAX_KEYWORD_LIMIT = 100;
export const DENSITY_TOP_N = 10;
export const MAX_TERM_CHARS = 80;

export interface KeywordTerm {
  term: string;
  wordCount: 1 | 2;
  count: number;
  densityPercent: number;
  score: number;
  importance: number;
}

export interface DensityEntry {
  term: string;
  count: number;
  densityPercent: number;
}

export interface KeywordAnalysis {
  totalWords: number;
  uniqueWords: number;
  stopwordCount: number;
  stopwordRatePercent: number;
  termCount: number;
  unigramCount: number;
  bigramCount: number;
  terms: KeywordTerm[];
  densityTop10: DensityEntry[];
}

const DIGITS_ONLY = /^\d+$/;

function normalizeToken(token: string): string {
  return token
    .toLowerCase()
    .replace(/[\u2019']s$/, "")
    .replace(/^[-'\u2019]+/, "")
    .replace(/[-'\u2019]+$/, "")
    .slice(0, MAX_TERM_CHARS);
}

function isContentToken(token: string): boolean {
  if (token.length < 2) return false;
  if (DIGITS_ONLY.test(token)) return false;
  if (STOPWORDS.has(token)) return false;
  return true;
}

/**
 * IDF-style prior. Rare words are more informative than frequent ones, so the
 * weight per word is: stopword 1.0, common English word 1.4, anything else 2.6.
 * A two word phrase sums both weights. This is a heuristic prior, not a corpus
 * derived IDF - the API has no training corpus at the edge.
 */
export function termWeight(term: string): number {
  let total = 0;
  for (const word of term.split(" ")) {
    if (STOPWORDS.has(word)) total += 1;
    else if (COMMON_WORDS.has(word)) total += 1.4;
    else total += 2.6;
  }
  return total;
}

/** Term frequency + IDF-ish importance for one block of text. */
export function analyzeKeywords(rawText: string, limit: number = DEFAULT_KEYWORD_LIMIT): KeywordAnalysis {
  const safeLimit = Math.max(1, Math.min(MAX_KEYWORD_LIMIT, Math.trunc(limit)));
  const tokens = tokenizeWords(String(rawText ?? "")).map(normalizeToken).filter((token) => token.length > 0);

  let stopwordCount = 0;
  for (const token of tokens) {
    if (STOPWORDS.has(token)) stopwordCount += 1;
  }

  const unigrams = new Map<string, number>();
  const bigrams = new Map<string, number>();

  for (const token of tokens) {
    if (isContentToken(token)) unigrams.set(token, (unigrams.get(token) ?? 0) + 1);
  }

  // Phrases are built inside one sentence only: "engines. Good" is not a phrase.
  for (const sentence of splitSentences(String(rawText ?? ""))) {
    const sentenceTokens = tokenizeWords(sentence).map(normalizeToken);
    for (let index = 0; index + 1 < sentenceTokens.length; index += 1) {
      const current = sentenceTokens[index] as string;
      const next = sentenceTokens[index + 1] as string;
      if (!isContentToken(current) || !isContentToken(next)) continue;
      const phrase = current + " " + next;
      bigrams.set(phrase, (bigrams.get(phrase) ?? 0) + 1);
    }
  }

  const totalWords = tokens.length;
  const denominator = totalWords > 0 ? totalWords : 1;

  const terms: KeywordTerm[] = [];
  for (const [term, count] of unigrams) {
    terms.push({
      term,
      wordCount: 1,
      count,
      densityPercent: roundTo((count / denominator) * 100, 2),
      score: roundTo(count * termWeight(term), 2),
      importance: 0,
    });
  }
  for (const [term, count] of bigrams) {
    terms.push({
      term,
      wordCount: 2,
      count,
      densityPercent: roundTo((count / denominator) * 100, 2),
      score: roundTo(count * termWeight(term), 2),
      importance: 0,
    });
  }

  terms.sort((a, b) => b.score - a.score || b.count - a.count || a.term.localeCompare(b.term));
  const topScore = terms.length > 0 ? (terms[0] as KeywordTerm).score : 0;
  for (const term of terms) {
    term.importance = topScore > 0 ? Math.round((term.score / topScore) * 100) : 0;
  }

  const limited = terms.slice(0, safeLimit);
  return {
    totalWords,
    uniqueWords: new Set(tokens).size,
    stopwordCount,
    stopwordRatePercent: roundTo((stopwordCount / denominator) * 100, 1),
    termCount: terms.length,
    unigramCount: unigrams.size,
    bigramCount: bigrams.size,
    terms: limited,
    densityTop10: limited.slice(0, DENSITY_TOP_N).map((term) => ({
      term: term.term,
      count: term.count,
      densityPercent: term.densityPercent,
    })),
  };
}
