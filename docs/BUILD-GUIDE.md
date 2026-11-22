# Build guide (read this before writing any app code)

This repo is a pnpm workspace of independent Cloudflare Workers, each one a
separate product listed on the RapidAPI marketplace.

```
apps/<slug>/            one Worker per product
packages/core/          shared runtime: OpenAPI factory, auth guard, SSRF-safe fetch, error envelope
docs/listings/          RapidAPI listing copy per product
marketing/site/         landing site
scripts/                deploy + smoke test helpers
```

## Hard rules

1. **Do not run `pnpm install`.** All dependencies are already installed. If you
   believe you need a new package, stop and report it instead of installing.
2. Every app is `@hono/zod-openapi` v1 + `zod` v4 + `hono` v4 on a Cloudflare Worker.
3. Every app serves `/health`, `/` and `/openapi.json` automatically from `defineApi`.
   Do not re-implement them.
4. Every request handler is registered with `app.openapi(route, handler)` so the
   OpenAPI document is generated from the same source of truth. No hand-written spec.
5. JSON is **camelCase**. Timestamps are ISO 8601 strings. Durations are integer ms.
6. A successful response returns the payload directly (no `{ data: ... }` wrapper).
   Failures use the shared error envelope from `@api/core`.
7. Never leak stack traces, upstream HTML or secrets into responses.
8. No API keys, no paid upstream services, no scraping of login-gated data.
9. Outbound HTTP requests to user supplied URLs must use `safeFetch` from
   `@api/core` (SSRF checks on every redirect hop).

## App skeleton

```
apps/<slug>/
  package.json        name = "<slug>", scripts: dev (own port), deploy, check, test
  wrangler.toml       name = "<slug>", main = "src/index.ts"
  tsconfig.json       { "extends": "../../tsconfig.base.json", "include": ["src/**/*.ts","test/**/*.ts"] }
  src/config.ts       ApiConfig object
  src/schemas.ts      zod schemas + inferred types
  src/index.ts        defineApi(config, (app) => { ...routes... })
  src/lib/*.ts        pure logic, one concern per file
  test/*.test.ts      vitest unit tests for the pure logic
```

## Route pattern

```ts
import { commonErrors, defineApi } from "@api/core";
import { createRoute } from "@hono/zod-openapi";
import { z } from "@api/core";

const jsonContent = (schema: any) => ({ "application/json": { schema } });

const route = createRoute({
  method: "get",
  path: "/v1/thing",
  tags: ["Things"],
  summary: "One line, imperative, under 90 chars",
  description: "What it does, what is returned, and any limit or caveat.",
  request: { query: ThingQuerySchema },
  responses: {
    200: { description: "Result", content: jsonContent(ThingResponseSchema) },
    ...commonErrors,
  },
});

const app = defineApi(config, (app) => {
  app.openapi(route, async (c) => {
    const { name } = c.req.valid("query");
    return c.json({ ok: true }, 200);
  });
});
export default app;
```

* Query parameters: `request: { query: Schema }`, read with `c.req.valid("query")`.
* JSON body: `request: { body: { content: jsonContent(Schema), required: true } }`,
  read with `c.req.valid("json")`.
* Errors: `throw new ApiError(status, "CODE", "message", { hint, details })` or the
  helpers `badRequest`, `notFound`, `upstreamError`. They are converted to the
  JSON envelope by the app factory. Do **not** return error JSON by hand.

## Zod notes (v4)

* `z.string().min(1).max(5000)`, `z.number().int()`, `z.boolean()`, `z.enum([...])`.
* Nullable: `z.string().nullable()`. Array: `z.array(z.string()).max(1000)`.
* Add `.openapi({ description: "...", example: ... })` on every user-facing field that
  appears in a request schema, and on response fields where the meaning is not obvious.
* Do **not** use `.transform()` in request schemas.

## Limits (enforce them, do not trust the client)

| resource | limit |
|---|---|
| request body | 512 KB JSON, 8 MB binary |
| outbound fetch | 12 s timeout, 5 MB text, 10 MB binary |
| list inputs | 100 items |
| text analysis | 100,000 characters |

Return 413 `PAYLOAD_TOO_LARGE` above those limits, 400 `INVALID_INPUT` below them.

## Config object

```ts
export const config: ApiConfig = {
  name: "slug",
  title: "Product Name API",
  version: "1.0.0",
  summary: "One sentence, under 120 chars, describes the outcome not the tech.",
  description: "Markdown-ish long description: what it does, what every call returns, honest limits, 3 use cases.",
  baseUrl: "https://<slug>.<subdomain>.workers.dev",
  tags: [{ name: "Group", description: "..." }],
  termsOfService: "https://example.com/terms",
  directRateLimitPerMinute: 60,
};
```

## Definition of done

1. `pnpm --filter <slug> exec tsc -p tsconfig.json --noEmit` is clean.
2. `pnpm --filter <slug> exec vitest run` passes, with tests covering the tricky logic.
3. `pnpm --filter <slug> exec wrangler dev --port <your port> --local` starts, and every
   endpoint answers a real curl with plausible data (record the commands + output).
4. `GET /openapi.json` lists every route with tags, summaries, examples and errors.
5. No `any` in exported function signatures. Internal `any` is fine where noted.
