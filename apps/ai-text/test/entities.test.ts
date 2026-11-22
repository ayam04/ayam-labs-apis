import { describe, expect, it } from "vitest";
import { extractEntities, type Entity } from "../src/lib/entities";

const SAMPLE =
  "Contact billing@acme.io or call +1 415 555 2671. " +
  "Invoice INV-2024-01-02 for $1,250.50 was paid on January 12, 2024 with 12% tax. " +
  "See https://acme.io/invoices/1234 and #billing @acme_support. " +
  "Server 192.168.1.10, IBAN DE89370400440532013000, id 550e8400-e29b-41d4-a716-446655440000.";

function find(entities: Entity[], type: string): Entity | undefined {
  return entities.find((entity) => entity.type === type);
}

describe("extractEntities", () => {
  it("finds one of every supported type", () => {
    const result = extractEntities(SAMPLE);
    expect(find(result.entities, "email")?.value).toBe("billing@acme.io");
    expect(find(result.entities, "url")?.value).toBe("https://acme.io/invoices/1234");
    expect(find(result.entities, "phone")?.value).toBe("+1 415 555 2671");
    expect(find(result.entities, "money")?.value).toBe("$1,250.50");
    expect(find(result.entities, "percent")?.value).toBe("12%");
    expect(find(result.entities, "hashtag")?.value).toBe("#billing");
    expect(find(result.entities, "mention")?.value).toBe("@acme_support");
    expect(find(result.entities, "ipv4")?.value).toBe("192.168.1.10");
    expect(find(result.entities, "iban")?.value).toBe("DE89370400440532013000");
    expect(find(result.entities, "uuid")?.value).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("finds both dates in the sample", () => {
    const result = extractEntities(SAMPLE);
    const dates = result.entities.filter((entity) => entity.type === "date").map((entity) => entity.value);
    expect(dates).toContain("2024-01-02");
    expect(dates).toContain("January 12, 2024");
  });

  it("returns spans that slice back to the reported value", () => {
    const result = extractEntities(SAMPLE);
    expect(result.entities.length).toBeGreaterThan(8);
    for (const entity of result.entities) {
      expect(SAMPLE.slice(entity.start, entity.end)).toBe(entity.value);
      expect(entity.confidence).toBeGreaterThan(0);
      expect(entity.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("never returns overlapping spans", () => {
    const result = extractEntities(SAMPLE);
    for (let index = 1; index < result.entities.length; index += 1) {
      expect(result.entities[index].start).toBeGreaterThanOrEqual(result.entities[index - 1].end);
    }
  });

  it("counts what it returns", () => {
    const result = extractEntities(SAMPLE);
    const total = Object.values(result.counts).reduce((sum, value) => sum + value, 0);
    expect(result.total).toBe(result.entities.length);
    expect(total).toBe(result.total);
    expect(result.truncated).toBe(false);
  });

  it("caps each type at 50 so one type cannot crowd out the rest", () => {
    const emails = Array.from({ length: 60 }, (_, index) => "user" + index + "@example.com").join(" ");
    const result = extractEntities(emails + " call +1 415 555 2671");
    expect(result.counts.email).toBe(50);
    expect(result.counts.phone).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.total).toBeLessThanOrEqual(200);
  });

  it("does not report a mention inside an email address", () => {
    const result = extractEntities("Write to jane@example.com today.");
    expect(result.counts.email).toBe(1);
    expect(result.counts.mention).toBe(0);
  });

  it("rejects impossible IPv4 addresses", () => {
    expect(extractEntities("host 999.1.1.1").counts.ipv4).toBe(0);
    expect(extractEntities("host 10.0.0.255").counts.ipv4).toBe(1);
  });

  it("strips trailing punctuation from URLs", () => {
    const result = extractEntities("Docs: https://acme.io/docs, and more.");
    expect(result.entities[0].value).toBe("https://acme.io/docs");
  });

  it("does not turn a date into a phone number", () => {
    const result = extractEntities("Due 2024-01-02.");
    expect(result.counts.date).toBe(1);
    expect(result.counts.phone).toBe(0);
  });

  it("rejects IBANs that fail the mod-97 checksum", () => {
    expect(extractEntities("IBAN DE89370400440532013001").counts.iban).toBe(0);
    expect(extractEntities("IBAN DE89370400440532013000").counts.iban).toBe(1);
  });

  it("finds nothing in clean prose", () => {
    const result = extractEntities("The quick brown fox jumps over the lazy dog.");
    expect(result.total).toBe(0);
    expect(result.entities).toEqual([]);
  });
});
