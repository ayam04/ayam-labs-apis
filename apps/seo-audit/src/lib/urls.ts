import { ApiError, ErrorCode } from "@api/core";

/**
 * URL helpers: normalisation for inbound `url`/`domain` parameters, registrable
 * domain comparison for internal/external link classification, and href
 * resolution. Pure functions, unit tested in test/urls.test.ts.
 */

/** Longest URL accepted from a caller (characters). */
export const MAX_URL_LENGTH = 2048;

/** Longest href kept when listing links (characters). */
export const MAX_HREF_LENGTH = 2048;

const AUTHORITY_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HOSTNAME_WITH_PORT = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/**
 * Common multi-label public suffixes. This is a compact heuristic list, not the
 * full Public Suffix List: it keeps internal/external classification correct for
 * the overwhelming majority of real sites without shipping a 200 KB table.
 */
const MULTI_LEVEL_SUFFIXES = new Set<string>([
  "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "ltd.uk", "plc.uk", "net.uk",
  "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp", "co.kr", "or.kr",
  "com.au", "net.au", "org.au", "edu.au", "gov.au", "id.au",
  "co.nz", "net.nz", "org.nz", "govt.nz",
  "co.in", "net.in", "org.in", "gen.in", "firm.in", "ind.in", "ac.in", "gov.in",
  "co.za", "org.za", "net.za", "gov.za",
  "com.br", "net.br", "org.br", "gov.br",
  "com.mx", "org.mx", "gob.mx",
  "com.ar", "org.ar", "gob.ar",
  "co.il", "org.il", "ac.il", "gov.il",
  "com.sg", "edu.sg", "gov.sg", "com.hk", "edu.hk", "gov.hk",
  "com.tw", "edu.tw", "gov.tw", "com.cn", "net.cn", "org.cn", "gov.cn",
  "com.tr", "net.tr", "org.tr", "gov.tr",
  "com.my", "net.my", "org.my", "gov.my",
  "co.id", "or.id", "ac.id", "go.id",
  "com.ph", "net.ph", "org.ph", "gov.ph",
  "com.vn", "net.vn", "org.vn", "gov.vn",
  "co.th", "or.th", "ac.th", "go.th",
  "com.sa", "com.ae", "co.ke", "com.ng", "co.ug", "com.pk", "com.bd", "com.eg",
  "co.at", "or.at", "co.no", "com.pl", "net.pl", "org.pl", "com.ua", "co.ma",
]);

export type HrefKind = "http" | "mailto" | "tel" | "javascript" | "data" | "other" | "invalid";

export interface ResolvedHref {
  /** Original attribute value, trimmed. */
  href: string;
  /** Absolute http(s) URL, or null when the href is not a fetchable link. */
  url: string | null;
  kind: HrefKind;
}

/**
 * Normalises a caller supplied URL: trims, adds https:// when the scheme is
 * missing, rejects non-http(s) schemes and embedded credentials, drops the
 * fragment (it never reaches the server) and enforces MAX_URL_LENGTH.
 */
export function normalizeUrlInput(raw: string): URL {
  const trimmed = String(raw ?? "").trim();
  if (trimmed.length === 0) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "url must not be empty", {
      hint: "Pass an absolute URL, for example ?url=https://example.com/pricing",
    });
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "url is longer than " + MAX_URL_LENGTH + " characters", {
      hint: "Shorten the URL. Query strings and fragments count towards the limit.",
    });
  }

  if (ANY_SCHEME.test(trimmed) && !AUTHORITY_SCHEME.test(trimmed)) {
    const scheme = trimmed.slice(0, trimmed.indexOf(":")).toLowerCase();
    if (!HOSTNAME_WITH_PORT.test(scheme)) {
      throw new ApiError(400, ErrorCode.INVALID_INPUT, 'Unsupported URL scheme "' + scheme + ':"', {
        hint: "Only http:// and https:// URLs can be fetched. Pass a hostname like example.com and https is assumed.",
      });
    }
  }

  const candidate = AUTHORITY_SCHEME.test(trimmed) ? trimmed : "https://" + trimmed;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Invalid URL", {
      hint: "Provide an absolute http(s) URL, for example https://example.com/blog/post",
    });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, 'Unsupported URL scheme "' + url.protocol + '"', {
      hint: "Only http:// and https:// URLs can be fetched.",
    });
  }
  if (url.username.length > 0 || url.password.length > 0) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "URLs with embedded credentials are not allowed", {
      hint: "Remove the user:password part in front of the hostname.",
    });
  }
  if (url.hostname.length === 0) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "URL has no hostname", {
      hint: "Include a host, for example https://example.com",
    });
  }
  url.hash = "";
  return url;
}

/**
 * Normalises a `domain` parameter into an https origin. Accepts a bare domain
 * (`example.com`), a domain with path (`example.com/blog` - the path is dropped)
 * or an explicit http(s) URL.
 */
export function normalizeDomainInput(raw: string): { origin: string; hostname: string; https: boolean; url: URL } {
  const url = normalizeUrlInput(raw);
  const https = url.protocol === "https:";
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return { origin: url.origin, hostname: url.hostname, https, url };
}

/** Registrable domain (eTLD+1) using the compact suffix list above. */
export function getRegistrableDomain(hostname: string): string {
  const host = String(hostname ?? "").toLowerCase().replace(/\.$/, "");
  if (host.length === 0) return host;
  if (host.startsWith("[")) return host;
  if (IPV4.test(host)) return host;
  const labels = host.split(".");
  if (labels.length <= 2) return host;
  const lastTwo = labels.slice(-2).join(".");
  if (MULTI_LEVEL_SUFFIXES.has(lastTwo)) return labels.slice(-3).join(".");
  return lastTwo;
}

/** True when both hosts share a registrable domain (e.g. www.example.com / blog.example.com). */
export function isSameRegistrableDomain(a: string, b: string): boolean {
  const left = getRegistrableDomain(a);
  const right = getRegistrableDomain(b);
  if (left.length === 0 || right.length === 0) return false;
  return left === right;
}

/** Resolves an href against a base URL and classifies the scheme. */
export function resolveHref(rawHref: string, base: string): ResolvedHref {
  const href = String(rawHref ?? "").trim().slice(0, MAX_HREF_LENGTH);
  if (href.length === 0) return { href, url: null, kind: "invalid" };
  const lower = href.toLowerCase();
  if (lower.startsWith("mailto:")) return { href, url: null, kind: "mailto" };
  if (lower.startsWith("tel:")) return { href, url: null, kind: "tel" };
  if (lower.startsWith("javascript:")) return { href, url: null, kind: "javascript" };
  if (lower.startsWith("data:")) return { href, url: null, kind: "data" };
  try {
    const resolved = new URL(href, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return { href, url: resolved.toString(), kind: "other" };
    }
    return { href, url: resolved.toString(), kind: "http" };
  } catch {
    return { href, url: null, kind: "invalid" };
  }
}

/** Compares two URLs ignoring the fragment and a trailing slash on non-root paths. */
export function sameDocument(a: string, b: string): boolean {
  try {
    const left = new URL(a);
    const right = new URL(b);
    const strip = (path: string) => (path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path);
    return left.origin === right.origin && strip(left.pathname) === strip(right.pathname) && left.search === right.search;
  } catch {
    return false;
  }
}
