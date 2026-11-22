/**
 * Lexicon based sentiment analysis.
 *
 * The score is the sum of word valences, where a negator (not, never, don't...)
 * within the two tokens before a word flips its valence and halves it. The
 * result is normalised by the maximum possible valence for the token count:
 *
 *   score       = sum(effective valence) / (5 * tokens)   clamped to [-1, 1]
 *   comparative = sum(effective valence) / tokens         AFINN style, in [-5, 5]
 *
 * This is a word list, not a model. It misses sarcasm, irony, emoji, non English
 * text and context. It is stable, fast and free, which is the point.
 */
import { LEXICON_SIZE, MAX_VALENCE, NEGATORS, SENTIMENT_LEXICON } from "./lexicon";
import { clamp, normalizeText, round, splitSentences, tokenize, truncateText } from "./text";

export type SentimentLabel = "positive" | "neutral" | "negative";

export interface SentimentToken {
  token: string;
  /** Lexicon valence of the word, before negation. */
  valence: number;
  /** How many times the word occurs. */
  count: number;
  /** Sum of effective valences, negated occurrences included. */
  contribution: number;
}

export interface SentenceSentiment {
  index: number;
  text: string;
  truncated: boolean;
  tokens: number;
  rawScore: number;
  score: number;
  label: SentimentLabel;
}

export interface SentimentResult {
  /** Normalised score in [-1, 1]. */
  score: number;
  /** Sum of effective valences divided by the token count (AFINN comparative). */
  comparative: number;
  /** Raw sum of effective valences. */
  rawScore: number;
  label: SentimentLabel;
  tokens: number;
  matchedTokens: number;
  negatedTokens: number;
  sentences: SentenceSentiment[];
  sentencesReturned: number;
  sentencesTotal: number;
  topPositive: SentimentToken[];
  topNegative: SentimentToken[];
  lexiconSize: number;
}

export const SENTENCE_BREAKDOWN_LIMIT = 20;
const SENTENCE_TEXT_LIMIT = 280;

interface Contribution {
  valence: number;
  count: number;
  contribution: number;
}

interface Scored {
  rawScore: number;
  tokens: number;
  matched: number;
  negated: number;
  contributions: Map<string, Contribution>;
}

export function labelForScore(score: number): SentimentLabel {
  if (score >= 0.1) return "positive";
  if (score <= -0.1) return "negative";
  return "neutral";
}

function scoreTokens(tokens: string[]): Scored {
  const contributions = new Map<string, Contribution>();
  let rawScore = 0;
  let matched = 0;
  let negated = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const base = SENTIMENT_LEXICON[token];
    if (base === undefined) continue;
    let effective = base;
    const previous = index > 0 ? tokens[index - 1] : "";
    const beforePrevious = index > 1 ? tokens[index - 2] : "";
    if (NEGATORS.has(previous) || NEGATORS.has(beforePrevious)) {
      effective = -base * 0.5;
      negated += 1;
    }
    matched += 1;
    rawScore += effective;
    const existing = contributions.get(token);
    if (existing) {
      existing.count += 1;
      existing.contribution += effective;
    } else {
      contributions.set(token, { valence: base, count: 1, contribution: effective });
    }
  }

  return { rawScore, tokens: tokens.length, matched, negated, contributions };
}

function normalise(rawScore: number, tokens: number): number {
  if (tokens === 0) return 0;
  return round(clamp(rawScore / (MAX_VALENCE * tokens), -1, 1), 4);
}

function topTokens(contributions: Map<string, Contribution>, direction: 1 | -1, limit = 5): SentimentToken[] {
  return [...contributions.entries()]
    .filter(([, value]) => (direction === 1 ? value.contribution > 0 : value.contribution < 0))
    .map(([token, value]) => ({
      token,
      valence: value.valence,
      count: value.count,
      contribution: round(value.contribution, 2),
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || b.count - a.count || a.token.localeCompare(b.token))
    .slice(0, limit);
}

export function analyseSentiment(text: string, sentenceLimit = SENTENCE_BREAKDOWN_LIMIT): SentimentResult {
  const normalized = normalizeText(text);
  const tokens = tokenize(normalized);
  const scored = scoreTokens(tokens);
  const score = normalise(scored.rawScore, scored.tokens);

  const allSentences = splitSentences(normalized);
  const cappedLimit = Math.max(0, Math.min(SENTENCE_BREAKDOWN_LIMIT, Math.floor(sentenceLimit)));
  const sentences: SentenceSentiment[] = allSentences.slice(0, cappedLimit).map((sentence, index) => {
    const sentenceTokens = tokenize(sentence);
    const sentenceScored = scoreTokens(sentenceTokens);
    const sentenceScore = normalise(sentenceScored.rawScore, sentenceScored.tokens);
    const display = truncateText(sentence, SENTENCE_TEXT_LIMIT);
    return {
      index,
      text: display.text,
      truncated: display.truncated,
      tokens: sentenceScored.tokens,
      rawScore: round(sentenceScored.rawScore, 2),
      score: sentenceScore,
      label: labelForScore(sentenceScore),
    };
  });

  return {
    score,
    comparative: scored.tokens === 0 ? 0 : round(scored.rawScore / scored.tokens, 4),
    rawScore: round(scored.rawScore, 2),
    label: labelForScore(score),
    tokens: scored.tokens,
    matchedTokens: scored.matched,
    negatedTokens: scored.negated,
    sentences,
    sentencesReturned: sentences.length,
    sentencesTotal: allSentences.length,
    topPositive: topTokens(scored.contributions, 1),
    topNegative: topTokens(scored.contributions, -1),
    lexiconSize: LEXICON_SIZE,
  };
}
