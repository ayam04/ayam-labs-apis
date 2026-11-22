import { describe, expect, it } from "vitest";
import { isWildcardGroup, MAX_ROBOTS_RULES, parseRobots } from "../src/lib/robots";

const sample = [
  "# Acme robots.txt",
  "User-agent: *",
  "Disallow: /admin/",
  "Allow: /admin/public/",
  "Crawl-delay: 10",
  "",
  "User-agent: Googlebot",
  "User-agent: Bingbot",
  "Disallow: /tmp",
  "Foo: bar",
  "",
  "Sitemap: https://acme.example/sitemap.xml",
  "Sitemap: https://acme.example/news-sitemap.xml",
  "Host: acme.example",
  "Clean-param: ref",
].join("\n");

describe("parseRobots", () => {
  it("splits user-agent groups and keeps their rules", () => {
    const result = parseRobots(sample);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]?.userAgents).toEqual(["*"]);
    expect(result.groups[0]?.disallow).toEqual([{ path: "/admin/", line: 3 }]);
    expect(result.groups[0]?.allow).toEqual([{ path: "/admin/public/", line: 4 }]);
    expect(result.groups[0]?.crawlDelay).toBe(10);
    expect(result.ruleCount).toBe(3);
  });

  it("merges consecutive user-agent lines into one group", () => {
    const result = parseRobots(sample);
    expect(result.groups[1]?.userAgents).toEqual(["googlebot", "bingbot"]);
    expect(result.groups[1]?.disallow).toEqual([{ path: "/tmp", line: 9 }]);
  });

  it("collects sitemaps, host and ignored directives", () => {
    const result = parseRobots(sample);
    expect(result.sitemaps).toEqual(["https://acme.example/sitemap.xml", "https://acme.example/news-sitemap.xml"]);
    expect(result.host).toBe("acme.example");
    expect(result.unknownDirectives).toEqual(["foo"]);
    expect(result.unknownDirectives).not.toContain("clean-param");
  });

  it("reports the line count and never truncates a small file", () => {
    const result = parseRobots(sample);
    expect(result.lineCount).toBe(15);
    expect(result.truncated).toBe(false);
  });

  it("strips comments and handles CRLF plus a BOM", () => {
    const result = parseRobots("\uFEFFUser-agent: *\r\nDisallow: /private # keep out\r\n");
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.disallow).toEqual([{ path: "/private", line: 2 }]);
  });

  it("keeps rules that appear before any user-agent under a wildcard group", () => {
    const result = parseRobots("Disallow: /orphan\nUser-agent: *\nDisallow: /admin\n");
    expect(result.groups[0]?.userAgents).toEqual(["*"]);
    expect(result.groups[0]?.disallow[0]?.path).toBe("/orphan");
  });

  it("ignores malformed lines instead of throwing", () => {
    const result = parseRobots("this line has no colon\nUser-agent: *\nDisallow: /x");
    expect(result.groups).toHaveLength(1);
    expect(result.ruleCount).toBe(1);
  });

  it("caps the rules per group and flags truncation", () => {
    const lines = ["User-agent: *"];
    for (let index = 0; index < MAX_ROBOTS_RULES + 25; index += 1) lines.push("Disallow: /path-" + index);
    const result = parseRobots(lines.join("\n"));
    expect(result.groups[0]?.disallow).toHaveLength(MAX_ROBOTS_RULES);
    expect(result.truncated).toBe(true);
  });

  it("handles an empty file", () => {
    const result = parseRobots("");
    expect(result.groups).toEqual([]);
    expect(result.sitemaps).toEqual([]);
    expect(result.ruleCount).toBe(0);
  });

  it("detects the wildcard group", () => {
    const result = parseRobots(sample);
    expect(isWildcardGroup(result.groups[0]!)).toBe(true);
    expect(isWildcardGroup(result.groups[1]!)).toBe(false);
  });
});
