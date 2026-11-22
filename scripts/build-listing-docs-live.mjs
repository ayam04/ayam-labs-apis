import { writeFile } from "node:fs/promises";
import { join } from "node:path";
const root = process.argv[2];
const hosts = { emailcheck: "emailcheck.ayamk.in", "seo-audit": "seo-audit.ayamk.in", docparse: "docparse.ayamk.in", "ai-text": "textmind.ayamk.in", "pii-shield": "piishield.ayamk.in" };
const BT = String.fromCharCode(96);
const FENCE = BT.repeat(3);
const code = (v) => BT + v + BT;
for (const [slug, host] of Object.entries(hosts)) {
  const spec = await (await fetch("https://" + host + "/openapi.json")).json();
  const proxy = slug.replace("-", "") + ".p.rapidapi.com";
  const out = [];
  out.push("## " + spec.info.title);
  out.push("");
  out.push("Version " + spec.info.version + ". Marketplace base URL: " + code("https://" + proxy));
  out.push("");
  out.push("### Endpoints");
  out.push("");
  out.push("| Method | Path | Summary |");
  out.push("| --- | --- | --- |");
  for (const [p, item] of Object.entries(spec.paths)) {
    for (const m of ["get", "post"]) {
      const op = item[m];
      if (!op) continue;
      out.push("| " + m.toUpperCase() + " | " + code(p) + " | " + (op.summary || "").replace(/\|/g, "/") + " |");
    }
  }
  out.push("");
  out.push("### Auth");
  out.push("");
  out.push("Send both headers on every request. The marketplace rejects calls without them before they reach the API.");
  out.push("");
  out.push(FENCE);
  out.push("X-RapidAPI-Key: <your key>");
  out.push("X-RapidAPI-Host: " + proxy);
  out.push(FENCE);
  out.push("");
  out.push("### Errors");
  out.push("");
  out.push("Every failure returns the same envelope:");
  out.push("");
  out.push(FENCE + "json");
  out.push('{ "error": { "code": "INVALID_INPUT", "message": "...", "hint": "..." }, "requestId": "uuid", "timestamp": "ISO-8601" }');
  out.push(FENCE);
  out.push("");
  out.push("| Status | Code | When |");
  out.push("| --- | --- | --- |");
  out.push("| 400 | INVALID_INPUT | Missing or unparsable parameters |");
  out.push("| 401 | UNAUTHORIZED | Missing or invalid marketplace credentials |");
  out.push("| 404 | NOT_FOUND | No route matches the path |");
  out.push("| 413 | PAYLOAD_TOO_LARGE | Body above the documented cap |");
  out.push("| 429 | RATE_LIMITED | Plan quota exceeded |");
  out.push("| 5xx | UPSTREAM_ERROR | Retry quoting the requestId to support |");
  out.push("");
  out.push("### Support");
  out.push("");
  out.push("Open a discussion on the listing, or email ayamullahkhan04@gmail.com with the requestId.");
  await writeFile(join(root, "docs", "listings", slug + "-docs.md"), out.join("\n") + "\n", "utf8");
  const n = Object.values(spec.paths).reduce((a, it) => a + (it.get ? 1 : 0) + (it.post ? 1 : 0), 0);
  console.log("wrote", slug, "routes:", n);
}