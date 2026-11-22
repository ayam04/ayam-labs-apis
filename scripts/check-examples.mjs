import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { unescape } from "node:querystring";
const dir = join(process.argv[2] || ".", "marketing", "site", "public");
// Every curl example published on the site, executed against the live API.
//   node scripts/check-examples.mjs .
// Secrets come from the environment: SECRET_EMAILCHECK, SECRET_SEO_AUDIT, SECRET_DOCPARSE,
// SECRET_AI_TEXT, SECRET_PII_SHIELD. Without them the run reports which examples it skipped.
const SECRETS = {
  emailcheck: process.env.SECRET_EMAILCHECK || "",
  "seo-audit": process.env.SECRET_SEO_AUDIT || "",
  docparse: process.env.SECRET_DOCPARSE || "",
  "ai-text": process.env.SECRET_AI_TEXT || "",
  "pii-shield": process.env.SECRET_PII_SHIELD || "",
};
const HOSTS = {
  emailcheck: "emailcheck.ayamk.in",
  "seo-audit": "seo-audit.ayamk.in",
  docparse: "docparse.ayamk.in",
  "ai-text": "textmind.ayamk.in",
  "pii-shield": "piishield.ayamk.in",
};
function decode(s) {
  return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function parse(cmd) {
  const c = decode(cmd).replace(/\\\n/g, " ").replace(/\s+/g, " ").trim();
  const method = (c.match(/curl -s? ?-X ([A-Z]+)/) || c.match(/-X ([A-Z]+)/) || [, "GET"])[1];
  const url = (c.match(/'([^']+)'/) || [])[1];
  const headers = [...c.matchAll(/-H '([^']+)'/g)].map((m) => m[1]);
  const data = (c.match(/-d '([\s\S]*?)'(?=\s|$)/) || [])[1];
  return { method, url, headers, data };
}
const results = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith(".html"))) {
  const html = readFileSync(dir + "\\" + f, "utf8");
  const codes = [...html.matchAll(/<code>([\s\S]*?)<\/code>/g)].map((m) => m[1]).filter((c) => c.includes("curl "));
  for (const block of codes) {
    for (const line of block.split(/\n(?=curl )/)) {
      if (!line.includes("curl ")) continue;
      const { method, url, headers, data } = parse(line);
      if (!url) { results.push([f, method, "(no url)", 0, "unparsed"]); continue; }
      const SLUG = { "emailcheck": "emailcheck", "seo-audit": "seo-audit", "docparse": "docparse", "textmind": "ai-text", "piishield": "pii-shield" };
      const byProxy = (url.match(/https:\/\/([a-z0-9-]+)\.p\.rapidapi\.com/) || [])[1];
      let app = byProxy && SLUG[byProxy] ? SLUG[byProxy] : Object.keys(HOSTS).find((k) => url.includes(HOSTS[k]));
      if (!app) { results.push([f, method, url.slice(0, 48), 0, "unknown host"]); continue; }
      const target = url.replace(/https:\/\/[a-z0-9-]+\.p\.rapidapi\.com/, "https://" + HOSTS[app]).replace(/https:\/\/[a-z0-9-]+\.ayamk\.in/, "https://" + HOSTS[app]);
      const h = { "x-rapidapi-proxy-secret": SECRETS[app] };
      if (data) h["content-type"] = "application/json";
      const init = { method, headers: h };
      if (data) init.body = data;
      try {
        const r = await fetch(target, init);
        const body = await r.text();
        results.push([f, method, target.replace("https://", ""), r.status, body.slice(0, 70).replace(/\s+/g, " ")]);
      } catch (e) {
        results.push([f, method, target.slice(0, 48), 0, "fetch error " + String(e).slice(0, 40)]);
      }
    }
  }
}
let bad = 0;
for (const [f, m, u, s, head] of results) {
  const ok = s >= 200 && s < 300;
  if (!ok) bad++;
  console.log((ok ? "ok  " : "BAD ") + String(s).padEnd(4) + m.padEnd(5) + u.padEnd(46) + " " + head.slice(0, 60));
}
console.log("\ntotal:", results.length, "| failures:", bad);
process.exitCode = bad === 0 ? 0 : 1;