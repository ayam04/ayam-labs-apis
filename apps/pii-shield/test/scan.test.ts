import { describe, expect, it } from "vitest";
import { scanText } from "../src/lib/pii";
import { DETECTORS, PII_TYPES } from "../src/lib/detectors";

const typesOf = (text: string, options = {}) => scanText(text, options).findings.map((finding) => finding.type);
const find = (text: string, type: string) => scanText(text).findings.find((finding) => finding.type === type);

describe("detector catalogue", () => {
  it("covers every advertised type exactly once", () => {
    expect(DETECTORS.map((detector) => detector.id)).toEqual([...PII_TYPES]);
    expect(new Set(DETECTORS.map((detector) => detector.id)).size).toBe(PII_TYPES.length);
  });

  it("documents every detector with an example, validator and confidence range", () => {
    for (const detector of DETECTORS) {
      expect(detector.example.length).toBeGreaterThan(2);
      expect(detector.description.length).toBeGreaterThan(10);
      expect(detector.confidenceRange.min).toBeGreaterThan(0);
      expect(detector.confidenceRange.max).toBeLessThanOrEqual(1);
      expect(detector.confidenceRange.min).toBeLessThanOrEqual(detector.confidenceRange.max);
      expect(detector.riskWeight).toBeGreaterThan(0);
    }
    expect(DETECTORS.filter((detector) => detector.validator === null)).toHaveLength(0);
  });
});

describe("email", () => {
  it("finds an address and reports exact offsets", () => {
    const text = "Contact jane.doe@example.com today";
    const result = scanText(text);
    const email = result.findings.find((finding) => finding.type === "EMAIL");
    expect(email).toBeDefined();
    expect(email?.value).toBe("jane.doe@example.com");
    expect(text.slice(email!.start, email!.end)).toBe("jane.doe@example.com");
    expect(email?.confidence).toBe(0.99);
  });

  it("ignores domain-less handles", () => {
    expect(typesOf("ping jane@example please")).not.toContain("EMAIL");
  });
});

