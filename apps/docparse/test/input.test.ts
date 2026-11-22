import { describe, expect, it } from "vitest";
import {
  assertDeclaredLength,
  isJsonContentType,
  isMultipartContentType,
  mediaType,
} from "../src/lib/input";

const facade = (headers: Record<string, string>) => ({
  header: (name: string) => headers[name.toLowerCase()],
  formData: async () => new FormData(),
});

describe("mediaType", () => {
  it("strips parameters and lowercases", () => {
    expect(mediaType("Application/JSON; charset=utf-8")).toBe("application/json");
    expect(mediaType(undefined)).toBe("");
  });
});

describe("content type predicates", () => {
  it("accepts json and json suffixes", () => {
    expect(isJsonContentType("application/json")).toBe(true);
    expect(isJsonContentType("application/json; charset=utf-8")).toBe(true);
    expect(isJsonContentType("application/vnd.api+json")).toBe(true);
    expect(isJsonContentType("text/plain")).toBe(false);
  });

  it("accepts multipart only with the form-data subtype", () => {
    expect(isMultipartContentType("multipart/form-data; boundary=abc")).toBe(true);
    expect(isMultipartContentType("multipart/mixed")).toBe(false);
  });
});

describe("assertDeclaredLength", () => {
  it("throws 413 when content-length is above the cap", () => {
    try {
      assertDeclaredLength(facade({ "content-length": String(10 * 1024 * 1024) }), 8 * 1024 * 1024);
      throw new Error("expected a 413");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(413);
    }
  });

  it("allows missing or small content-length headers", () => {
    expect(() => assertDeclaredLength(facade({}), 1024)).not.toThrow();
    expect(() => assertDeclaredLength(facade({ "content-length": "12" }), 1024)).not.toThrow();
    expect(() => assertDeclaredLength(facade({ "content-length": "abc" }), 1024)).not.toThrow();
  });
});
