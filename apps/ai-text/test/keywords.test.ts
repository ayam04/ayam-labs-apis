import { describe, expect, it } from "vitest";
import { extractKeywords } from "../src/lib/keywords";

const SOLAR =
  "Solar panels convert sunlight into electricity. Solar panels are cheaper than ever, and solar adoption keeps growing.";

describe("extractKeywords", () => {
  it("ranks the repeated phrase first", () => {
    const result = extractKeywords(SOLAR, 20);
    expect(result.keywords[0].term).toBe("solar panels");
    expect(result.keywords[0].ngram).toBe(2);
    expect(result.keywords[0].count).toBe(2);
    expect(result.keywords[0].score).toBe(100);
  });

  it("drops stopwords from unigram candidates", () => {
    const result = extractKeywords(SOLAR, 100);
    const terms = result.keywords.map((keyword) => keyword.term);
    expect(terms).not.toContain("and");
    expect(terms).not.toContain("into");
    expect(terms).not.toContain("than");
    expect(terms).not.toContain("are");
  });

  it("never builds an n-gram across a stopword", () => {
    const result = extractKeywords(SOLAR, 100);
    const terms = result.keywords.map((keyword) => keyword.term);
    expect(terms).not.toContain("sunlight into");
    expect(terms).not.toContain("solar panels are");
  });

  it("never builds an n-gram across a sentence boundary", () => {
    const result = extractKeywords("We sell solar. Panels are cheap.", 100);
    const terms = result.keywords.map((keyword) => keyword.term);
    expect(terms).not.toContain("solar panels");
    expect(terms).toContain("solar");
    expect(terms).toContain("panels");
  });

  it("reports document statistics", () => {
    const { stats } = extractKeywords(SOLAR, 20);
    expect(stats.words).toBe(17);
    expect(stats.sentences).toBe(2);
    expect(stats.characters).toBe(SOLAR.length);
    expect(stats.stopwordCount).toBe(4);
    expect(stats.stopwordRatio).toBeCloseTo(4 / 17, 3);
    expect(stats.uniqueWords).toBeLessThan(stats.words);
  });

  it("computes density as a share of token positions", () => {
    const first = extractKeywords(SOLAR, 1).keywords[0];
    expect(first.density).toBeCloseTo((100 * 2) / 17, 2);
  });

  it("computes a real IDF over sentences", () => {
    const keywords = extractKeywords(SOLAR, 100).keywords;
    const solar = keywords.find((keyword) => keyword.term === "solar");
    const rare = keywords.find((keyword) => keyword.term === "electricity");
    expect(solar).toBeDefined();
    expect(rare).toBeDefined();
    // "solar" appears in both sentences, "electricity" in one, so the rarer term has the higher IDF.
    expect((solar as { idf: number }).idf).toBeCloseTo(1, 3);
    expect((rare as { idf: number }).idf).toBeGreaterThan(1);
    expect((rare as { sentenceHits: number }).sentenceHits).toBe(1);
  });

  it("respects the limit and flags truncation", () => {
    const result = extractKeywords(SOLAR, 2);
    expect(result.keywords).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("caps the limit at 100", () => {
    const result = extractKeywords(SOLAR, 500);
    expect(result.keywords.length).toBeLessThanOrEqual(100);
  });

  it("returns empty output for stopword only text", () => {
    const result = extractKeywords("the and of to in", 20);
    expect(result.keywords).toEqual([]);
    expect(result.stats.words).toBe(5);
  });
});
