// Docs drift check: numbers published on the site must match what the API reports,
// and values that were corrected must not creep back.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.argv[2] || ".";
const PUB = join(ROOT, "marketing", "site", "public");
const SECRET = process.env.SECRET_DOCPARSE || "";

let failures = 0;
const fail = (msg) => { failures++; console.log("DRIFT " + msg); };

// 1. live limits
// without the secret this runs in offline mode: the live numeric comparison is skipped,
// the stale-value scan still runs, so CI can use it with no network or credentials
let limits = null;
if (!SECRET) console.log("note: SECRET_DOCPARSE not set, running the offline scan only");
if (SECRET) {
  try {
    const res = await fetch("https://docparse.ayamk.in/v1/formats", { headers: { "x-rapidapi-proxy-secret": SECRET } });
    limits = (await res.json()).limits;
  } catch (error) {
    console.log("note: could not read live limits, skipping numeric comparison");
  }
}

// 2. pages that describe docparse limits
const docparsePages = ["docparse.html", "guides-pdf-text.html", "reference-docparse.html", "compare-pricing.html", "index.html"];
for (const name of docparsePages) {
  let html = "";
  try { html = readFileSync(join(PUB, name), "utf8"); } catch { continue; }
  const text = html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

  if (limits) {
    for (const m of text.matchAll(/(\d+)\s*pages?\s*per\s*(?:request|call|extraction)/gi)) {
      const claimed = Number(m[1]);
      if (claimed !== limits.maxPdfPages) fail(`${name}: claims ${claimed} pages per request, API reports ${limits.maxPdfPages}`);
    }
    for (const m of text.matchAll(/(\d+)\s*MB/g)) {
      const mb = Number(m[1]);
      // "5MB" can mean 5 MiB or 5,000,000 bytes; both are honest descriptions of the same cap
      const candidates = [mb * 1024 * 1024, mb * 1_000_000];
      const known = [limits.maxDocumentBytes, limits.maxFetchedHtmlBytes].filter(Boolean);
      const matches = known.some((k) => candidates.some((c) => Math.abs(c - k) <= 1));
      if (known.length && !matches) fail(`${name}: claims ${mb}MB, API reports ${known.map((b) => b + " bytes").join(" or ")}`);
    }
  }
}

// 3. values that were wrong once and must not return
const stale = [
  { pattern: /100 pages per (request|extraction)/i, why: "docparse extracts 4 pages per call since the CPU cap" },
  // a page may quote the old number while correcting it; only flag a claim that is not being retracted
  { pattern: /\$0\.0005 per page(?!.{0,80}(used to|previously|corrected))/i, why: "pricing corrected to $0.0125 per page" },
  { pattern: /parity at \$0\.0005(?!.{0,80}(used to|previously|corrected))/i, why: "parity claim removed with the page cap" },
  { pattern: /10\s?ms CPU budget/i, why: "that diagnosis was measured wrong and retracted" },
  { pattern: /\/v1\/extract\b/i, why: "that endpoint never existed; it is /v1/pdf/text" },
];
// a page may quote an old value while retracting it, so drop sentences that do
const RETRACTIONS = /(used to|previously|corrected|no longer|was wrong)/i;
const withoutRetractions = (text) =>
  text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !RETRACTIONS.test(sentence))
    .join(" ");

for (const name of readdirSync(PUB).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(PUB, name), "utf8");
  const text = withoutRetractions(html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " "));
  for (const rule of stale) {
    if (rule.pattern.test(text)) fail(`${name}: contains a value that was corrected (${rule.why})`);
  }
}

console.log(failures === 0 ? "docs drift check: clean" : `docs drift check: ${failures} problem(s)`);
// set exitCode rather than calling process.exit(): exiting while fetch handles are closing
// trips a libuv assertion on Node 24 / Windows and turns a clean run into a failure
process.exitCode = failures === 0 ? 0 : 1;