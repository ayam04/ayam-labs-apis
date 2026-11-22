import type { MiddlewareHandler } from "hono";
import type { ApiConfig, ApiEnv } from "./types";
import { buildErrorEnvelope, ApiError } from "./errors";
import { jsonErrorBody } from "./response";

/** Constant-time-ish string compare (length-independent timing is not critical here). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

function localLimit(key: string, limit: number, windowSeconds: number): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    if (buckets.size > MAX_BUCKETS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: windowSeconds };
  }
  if (existing.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { allowed: true, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
}

/**
 * Enforces the RapidAPI gateway contract:
 *  - requests arriving through Rapid carry `x-rapidapi-proxy-secret` (configured in the Hub gateway tab)
 *  - direct requests must present our own `x-api-key` (landing page demos, smoke tests)
 * Also applies a conservative per-IP rate limit to direct traffic only; RapidAPI
 * enforces the real plan quotas upstream.
 */
export function createGuard<B extends Record<string, unknown>>(config: ApiConfig): MiddlewareHandler<ApiEnv<B>> {
  const limit = config.directRateLimitPerMinute ?? 60;
  return async (c, next) => {
    const path = new URL(c.req.url).pathname;

    // Monitoring and discovery stay public: they expose no customer data and are
    // what the landing page status probes and uptime checks hit.
    if (path === "/" || path === "/health" || path === "/openapi.json") {
      await next();
      return;
    }

    // Values written with `wrangler secret put` from a shell pipe can carry a
    // trailing newline, so both sides are trimmed before comparing.
    const proxySecret = (c.env.RAPIDAPI_PROXY_SECRET ?? "").trim();
    // c.req.header(name) is case-insensitive; reading the header map by key is not.
    const presentedSecret = c.req.header("x-rapidapi-proxy-secret")?.trim();
    const isProxied = typeof presentedSecret === "string" && presentedSecret.length > 0;

    if (proxySecret) {
      if (isProxied) {
        if (!safeEqual(presentedSecret as string, proxySecret)) {
          return jsonErrorBody(c, new ApiError(401, "UNAUTHORIZED", "Invalid RapidAPI proxy secret"));
        }
      } else {
        const directKey = c.env.DIRECT_API_KEY;
        const presentedKey = c.req.header("x-api-key");
        if (!directKey || !presentedKey || !safeEqual(String(presentedKey), directKey)) {
          return jsonErrorBody(
            c,
            new ApiError(401, "UNAUTHORIZED", "This API is served through the RapidAPI marketplace", {
              hint: "Subscribe on RapidAPI and send the X-RapidAPI-Key and X-RapidAPI-Host headers, or call the RapidAPI proxy URL for this API.",
            }),
          );
        }
      }
    }

    // Rate limit only direct traffic: proxied traffic is metered by RapidAPI itself.
    if (!isProxied) {
      const ip = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for") ?? "unknown";
      const key = `${config.name}:${ip}`;
      if (c.env.RATE_LIMITER) {
        try {
          const result = await c.env.RATE_LIMITER.limit({ key });
          if (!result.success) {
            c.header("retry-after", "60");
            return jsonErrorBody(
              c,
              new ApiError(429, "RATE_LIMITED", "Too many requests", { hint: `Direct traffic is limited to ${limit} requests per minute.` }),
            );
          }
        } catch {
          /* binding failure must not break the API */
        }
      } else {
        const outcome = localLimit(key, limit, 60);
        if (!outcome.allowed) {
          c.header("retry-after", String(outcome.retryAfter));
          return jsonErrorBody(
            c,
            new ApiError(429, "RATE_LIMITED", "Too many requests", { hint: `Direct traffic is limited to ${limit} requests per minute.` }),
          );
        }
      }
    }

    await next();
  };
}

export { buildErrorEnvelope };
