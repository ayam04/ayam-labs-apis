import { describe, expect, it } from "vitest";
import { buildPageSelection, formatPageRanges, parsePageRanges } from "../src/lib/ranges";

describe("parsePageRanges", () => {
  it("expands the documented example 1,3,5-7", () => {
    const parsed = parsePageRanges("1,3,5-7");
    expect(parsed.pages).toEqual([1, 3, 5, 6, 7]);
    expect(parsed.ranges).toBe("1,3,5-7");
  });

  it("sorts and deduplicates", () => {
    expect(parsePageRanges("5,1,5,2-3").pages).toEqual([1, 2, 3, 5]);
  });

  it("tolerates spaces around tokens", () => {
    expect(parsePageRanges(" 1 , 3 - 4 ").pages).toEqual([1, 3, 4]);
  });

  it("keeps a single page range of one page", () => {
    expect(parsePageRanges("2-2").pages).toEqual([2]);
  });

  it("rejects reversed ranges with 400", () => {
    try {
      parsePageRanges("7-5");
      throw new Error("expected a 400");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(400);
      expect((error as { code?: string }).code).toBe("INVALID_INPUT");
    }
  });

  it("rejects page zero", () => {
    expect(() => parsePageRanges("0")).toThrowError(/Invalid page number/);
  });

  it("rejects non numeric tokens", () => {
    expect(() => parsePageRanges("first")).toThrowError(/Invalid page selection/);
  });

  it("rejects empty tokens", () => {
    expect(() => parsePageRanges("1,,2")).toThrowError(/Empty page token/);
  });

  it("rejects an empty selection", () => {
    expect(() => parsePageRanges("  ")).toThrowError(/Missing required parameter/);
  });

  it("rejects selections above 100 pages", () => {
    expect(() => parsePageRanges("1-101")).toThrowError(/more than 100 pages/);
    expect(() => parsePageRanges("1-60,100-150")).toThrowError(/Too many pages requested/);
  });

  it("rejects more than 64 tokens", () => {
    expect(() => parsePageRanges(Array.from({ length: 65 }, (_, index) => String(index + 1)).join(","))).toThrowError(
      /Too many page tokens/,
    );
  });

  it("rejects page numbers above the documented maximum", () => {
    expect(() => parsePageRanges("10001")).toThrowError(/above the supported maximum/);
  });
});

describe("formatPageRanges", () => {
  it("compacts consecutive runs", () => {
    expect(formatPageRanges([1, 3, 5, 6, 7])).toBe("1,3,5-7");
    expect(formatPageRanges([1, 2, 3])).toBe("1-3");
    expect(formatPageRanges([4])).toBe("4");
    expect(formatPageRanges([])).toBe("");
  });

  it("sorts and deduplicates its input", () => {
    expect(formatPageRanges([3, 1, 2])).toBe("1-3");
  });
});

describe("buildPageSelection", () => {
  it("drops pages past the end of the document", () => {
    expect(buildPageSelection([1, 5, 9], 6)).toEqual({ pages: [1, 5], outOfRange: [9] });
  });

  it("reports every page when the document is empty", () => {
    expect(buildPageSelection([1, 2], 0)).toEqual({ pages: [], outOfRange: [1, 2] });
  });

  it("keeps the order ascending", () => {
    expect(buildPageSelection([4, 2, 3], 4).pages).toEqual([2, 3, 4]);
  });
});
