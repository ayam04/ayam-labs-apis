import { describe, expect, it } from "vitest";
import {
  collapseWhitespace,
  countParagraphs,
  decodeEntities,
  extractHeadings,
  extractJsonLdBlocks,
  extractVisibleText,
} from "../src/lib/html";

import sampleHtml from "./fixtures/sample.html?raw";

describe("decodeEntities", () => {
  it("decodes named entities", () => {
    expect(decodeEntities("Fish &amp; chips &quot;today&quot;")).toBe('Fish & chips "today"');
  });

  it("decodes numeric entities", () => {
    expect(decodeEntities("it&#39;s &#x2014; fine")).toBe("it's \u2014 fine");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("&notarealentity; &amp;")).toBe("&notarealentity; &");
  });

  it("is a no-op without ampersands", () => {
    expect(decodeEntities("plain text")).toBe("plain text");
  });
});

describe("collapseWhitespace", () => {
  it("collapses runs including nbsp and zero width spaces", () => {
    expect(collapseWhitespace("  a\u00a0\u200b b \n c ")).toBe("a b c");
  });
});

describe("extractVisibleText", () => {
  const text = extractVisibleText(sampleHtml);

  it("keeps body copy", () => {
    expect(text).toContain("Product analytics without the setup");
    expect(text).toContain("Most tools need a data engineer.");
  });

  it("drops scripts, styles and head tags", () => {
    expect(text).not.toContain("var tracking");
    expect(text).not.toContain("<h1>");
    expect(text).not.toContain("Acme Analytics - product analytics without the setup");
  });

  it("keeps anchor text", () => {
    expect(text).toContain("Read the documentation");
    expect(text).toContain("Email us");
  });

  it("returns an empty string for empty input", () => {
    expect(extractVisibleText("")).toBe("");
  });
});

describe("extractHeadings", () => {
  it("returns headings in order with their level", () => {
    const headings = extractHeadings(sampleHtml);
    expect(headings).toEqual([
      { level: 1, text: "Product analytics without the setup" },
      { level: 2, text: "Why teams switch" },
    ]);
  });

  it("flattens inline markup inside a heading", () => {
    const headings = extractHeadings("<h2>Hello <em>world</em></h2>");
    expect(headings[0]?.text).toBe("Hello world");
  });

  it("ignores headings without a closing tag", () => {
    expect(extractHeadings("<h1>No close")).toEqual([]);
  });
});

describe("extractJsonLdBlocks", () => {
  it("returns the JSON text of ld+json scripts", () => {
    const blocks = extractJsonLdBlocks(sampleHtml);
    expect(blocks).toHaveLength(1);
    const parsed = JSON.parse(blocks[0] ?? "{}") as Record<string, unknown>;
    expect(parsed["@type"]).toBe("SoftwareApplication");
  });

  it("ignores ordinary scripts", () => {
    expect(extractJsonLdBlocks("<script>var a = 1;</script>")).toEqual([]);
  });

  it("accepts single quoted and unquoted type attributes", () => {
    const html = "<script type='application/ld+json'>{}</script><script type=application/ld+json>{}</script>";
    expect(extractJsonLdBlocks(html)).toHaveLength(2);
  });
});

describe("countParagraphs", () => {
  it("counts p tags in the fixture", () => {
    expect(countParagraphs(sampleHtml)).toBe(2);
  });

  it("returns zero when there are none", () => {
    expect(countParagraphs("<div>hi</div>")).toBe(0);
  });
});
