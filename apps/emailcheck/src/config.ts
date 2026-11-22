import type { ApiConfig } from "@api/core";

export const config: ApiConfig = {
  name: "emailcheck",
  title: "EmailCheck API",
  version: "1.0.0",
  summary: "Verify email addresses in real time: syntax, MX, disposable, role accounts, typos and deliverability scoring.",
  description: [
    "Validate email addresses before you send, store or bill for them.",
    "",
    "Every call runs a syntax pass, live DNS lookups (MX + A/AAAA), a 10,000+ domain disposable-mailbox blocklist, role-account detection, free-provider detection, typo suggestions and a 0-100 deliverability score with human readable reasons.",
    "",
    "**Honest scope:** no SMTP handshake happens at the edge, so the API tells you whether the *domain* accepts mail and how risky the *address* looks. It does not claim to prove that a specific mailbox exists. Results are cached at the edge for 10 minutes to keep latency low.",
    "",
    "**Built for:** signup forms, lead qualification, CRM hygiene, bulk list cleaning, fraud checks.",
  ].join("\n"),
  baseUrl: "https://emailcheck.ayamk.in",
  tags: [
    { name: "Verification", description: "Address level checks" },
    { name: "Domain", description: "Domain level email infrastructure" },
  ],
  termsOfService: "https://example.com/terms",
  directRateLimitPerMinute: 60,
};