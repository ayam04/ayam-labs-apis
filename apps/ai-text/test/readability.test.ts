import { describe, expect, it } from "vitest";
import { analyseReadability, estimateSyllables, gradeLabel, isComplexWord } from "../src/lib/readability";

describe("estimateSyllables", () => {
  it("handles short and single syllable words", () => {
    expect(estimateSyllables("cat")).toBe(1);
    expect(estimateSyllables("the")).toBe(1);
    expect(estimateSyllables("a")).toBe(1);
  });

  it("drops a silent trailing e", () => {
    expect(estimateSyllables("make")).toBe(1);
    expect(estimateSyllables("smile")).toBe(1);
    expect(estimateSyllables("these")).toBe(1);
  });

  it("counts a consonant + le ending", () => {
    expect(estimateSyllables("table")).toBe(2);
    expect(estimateSyllables("little")).toBe(2);
    expect(estimateSyllables("syllable")).toBe(3);
  });

  it("counts vowel groups", () => {
    expect(estimateSyllables("banana")).toBe(3);
    expect(estimateSyllables("computer")).toBe(3);
    expect(estimateSyllables("unfortunately")).toBeGreaterThanOrEqual(5);
    expect(estimateSyllables("queue")).toBe(1);
  });

  it("returns zero for words without letters", () => {
    expect(estimateSyllables("1234")).toBe(0);
  });
});

describe("isComplexWord", () => {
  it("requires three syllables and no inflectional suffix", () => {
    expect(isComplexWord("magnificent")).toBe(true);
    expect(isComplexWord("interesting")).toBe(false);
    expect(isComplexWord("created")).toBe(false);
  });
});

describe("gradeLabel", () => {
  it("maps grades to bands", () => {
    expect(gradeLabel(-2)).toBe("not enough text");
    expect(gradeLabel(4)).toBe("grade 5 or below");
    expect(gradeLabel(7)).toBe("grade 6-8");
    expect(gradeLabel(11)).toBe("grade 9-12");
    expect(gradeLabel(15)).toBe("college");
    expect(gradeLabel(19)).toBe("postgraduate");
  });
});

describe("analyseReadability", () => {
  const simple = "This is a simple sentence. It has short words.";
  const complex =
    "Notwithstanding the aforementioned considerations, the institutional framework necessitates a comprehensive re-evaluation of interdisciplinary methodologies.";

  it("counts words and sentences", () => {
    const result = analyseReadability(simple);
    expect(result.counts.words).toBe(9);
    expect(result.counts.sentences).toBe(2);
    expect(result.counts.letters).toBeGreaterThan(30);
    expect(result.counts.syllables).toBeGreaterThan(0);
    expect(result.averages.wordsPerSentence).toBeCloseTo(4.5, 2);
  });

  it("scores simple text as easier than complex text", () => {
    const easy = analyseReadability(simple);
    const hard = analyseReadability(complex);
    expect(easy.fleschReadingEase).toBeGreaterThan(60);
    expect(hard.fleschReadingEase).toBeLessThan(easy.fleschReadingEase);
    expect(hard.fleschKincaidGrade).toBeGreaterThan(easy.fleschKincaidGrade);
    expect(hard.gunningFog).toBeGreaterThan(easy.gunningFog);
  });

  it("finds the longest sentence", () => {
    const result = analyseReadability("Short one. This sentence is much longer than the first one.");
    expect(result.longestSentence).not.toBeNull();
    expect(result.longestSentence?.index).toBe(1);
    expect(result.longestSentence?.words).toBe(9);
  });

  it("reports a reading time", () => {
    const result = analyseReadability(simple);
    expect(result.averages.readingTimeSeconds).toBeCloseTo((9 / 200) * 60, 1);
  });

  it("handles a single word", () => {
    const result = analyseReadability("Hello.");
    expect(result.counts.words).toBe(1);
    expect(result.counts.sentences).toBe(1);
    expect(result.gradeLevel).toEqual(expect.any(String));
  });
});
