/**
 * Shared types for every API in this marketplace.
 */

export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface CoreBindings {
  /** Secret appended by the RapidAPI gateway as `X-RapidAPI-Proxy-Secret`. */
  RAPIDAPI_PROXY_SECRET?: string;
  /** Key that allows direct (non-proxied) calls, used by our own landing pages and smoke tests. */
  DIRECT_API_KEY?: string;
  /** "production" | "staging" | "development" */
  ENVIRONMENT?: string;
  /** Cloudflare native rate limiting binding (optional). */
  RATE_LIMITER?: RateLimiterBinding;
  /** KV namespace used for lightweight counters/caches (optional). */
  CACHE?: KVNamespace;
}

export interface Variables {
  requestId: string;
  startedAt: number;
}

export type ApiEnv<B = Record<string, unknown>> = {
  Bindings: CoreBindings & B;
  Variables: Variables;
};

export interface TagConfig {
  name: string;
  description?: string;
}

export interface ApiConfig {
  /** Worker name / slug, e.g. "emailcheck". */
  name: string;
  /** Display title used in OpenAPI + RapidAPI, e.g. "EmailCheck API". */
  title: string;
  version: string;
  /** One-liner, under 120 chars. Shown in listings. */
  summary: string;
  /** Longer markdown-ish description shown in OpenAPI. */
  description: string;
  /** Public base URL of the deployed worker. */
  baseUrl?: string;
  /** Public docs / landing page. */
  websiteUrl?: string;
  tags?: TagConfig[];
  provider?: { name: string; url?: string; email?: string };
  termsOfService?: string;
  /** Direct-call per-minute limit applied only to non-proxied traffic. */
  directRateLimitPerMinute?: number;
}
