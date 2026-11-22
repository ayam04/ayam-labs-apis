import { z } from "@hono/zod-openapi";

/** Shared error schema so every endpoint documents failures identically. */
export const ErrorItemSchema = z.object({
  code: z.string().openapi({ example: "INVALID_INPUT", description: "Stable machine-readable error code." }),
  message: z.string().openapi({ example: "Request validation failed", description: "Human-readable explanation." }),
  details: z
    .union([z.string(), z.array(z.string()), z.array(z.record(z.string(), z.unknown())), z.record(z.string(), z.unknown())])
    .optional()
    .openapi({ description: "Optional structured details (usually field-level validation issues)." }),
  hint: z.string().optional().openapi({ example: "Pass the email address in the \"email\" query parameter." }),
});

export const ErrorEnvelopeSchema = z
  .object({
    error: ErrorItemSchema,
    requestId: z.string().openapi({ example: "8f14e45f-ceea-467f-a8e7-9b5e4f0e2a31" }),
    timestamp: z.string().openapi({ example: "2026-11-21T10:15:30.000Z" }),
  })
  .openapi("ErrorResponse");

export const jsonError = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorEnvelopeSchema } },
});

/** Standard set of documented error responses (400/401/403/404/429/500). */
export const commonErrors = {
  400: jsonError("Invalid request (bad parameters or unparsable input)"),
  401: jsonError("Missing or invalid credentials"),
  403: jsonError("Forbidden"),
  404: jsonError("Resource not found"),
  429: jsonError("Rate limit exceeded"),
  500: jsonError("Unexpected server error"),
  502: jsonError("Upstream dependency failed"),
  504: jsonError("Upstream dependency timed out"),
} as const;

export const HealthSchema = z
  .object({
    status: z.literal("ok"),
    name: z.string(),
    version: z.string(),
    environment: z.string(),
    timestamp: z.string(),
  })
  .openapi("HealthResponse");

export { z };
