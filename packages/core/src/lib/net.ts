import { ApiError, ErrorCode, upstreamError } from "../errors";

/* ------------------------------------------------------------------ *
 * SSRF protection
 * Any outbound request built from user input must go through safeFetch.
 * ------------------------------------------------------------------ */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

const BLOCKED_TLDS = [".local", ".localhost", ".internal", ".intranet", ".lan", ".home.arpa", ".onion", ".test", ".invalid", ".example"];

function parseIpv4(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

const V4_BLOCKS: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
].map(([base, bits]) => [base as string, bits as number]);

function isBlockedIpv4(ip: string): boolean {
  const value = parseIpv4(ip);
  if (value === null) return true;
  for (const [base, bits] of V4_BLOCKS) {
    const baseValue = parseIpv4(base);
    if (baseValue === null) continue;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((value & mask) >>> 0 === (baseValue & mask) >>> 0) return true;
  }
  return false;
}

function isBlockedIpv6(rawIp: string): boolean {
  const ip = rawIp.toLowerCase().split("%")[0] ?? "";
  if (ip === "::" || ip === "::1") return true;
  // IPv4-mapped addresses (::ffff:10.0.0.1)
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped && mapped[1]) return isBlockedIpv4(mapped[1]);
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true; // fc00::/7 unique local
  if (/^fe[89ab][0-9a-f]:/.test(ip)) return true; // fe80::/10 link local
  if (ip.startsWith("ff")) return true; // multicast
  return false;
}

export function isBlockedIp(ip: string): boolean {
  return ip.includes(":") ? isBlockedIpv6(ip) : isBlockedIpv4(ip);
}

/** True when the host is a bare IP literal (v4 dotted quad or anything with a colon). */
function isIpLiteral(host: string): boolean {
  return host.includes(":") || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
}

export function validateHostname(hostname: string): void {
  const host = hostname.toLowerCase().replace(/\[|\]/g, "");
  if (host.length === 0) throw new ApiError(400, ErrorCode.BLOCKED_TARGET, "URL hostname is empty");
  if (BLOCKED_HOSTNAMES.has(host)) throw new ApiError(400, ErrorCode.BLOCKED_TARGET, `Requests to ${host} are not allowed`);
  // Only IP literals can be range-checked here; real hostnames are checked after DNS resolution.
  if (isIpLiteral(host) && isBlockedIp(host)) {
    throw new ApiError(400, ErrorCode.BLOCKED_TARGET, "Requests to private or reserved IP ranges are not allowed");
  }
  for (const tld of BLOCKED_TLDS) {
    if (host === tld.slice(1) || host.endsWith(tld)) {
      throw new ApiError(400, ErrorCode.BLOCKED_TARGET, `Requests to ${tld} hosts are not allowed`);
    }
  }
  if (!host.includes(".") && !host.includes(":")) {
    throw new ApiError(400, ErrorCode.BLOCKED_TARGET, "Only fully qualified public hostnames are allowed");
  }
}

interface DohAnswer {
  type: number;
  data: string;
}

/** Resolve A + AAAA via DNS-over-HTTPS (Cloudflare resolver). */
export async function resolvePublicIps(hostname: string, timeoutMs = 4000): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const records: string[] = [];
    for (const type of ["A", "AAAA"] as const) {
      const url = new URL("https://cloudflare-dns.com/dns-query");
      url.searchParams.set("name", hostname);
      url.searchParams.set("type", type);
      const response = await fetch(url.toString(), {
        headers: { accept: "application/dns-json" },
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const payload = (await response.json()) as { Answer?: DohAnswer[]; Status?: number };
      for (const answer of payload.Answer ?? []) {
        if (answer.type === 1 || answer.type === 28) records.push(answer.data);
      }
    }
    return records;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/** Throw unless the URL is a public http(s) URL that resolves only to public IPs. */
export async function assertPublicUrl(input: string | URL, options: { resolve?: boolean } = {}): Promise<URL> {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : new URL(input.toString());
  } catch {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Invalid URL", { hint: "Provide an absolute http(s) URL, e.g. https://example.com" });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ApiError(400, ErrorCode.BLOCKED_TARGET, "Only http and https URLs are supported");
  }
  if (url.username || url.password) {
    throw new ApiError(400, ErrorCode.BLOCKED_TARGET, "URLs with embedded credentials are not allowed");
  }
  validateHostname(url.hostname);
  if (options.resolve !== false) {
    const ips = await resolvePublicIps(url.hostname);
    if (ips.length === 0) {
      throw new ApiError(400, ErrorCode.BLOCKED_TARGET, `Could not resolve hostname "${url.hostname}"`);
    }
    for (const ip of ips) {
      if (isBlockedIp(ip)) {
        throw new ApiError(400, ErrorCode.BLOCKED_TARGET, `Hostname "${url.hostname}" resolves to a private address`);
      }
    }
  }
  return url;
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Skip DNS resolution (only for hosts we control). */
  skipResolve?: boolean;
  userAgent?: string;
}

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; AyamLabsBot/1.0; +https://github.com/ayam04) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** fetch() with SSRF checks on every redirect hop and a hard timeout. */
export async function safeFetch(target: string | URL, options: SafeFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 12000, maxRedirects = 4, skipResolve = false } = options;
  let url = await assertPublicUrl(target, { resolve: !skipResolve });
  const method = (options.method ?? "GET").toUpperCase();

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method,
        headers: {
          "user-agent": options.userAgent ?? DEFAULT_USER_AGENT,
          accept: "*/*",
          ...(options.headers ?? {}),
        },
        body: method === "GET" || method === "HEAD" ? undefined : (options.body ?? undefined),
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(504, ErrorCode.UPSTREAM_TIMEOUT, "Upstream request timed out", {
          hint: `The target server did not respond within ${timeoutMs}ms.`,
        });
      }
      throw upstreamError("Could not reach the target URL", { reason: error instanceof Error ? error.message : String(error) });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return response;
      const next = new URL(location, url);
      url = await assertPublicUrl(next, { resolve: !skipResolve });
      continue;
    }
    return response;
  }
  throw upstreamError("Too many redirects", { hint: `Limit is ${maxRedirects} redirects.` });
}

export async function readTextLimited(response: Response, maxBytes = 5_000_000): Promise<{ text: string; truncated: boolean; bytes: number }> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Response body is too large (${declared} bytes)`, {
      hint: `Maximum supported size is ${maxBytes} bytes.`,
    });
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    const bytes = new TextEncoder().encode(text).length;
    return { text: text.slice(0, maxBytes), truncated: bytes > maxBytes, bytes };
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      const keep = value.byteLength - (total - maxBytes);
      if (keep > 0) chunks.push(value.subarray(0, keep));
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder("utf-8").decode(merged), truncated, bytes: total };
}

export async function readBytesLimited(response: Response, maxBytes = 10_000_000): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Response body is too large (${declared} bytes)`, {
      hint: `Maximum supported size is ${maxBytes} bytes.`,
    });
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Response body is too large (${buffer.byteLength} bytes)`, {
      hint: `Maximum supported size is ${maxBytes} bytes.`,
    });
  }
  return { bytes: new Uint8Array(buffer), truncated: false };
}
