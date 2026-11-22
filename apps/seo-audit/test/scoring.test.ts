import { describe, expect, it } from "vitest";
import { buildChecks, CHECK_WEIGHTS, evaluateAudit, gradeFor, TOTAL_WEIGHT, type ScoreInput } from "../src/lib/scoring";

const perfect: ScoreInput = {
  https: true,
  title: "Acme Analytics - product analytics without setup",
  metaDescription: "Simple usage based pricing for product teams that want activation, retention and revenue in one place.",
  canonical: "https://acme.example/",
  canonicalSameSite: true,
  lang: "en-GB",
  headingCounts: { h1: 1, h2: 4, h3: 2, h4: 0, h5: 0, h6: 0 },
  imageCount: 4,
  imagesMissingAlt: 0,
  internalLinks: 12,
  jsonLdBlocks: 2,
  jsonLdValidBlocks: 2,
  jsonLdTypes: 1,
  openGraph: { title: true, description: true, image: true },
  twitter: { card: true, title: true, description: true },
  viewport: true,
  charset: true,
};

const empty: ScoreInput = {
  https: false,
  title: null,
  metaDescription: null,
  canonical: null,
  canonicalSameSite: false,
  lang: null,
  headingCounts: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
  imageCount: 4,
  imagesMissingAlt: 4,
  internalLinks: 0,
  jsonLdBlocks: 0,
  jsonLdValidBlocks: 0,
  jsonLdTypes: 0,
  openGraph: { title: false, description: false, image: false },
  twitter: { card: false, title: false, description: false },
  viewport: false,
  charset: false,
};

describe("check weights", () => {
  it("sum to exactly 100 across 14 checks", () => {
    expect(CHECK_WEIGHTS).toHaveLength(14);
    expect(TOTAL_WEIGHT).toBe(100);
    expect(CHECK_WEIGHTS.reduce((sum, check) => sum + check.weight, 0)).toBe(100);
  });

  it("have unique ids and non zero weights", () => {
    const ids = CHECK_WEIGHTS.map((check) => check.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const check of CHECK_WEIGHTS) expect(check.weight).toBeGreaterThan(0);
  });
});

describe("evaluateAudit", () => {
  it("scores a page that passes everything 100 with grade A", () => {
    const result = evaluateAudit(perfect);
    expect(result.value).toBe(100);
    expect(result.grade).toBe("A");
    expect(result.passed).toBe(14);
    expect(result.failed).toBe(0);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("scores a page that fails everything 0 with grade F", () => {
    const result = evaluateAudit(empty);
    expect(result.value).toBe(0);
    expect(result.grade).toBe("F");
    expect(result.failed).toBe(14);
    expect(result.checks.every((check) => check.status === "fail")).toBe(true);
  });

  it("awards half the weight, rounded up, for a warning", () => {
    const longTitle = "x".repeat(61);
    const result = evaluateAudit({ ...perfect, title: longTitle });
    const titleCheck = result.checks.find((check) => check.id === "title");
    expect(titleCheck?.status).toBe("warn");
    expect(titleCheck?.points).toBe(8);
    expect(result.value).toBe(93);
    expect(result.warned).toBe(1);
  });

  it("fails image-alt only when more than a quarter of images miss alt text", () => {
    const oneOfFour = evaluateAudit({ ...perfect, imageCount: 4, imagesMissingAlt: 1 });
    expect(oneOfFour.checks.find((check) => check.id === "image-alt")?.status).toBe("warn");

    const twoOfFour = evaluateAudit({ ...perfect, imageCount: 4, imagesMissingAlt: 2 });
    expect(twoOfFour.checks.find((check) => check.id === "image-alt")?.status).toBe("fail");
  });

  it("does not punish a page that has no images", () => {
    const result = evaluateAudit({ ...perfect, imageCount: 0, imagesMissingAlt: 0 });
    expect(result.checks.find((check) => check.id === "image-alt")?.status).toBe("pass");
    expect(result.value).toBe(100);
  });

  it("keeps every check message populated", () => {
    const checks = buildChecks(perfect);
    for (const check of checks) {
      expect(check.message.length).toBeGreaterThan(0);
      expect(check.weight).toBeGreaterThan(0);
    }
  });

  it("warns when the canonical points off site", () => {
    const result = evaluateAudit({ ...perfect, canonicalSameSite: false });
    const canonical = result.checks.find((check) => check.id === "canonical");
    expect(canonical?.status).toBe("warn");
    expect(canonical?.points).toBe(4);
  });

  it("maps scores to letter grades", () => {
    expect(gradeFor(100)).toBe("A");
    expect(gradeFor(90)).toBe("A");
    expect(gradeFor(89)).toBe("B");
    expect(gradeFor(70)).toBe("C");
    expect(gradeFor(60)).toBe("D");
    expect(gradeFor(59)).toBe("F");
  });
});
