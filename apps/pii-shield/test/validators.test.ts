import { describe, expect, it } from "vitest";
import {
  base58Check,
  cardBrand,
  datePlausible,
  daysInMonth,
  highEntropyToken,
  ibanCheck,
  ipv4Valid,
  ipv6Valid,
  luhnValid,
  shannonEntropy,
  ssnValid,
  urlValid,
} from "../src/lib/validators";
import { sha256Hex, shortHash, utf8Bytes } from "../src/lib/sha256";

describe("luhn", () => {
  it("accepts known test numbers", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("5555555555554444")).toBe(true);
    expect(luhnValid("378282246310005")).toBe(true);
    expect(luhnValid("6011111111111117")).toBe(true);
    expect(luhnValid("3530111333300000")).toBe(true);
  });

  it("rejects a single digit change", () => {
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(luhnValid("1234567890123456")).toBe(false);
  });

  it("rejects non digits", () => {
    expect(luhnValid("4111-1111-1111-1111")).toBe(false);
    expect(luhnValid("")).toBe(false);
  });
});

describe("card brand", () => {
  it("detects visa, mastercard, amex, discover and jcb", () => {
    expect(cardBrand("4111111111111111")?.id).toBe("visa");
    expect(cardBrand("5555555555554444")?.id).toBe("mastercard");
    expect(cardBrand("2221000000000009")?.id).toBe("mastercard");
    expect(cardBrand("378282246310005")?.id).toBe("amex");
    expect(cardBrand("6011111111111117")?.id).toBe("discover");
    expect(cardBrand("3530111333300000")?.id).toBe("jcb");
  });

  it("returns null for unknown prefixes", () => {
    expect(cardBrand("9999999999999995")).toBeNull();
  });
});

describe("iban", () => {
  it("validates a spaced GB IBAN", () => {
    const result = ibanCheck("GB82 WEST 1234 5698 7654 32");
    expect(result.valid).toBe(true);
    expect(result.country).toBe("GB");
    expect(result.compact).toBe("GB82WEST12345698765432");
  });

  it("validates a DE IBAN", () => {
    expect(ibanCheck("DE89370400440532013000").valid).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    const result = ibanCheck("GB82WEST12345698765433");
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("mod97");
  });

  it("rejects an unregistered country code", () => {
    expect(ibanCheck("ZZ82WEST12345698765432").valid).toBe(false);
  });

  it("rejects values that are too short", () => {
    expect(ibanCheck("GB8212345678").valid).toBe(false);
  });
});

describe("ssn", () => {
  it("accepts a structurally valid number", () => {
    expect(ssnValid("123-45-6789")).toBe(true);
    expect(ssnValid("001-01-0001")).toBe(true);
  });

  it("rejects area 000, 666 and 900+", () => {
    expect(ssnValid("000-45-6789")).toBe(false);
    expect(ssnValid("666-45-6789")).toBe(false);
    expect(ssnValid("900-45-6789")).toBe(false);
  });

  it("rejects group 00 and serial 0000", () => {
    expect(ssnValid("123-00-6789")).toBe(false);
    expect(ssnValid("123-45-0000")).toBe(false);
  });

  it("rejects malformed shapes", () => {
    expect(ssnValid("123456789")).toBe(false);
    expect(ssnValid("123-456-789")).toBe(false);
  });
});

describe("ip and url", () => {
  it("accepts valid ipv4 and rejects bad octets or leading zeros", () => {
    expect(ipv4Valid("203.0.113.42")).toBe(true);
    expect(ipv4Valid("256.1.1.1")).toBe(false);
    expect(ipv4Valid("192.168.01.1")).toBe(false);
    expect(ipv4Valid("1.2.3")).toBe(false);
  });

  it("accepts compressed ipv6 and rejects too many groups", () => {
    expect(ipv6Valid("2001:db8::1")).toBe(true);
    expect(ipv6Valid("::1")).toBe(true);
    expect(ipv6Valid("1:2:3:4:5:6:7:8")).toBe(true);
    expect(ipv6Valid("1:2:3:4:5:6:7:8:9")).toBe(false);
    expect(ipv6Valid("2001:db8:::1")).toBe(false);
    expect(ipv6Valid("gggg::1")).toBe(false);
  });

  it("accepts http and www style urls only", () => {
    expect(urlValid("https://example.com/a?b=1")).toBe(true);
    expect(urlValid("http://203.0.113.42/x")).toBe(true);
    expect(urlValid("ftp://example.com")).toBe(false);
    expect(urlValid("not a url")).toBe(false);
  });
});

describe("dates", () => {
  it("knows month lengths and leap years", () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2024, 4)).toBe(30);
  });

  it("bounds the plausible year range", () => {
    expect(datePlausible(1990, 4, 17)).toBe(true);
    expect(datePlausible(1899, 4, 17)).toBe(false);
    expect(datePlausible(1990, 13, 17)).toBe(false);
    expect(datePlausible(1990, 2, 30)).toBe(false);
  });
});

describe("base58check", () => {
  it("verifies well known bitcoin addresses", () => {
    expect(base58Check("1BoatSLRHtKNngkdXEeobR76b53LETtpyT").valid).toBe(true);
    expect(base58Check("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa").valid).toBe(true);
    expect(base58Check("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy").version).toBe(5);
  });

  it("rejects a broken checksum and illegal characters", () => {
    expect(base58Check("1BoatSLRHtKNngkdXEeobR76b53LETtpyU").valid).toBe(false);
    expect(base58Check("1BoatSLRHtKNngkdXEeobR76b53LETtpy0").valid).toBe(false);
  });
});

describe("entropy", () => {
  it("scores repetitive text low and random tokens high", () => {
    expect(shannonEntropy("aaaaaaaaaa")).toBe(0);
    expect(shannonEntropy("abababab")).toBe(1);
    expect(shannonEntropy("aB3xK9mQ2pL7vR4t")).toBeGreaterThan(3.5);
  });

  it("flags long mixed-class tokens only", () => {
    expect(highEntropyToken("sk_" + "live_9f2b7c4d8e1a6f3b5c0d2e7a9b4c6d8e").ok).toBe(true);
    expect(highEntropyToken("thisisaverylonglowercasewordwithnentropy").ok).toBe(false);
    expect(highEntropyToken("shorttoken").ok).toBe(false);
  });
});

describe("sha256", () => {
  it("matches the FIPS 180-4 vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("The quick brown fox jumps over the lazy dog")).toBe(
      "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
    );
  });

  it("encodes multibyte characters deterministically", () => {
    expect(utf8Bytes("é").length).toBe(2);
    expect(utf8Bytes("😀").length).toBe(4);
    expect(shortHash("jane@example.com")).toHaveLength(8);
    expect(shortHash("jane@example.com")).toBe(shortHash("jane@example.com"));
  });
});
