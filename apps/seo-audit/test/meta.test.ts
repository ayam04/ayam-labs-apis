import { describe, expect, it } from "vitest";
import { parseRobotsMeta, summarizeJsonLdBlock } from "../src/lib/meta";

describe("parseRobotsMeta", () => {
  it("defaults to index and follow when absent", () => {
    const result = parseRobotsMeta(null);
    expect(result.index).toBe(true);
    expect(result.follow).toBe(true);
    expect(result.directives).toEqual([]);
  });

  it("reads noindex and nofollow", () => {
    const result = parseRobotsMeta("noindex, nofollow");
    expect(result.index).toBe(false);
    expect(result.follow).toBe(false);
    expect(result.directives).toEqual(["noindex", "nofollow"]);
  });

  it("treats none as both", () => {
    const result = parseRobotsMeta("none");
    expect(result.index).toBe(false);
    expect(result.follow).toBe(false);
  });

  it("keeps index,follow explicit", () => {
    const result = parseRobotsMeta("index,follow");
    expect(result.index).toBe(true);
    expect(result.follow).toBe(true);
  });

  it("tolerates extra directives and whitespace", () => {
    const result = parseRobotsMeta("  index,  follow , max-snippet:-1  ");
    expect(result.raw).toBe("index, follow , max-snippet:-1");
    expect(result.directives).toContain("max-snippet:-1");
    expect(result.index).toBe(true);
  });
});

describe("summarizeJsonLdBlock", () => {
  it("parses a single object and pulls the summary fields", () => {
    const block = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "Acme Analytics",
      description: "Product analytics for small teams.",
      url: "https://acme.example/",
    });
    const result = summarizeJsonLdBlock(block);
    expect(result.valid).toBe(true);
    expect(result.types).toEqual(["SoftwareApplication"]);
    expect(result.summary.name).toBe("Acme Analytics");
    expect(result.summary.url).toBe("https://acme.example/");
    expect(result.keys).toContain("name");
    expect(result.keys).not.toContain("@context");
  });

  it("walks @graph nodes and collects every type", () => {
    const block = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Article", headline: "How to audit a page", author: { "@type": "Person", name: "Jane Doe" }, datePublished: "2026-01-02" },
        { "@type": "BreadcrumbList" },
      ],
    });
    const result = summarizeJsonLdBlock(block);
    expect(result.types).toEqual(["Article", "BreadcrumbList"]);
    expect(result.summary.headline).toBe("How to audit a page");
    expect(result.summary.author).toBe("Jane Doe");
    expect(result.summary.datePublished).toBe("2026-01-02");
  });

  it("handles arrays and @type arrays", () => {
    const result = summarizeJsonLdBlock(JSON.stringify([{ "@type": ["Product", "Offer"], name: "Pro plan" }, { "@type": "Organization", name: "Acme" }]));
    expect(result.types).toEqual(["Product", "Offer", "Organization"]);
    expect(result.summary.type).toBe("Product");
    expect(result.summary.name).toBe("Pro plan");
  });

  it("reports invalid JSON without throwing", () => {
    const result = summarizeJsonLdBlock("{ not json ");
    expect(result.valid).toBe(false);
    expect(result.types).toEqual([]);
    expect(result.error).toBe("Block is not valid JSON");
  });

  it("truncates long descriptions to 200 characters", () => {
    const result = summarizeJsonLdBlock(JSON.stringify({ "@type": "Article", description: "x".repeat(400) }));
    expect(result.summary.description).toHaveLength(200);
  });
});
