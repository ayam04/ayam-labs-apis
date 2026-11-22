import { commonErrors, defineApi } from "@api/core";
import { createRoute } from "@hono/zod-openapi";
import { config } from "./config";
import {
  BulkBodySchema,
  BulkResponseSchema,
  DisposableQuerySchema,
  DisposableResponseSchema,
  DomainQuerySchema,
  DomainResponseSchema,
  EmailBodySchema,
  EmailQuerySchema,
  VerificationSchema,
} from "./schemas";
import { verifyEmail, verifyMany, isDisposableDomain } from "./lib/verify";
import { inspectDomain } from "./lib/domain";

/* eslint-disable @typescript-eslint/no-explicit-any */
const jsonContent = (schema: any) => ({ "application/json": { schema } });

const verifyGet = createRoute({
  method: "get",
  path: "/v1/verify",
  tags: ["Verification"],
  summary: "Verify a single email address",
  description:
    "Runs the full pipeline for one address: syntax, MX/AAAA DNS, disposable blocklist, role account detection, free provider detection, typo suggestion and scoring.",
  request: { query: EmailQuerySchema },
  responses: {
    200: { description: "Verification result", content: jsonContent(VerificationSchema) },
    ...commonErrors,
  },
});

const verifyPost = createRoute({
  method: "post",
  path: "/v1/verify",
  tags: ["Verification"],
  summary: "Verify a single email address (JSON body)",
  description: "Same pipeline as the GET variant. Useful when addresses contain characters that need escaping in a query string.",
  request: { body: { content: jsonContent(EmailBodySchema), required: true } },
  responses: {
    200: { description: "Verification result", content: jsonContent(VerificationSchema) },
    ...commonErrors,
  },
});

const bulkRoute = createRoute({
  method: "post",
  path: "/v1/bulk",
  tags: ["Verification"],
  summary: "Verify up to 100 addresses in one request",
  description:
    "Deduplicates the input by canonical form, verifies with bounded concurrency and returns per-address results plus an aggregate summary. Regex-free: invalid lines are reported, not rejected.",
  request: { body: { content: jsonContent(BulkBodySchema), required: true } },
  responses: {
    200: { description: "Bulk results", content: jsonContent(BulkResponseSchema) },
    ...commonErrors,
  },
});

const domainRoute = createRoute({
  method: "get",
  path: "/v1/domain",
  tags: ["Domain"],
  summary: "Inspect a domain's email infrastructure",
  description:
    "Returns MX, A/AAAA, NS records, mail provider fingerprint, SPF policy, DMARC policy, DKIM selector probes and disposable/free classification.",
  request: { query: DomainQuerySchema },
  responses: {
    200: { description: "Domain report", content: jsonContent(DomainResponseSchema) },
    ...commonErrors,
  },
});

const disposableRoute = createRoute({
  method: "get",
  path: "/v1/disposable",
  tags: ["Verification"],
  summary: "Check a domain against the disposable mailbox blocklist",
  description: "Fast, DNS-free check of a single domain against 10,000+ known disposable and temporary mailbox providers.",
  request: { query: DisposableQuerySchema },
  responses: {
    200: { description: "Disposable check", content: jsonContent(DisposableResponseSchema) },
    ...commonErrors,
  },
});

const app = defineApi(config, (app) => {
  app.openapi(verifyGet, async (c) => {
    const { email } = c.req.valid("query");
    return c.json(await verifyEmail(email), 200);
  });

  app.openapi(verifyPost, async (c) => {
    const { email } = c.req.valid("json");
    return c.json(await verifyEmail(email), 200);
  });

  app.openapi(bulkRoute, async (c) => {
    const started = Date.now();
    const { emails } = c.req.valid("json");
    const results = await verifyMany(emails);
    const canonicals = new Set(results.map((result) => result.canonical ?? result.email.toLowerCase()));
    const summary = {
      total: results.length,
      deliverable: results.filter((result) => result.deliverability === "deliverable").length,
      risky: results.filter((result) => result.deliverability === "risky").length,
      undeliverable: results.filter((result) => result.deliverability === "undeliverable").length,
      unknown: results.filter((result) => result.deliverability === "unknown").length,
      disposable: results.filter((result) => result.flags.disposable).length,
      roleAccounts: results.filter((result) => result.flags.roleAccount).length,
      duplicates: results.length - canonicals.size,
    };
    return c.json({ summary, results, durationMs: Date.now() - started }, 200);
  });

  app.openapi(domainRoute, async (c) => {
    const { domain, dkim } = c.req.valid("query");
    return c.json(await inspectDomain(domain, { dkim: dkim !== "false" }), 200);
  });

  app.openapi(disposableRoute, async (c) => {
    const { domain } = c.req.valid("query");
    return c.json({ domain: domain.trim().toLowerCase(), disposable: isDisposableDomain(domain.trim().toLowerCase()) }, 200);
  });
});

export default app;
