import { describe, expect, it } from "vitest";
import { moderate } from "../src/lib/moderate";

describe("verdict", () => {
  it("allows clean prose", () => {
    const result = moderate("Thanks for the update. The report is in the shared folder.");
    expect(result.verdict.action).toBe("allow");
    expect(result.verdict.score).toBe(0);
    expect(result.verdict.reasons[0]).toMatch(/No PII, profanity or spam/);
    expect(result.pii.findings).toHaveLength(0);
    expect(result.profanity.isProfane).toBe(false);
    expect(result.spam.band).toBe("clean");
  });

  it("sends ordinary contact details to review", () => {
    const result = moderate("Ping me on jane.doe@example.com when done.");
    expect(result.pii.risk.level).toBe("medium");
    expect(result.verdict.action).toBe("review");
    expect(result.verdict.reasons[0]).toContain("EMAIL x1");
  });

  it("blocks critical PII", () => {
    const result = moderate("card 4111 1111 1111 1111 and key AKIAIOSFODNN7EXAMPLE");
    expect(result.pii.risk.level).toBe("critical");
    expect(result.verdict.action).toBe("block");
  });

  it("blocks a spam pitch", () => {
    const result = moderate(
      "WIN a $1000 gift card NOW!!! Verify your account at https://bit.ly/xk9 and call 555-123-4567. TODAY ONLY! double your bitcoin, guaranteed profit!!!",
    );
    expect(result.spam.band).toBe("spam");
    expect(result.verdict.action).toBe("block");
  });

  it("blocks a high severity profanity match", () => {
    const result = moderate("well, fuck this");
    expect(result.profanity.highestSeverity).toBe("high");
    expect(result.verdict.action).toBe("block");
    expect(result.verdict.reasons.some((reason) => reason.startsWith("Profanity:"))).toBe(true);
  });

  it("reviews any profanity, even low severity", () => {
    const result = moderate("damn it");
    expect(result.verdict.action).toBe("review");
    expect(result.verdict.score).toBe(2);
  });

  it("reviews suspicious spam", () => {
    const result = moderate("ACT NOW!!! Limited time offer. Write to us.");
    expect(result.spam.band).toBe("suspicious");
    expect(result.verdict.action).toBe("review");
  });

  it("blends the three scores with fixed weights", () => {
    const result = moderate("shit https://bit.ly/x");
    const expected = Math.round(result.pii.risk.score * 0.45 + result.spam.score * 0.35 + result.profanity.score * 0.2);
    expect(result.verdict.score).toBe(expected);
  });

  it("never echoes raw values in the verdict reasons", () => {
    const result = moderate("reach me at jane.doe@example.com or 4111 1111 1111 1111");
    const serialized = JSON.stringify(result.verdict);
    expect(serialized).not.toContain("jane.doe@example.com");
    expect(serialized).not.toContain("4111");
    expect(serialized).toContain("EMAIL x1");
    expect(serialized).toContain("CREDIT_CARD x1");
  });
});

describe("pass through options", () => {
  it("restricts the PII pass to the requested types", () => {
    const result = moderate("jane@example.com 4111 1111 1111 1111", { piiTypes: ["EMAIL"] });
    expect(result.pii.findings.map((finding) => finding.type)).toEqual(["EMAIL"]);
  });

  it("applies the confidence floor", () => {
    const result = moderate("renewal 1990-04-17", { minConfidence: 0.6 });
    expect(result.pii.findings).toHaveLength(0);
  });

  it("screens the requested profanity languages", () => {
    const result = moderate("esto es mierda", { langs: ["es"] });
    expect(result.profanity.isProfane).toBe(true);
    expect(result.profanity.matches[0].lang).toBe("es");
  });
});

describe("shape", () => {
  it("reports input size and all three detector payloads", () => {
    const result = moderate("Hi there, one line of text.");
    expect(result.text.characters).toBe(27);
    expect(result.text.words).toBe(6);
    expect(result.pii).toHaveProperty("spans");
    expect(result.profanity).toHaveProperty("counts");
    expect(result.spam).toHaveProperty("features");
    expect(result.spam).toHaveProperty("thresholds");
  });
});
