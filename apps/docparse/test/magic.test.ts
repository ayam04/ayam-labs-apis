import { describe, expect, it } from "vitest";
import {
  detectPdfEncryption,
  indexOfAscii,
  looksLikeHtml,
  looksLikePdf,
  looksLikeZip,
  readPdfVersion,
} from "../src/lib/magic";

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("indexOfAscii", () => {
  it("finds a needle and returns -1 when absent", () => {
    expect(indexOfAscii(bytes("xx%PDF-yy"), "%PDF-")).toBe(2);
    expect(indexOfAscii(bytes("xx"), "%PDF-")).toBe(-1);
  });

  it("honours the start offset", () => {
    expect(indexOfAscii(bytes("%PDF-%PDF-"), "%PDF-", 2)).toBe(5);
  });
});

describe("looksLikePdf", () => {
  it("accepts a normal header", () => {
    expect(looksLikePdf(bytes("%PDF-1.7\n1 0 obj"))).toBe(true);
  });

  it("accepts leading junk, as real readers do", () => {
    expect(looksLikePdf(bytes("\n\n  %PDF-1.4\n"))).toBe(true);
  });

  it("rejects html error pages and zips", () => {
    expect(looksLikePdf(bytes("<!doctype html><html></html>"))).toBe(false);
    expect(looksLikePdf(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
  });
});

describe("readPdfVersion", () => {
  it("reads a well formed version", () => {
    expect(readPdfVersion(bytes("%PDF-1.7\n"))).toBe("1.7");
    expect(readPdfVersion(bytes("%PDF-1.4\n"))).toBe("1.4");
  });

  it("returns null when the header is missing or malformed", () => {
    expect(readPdfVersion(bytes("not a pdf"))).toBeNull();
    expect(readPdfVersion(bytes("%PDF-x\n"))).toBeNull();
  });
});

describe("detectPdfEncryption", () => {
  it("sees an /Encrypt entry in the trailer", () => {
    expect(detectPdfEncryption(bytes("%PDF-1.7\ntrailer\n<< /Root 1 0 R /Encrypt 4 0 R >>"))).toBe(true);
  });

  it("is false for a plain document", () => {
    expect(detectPdfEncryption(bytes("%PDF-1.7\ntrailer\n<< /Root 1 0 R >>"))).toBe(false);
  });
});

describe("looksLikeZip", () => {
  it("accepts the docx signature", () => {
    expect(looksLikeZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBe(true);
  });

  it("rejects pdf and text", () => {
    expect(looksLikeZip(bytes("%PDF-1.7"))).toBe(false);
    expect(looksLikeZip(bytes("hello"))).toBe(false);
  });
});

describe("looksLikeHtml", () => {
  it("accepts documents and fragments", () => {
    expect(looksLikeHtml("<!doctype html><html></html>")).toBe(true);
    expect(looksLikeHtml("<p>hello</p>")).toBe(true);
    expect(looksLikeHtml("<HTML><body>x</body></HTML>")).toBe(true);
  });

  it("rejects plain text and json", () => {
    expect(looksLikeHtml("just some words")).toBe(false);
    expect(looksLikeHtml('{"html":"<p>x</p>"}')).toBe(false);
  });
});
