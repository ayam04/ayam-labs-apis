import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import type { ApiConfig, ApiEnv } from "./types";
import { ApiError, buildErrorEnvelope } from "./errors";
import { createGuard } from "./guard";
import { jsonErrorBody } from "./response";

const DEFAULT_PROVIDER = { name: "Ayam Labs", url: "https://github.com/ayam04", email: "ayamullahkhan04@gmail.com" };

export interface RouteInfo {
  method: string;
  path: string;
  summary: string;
}

function isMetaPath(path: string): boolean {
  return path === "/" || path === "/health" || path === "/openapi.json" || path === "/*";
}

/**
 * Creates a fully wired Worker app:
 *  - CORS for browser callers
 *  - request id + response timing + version headers
 *  - RapidAPI proxy-secret auth (plus an escape hatch for direct calls)
 *  - JSON error envelope, 404 and 500 handling
 *  - /health, / and /openapi.json
 */
export function defineApi<B extends Record<string, unknown> = Record<string, unknown>>(
  config: ApiConfig,
  register: (app: OpenAPIHono<ApiEnv<B>>) => void,
): OpenAPIHono<ApiEnv<B>> {
  const app = new OpenAPIHono<ApiEnv<B>>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join(".") || "(root)",
          message: issue.message,
          code: issue.code,
        }));
        return jsonErrorBody(
          c,
          new ApiError(400, "INVALID_INPUT", "Request validation failed", {
            details: issues as unknown as string[],
            hint: "Check the parameter names, types and required fields against /openapi.json.",
          }),
        ) as never;
      }
      return undefined as never;
    },
  });

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
      allowHeaders: [
        "Content-Type",
        "Accept",
        "Authorization",
        "X-RapidAPI-Key",
        "X-RapidAPI-Host",
        "X-RapidAPI-Proxy-Secret",
        "X-API-Key",
        "X-Request-Id",
      ],
      exposeHeaders: ["X-Request-Id", "X-Response-Time-Ms", "X-API-Version", "Retry-After"],
      maxAge: 86400,
    }),
  );

  app.use("*", async (c, next) => {
    const incoming = c.req.header("x-request-id");
    const requestId = incoming && incoming.length <= 64 ? incoming : crypto.randomUUID();
    c.set("requestId", requestId);
    c.set("startedAt", Date.now());
    c.header("cache-control", "no-store");
    // machine endpoint, never a search result: keep scanners' 401/404 probes out of indexes
    c.header("x-robots-tag", "noindex, nofollow");
    await next();
    c.header("x-request-id", requestId);
    c.header("x-response-time-ms", String(Date.now() - c.get("startedAt")));
    c.header("x-api-version", config.version);
  });

  app.use("*", createGuard<B>(config));

  register(app);

  app.get("/health", (c) =>
    c.json(
      {
        status: "ok" as const,
        name: config.name,
        version: config.version,
        environment: c.env.ENVIRONMENT ?? "production",
        timestamp: new Date().toISOString(),
      },
      200,
    ),
  );

  app.get("/", (c) => {
    const routes = (app.routes ?? [])
      .filter((route) => route.method !== "ALL" && !isMetaPath(route.path))
      .map((route) => ({ method: route.method, path: route.path.replace(/:([a-zA-Z]+)/g, "{$1}") }));
    const unique = new Map<string, { method: string; path: string }>();
    for (const route of routes) unique.set(`${route.method} ${route.path}`, route);
    return c.json(
      {
        name: config.name,
        title: config.title,
        version: config.version,
        summary: config.summary,
        description: config.description,
        provider: config.provider ?? DEFAULT_PROVIDER,
        documentation: "/openapi.json",
        endpoints: [...unique.values()].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method)),
        usage:
          "Send X-RapidAPI-Key and X-RapidAPI-Host when calling through the RapidAPI marketplace, or X-API-Key for direct calls.",
      },
      200,
    );
  });

  app.doc("/openapi.json", {
    // 3.0.3 because the generated document is 3.0 shaped (nullable, no 3.1 unions)
    // and the RapidAPI importer is most reliable with 3.0.x.
    openapi: "3.0.3",
    info: {
      title: config.title,
      version: config.version,
      description: config.description,
      termsOfService: config.termsOfService,
      contact: config.provider ?? DEFAULT_PROVIDER,
    },
    servers: [
      ...(config.baseUrl ? [{ url: config.baseUrl, description: "Direct origin" }] : []),
      { url: "https://rapidapi.com", description: "RapidAPI marketplace" },
    ],
    tags: config.tags,
    "x-provider": (config.provider ?? DEFAULT_PROVIDER).name,
    "x-website": config.websiteUrl,
  } as Parameters<typeof app.doc>[1]);

  app.notFound((c) => {
    const err = new ApiError(404, "NOT_FOUND", `No route matches ${c.req.method} ${new URL(c.req.url).pathname}`, {
      hint: "See /openapi.json for the list of available endpoints.",
    });
    return jsonErrorBody(c, err) as unknown as Response;
  });

  app.onError((error, c) => {
    const requestId = c.get("requestId") ?? "unknown";
    if (error instanceof ApiError) {
      if (error.status >= 500) {
        console.error(
          JSON.stringify({ level: "error", api: config.name, requestId, code: error.code, message: error.message, path: c.req.path }),
        );
      }
      return jsonErrorBody(c, error) as unknown as Response;
    }
    console.error(
      JSON.stringify({
        level: "error",
        api: config.name,
        requestId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: c.req.path,
      }),
    );
    const envelope = buildErrorEnvelope(c, {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
      hint: `Reference this request id when contacting support: ${requestId}`,
    });
    return new Response(JSON.stringify(envelope), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8", "x-request-id": String(requestId) },
    });
  });

  return app;
}
