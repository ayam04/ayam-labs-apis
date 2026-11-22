/**
 * robots.txt parser (RFC 9309 shaped, tolerant of the real world).
 *
 * Pure: takes the already fetched text and returns groups, rules, crawl-delay,
 * sitemaps and a few counts. Every list is capped so a hostile file cannot make
 * the response unbounded.
 */

export const MAX_ROBOTS_LINES = 20_000;
export const MAX_ROBOTS_GROUPS = 200;
export const MAX_ROBOTS_RULES = 500;
export const MAX_ROBOTS_SITEMAPS = 200;
export const MAX_ROBOTS_USER_AGENTS = 32;
export const MAX_ROBOTS_UNKNOWN_DIRECTIVES = 20;

export interface RobotsRule {
  path: string;
  line: number;
}

export interface RobotsGroup {
  userAgents: string[];
  allow: RobotsRule[];
  disallow: RobotsRule[];
  crawlDelay: number | null;
}

export interface RobotsParseResult {
  groups: RobotsGroup[];
  sitemaps: string[];
  host: string | null;
  lineCount: number;
  ruleCount: number;
  unknownDirectives: string[];
  truncated: boolean;
}

const IGNORED_DIRECTIVES = new Set(["clean-param", "request-rate", "visit-time", "noindex"]);

/** Parses robots.txt content. Never throws; malformed lines are ignored. */
export function parseRobots(rawText: string): RobotsParseResult {
  const text = String(rawText ?? "").replace(/^\ufeff/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const result: RobotsParseResult = {
    groups: [],
    sitemaps: [],
    host: null,
    lineCount: lines.length,
    ruleCount: 0,
    unknownDirectives: [],
    truncated: false,
  };

  let current: RobotsGroup | null = null;
  let lastWasUserAgent = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (index >= MAX_ROBOTS_LINES) {
      result.truncated = true;
      break;
    }
    const rawLine = lines[index] as string;
    const hash = rawLine.indexOf("#");
    const line = (hash >= 0 ? rawLine.slice(0, hash) : rawLine).trim();
    if (line.length === 0) {
      lastWasUserAgent = false;
      continue;
    }
    const separator = line.indexOf(":");
    if (separator <= 0) {
      lastWasUserAgent = false;
      continue;
    }
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    const lineNumber = index + 1;

    if (key === "user-agent") {
      const agent = value.toLowerCase().slice(0, 100);
      if (agent.length === 0) {
        lastWasUserAgent = false;
        continue;
      }
      if (!current || !lastWasUserAgent) {
        if (result.groups.length >= MAX_ROBOTS_GROUPS) {
          result.truncated = true;
          break;
        }
        current = { userAgents: [], allow: [], disallow: [], crawlDelay: null };
        result.groups.push(current);
      }
      if (current.userAgents.length >= MAX_ROBOTS_USER_AGENTS) result.truncated = true;
      else current.userAgents.push(agent);
      lastWasUserAgent = true;
      continue;
    }

    lastWasUserAgent = false;

    if (key === "allow" || key === "disallow") {
      if (value.length === 0) continue;
      if (!current) {
        if (result.groups.length >= MAX_ROBOTS_GROUPS) {
          result.truncated = true;
          continue;
        }
        current = { userAgents: ["*"], allow: [], disallow: [], crawlDelay: null };
        result.groups.push(current);
      }
      const bucket = key === "allow" ? current.allow : current.disallow;
      if (bucket.length >= MAX_ROBOTS_RULES) {
        result.truncated = true;
        continue;
      }
      bucket.push({ path: value.slice(0, 500), line: lineNumber });
      result.ruleCount += 1;
      continue;
    }

    if (key === "crawl-delay") {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0 && current !== null) {
        current.crawlDelay = Math.min(delay, 86_400);
      }
      continue;
    }

    if (key === "sitemap") {
      if (result.sitemaps.length >= MAX_ROBOTS_SITEMAPS) {
        result.truncated = true;
        continue;
      }
      if (/^https?:\/\//i.test(value)) result.sitemaps.push(value.slice(0, 500));
      continue;
    }

    if (key === "host") {
      result.host = value.slice(0, 255);
      continue;
    }

    if (IGNORED_DIRECTIVES.has(key)) continue;

    if (result.unknownDirectives.length < MAX_ROBOTS_UNKNOWN_DIRECTIVES && !result.unknownDirectives.includes(key)) {
      result.unknownDirectives.push(key);
    }
  }

  return result;
}

/** True when a group targets every crawler. */
export function isWildcardGroup(group: RobotsGroup): boolean {
  return group.userAgents.includes("*");
}
