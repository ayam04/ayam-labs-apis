import { describe, expect, it } from "vitest";
import { analyseSentiment, labelForScore } from "../src/lib/sentiment";
import { LEXICON_SIZE } from "../src/lib/lexicon";

describe("labelForScore", () => {
  it("uses symmetric thresholds", () => {
    expect(labelForScore(0.1)).toBe("positive");
    expect(labelForScore(0.09)).toBe("neutral");
    expect(labelForScore(-0.1)).toBe("negative");
    expect(labelForScore(-0.09)).toBe("neutral");
  });
});

describe("analyseSentiment", () => {
  it("ships a lexicon with at least 300 entries", () => {
    expect(LEXICON_SIZE).toBeGreaterThanOrEqual(300);
  });

  it("scores a single positive word", () => {
    const result = analyseSentiment("great");
    expect(result.score).toBeCloseTo(3 / 5, 4);
    expect(result.rawScore).toBe(3);
    expect(result.label).toBe("positive");
    expect(result.tokens).toBe(1);
    expect(result.matchedTokens).toBe(1);
  });

  it("scores a positive sentence", () => {
    const result = analyseSentiment("I love this product, it is great!");
    expect(result.score).toBeGreaterThan(0);
    expect(result.label).toBe("positive");
    expect(result.matchedTokens).toBe(2);
    const tokens = result.topPositive.map((entry) => entry.token);
    expect(tokens).toContain("love");
    expect(tokens).toContain("great");
  });

  it("scores a negative sentence", () => {
    const result = analyseSentiment("This is terrible and I hate it.");
    expect(result.score).toBeLessThan(0);
    expect(result.score).toBeCloseTo(-7 / 35, 4);
    expect(result.label).toBe("negative");
    expect(result.topNegative.map((entry) => entry.token)).toContain("hate");
  });

  it("returns neutral for text without lexicon hits", () => {
    const result = analyseSentiment("The table is on the floor.");
    expect(result.rawScore).toBe(0);
    expect(result.score).toBe(0);
    expect(result.matchedTokens).toBe(0);
    expect(result.label).toBe("neutral");
  });

  it("flips valences after a negator", () => {
    const positive = analyseSentiment("I like it.");
    const negated = analyseSentiment("I do not like it.");
    expect(positive.score).toBeGreaterThan(0);
    expect(negated.score).toBeLessThan(0);
    expect(negated.negatedTokens).toBe(1);
    expect(negated.rawScore).toBe(-1);
  });

  it("keeps the normalised score inside [-1, 1]", () => {
    const result = analyseSentiment("love love love love love amazing awesome perfect");
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.score).toBeGreaterThan(0);
  });

  it("builds a comparative score from the token count", () => {
    const result = analyseSentiment("good start but a bad finish");
    expect(result.comparative).toBeCloseTo(result.rawScore / result.tokens, 4);
  });

  it("returns at most 20 sentence breakdowns but counts them all", () => {
    const text = Array.from({ length: 25 }, () => "This is great.").join(" ");
    const result = analyseSentiment(text);
    expect(result.sentencesTotal).toBe(25);
    expect(result.sentencesReturned).toBe(20);
    expect(result.sentences).toHaveLength(20);
    expect(result.sentences[0].index).toBe(0);
    expect(result.sentences[0].label).toBe("positive");
  });

  it("reports the lexicon size", () => {
    expect(analyseSentiment("hello").lexiconSize).toBe(LEXICON_SIZE);
  });
});
