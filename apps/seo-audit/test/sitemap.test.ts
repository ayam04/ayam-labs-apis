import { describe, expect, it } from "vitest";
import { MAX_CHILD_SITEMAPS, MAX_SITEMAP_URLS, parseSitemap } from "../src/lib/sitemap";

const urlset = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://acme.example/pricing</loc><lastmod>2026-10-01</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>https://acme.example/search?a=1&amp;b=2</loc></url>
  <url><loc><![CDATA[https://acme.example/blog]]></loc><lastmod>2026-11-02T10:00:00+00:00</lastmod></url>
</urlset>`;

const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://acme.example/sitemap-pages.xml</loc><lastmod>2026-01-01</lastmod></sitemap>
  <sitemap><loc>https://acme.example/sitemap-blog.xml</loc></sitemap>
</sitemapindex>`;

describe("parseSitemap", () => {
  it("parses a urlset with lastmod, changefreq and priority", () => {
    const result = parseSitemap(urlset);
    expect(result.format).toBe("xml");
    expect(result.isIndex).toBe(false);
    expect(result.urls).toHaveLength(3);
    expect(result.urls[0]).toEqual({
      loc: "https://acme.example/pricing",
      lastModified: "2026-10-01",
      changeFrequency: "weekly",
      priority: 0.8,
    });
    expect(result.totalLocCount).toBe(3);
  });

  it("decodes entities in loc values", () => {
    const result = parseSitemap(urlset);
    expect(result.urls[1]?.loc).toBe("https://acme.example/search?a=1&b=2");
  });

  it("unwraps CDATA loc values", () => {
    const result = parseSitemap(urlset);
    expect(result.urls[2]?.loc).toBe("https://acme.example/blog");
    expect(result.urls[2]?.lastModified).toBe("2026-11-02T10:00:00+00:00");
  });

  it("detects a sitemap index", () => {
    const result = parseSitemap(index);
    expect(result.isIndex).toBe(true);
    expect(result.format).toBe("xml");
    expect(result.sitemaps).toHaveLength(2);
    expect(result.sitemaps[0]).toEqual({ loc: "https://acme.example/sitemap-pages.xml", lastModified: "2026-01-01" });
    expect(result.urls).toHaveLength(0);
  });

  it("parses a plain text sitemap", () => {
    const result = parseSitemap("https://acme.example/a\nhttps://acme.example/b\n");
    expect(result.format).toBe("text");
    expect(result.urls).toHaveLength(2);
    expect(result.urls[0]?.loc).toBe("https://acme.example/a");
  });

  it("returns an empty unknown result for junk", () => {
    const result = parseSitemap("not a sitemap at all");
    expect(result.format).toBe("unknown");
    expect(result.urls).toHaveLength(0);
    expect(result.sitemaps).toHaveLength(0);
    expect(result.totalLocCount).toBe(0);
  });

  it("handles an empty body", () => {
    expect(parseSitemap("").format).toBe("unknown");
  });

  it("caps urls at 500 and flags truncation", () => {
    const blocks = Array.from({ length: MAX_SITEMAP_URLS + 20 }, (_, index) => "<url><loc>https://acme.example/p" + index + "</loc></url>").join("");
    const result = parseSitemap("<urlset>" + blocks + "</urlset>");
    expect(result.urls).toHaveLength(MAX_SITEMAP_URLS);
    expect(result.truncatedUrls).toBe(true);
    expect(result.totalLocCount).toBe(MAX_SITEMAP_URLS + 20);
  });

  it("caps child sitemaps at 200 and flags truncation", () => {
    const blocks = Array.from({ length: MAX_CHILD_SITEMAPS + 5 }, (_, index) => "<sitemap><loc>https://acme.example/s" + index + ".xml</loc></sitemap>").join("");
    const result = parseSitemap("<sitemapindex>" + blocks + "</sitemapindex>");
    expect(result.sitemaps).toHaveLength(MAX_CHILD_SITEMAPS);
    expect(result.truncatedSitemaps).toBe(true);
  });

  it("clamps an out of range priority", () => {
    const result = parseSitemap("<urlset><url><loc>https://acme.example/x</loc><priority>7</priority></url></urlset>");
    expect(result.urls[0]?.priority).toBe(1);
  });
});