describe("phone", () => {
  it("finds an international number once", () => {
    const findings = scanText("Call +1 (555) 123-4567 now").findings.filter((finding) => finding.type === "PHONE");
    expect(findings).toHaveLength(1);
    expect(findings[0].confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("rejects short groups that only look like a phone", () => {
    expect(typesOf("Call 555-1234")).not.toContain("PHONE");
    expect(typesOf("Order 12 34 56")).not.toContain("PHONE");
  });

  it("matches a phone number that ends a sentence", () => {
    const phone = find("call 555-123-4567. Email us later.", "PHONE");
    expect(phone?.value).toBe("555-123-4567");
    expect(phone?.confidence).toBe(0.85);
  });

  it("does not fire on dotted version strings", () => {
    expect(typesOf("version 1.2.3 shipped")).not.toContain("PHONE");
    expect(typesOf("ip 203.0.113.42 online")).not.toContain("PHONE");
  });
});

describe("credit card", () => {
  it("finds a Luhn valid card and its brand", () => {
    const card = find("Pay with 4111 1111 1111 1111 today", "CREDIT_CARD");
    expect(card?.detail).toBe("visa");
    expect(card?.validator).toBe("luhn");
    expect(card?.confidence).toBe(0.97);
  });

  it("rejects a card that fails Luhn", () => {
    expect(typesOf("Pay with 4111 1111 1111 1112 today")).not.toContain("CREDIT_CARD");
  });

  it("detects an amex 15 digit number", () => {
    expect(find("amex 378282246310005", "CREDIT_CARD")?.detail).toBe("amex");
  });
});

describe("iban and ssn", () => {
  it("finds a checksum valid IBAN and echoes the country", () => {
    const iban = find("Send to GB82 WEST 1234 5698 7654 32 please", "IBAN");
    expect(iban?.validator).toBe("iban-mod97");
    expect(iban?.detail).toBe("GB");
  });

  it("ignores an IBAN with a bad checksum", () => {
    expect(typesOf("Send to GB82 WEST 1234 5698 7654 33 please")).not.toContain("IBAN");
  });

  it("finds a valid SSN", () => {
    expect(find("ssn 123-45-6789", "SSN")?.value).toBe("123-45-6789");
  });

  it("rejects invalid SSN areas and groups", () => {
    expect(typesOf("ssn 666-45-6789")).not.toContain("SSN");
    expect(typesOf("ssn 900-45-6789")).not.toContain("SSN");
    expect(typesOf("ssn 123-00-6789")).not.toContain("SSN");
  });
});

describe("network identifiers", () => {
  it("finds IPv4, IPv6 and MAC addresses", () => {
    expect(find("from 203.0.113.42 port 22", "IPV4")?.value).toBe("203.0.113.42");
    expect(find("host 2001:db8::1 online", "IPV6")?.value).toBe("2001:db8::1");
    expect(find("mac 00:1A:2B:3C:4D:5E here", "MAC_ADDRESS")?.value).toBe("00:1A:2B:3C:4D:5E");
  });

  it("rejects out of range octets and short hex groups", () => {
    expect(typesOf("version 256.0.113.42")).not.toContain("IPV4");
    expect(typesOf("time 12:34")).not.toContain("IPV6");
  });

  it("resolves a URL that contains an IP to a single URL finding", () => {
    const result = scanText("see https://203.0.113.42/path now");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].type).toBe("URL");
  });
});

describe("secrets", () => {
  it("finds a JWT as one span and does not slice it into API keys", () => {
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";
    const result = scanText("Bearer " + token + " end");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].type).toBe("JWT");
    expect(result.findings[0].value).toBe(token);
  });

  it("finds an AWS access key id", () => {
    expect(find("key AKIAIOSFODNN7EXAMPLE here", "AWS_KEY")?.value).toBe("AKIAIOSFODNN7EXAMPLE");
  });

  it("finds a GitHub token", () => {
    const token = "ghp_aBcD1234eFgH5678iJkL9012mNoP3456qRsT";
    expect(find("token " + token + " x", "GITHUB_TOKEN")?.value).toBe(token);
  });

  it("flags a high entropy token as a low confidence API key", () => {
    const key = find("secret " + "sk_" + "live_9f2b7c4d8e1a6f3b5c0d2e7a9b4c6d8e" + " end", "API_KEY");
    expect(key).toBeDefined();
    expect(key?.confidence).toBeLessThan(0.6);
    expect(key?.validator).toBe("entropy");
  });

  it("does not call a long lowercase word an API key", () => {
    expect(typesOf("supercalifragilisticexpialidociousness")).not.toContain("API_KEY");
  });

  it("verifies bitcoin and ethereum wallets", () => {
    expect(find("to 1BoatSLRHtKNngkdXEeobR76b53LETtpyT now", "CRYPTO_WALLET")?.detail).toBe("bitcoin-p2pkh");
    expect(find("to 0x52908400098527886E0F7030069857D2E4169EE7 now", "CRYPTO_WALLET")?.detail).toBe("ethereum");
  });

  it("rejects a bitcoin shaped string with a broken checksum", () => {
    expect(typesOf("to 1BoatSLRHtKNngkdXEeobR76b53LETtpyU now")).not.toContain("CRYPTO_WALLET");
  });
});

