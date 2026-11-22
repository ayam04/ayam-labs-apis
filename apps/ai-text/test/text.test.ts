import { describe, expect, it } from "vitest";
import {
  clamp,
  countWords,
  normalizeText,
  round,
  splitSentences,
  tokenize,
  truncateText,
} from "../src/lib/text";

describe("normalizeText", () => {
  it("normalises line endings, strips zero width characters and trims", () => {
    expect(normalizeText("  a\r\nb\u200B  ")).toBe("a\nb");
  });
});

describe("tokenize", () => {
  it("lowercases, drops punctuation and keeps inner apostrophes", () => {
    expect(tokenize("Hello, WORLD! it's 2026.")).toEqual(["hello", "world", "it's", "2026"]);
  });

  it("handles unicode letters", () => {
    expect(tokenize("Café über naïve")).toEqual(["café", "über", "naïve"]);
  });

  it("returns an empty array for punctuation only input", () => {
    expect(tokenize("!!! ... ---")).toEqual([]);
  });
});

describe("countWords", () => {
  it("counts tokens, not characters", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("splitSentences", () => {
  it("splits on terminators", () => {
    expect(splitSentences("Hello! Are you there? Yes.")).toEqual(["Hello!", "Are you there?", "Yes."]);
  });

  it("keeps abbreviations from ending a sentence", () => {
    expect(splitSentences("Dr. Smith went home. He slept well.")).toHaveLength(2);
    expect(splitSentences("Mr. and Mrs. Jones arrived. Then they left.")).toHaveLength(2);
    expect(splitSentences("Use e.g. this example. Another one follows.")).toHaveLength(2);
  });

  it("treats paragraphs as sentence boundaries", () => {
    expect(splitSentences("First paragraph\n\nSecond paragraph")).toHaveLength(2);
  });

  it("returns an empty array for empty input", () => {
    expect(splitSentences("   ")).toEqual([]);
  });
});

describe("round and clamp", () => {
  it("rounds to a fixed number of decimals", () => {
    expect(round(3.14159, 2)).toBe(3.14);
    expect(round(2, 2)).toBe(2);
  });

  it("never returns negative zero", () => {
    expect(Object.is(round(-0.0001, 2), 0)).toBe(true);
  });

  it("clamps into range", () => {
    expect(clamp(5, -1, 1)).toBe(1);
    expect(clamp(-5, -1, 1)).toBe(-1);
    expect(clamp(0.5, -1, 1)).toBe(0.5);
  });
});

describe("truncateText", () => {
  it("leaves short text untouched", () => {
    const result = truncateText("short", 10);
    expect(result.text).toBe("short");
    expect(result.truncated).toBe(false);
  });

  it("marks and marks up truncated text", () => {
    const result = truncateText("abcdefghij", 5);
    expect(result.truncated).toBe(true);
    expect(result.text.endsWith("\u2026")).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(5);
  });
});
