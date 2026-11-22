import { describe, expect, it } from "vitest";
import { normalizeMarkdown } from "../src/lib/markdown";
import { sanitizeHref, sanitizeImageSrc } from "../src/lib/url";
import { ensureHtmlDocument } from "../src/lib/html";

describe("normalizeMarkdown", () => {
  it("collapses three or more newlines into one blank line", () => {
    expect(normalizeMarkdown("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("strips trailing whitespace and leading/trailing blank lines", () => {
    expect(normalizeMarkdown("\n\n# Title   \n\ntext   \n\n\n")).toBe("# Title\n\ntext");
  });

  it("keeps fenced code blocks untouched", () => {
    const input = "text\n\n\u0060\u0060\u0060js\nconst a = 1;\n\n\nconst b = 2;\n\u0060\u0060\u0060\n\nend";
    expect(normalizeMarkdown(input)).toBe("text\n\n\u0060\u0060\u0060js\nconst a = 1;\n\n\nconst b = 2;\n\u0060\u0060\u0060\n\nend");
  });

  it("removes stray tag-like text outside code", () => {
    expect(normalizeMarkdown("hello <div class=\"x\">world</div>")).toBe("hello world");
  });

  it("drops empty links and images", () => {
    expect(normalizeMarkdown("see [](https://example.com) and ![](/x.png)")).toBe("see and");
  });

  it("leaves clean markdown unchanged", () => {
    const markdown = "# Title\n\n- one\n- two\n\n> quote";
    expect(normalizeMarkdown(markdown)).toBe(markdown);
  });
});

describe("sanitizeHref", () => {
  it("resolves relative links against the base url", () => {
    expect(sanitizeHref("/pricing", "https://example.com/docs/page")).toBe("https://example.com/pricing");
    expect(sanitizeHref("next", "https://example.com/docs/page")).toBe("https://example.com/docs/next");
  });

  it("keeps absolute http and https links", () => {
    expect(sanitizeHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(sanitizeHref("http://example.com")).toBe("http://example.com/");
  });

  it("keeps mailto and tel but rejects script schemes", () => {
    expect(sanitizeHref("mailto:hello@example.com")).toBe("mailto:hello@example.com");
    expect(sanitizeHref("tel:+15551234")).toBe("tel:+15551234");
    expect(sanitizeHref("javascript:alert(1)")).toBeNull();
    expect(sanitizeHref("JavaScript:alert(1)")).toBeNull();
    expect(sanitizeHref("data:text/html,<script>")).toBeNull();
    expect(sanitizeHref("vbscript:msgbox")).toBeNull();
  });

  it("rejects in-page anchors, empty values and oversized urls", () => {
    expect(sanitizeHref("#section")).toBeNull();
    expect(sanitizeHref("")).toBeNull();
    expect(sanitizeHref(null)).toBeNull();
    expect(sanitizeHref("https://example.com/" + "a".repeat(3000))).toBeNull();
  });

  it("rejects relative links when there is no base url", () => {
    expect(sanitizeHref("/pricing")).toBeNull();
  });
});

describe("sanitizeImageSrc", () => {
  it("keeps http(s) images and resolves relative ones", () => {
    expect(sanitizeImageSrc("/logo.png", "https://example.com")).toBe("https://example.com/logo.png");
    expect(sanitizeImageSrc("https://cdn.example.com/x.png")).toBe("https://cdn.example.com/x.png");
  });

  it("drops data urls and mailto targets", () => {
    expect(sanitizeImageSrc("data:image/png;base64,AAAA")).toBeNull();
    expect(sanitizeImageSrc("mailto:x@example.com")).toBeNull();
  });
});

describe("ensureHtmlDocument", () => {
  it("leaves full documents alone", () => {
    const html = "<html><body><p>x</p></body></html>";
    expect(ensureHtmlDocument(html)).toBe(html);
  });

  it("wraps fragments so the html selector always matches", () => {
    const wrapped = ensureHtmlDocument("<p>fragment</p>");
    expect(wrapped.startsWith("<!doctype html><html>")).toBe(true);
    expect(wrapped.endsWith("</body></html>")).toBe(true);
    expect(wrapped).toContain("<p>fragment</p>");
  });
});
