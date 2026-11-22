import { describe, expect, it } from "vitest";
import { maskValue, redactText } from "../src/lib/redact";
import { shortHash } from "../src/lib/sha256";

describe("maskValue", () => {
  it("keeps the last characters and masks the rest", () => {
    expect(maskValue("4111111111111111", 4)).toBe("************1111");
    expect(maskValue("jane@example.com", 4)).toBe("************.com");
  });

  it("always masks at least one character", () => {
    expect(maskValue("1234", 4)).toBe("*234");
    expect(maskValue("12", 0)).toBe("**");
    expect(maskValue("7", 4)).toBe("*");
  });
});

describe("mask style", () => {
  it("redacts a card and keeps the last four characters", () => {
    const result = redactText("Pay with 4111 1111 1111 1111 now", { style: "mask", keepLast: 4 });
    expect(result.redactedText).toBe("Pay with ***************1111 now");
    expect(result.style).toBe("mask");
    expect(result.keepLast).toBe(4);
    expect(result.replacementCount).toBe(1);
    expect(result.changed).toBe(true);
  });

  it("honours keepLast 0", () => {
    const result = redactText("jane@example.com", { style: "mask", keepLast: 0 });
    expect(result.redactedText).toBe("****************");
  });

  it("leaves clean text untouched", () => {
    const result = redactText("nothing sensitive here", { style: "mask" });
    expect(result.redactedText).toBe("nothing sensitive here");
    expect(result.changed).toBe(false);
    expect(result.replacementCount).toBe(0);
    expect(result.risk.level).toBe("none");
  });

  it("only redacts the requested types", () => {
    const result = redactText("jane@example.com +1 555 123 4567", { types: ["EMAIL"], style: "mask" });
    expect(result.redactedText).toContain("+1 555 123 4567");
    expect(result.redactedText.startsWith("*")).toBe(true);
  });
});

describe("label style", () => {
  it("numbers distinct values per type and reuses labels", () => {
    const text = "jane@example.com then john@example.com then jane@example.com";
    const result = redactText(text, { types: ["EMAIL"], style: "label" });
    expect(result.redactedText).toBe("[EMAIL_1] then [EMAIL_2] then [EMAIL_1]");
    expect(result.replacementCount).toBe(3);
  });

  it("numbers each type independently", () => {
    const result = redactText("jane@example.com 4111 1111 1111 1111", { types: ["EMAIL", "CREDIT_CARD"], style: "label" });
    expect(result.redactedText).toBe("[EMAIL_1] [CREDIT_CARD_1]");
  });

  it("does not return a hash mapping", () => {
    const result = redactText("jane@example.com", { style: "label" });
    expect(result.mapping).toBeUndefined();
    expect(result.keepLast).toBe(0);
  });
});

describe("hash style", () => {
  it("uses the first 8 hex characters of the value hash", () => {
    const result = redactText("jane@example.com", { types: ["EMAIL"], style: "hash" });
    const hash = shortHash("jane@example.com");
    expect(result.redactedText).toBe("[EMAIL_" + hash + "]");
    expect(result.mapping).toHaveLength(1);
    expect(result.mapping?.[0]).toEqual({ hash, type: "EMAIL", occurrences: 1, firstStart: 0 });
  });

  it("counts repeated values and never echoes the raw value", () => {
    const result = redactText("a@b.com and a@b.com", { types: ["EMAIL"], style: "hash" });
    expect(result.mapping?.[0].occurrences).toBe(2);
    expect(result.replacementCount).toBe(2);
    // findings still describe the match, but the mapping and the output text never echo it
    expect(JSON.stringify(result.mapping)).not.toContain("a@b.com");
    expect(result.redactedText).not.toContain("a@b.com");
  });

  it("is deterministic across calls", () => {
    const first = redactText("a@b.com", { style: "hash" });
    const second = redactText("a@b.com", { style: "hash" });
    expect(first.redactedText).toBe(second.redactedText);
  });
});

describe("reconstruction", () => {
  it("keeps surrounding text and offsets intact", () => {
    const text = "line1 jane@example.com line2\nline3 4111 1111 1111 1111 line4";
    const result = redactText(text, { style: "label" });
    expect(result.redactedText).toContain("line1 [EMAIL_1] line2");
    expect(result.redactedText).toContain("line4");
    expect(result.findings.map((finding) => finding.type)).toEqual(["EMAIL", "CREDIT_CARD"]);
    expect(result.findings[0].start).toBe(6);
  });

  it("returns spans and a risk summary alongside the text", () => {
    const result = redactText("jane@example.com", { style: "label" });
    expect(result.spans).toHaveLength(1);
    expect(result.risk.detectedTypes).toEqual(["EMAIL"]);
    expect(result.counts.EMAIL).toBe(1);
  });
});
