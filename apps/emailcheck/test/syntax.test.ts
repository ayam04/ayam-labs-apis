import { describe, expect, it } from "vitest";
import { checkSyntax, looksRandom, suggestDomain } from "../src/lib/syntax";

describe("checkSyntax", () => {
  it("accepts a normal address", () => {
    const result = checkSyntax("Jane.Doe@Example.COM");
    expect(result.valid).toBe(true);
    expect(result.domain).toBe("example.com");
    expect(result.normalized).toBe("Jane.Doe@example.com");
  });

  it("rejects missing local part", () => {
    expect(checkSyntax("@example.com").valid).toBe(false);
    expect(checkSyntax("@example.com").problems).toContain("Missing local part before @");
  });

  it("rejects duplicate @", () => {
    expect(checkSyntax("a@@b.com").valid).toBe(false);
  });

  it("rejects whitespace", () => {
    expect(checkSyntax("a b@c.com").valid).toBe(false);
  });

  it("rejects consecutive dots in local part", () => {
    const result = checkSyntax("a..b@example.com");
    expect(result.valid).toBe(false);
    expect(result.problems.join(" ")).toMatch(/dots/);
  });

  it("rejects a domain without a TLD", () => {
    expect(checkSyntax("user@localhost").valid).toBe(false);
  });

  it("canonicalises gmail dots and sub-addresses", () => {
    const result = checkSyntax("john.doe+tag@gmail.com");
    expect(result.canonical).toBe("johndoe@gmail.com");
  });

  it("keeps sub-addresses for non gmail domains", () => {
    expect(checkSyntax("john+tag@outlook.com").canonical).toBe("john@outlook.com");
  });

  it("handles international domains", () => {
    const result = checkSyntax("user@bücher.de");
    expect(result.valid).toBe(true);
    expect(result.domain).toBe("xn--bcher-kva.de");
  });
});

describe("suggestDomain", () => {
  it("never suggests for a correct popular domain", () => {
    expect(suggestDomain("gmail.com")).toBeNull();
    expect(suggestDomain("ymail.com")).toBeNull();
    expect(suggestDomain("outlook.com")).toBeNull();
  });

  it("suggests for a known misspelling", () => {
    expect(suggestDomain("gmial.com")).toBe("gmail.com");
    expect(suggestDomain("hotmial.com")).toBe("hotmail.com");
  });

  it("suggests by edit distance when the TLD matches", () => {
    expect(suggestDomain("gmaill.com")).toBe("gmail.com");
  });
});

describe("looksRandom", () => {
  it("flags vowel-free strings", () => {
    expect(looksRandom("xqztwrpkjjd")).toBe(true);
    expect(looksRandom("jdoe")).toBe(false);
    expect(looksRandom("christopher")).toBe(false);
  });
});
