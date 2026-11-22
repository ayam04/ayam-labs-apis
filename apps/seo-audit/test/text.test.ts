import { describe, expect, it } from "vitest";
import {
  analysisTextFor,
  analyzeReadability,
  countSyllables,
  countWords,
  fleschKincaidGrade,
  fleschReadingEase,
  gunningFog,
  isComplexWord,
  readingLevelFor,
  roundTo,
  splitSentences,
  tokenizeWords,
} from "../src/lib/text";

describe("tokenizeWords / countWords", () => {
  it("counts hyphenated and quoted words once", () => {
    expect(countWords("The state-of-the-art don't stop.")).toBe(4);
  });

  it("ignores pure punctuation", () => {
    expect(countWords("... --- !!!")).toBe(0);
  });

  it("returns the tokens in order", () => {
    expect(tokenizeWords("Hello, world!")).toEqual(["Hello", "world"]);
  });

  it("returns zero for empty input", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("splitSentences", () => {
  it("splits on terminal punctuation followed by whitespace", () => {
    expect(splitSentences("The cat sat on the mat. The dog ran in the park. A bird flew away.")).toHaveLength(3);
  });

  it("keeps abbreviation dots inside one sentence", () => {
    const sentences = splitSentences("Dr. Smith went home. He was tired.");
    expect(sentences).toHaveLength(2);
    expect(sentences[0]).toBe("Dr. Smith went home.");
  });

  it("does not split decimals", () => {
    expect(splitSentences("Pi is 3.14 and that is that.")).toHaveLength(1);
  });

  it("treats blank lines as sentence boundaries", () => {
    expect(splitSentences("First item\nSecond item\nThird item")).toHaveLength(3);
  });

  it("returns an empty array for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("countSyllables", () => {
  it("matches a small known set", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("water")).toBe(2);
    expect(countSyllables("beautiful")).toBe(3);
    expect(countSyllables("sentence")).toBe(2);
    expect(countSyllables("table")).toBe(2);
    expect(countSyllables("javascript")).toBe(3);
    expect(countSyllables("people")).toBe(2);
    expect(countSyllables("little")).toBe(2);
  });

  it("counts a number as one beat", () => {
    expect(countSyllables("2024")).toBe(1);
  });
});

describe("readability formulas", () => {
  it("computes Flesch reading ease from raw counts", () => {
    // 206.835 - 1.015 * (12/2) - 84.6 * (12/12) = 116.145
    expect(fleschReadingEase(12, 2, 12)).toBeCloseTo(116.145, 3);
  });

  it("computes Flesch-Kincaid grade from raw counts", () => {
    // 0.39 * 6 + 11.8 * 1 - 15.59 = -1.45
    expect(fleschKincaidGrade(12, 2, 12)).toBeCloseTo(-1.45, 2);
  });

  it("computes Gunning Fog from raw counts", () => {
    // 0.4 * (100/5 + 100 * 10/100) = 12
    expect(gunningFog(100, 5, 10)).toBeCloseTo(12, 5);
  });

  it("guards against zero counts", () => {
    expect(fleschReadingEase(0, 0, 0)).toBe(0);
    expect(fleschKincaidGrade(10, 0, 10)).toBe(0);
  });
});

describe("analyzeReadability", () => {
  const paragraph = "The cat sat on the mat. The dog ran in the park. A bird flew away.";

  it("counts words, sentences, paragraphs and syllables", () => {
    const metrics = analyzeReadability(paragraph);
    expect(metrics.wordCount).toBe(16);
    expect(metrics.sentenceCount).toBe(3);
    expect(metrics.paragraphCount).toBe(1);
    expect(metrics.syllableCount).toBe(17);
  });

  it("clamps Flesch reading ease to 0-100", () => {
    const metrics = analyzeReadability(paragraph);
    expect(metrics.fleschReadingEase).toBe(100);
    expect(metrics.readingLevel).toBe("very easy");
  });

  it("never returns a negative grade", () => {
    const metrics = analyzeReadability(paragraph);
    expect(metrics.fleschKincaidGrade).toBeGreaterThanOrEqual(0);
    expect(metrics.gunningFogIndex).toBeGreaterThanOrEqual(0);
  });

  it("reports the longest sentence with its index", () => {
    const metrics = analyzeReadability("Short one. This second sentence is clearly the longest of them all.");
    expect(metrics.longestSentence.text).toBe("This second sentence is clearly the longest of them all.");
    expect(metrics.longestSentence.index).toBe(1);
    expect(metrics.longestSentence.wordCount).toBe(10);
  });

  it("counts passive voice hints", () => {
    const metrics = analyzeReadability("The report was written by the team.");
    expect(metrics.passiveVoiceHints).toBe(1);
  });

  it("handles empty text", () => {
    const metrics = analyzeReadability("");
    expect(metrics.wordCount).toBe(0);
    expect(metrics.readingLevel).toBe("insufficient text");
    expect(metrics.fleschReadingEase).toBe(0);
  });

  it("honours an explicit paragraph count", () => {
    expect(analyzeReadability(paragraph, { paragraphCount: 7 }).paragraphCount).toBe(7);
  });
});

describe("helpers", () => {
  it("rounds to a fixed number of decimals", () => {
    expect(roundTo(1.2345, 2)).toBe(1.23);
    expect(roundTo(1.25, 1)).toBe(1.3);
  });

  it("maps Flesch scores to reading levels", () => {
    expect(readingLevelFor(95)).toBe("very easy");
    expect(readingLevelFor(65)).toBe("standard");
    expect(readingLevelFor(10)).toBe("very difficult");
  });

  it("flags three syllable words as complex, ignoring common suffixes", () => {
    expect(isComplexWord("beautiful")).toBe(true);
    expect(isComplexWord("running")).toBe(false);
    expect(isComplexWord("cat")).toBe(false);
  });

  it("truncates analysis text at the cap", () => {
    expect(analysisTextFor("abcdef", 3)).toBe("abc");
    expect(analysisTextFor("ab", 3)).toBe("ab");
  });
});
