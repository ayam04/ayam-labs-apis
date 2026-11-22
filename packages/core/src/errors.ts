import type { Context } from "hono";

export const ErrorCode = {
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_PARAMETER: "MISSING_PARAMETER",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_FOUND: "NOT_FOUND",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  UPSTREAM_TIMEOUT: "UPSTREAM_TIMEOUT",
  BLOCKED_TARGET: "BLOCKED_TARGET",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA: "UNSUPPORTED_MEDIA",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Thrown from any depth; converted to a JSON error response by the app's onError handler. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCodeValue | string;
  readonly details?: unknown;
  readonly hint?: string;
  readonly headers?: Record<string, string>;

  constructor(
    status: number,
    code: ErrorCodeValue | string,
    message: string,
    options: { details?: unknown; hint?: string; headers?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.hint = options.hint;
    this.headers = options.headers;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, ErrorCode.INVALID_INPUT, message, { details });

export const missingParam = (name: string) =>
  new ApiError(400, ErrorCode.MISSING_PARAMETER, `Missing required parameter: ${name}`, {
    hint: `Provide "${name}" as a query parameter or JSON body field.`,
  });

export const unauthorized = (message: string, hint?: string) =>
  new ApiError(401, ErrorCode.UNAUTHORIZED, message, { hint });

export const forbidden = (message: string) => new ApiError(403, ErrorCode.FORBIDDEN, message);

export const notFound = (message = "Route not found") => new ApiError(404, ErrorCode.NOT_FOUND, message);

export const rateLimited = (retryAfterSeconds: number) =>
  new ApiError(429, ErrorCode.RATE_LIMITED, "Too many requests", {
    hint: `Retry after ${retryAfterSeconds} seconds.`,
    headers: { "retry-after": String(retryAfterSeconds) },
  });

export const upstreamError = (message: string, details?: unknown) =>
  new ApiError(502, ErrorCode.UPSTREAM_ERROR, message, { details });

export const internalError = (message = "Unexpected server error") =>
  new ApiError(500, ErrorCode.INTERNAL_ERROR, message);

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: unknown;
    hint?: string;
  };
  requestId: string;
  timestamp: string;
}

export function buildErrorEnvelope(
  c: Context<any>,
  err: Pick<ApiError, "code" | "message" | "details" | "hint">,
): ErrorEnvelope {
  const requestId = (c.get("requestId") as string | undefined) ?? "unknown";
  const envelope: ErrorEnvelope = {
    error: { code: String(err.code), message: err.message },
    requestId,
    timestamp: new Date().toISOString(),
  };
  if (err.details !== undefined) envelope.error.details = err.details;
  if (err.hint) envelope.error.hint = err.hint;
  return envelope;
}
