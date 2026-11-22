// Generates a RapidAPI Docs-tab markdown file per API from its OpenAPI spec.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2];
const specs = join(root, ".tmp", "specs");
const outDir = join(root, "docs", "listings");
const BT = String.fromCharCode(96);
const FENCE = BT.repeat(3);
const code = (value) => BT + value + BT;
const apps = ["emailcheck", "seo-audit", "docparse", "ai-text", "pii-shield"];

for (const slug of apps) {
  const spec = JSON.parse(await readFile(join(specs, slug + ".openapi.json"), "utf8"));
  const proxy = slug + ".p.rapidapi.com";
  const out = [];
  out.push("## " + spec.info.title);
  out.push("");
  out.push("Version " + spec.info.version + ". Marketplace base URL: " + code("https://" + proxy));
  out.push("");
  out.push("### Endpoints");
  out.push("");
  out.push("| Method | Path | Summary |");
  out.push("| --- | --- | --- |");
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const method of ["get", "post"]) {
      const op = item[method];
      if (!op) continue;
      out.push("| " + method.toUpperCase() + " | " + code(path) + " | " + (op.summary || "") + " |");
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
  const firstGet = Object.entries(spec.paths).filter(([, item]) => item.get).map(([p]) => p)[0];
  if (firstGet) {
    out.push("### First call");
    out.push("");
    out.push(FENCE + "bash");
    out.push("curl " + JSON.stringify("https://" + proxy + firstGet) + " \\");
    out.push("  -H \"X-RapidAPI-Key: YOUR_KEY\" \\");
    out.push("  -H " + JSON.stringify("X-RapidAPI-Host: " + proxy));
    out.push(FENCE);
    out.push("");
  }
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
  out.push("| 415 | UNSUPPORTED_MEDIA | Wrong content type for the endpoint |");
  out.push("| 429 | RATE_LIMITED | Plan quota exceeded |");
  out.push("| 5xx | UPSTREAM_ERROR | Retry quoting the requestId to support |");
  out.push("");
  out.push("### Support");
  out.push("");
  out.push("Open a discussion on the listing, or email ayamullahkhan04@gmail.com with the requestId.");
  await writeFile(join(outDir, slug + "-docs.md"), out.join("\n") + "\n", "utf8");
  console.log("wrote", slug + "-docs.md");
}