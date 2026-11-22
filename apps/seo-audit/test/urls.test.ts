import { describe, expect, it } from "vitest";
import { ApiError } from "@api/core";
import {
  getRegistrableDomain,
  isSameRegistrableDomain,
  normalizeDomainInput,
  normalizeUrlInput,
  resolveHref,
  sameDocument,
} from "../src/lib/urls";

describe("normalizeUrlInput", () => {
  it("adds https when the scheme is missing", () => {
    expect(normalizeUrlInput("example.com").toString()).toBe("https://example.com/");
  });

  it("drops the fragment", () => {
    expect(normalizeUrlInput("example.com/a#top").toString()).toBe("https://example.com/a");
  });

  it("keeps an explicit http scheme and port", () => {
    expect(normalizeUrlInput("http://example.com:8080/x").toString()).toBe("http://example.com:8080/x");
  });

  it("treats host:port without a scheme as a URL", () => {
    expect(normalizeUrlInput("example.com:8080/x").toString()).toBe("https://example.com:8080/x");
  });

  it("rejects unsupported schemes", () => {
    expect(() => normalizeUrlInput("ftp://example.com")).toThrow(ApiError);
    expect(() => normalizeUrlInput("mailto:hi@example.com")).toThrow(ApiError);
    expect(() => normalizeUrlInput("javascript:alert(1)")).toThrow(ApiError);
  });

  it("rejects embedded credentials", () => {
    expect(() => normalizeUrlInput("https://user:pass@example.com")).toThrow(ApiError);
  });

  it("rejects empty and oversized input", () => {
    expect(() => normalizeUrlInput("   ")).toThrow(ApiError);
    expect(() => normalizeUrlInput("https://example.com/" + "a".repeat(2100))).toThrow(ApiError);
  });
});

describe("getRegistrableDomain", () => {
  it("keeps two label domains", () => {
    expect(getRegistrableDomain("example.com")).toBe("example.com");
    expect(getRegistrableDomain("www.example.com")).toBe("example.com");
  });

  it("knows common multi label suffixes", () => {
    expect(getRegistrableDomain("blog.example.co.uk")).toBe("example.co.uk");
    expect(getRegistrableDomain("shop.example.com.au")).toBe("example.com.au");
    expect(getRegistrableDomain("www.example.co.jp")).toBe("example.co.jp");
  });

  it("leaves IP addresses alone", () => {
    expect(getRegistrableDomain("127.0.0.1")).toBe("127.0.0.1");
  });

  it("compares sites by registrable domain", () => {
    expect(isSameRegistrableDomain("www.example.com", "api.example.com")).toBe(true);
    expect(isSameRegistrableDomain("example.co.uk", "other.co.uk")).toBe(false);
    expect(isSameRegistrableDomain("example.com", "example.org")).toBe(false);
  });
});

describe("resolveHref", () => {
  it("resolves relative paths against the base", () => {
    expect(resolveHref("/pricing", "https://example.com/blog/post").url).toBe("https://example.com/pricing");
    expect(resolveHref("pricing", "https://example.com/blog/post").url).toBe("https://example.com/blog/pricing");
  });

  it("resolves protocol relative URLs", () => {
    expect(resolveHref("//cdn.example.com/x.js", "https://example.com/").url).toBe("https://cdn.example.com/x.js");
  });

  it("classifies non navigational schemes", () => {
    expect(resolveHref("mailto:hi@example.com", "https://example.com/").kind).toBe("mailto");
    expect(resolveHref("tel:+441234567890", "https://example.com/").kind).toBe("tel");
    expect(resolveHref("javascript:void(0)", "https://example.com/").url).toBeNull();
    expect(resolveHref("data:text/html,hi", "https://example.com/").kind).toBe("data");
  });

  it("keeps fragments on the same document", () => {
    expect(resolveHref("#section", "https://example.com/a").url).toBe("https://example.com/a#section");
  });

  it("marks an empty href invalid", () => {
    expect(resolveHref("   ", "https://example.com/").kind).toBe("invalid");
  });
});

describe("normalizeDomainInput", () => {
  it("returns the origin and hostname", () => {
    const domain = normalizeDomainInput("Example.COM/some/path");
    expect(domain.origin).toBe("https://example.com");
    expect(domain.hostname).toBe("example.com");
    expect(domain.https).toBe(true);
  });

  it("keeps an explicit http scheme", () => {
    const domain = normalizeDomainInput("http://example.com");
    expect(domain.origin).toBe("http://example.com");
    expect(domain.https).toBe(false);
  });
});

describe("sameDocument", () => {
  it("ignores fragments and a trailing slash", () => {
    expect(sameDocument("https://example.com/a/", "https://example.com/a")).toBe(true);
    expect(sameDocument("https://example.com/a#x", "https://example.com/a")).toBe(true);
  });

  it("separates different paths and hosts", () => {
    expect(sameDocument("https://example.com/a", "https://example.com/b")).toBe(false);
    expect(sameDocument("https://example.com/a", "https://other.example/a")).toBe(false);
  });
});
