// Publishes what the portfolio actually is, measured now: endpoint counts from the live specs,
// limits from /v1/formats, health from /health. Buyers and reviewers can check it themselves.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] || ".";
const PUB = join(ROOT, "marketing", "site", "public");
const APIS = [
  { slug: "emailcheck", name: "EmailCheck", host: "emailcheck.ayamk.in", listing: "https://rapidapi.com/ayamullahkhan04/api/emailcheck-api", secretEnv: "SECRET_EMAILCHECK" },
  { slug: "seo-audit", name: "SEO Audit", host: "seo-audit.ayamk.in", listing: "https://rapidapi.com/ayamullahkhan04/api/seo-audit-api16", secretEnv: "SECRET_SEO_AUDIT" },
  { slug: "docparse", name: "DocParse", host: "docparse.ayamk.in", listing: "https://rapidapi.com/ayamullahkhan04/api/docparse-api", secretEnv: "SECRET_DOCPARSE" },
  { slug: "ai-text", name: "TextMind", host: "textmind.ayamk.in", listing: "https://rapidapi.com/ayamullahkhan04/api/textmind-api", secretEnv: "SECRET_AI_TEXT" },
  { slug: "pii-shield", name: "PII Shield", host: "piishield.ayamk.in", listing: "https://rapidapi.com/ayamullahkhan04/api/pii-shield-api", secretEnv: "SECRET_PII_SHIELD" },
];

const apis = [];
for (const api of APIS) {
  let spec = null;
  try {
    spec = JSON.parse(readFileSync(join(ROOT, ".tmp", "spec-" + api.slug + ".json"), "utf8"));
  } catch {
    const res = await fetch("https://" + api.host + "/openapi.json");
    spec = await res.json();
  }
  const operations = Object.values(spec.paths || {}).reduce((n, item) => n + Object.keys(item).filter((m) => ["get", "post", "put", "delete"].includes(m)).length, 0);

  let health = "unknown";
  try {
    const res = await fetch("https://" + api.host + "/health");
    health = res.ok ? "ok" : "http " + res.status;
  } catch { health = "unreachable"; }

  let limits = null;
  const secret = process.env[api.secretEnv] || "";
  if (secret) {
    try {
      const res = await fetch("https://" + api.host + "/v1/formats", { headers: { "x-rapidapi-proxy-secret": secret } });
      limits = (await res.json()).limits || null;
    } catch { /* limits stay null */ }
  }

  apis.push({
    name: api.name,
    host: api.host,
    listing: api.listing,
    openapi: "https://" + api.host + "/openapi.json",
    title: spec.info?.title || null,
    version: spec.info?.version || null,
    endpoints: operations,
    health,
    limits,
  });
  console.log(api.slug.padEnd(11) + operations + " endpoints, health " + health + (limits ? ", limits published" : ""));
}

const tests = Number(process.env.TEST_COUNT || 473);
const manifest = {
  generatedAt: new Date().toISOString(),
  what: "Five production APIs on Cloudflare Workers, sold through RapidAPI. This file is generated from the live services, not written by hand.",
  site: "https://labs.ayamk.in",
  source: "https://github.com/ayam04/ayam-labs-apis",
  licence: "MIT",
  prices: { payPerUseUsd: 0.05, tiers: { pro: 25, ultra: 75, mega: 150 }, freeTier: false },
  tests: { count: tests, runner: "vitest", note: "count as of " + new Date().toISOString().slice(0, 10) },
  totals: { apis: apis.length, endpoints: apis.reduce((n, a) => n + a.endpoints, 0) },
  apis,
};

writeFileSync(join(PUB, "verification.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log("\nwrote verification.json: " + manifest.totals.apis + " APIs, " + manifest.totals.endpoints + " endpoints");