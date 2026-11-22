import { z } from "@api/core";

export const DeliverabilitySchema = z.enum(["deliverable", "risky", "undeliverable", "unknown"]).openapi({
  description: "Overall verdict. Based on DNS + address heuristics; mailbox existence is not confirmed.",
});

export const FlagsSchema = z
  .object({
    disposable: z.boolean().openapi({ example: false, description: "Domain is on the disposable / temporary mailbox blocklist." }),
    roleAccount: z.boolean().openapi({ example: false, description: "Local part is a shared role address such as info@ or support@." }),
    freeProvider: z.boolean().openapi({ example: true, description: "Domain belongs to a free consumer mailbox provider." }),
    randomLocalPart: z.boolean().openapi({ example: false, description: "Local part looks machine generated." }),
    hasMx: z.boolean().openapi({ example: true, description: "Domain publishes MX records." }),
    hasARecord: z.boolean().openapi({ example: true, description: "Domain publishes A/AAAA records." }),
    nullMx: z.boolean().openapi({ example: false, description: "Domain publishes a null MX (RFC 7505) and refuses mail." }),
    possibleTypo: z.boolean().openapi({ example: false, description: "Domain looks like a misspelling of a popular provider." }),
  })
  .openapi("AddressFlags");

export const VerificationSchema = z
  .object({
    email: z.string().openapi({ example: "jane.doe+newsletter@gmail.com" }),
    normalized: z.string().nullable().openapi({ example: "jane.doe+newsletter@gmail.com" }),
    canonical: z.string().nullable().openapi({
      example: "janedoe@gmail.com",
      description: "Deduplication form: sub-address and Gmail dots removed.",
    }),
    validFormat: z.boolean().openapi({ example: true }),
    localPart: z.string().nullable().openapi({ example: "jane.doe+newsletter" }),
    domain: z.string().nullable().openapi({ example: "gmail.com" }),
    score: z.number().min(0).max(100).openapi({ example: 88, description: "Risk score. 100 = cleanest possible signal." }),
    deliverability: DeliverabilitySchema,
    flags: FlagsSchema,
    provider: z.string().nullable().openapi({ example: "Google Workspace / Gmail" }),
    didYouMean: z.string().nullable().openapi({ example: null }),
    mxRecords: z
      .array(z.object({ exchange: z.string(), priority: z.number() }))
      .openapi({ example: [{ exchange: "gmail-smtp-in.l.google.com", priority: 5 }] }),
    reasons: z.array(z.string()).openapi({ example: ["Domain is a free consumer mailbox provider"] }),
    durationMs: z.number().openapi({ example: 38 }),
  })
  .openapi("EmailVerification");

export const BulkSummarySchema = z
  .object({
    total: z.number().openapi({ example: 3 }),
    deliverable: z.number().openapi({ example: 2 }),
    risky: z.number().openapi({ example: 1 }),
    undeliverable: z.number().openapi({ example: 0 }),
    unknown: z.number().openapi({ example: 0 }),
    disposable: z.number().openapi({ example: 0 }),
    roleAccounts: z.number().openapi({ example: 0 }),
    duplicates: z.number().openapi({ example: 0 }),
  })
  .openapi("BulkSummary");

export const BulkResponseSchema = z
  .object({
    summary: BulkSummarySchema,
    results: z.array(VerificationSchema),
    durationMs: z.number().openapi({ example: 210 }),
  })
  .openapi("BulkVerification");

export const DomainResponseSchema = z
  .object({
    domain: z.string().openapi({ example: "stripe.com" }),
    resolves: z.boolean().openapi({ example: true }),
    mx: z.object({
      found: z.boolean(),
      records: z.array(z.object({ exchange: z.string(), priority: z.number() })),
    }),
    addresses: z.array(z.string()).openapi({ example: ["104.18.6.125"] }),
    nameservers: z.array(z.string()).openapi({ example: ["ns1.stripe.com"] }),
    provider: z.string().nullable().openapi({ example: "Google Workspace / Gmail" }),
    classification: z.object({ disposable: z.boolean(), freeProvider: z.boolean() }),
    emailAuth: z.object({
      spf: z.object({ found: z.boolean(), record: z.string().nullable(), policy: z.string().nullable() }),
      dmarc: z.object({ found: z.boolean(), record: z.string().nullable(), policy: z.string().nullable() }),
      dkimSelectors: z.array(z.object({ selector: z.string(), found: z.boolean() })),
    }),
    durationMs: z.number().openapi({ example: 120 }),
  })
  .openapi("DomainReport");

export const DisposableResponseSchema = z
  .object({
    domain: z.string().openapi({ example: "mailinator.com" }),
    disposable: z.boolean().openapi({ example: true }),
  })
  .openapi("DisposableCheck");

export const EmailQuerySchema = z.object({
  email: z.string().min(3).max(320).openapi({ param: { name: "email", in: "query" }, example: "jane@example.com", description: "Address to verify." }),
});

export const EmailBodySchema = z.object({
  email: z.string().min(3).max(320).openapi({ example: "jane@example.com", description: "Address to verify." }),
});

export const BulkBodySchema = z.object({
  emails: z
    .array(z.string().min(3).max(320))
    .min(1)
    .max(100)
    .openapi({ example: ["jane@gmail.com", "info@stripe.com"], description: "Up to 100 addresses per request." }),
});

export const DomainQuerySchema = z.object({
  domain: z.string().min(3).max(253).openapi({ param: { name: "domain", in: "query" }, example: "stripe.com", description: "Domain to inspect." }),
  dkim: z
    .enum(["true", "false"])
    .optional()
    .openapi({ param: { name: "dkim", in: "query" }, example: "true", description: "Also probe four common DKIM selectors (slower)." }),
});

export const DisposableQuerySchema = z.object({
  domain: z.string().min(3).max(253).openapi({ param: { name: "domain", in: "query" }, example: "temp-mail.org" }),
});
