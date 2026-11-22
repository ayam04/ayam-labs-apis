import { describe, expect, it } from "vitest";
import {
  cleanDocumentText,
  cleanText,
  collapseBlankLines,
  countWords,
  firstByline,
  normalizeForMatch,
  normalizeUnicode,
  stripLineIndent,
  truncateText,
  trimTrailingSpaces,
} from "../src/lib/text";

describe("normalizeUnicode", () => {
  it("folds unicode dashes to ascii hyphens", () => {
    expect(normalizeUnicode("2020\u20132021\u2014now")).toBe("2020-2021-now");
  });

  it("folds curly quotes and prime marks", () => {
    expect(normalizeUnicode("\u201Cdon\u2019t\u201D")).toBe('"don\'t"');
  });

  it("converts ellipsis, nbsp and tabs", () => {
    expect(normalizeUnicode("wait\u2026\u00A0here\tnow")).toBe("wait... here now");
  });

  it("drops zero width characters and soft hyphens", () => {
    expect(normalizeUnicode("a\u200Bb\u00ADc")).toBe("abc");
  });

  it("normalises windows line endings", () => {
    expect(normalizeUnicode("a\r\nb\rc")).toBe("a\nb\nc");
  });

  it("replaces control characters with spaces", () => {
    expect(normalizeUnicode("a\u0001b")).toBe("a b");
  });
});

describe("cleanText", () => {
  it("collapses runs of spaces but keeps single newlines", () => {
    expect(cleanText("a   b\n   c")).toBe("a b\n c");
  });

  it("collapses three or more blank lines into one", () => {
    expect(cleanText("para one\n\n\n\n\npara two")).toBe("para one\n\npara two");
  });

  it("removes trailing spaces per line and trims the edges", () => {
    expect(cleanText("   a   \n b  \n")).toBe("a\n b");
  });

  it("keeps paragraph breaks intact", () => {
    expect(cleanText("one\n\ntwo")).toBe("one\n\ntwo");
  });

  it("returns an empty string for empty input", () => {
    expect(cleanText("")).toBe("");
  });
});

describe("cleanDocumentText", () => {
  it("also strips leading indentation from every line", () => {
    expect(cleanDocumentText("a   b\n   c")).toBe("a b\nc");
    expect(cleanDocumentText("   a   \n b  \n")).toBe("a\nb");
  });

  it("is empty for empty input", () => {
    expect(cleanDocumentText("")).toBe("");
  });
});

describe("stripLineIndent", () => {
  it("only removes leading whitespace", () => {
    expect(stripLineIndent("  a b\n\t\tc")).toBe("a b\nc");
  });
});

describe("helpers", () => {
  it("trimTrailingSpaces only touches line ends", () => {
    expect(trimTrailingSpaces("a  b   \nc\t\t")).toBe("a  b\nc");
  });

  it("collapseBlankLines keeps a single blank line", () => {
    expect(collapseBlankLines("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("normalizeForMatch lowercases and folds whitespace", () => {
    expect(normalizeForMatch("  Total\u00A0  Amount ")).toBe("total amount");
  });
});

describe("countWords", () => {
  it("counts contractions and hyphenated words as one", () => {
    expect(countWords("don't stop the state-of-the-art now")).toBe(5);
    expect(countWords("state-of-the-art")).toBe(1);
    expect(countWords("don't")).toBe(1);
  });

  it("ignores punctuation only tokens", () => {
    expect(countWords("hello -- world ... ok")).toBe(3);
  });

  it("handles empty input", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("truncateText", () => {
  it("leaves short text untouched", () => {
    expect(truncateText("short", 100)).toEqual({ text: "short", truncated: false });
  });

  it("cuts on a word boundary and flags truncation", () => {
    const result = truncateText("alpha beta gamma delta", 12);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(12);
    expect(result.text.startsWith("alpha")).toBe(true);
    expect(result.text.endsWith(" ")).toBe(false);
  });
});

describe("firstByline", () => {
  it("skips short headings and returns the first substantial paragraph", () => {
    const text = "Invoice\n\nThis document records the work completed during the second quarter of the year.";
    expect(firstByline(text)).toBe("This document records the work completed during the second quarter of the year.");
  });

  it("falls back to a shorter paragraph when nothing is long enough", () => {
    expect(firstByline("Short line here")).toBe("Short line here");
  });

  it("returns null for empty text", () => {
    expect(firstByline("")).toBeNull();
  });
});

