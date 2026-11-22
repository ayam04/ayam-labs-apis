import { describe, expect, it } from "vitest";
import { compactBase64, decodeBase64Capped, encodeBase64, estimateBase64Bytes, splitDataUrl } from "../src/lib/base64";

const bytesOf = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("estimateBase64Bytes", () => {
  it("matches the real decoded length for padded input", () => {
    const encoded = encodeBase64(bytesOf("%PDF-1.7\n"));
    expect(encoded.length % 4).toBe(0);
    expect(estimateBase64Bytes(encoded)).toBe(bytesOf("%PDF-1.7\n").length);
  });

  it("ignores whitespace and newlines", () => {
    expect(estimateBase64Bytes("aGVs\n bG8=\n")).toBe(5);
  });

  it("returns zero for empty input", () => {
    expect(estimateBase64Bytes("   ")).toBe(0);
  });
});

describe("splitDataUrl", () => {
  it("strips a data url prefix and reports the media type", () => {
    expect(splitDataUrl("data:application/pdf;base64,JVBERi0=")).toEqual({
      mediaType: "application/pdf",
      payload: "JVBERi0=",
    });
  });

  it("leaves a plain payload alone", () => {
    expect(splitDataUrl("JVBERi0=")).toEqual({ mediaType: null, payload: "JVBERi0=" });
  });
});

describe("compactBase64", () => {
  it("removes wrapping whitespace", () => {
    expect(compactBase64("aGVs\n bG8=\n")).toBe("aGVsbG8=");
  });
});

describe("decodeBase64Capped", () => {
  it("round trips arbitrary bytes", () => {
    const original = new Uint8Array([0, 1, 2, 250, 251, 252, 37, 80, 68, 70]);
    const decoded = decodeBase64Capped(encodeBase64(original), 1024);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it("decodes text that matches the expected string", () => {
    const encoded = encodeBase64(bytesOf("hello pdf"));
    expect(new TextDecoder().decode(decodeBase64Capped(encoded, 1024))).toBe("hello pdf");
  });

  it("rejects payloads above the byte cap with 413 before decoding", () => {
    const encoded = encodeBase64(bytesOf("0123456789"));
    try {
      decodeBase64Capped(encoded, 5);
      throw new Error("expected a 413");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(413);
      expect((error as { code?: string }).code).toBe("PAYLOAD_TOO_LARGE");
    }
  });

  it("accepts a data url prefix", () => {
    const encoded = encodeBase64(bytesOf("abc"));
    expect(new TextDecoder().decode(decodeBase64Capped("data:application/pdf;base64," + encoded, 1024))).toBe("abc");
  });

  it("accepts url safe base64", () => {
    const urlSafe = encodeBase64(new Uint8Array([251, 255, 190])).replace(/\+/g, "-").replace(/\//g, "_");
    expect(Array.from(decodeBase64Capped(urlSafe, 1024))).toEqual([251, 255, 190]);
  });

  it("accepts unpadded base64", () => {
    const encoded = encodeBase64(bytesOf("abc")).replace(/=+$/, "");
    expect(new TextDecoder().decode(decodeBase64Capped(encoded, 1024))).toBe("abc");
  });

  it("rejects junk characters with 400", () => {
    expect(() => decodeBase64Capped("not base64!!", 1024)).toThrowError(/not valid base64/);
  });

  it("rejects an empty payload with 400", () => {
    expect(() => decodeBase64Capped("  ", 1024)).toThrowError(/empty/);
  });
});
