// Live smoke test. Direct /v1 calls need the RapidAPI proxy secret, because the
// workers are locked to marketplace traffic. Usage:
//   node scripts/smoke.mjs              (health + public routes only)
//   SECRET_EMAILCHECK=... node scripts/smoke.mjs   (full suite)
const HOSTS = {
  emailcheck: "emailcheck.ayamk.in",
  "seo-audit": "seo-audit.ayamk.in",
  docparse: "docparse.ayamk.in",
  "ai-text": "textmind.ayamk.in",
  "pii-shield": "piishield.ayamk.in",
};
const SITE = "labs.ayamk.in";
const api = (name) => "https://" + (HOSTS[name] ?? name);
const secret = (slug) => process.env["SECRET_" + slug.toUpperCase().replace(/-/g, "_")] ?? process.env.RAPIDAPI_SECRET ?? "";

let pass = 0, fail = 0;

async function hit(label, url, init = {}, slug = "") {
  const started = Date.now();
  const headers = { ...(init.headers ?? {}) };
  const s = secret(slug);
  if (s) headers["x-rapidapi-proxy-secret"] = s;
  try {
    const response = await fetch(url, { ...init, headers });
    const text = await response.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* non json */ }
    const ok = response.ok;
    ok ? pass++ : fail++;
    console.log((ok ? "PASS " : "FAIL ") + String(response.status).padEnd(3) + String(Date.now() - started).padStart(6) + "ms  " + label);
    if (!ok) console.log("      " + (body ? JSON.stringify(body).slice(0, 180) : text.slice(0, 120)));
    return body;
  } catch (error) {
    fail++;
    console.log("FAIL  ERR " + label + " :: " + error.message);
    return null;
  }
}

const json = (obj) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(obj) });

console.log("== emailcheck");
await hit("health", api("emailcheck") + "/health");
await hit("verify", api("emailcheck") + "/v1/verify?email=tim%40stripe.com", {}, "emailcheck");
await hit("bulk", api("emailcheck") + "/v1/bulk", json({ emails: ["a@gmail.com", "not-an-email", "x@mailinator.com"] }), "emailcheck");

console.log("== seo-audit");
await hit("audit", api("seo-audit") + "/v1/audit?url=https%3A%2F%2Fexample.com", {}, "seo-audit");
await hit("text", api("seo-audit") + "/v1/text", json({ text: "Solar panels convert sunlight into electricity and adoption keeps growing." }), "seo-audit");

console.log("== docparse");
await hit("pdf/text (small)", api("docparse") + "/v1/pdf/text", json({ url: "https://www.orimi.com/pdf-test.pdf" }), "docparse");
// a dense document above the CPU guard must return our JSON 413, never a Cloudflare HTML page
const guardHeaders = { "content-type": "application/json" };
const guardSecret = secret("docparse");
if (guardSecret) guardHeaders["x-rapidapi-proxy-secret"] = guardSecret;
const guardRes = await fetch(api("docparse") + "/v1/pdf/text", {
  method: "POST",
  headers: guardHeaders,
  body: JSON.stringify({ url: "https://arxiv.org/pdf/1706.03762v7" }),
});
const guardBody = await guardRes.text();
const guardOk = guardRes.status === 413 && guardBody.includes("PAYLOAD_TOO_LARGE");
guardOk ? pass++ : fail++;
console.log((guardOk ? "PASS " : "FAIL ") + String(guardRes.status).padEnd(3) + "      cpu guard returns JSON 413");
if (!guardOk) console.log("      " + guardBody.slice(0, 140));
await hit("pdf/pages", api("docparse") + "/v1/pdf/pages?pages=1", json({ url: "https://arxiv.org/pdf/1706.03762v7" }), "docparse");
await hit("html/markdown", api("docparse") + "/v1/html/markdown", json({ html: "<h1>Hi</h1><p>Hello <b>world</b>.</p>" }), "docparse");

console.log("== ai-text");
await hit("sentiment", api("ai-text") + "/v1/sentiment", json({ text: "The deploy went smoothly and the team is thrilled." }), "ai-text");
await hit("summarize", api("ai-text") + "/v1/summarize", json({ text: "Artificial intelligence is transforming industries. Companies use machine learning to automate tasks and analyse datasets. Regulation will shape adoption.", maxWords: 30 }), "ai-text");

console.log("== pii-shield");
await hit("redact", api("pii-shield") + "/v1/redact", json({ text: "Call 415-555-0132 or jane@acme.com", style: "label" }), "pii-shield");

console.log("== site");
await hit("home", "https://" + SITE + "/");
await hit("article", "https://" + SITE + "/blog-five-apis.html");

console.log("");
console.log(pass + " passed, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);