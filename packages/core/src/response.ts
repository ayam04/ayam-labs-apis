import type { Context } from "hono";
import { ApiError, buildErrorEnvelope } from "./errors";

/** Build a JSON error Response from an ApiError, honouring custom headers (e.g. Retry-After). */
export function jsonErrorBody(c: Context<any>, error: ApiError): Response {
  const payload = JSON.stringify(buildErrorEnvelope(c, error));
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(error.headers ?? {}),
  };
  return new Response(payload, { status: error.status, headers });
}
