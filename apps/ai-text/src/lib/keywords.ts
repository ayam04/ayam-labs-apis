/**
 * Single document keyword extraction.
 *
 * Sentences are treated as documents, so the IDF term is a real inverse
 * document frequency over sentences:
 *
 *   idf   = ln((1 + S) / (1 + df)) + 1     S = sentence count, df = sentences containing the term
 *   raw   = count * idf * length bonus     bonus = 1 (unigram), 1.8 (bigram), 2.4 (trigram)
 *   score = 100 * raw / bestRaw            best term in the document scores 100
 *
 * N-grams are built from contiguous tokens inside a single sentence. A phrase is
 * dropped when any of its tokens is a stopword, so "learning model" is never
 * invented out of "machine learning model", and no phrase ever crosses a
 * sentence boundary.
 */
import { isStopword } from "./stopwords";
import { normalizeText, round, splitSentences, tokenize } from "./text";

export const MAX_KEYWORDS = 100;
export const DEFAULT_KEYWORDS = 20;
const MAX_NGRAM = 3;
const NGRAM_WEIGHT: Readonly<Record<number, number>> = { 1: 1, 2: 1.8, 3: 2.4 };

export interface Keyword {
  /** The term, lowercased, tokens joined with a single space. */
  term: string;
  /** Number of tokens in the term (1, 2 or 3). */
  ngram: number;
  /** How many times the term occurs in the text. */
  count: number;
  /** How many sentences contain the term. */
  sentenceHits: number;
  /** Inverse document frequency computed over the sentences. */
  idf: number;
  /** Percentage of the document's token positions where this term starts. */
  density: number;
  /** Relative relevance, 0-100, where 100 is the best term in the document. */
  score: number;
}

export interface KeywordStats {
  characters: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  stopwordCount: number;
  stopwordRatio: number;
  candidateTerms: number;
}

export interface KeywordResult {
  keywords: Keyword[];
  stats: KeywordStats;
  truncated: boolean;
}

interface Candidate {
  term: string;
  ngram: number;
  count: number;
}

function gramKey(term: string, ngram: number): string {
  return ngram + "|" + term;
}

function collectCandidates(sentenceTokens: string[][]): Map<string, Candidate> {
  const candidates = new Map<string, Candidate>();
  for (const tokens of sentenceTokens) {
    for (let n = 1; n <= MAX_NGRAM; n += 1) {
      for (let i = 0; i + n <= tokens.length; i += 1) {
        let usable = true;
        const parts: string[] = [];
        for (let j = 0; j < n; j += 1) {
          const token = tokens[i + j];
          if (isStopword(token) || (n === 1 && token.length < 2)) {
            usable = false;
            break;
          }
          parts.push(token);
        }
        if (!usable) continue;
        const term = parts.join(" ");
        const key = gramKey(term, n);
        const existing = candidates.get(key);
        if (existing) existing.count += 1;
        else candidates.set(key, { term, ngram: n, count: 1 });
      }
    }
  }
  return candidates;
}

function sentenceDocFrequencies(sentences: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const sentence of sentences) {
    const tokens = tokenize(sentence);
    const seen = new Set<string>();
    for (let n = 1; n <= MAX_NGRAM; n += 1) {
      for (let i = 0; i + n <= tokens.length; i += 1) {
        const key = gramKey(tokens.slice(i, i + n).join(" "), n);
        if (seen.has(key)) continue;
        seen.add(key);
        frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
      }
    }
  }
  return frequencies;
}

export function extractKeywords(text: string, limit: number = DEFAULT_KEYWORDS): KeywordResult {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const sentences = splitSentences(normalized);
  const cappedLimit = Math.max(1, Math.min(MAX_KEYWORDS, Math.floor(limit)));

  const stats: KeywordStats = {
    characters: normalized.length,
    words: tokens.length,
    uniqueWords: new Set(tokens).size,
    sentences: sentences.length,
    stopwordCount: tokens.filter((token) => isStopword(token)).length,
    stopwordRatio: tokens.length === 0 ? 0 : round(tokens.filter((token) => isStopword(token)).length / tokens.length, 4),
    candidateTerms: 0,
  };

  if (tokens.length === 0) {
    return { keywords: [], stats, truncated: false };
  }

  const candidates = collectCandidates(sentences.map((sentence) => tokenize(sentence)));
  const docFrequencies = sentenceDocFrequencies(sentences);
  const sentenceCount = Math.max(1, sentences.length);

  const scored = [...candidates.values()].map((candidate) => {
    const df = docFrequencies.get(gramKey(candidate.term, candidate.ngram)) ?? 1;
    const idf = Math.log((1 + sentenceCount) / (1 + df)) + 1;
    const raw = candidate.count * idf * NGRAM_WEIGHT[candidate.ngram];
    return {
      term: candidate.term,
      ngram: candidate.ngram,
      count: candidate.count,
      sentenceHits: df,
      idf: round(idf, 4),
      density: round((100 * candidate.count) / tokens.length, 3),
      raw,
    };
  });

  const bestRaw = scored.reduce((max, item) => (item.raw > max ? item.raw : max), 0);
  const keywords: Keyword[] = scored
    .map((item) => ({
      term: item.term,
      ngram: item.ngram,
      count: item.count,
      sentenceHits: item.sentenceHits,
      idf: item.idf,
      density: item.density,
      score: bestRaw === 0 ? 0 : round((100 * item.raw) / bestRaw, 2),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.count - a.count ||
        b.ngram - a.ngram ||
        a.term.localeCompare(b.term),
    );

  stats.candidateTerms = keywords.length;
  return {
    keywords: keywords.slice(0, cappedLimit),
    stats,
    truncated: keywords.length > cappedLimit,
  };
}
