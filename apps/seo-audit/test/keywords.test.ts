import { describe, expect, it } from "vitest";
import { analyzeKeywords, termWeight, DEFAULT_KEYWORD_LIMIT, MAX_KEYWORD_LIMIT } from "../src/lib/keywords";

describe("analyzeKeywords", () => {
  it("drops stopwords and pure UI chrome words", () => {
    const analysis = analyzeKeywords("The seo tools and the audit. Click menu subscribe for seo.");
    const terms = analysis.terms.map((term) => term.term);
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("and");
    expect(terms).not.toContain("click");
    expect(terms).not.toContain("menu");
    expect(terms).toContain("seo");
    expect(terms).toContain("audit");
  });

  it("keeps topical words that also appear in navigation", () => {
    const terms = analyzeKeywords("search privacy cookies").terms.map((term) => term.term);
    expect(terms).toContain("search");
    expect(terms).toContain("privacy");
    expect(terms).toContain("cookies");
  });

  it("counts occurrences and computes density against all words", () => {
    const analysis = analyzeKeywords("seo seo audit audit audit");
    const audit = analysis.terms.find((term) => term.term === "audit");
    expect(analysis.totalWords).toBe(5);
    expect(audit).toBeDefined();
    expect(audit?.count).toBe(3);
    expect(audit?.densityPercent).toBe(60);
    expect(analysis.terms.find((term) => term.term === "seo")?.densityPercent).toBe(40);
  });

  it("builds two word phrases from adjacent content words", () => {
    const analysis = analyzeKeywords("keyword research matters for keyword research", 50);
    const phrase = analysis.terms.find((term) => term.term === "keyword research");
    expect(phrase).toBeDefined();
    expect(phrase?.wordCount).toBe(2);
    expect(phrase?.count).toBe(2);
  });

  it("never builds a phrase across a stopword", () => {
    const analysis = analyzeKeywords("keyword for research", 50);
    expect(analysis.terms.map((term) => term.term)).not.toContain("keyword research");
  });

  it("never builds a phrase across a sentence boundary", () => {
    const analysis = analyzeKeywords("We rank search engines. Good research starts with intent.", 50);
    const terms = analysis.terms.map((term) => term.term);
    expect(terms).not.toContain("engines good");
    expect(terms).toContain("search engines");
  });

  it("respects the limit and reports distinct term counts", () => {
    const analysis = analyzeKeywords("alpha beta gamma delta epsilon zeta eta theta", 3);
    expect(analysis.terms).toHaveLength(3);
    expect(analysis.unigramCount).toBe(8);
    expect(analysis.termCount).toBeGreaterThanOrEqual(8);
  });

  it("defaults to 20 terms and caps at 100", () => {
    const long = Array.from({ length: 60 }, (_, index) => "term" + String.fromCharCode(97 + (index % 26)) + "x" + index).join(" ");
    expect(analyzeKeywords(long).terms).toHaveLength(DEFAULT_KEYWORD_LIMIT);
    expect(analyzeKeywords(long, 500).terms).toHaveLength(MAX_KEYWORD_LIMIT);
  });

  it("returns at most ten density entries", () => {
    const analysis = analyzeKeywords("alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu", 20);
    expect(analysis.densityTop10.length).toBeLessThanOrEqual(10);
    expect(analysis.densityTop10[0]?.term).toBeDefined();
  });

  it("normalises possessives and case", () => {
    const analysis = analyzeKeywords("Acme's Acme ACME");
    const acme = analysis.terms.find((term) => term.term === "acme");
    expect(acme?.count).toBe(3);
  });

  it("reports word and stopword totals", () => {
    const analysis = analyzeKeywords("The seo tools and the audit");
    expect(analysis.totalWords).toBe(6);
    expect(analysis.stopwordCount).toBe(3);
    expect(analysis.uniqueWords).toBe(5);
  });
});

describe("termWeight", () => {
  it("weights stopwords lowest and rare words highest", () => {
    expect(termWeight("the")).toBe(1);
    expect(termWeight("people")).toBe(1.4);
    expect(termWeight("keyword")).toBe(2.6);
    expect(termWeight("seo audit")).toBe(5.2);
  });
});