describe("context detectors", () => {
  it("finds passport and licence numbers behind their labels", () => {
    expect(find("Passport No: X1234567", "PASSPORT")?.value).toBe("X1234567");
    expect(find("Driver's License: D1234567", "DRIVERS_LICENSE")?.value).toBe("D1234567");
  });

  it("does not invent a passport without a label", () => {
    expect(typesOf("X1234567")).not.toContain("PASSPORT");
  });

  it("finds a street address", () => {
    const address = find("Ship to 1600 Pennsylvania Ave NW today", "POSTAL_ADDRESS");
    expect(address?.value).toBe("1600 Pennsylvania Ave NW");
  });

  it("finds a dictionary backed person name at low confidence", () => {
    const name = find("Owner Jane Doe signed", "PERSON_NAME");
    expect(name?.value).toBe("Jane Doe");
    expect(name?.confidence).toBeLessThanOrEqual(0.5);
  });

  it("boosts a person name that follows a title", () => {
    const name = find("Dr. Jane Doe arrived", "PERSON_NAME");
    expect(name?.confidence).toBeGreaterThan(0.6);
  });
});

describe("dates of birth", () => {
  it("reports a bare date with low confidence", () => {
    const date = find("renewal 1990-04-17 confirmed", "DATE_OF_BIRTH");
    expect(date?.confidence).toBe(0.5);
  });

  it("boosts the confidence when a birth keyword is nearby", () => {
    const date = find("date of birth 1990-04-17", "DATE_OF_BIRTH");
    expect(date?.confidence).toBe(0.78);
  });

  it("accepts day-first and month-name forms and rejects impossible dates", () => {
    expect(find("born 17/04/1990", "DATE_OF_BIRTH")?.value).toBe("17/04/1990");
    expect(find("born April 17, 1990", "DATE_OF_BIRTH")?.value).toBe("April 17, 1990");
    expect(typesOf("seen 1990-02-30")).not.toContain("DATE_OF_BIRTH");
  });
});

describe("scan controls", () => {
  it("restricts detection to the requested types", () => {
    const text = "jane@example.com and +1 555 123 4567";
    expect(scanText(text, { types: ["EMAIL"] }).findings.map((finding) => finding.type)).toEqual(["EMAIL"]);
  });

  it("drops findings below minConfidence", () => {
    const text = "renewal 1990-04-17";
    expect(scanText(text, { minConfidence: 0.6 }).findings).toHaveLength(0);
  });

  it("returns counts, spans and a risk summary", () => {
    const result = scanText("jane@example.com, card 4111 1111 1111 1111");
    expect(result.counts.EMAIL).toBe(1);
    expect(result.counts.CREDIT_CARD).toBe(1);
    expect(result.spans).toHaveLength(2);
    expect(result.risk.detectedTypes).toEqual(["CREDIT_CARD", "EMAIL"]);
    expect(result.risk.level).toBe("high");
    expect(result.risk.score).toBe(64);
    expect(result.truncated).toBe(false);
    expect(result.textLength).toBe(42);
  });

  it("escalates the risk level for a card plus an AWS key", () => {
    const result = scanText("4111 1111 1111 1111 and AKIAIOSFODNN7EXAMPLE");
    expect(result.risk.score).toBe(88);
    expect(result.risk.level).toBe("critical");
  });

  it("never puts raw values into the risk summary", () => {
    const result = scanText("jane@example.com");
    const serialized = JSON.stringify(result.risk);
    expect(serialized).not.toContain("jane@example.com");
    expect(Object.keys(result.risk).sort()).toEqual(["detectedTypes", "level", "score"]);
  });

  it("caps findings at 2000 and flags truncation", () => {
    const text = new Array(2100).fill("a@b.co").join(" ");
    const result = scanText(text);
    expect(result.findings).toHaveLength(2000);
    expect(result.truncated).toBe(true);
  });

  it("truncates very long finding values", () => {
    const token = "eyJ" + "a".repeat(300) + "." + "b".repeat(300) + "." + "c".repeat(300);
    const result = scanText(token);
    expect(result.findings[0].valueTruncated).toBe(true);
    expect(result.findings[0].value).toHaveLength(256);
  });

  it("returns nothing for empty-ish prose", () => {
    const result = scanText("The quarterly report is ready for review tomorrow.");
    expect(result.findings).toHaveLength(0);
    expect(result.risk).toEqual({ level: "none", score: 0, detectedTypes: [] });
  });
});
