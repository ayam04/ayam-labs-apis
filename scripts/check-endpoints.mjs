import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
const root = process.argv[2];
const hosts = { emailcheck: "emailcheck.ayamk.in", "seo-audit": "seo-audit.ayamk.in", docparse: "docparse.ayamk.in", "ai-text": "textmind.ayamk.in", "pii-shield": "piishield.ayamk.in" };
const routes = new Map();
const all = new Set();
for (const [slug, host] of Object.entries(hosts)) {
  const spec = await (await fetch("https://" + host + "/openapi.json")).json();
  const set = new Set();
  for (const [p, item] of Object.entries(spec.paths)) { set.add(p); all.add(p); }
  routes.set(slug, set);
}
const pub = join(root, "marketing", "site", "public");
const files = [];
for (const f of await readdir(pub)) if (f.endsWith(".html")) files.push(join(pub, f));
for (const f of await readdir(join(root, "docs", "listings"))) files.push(join(root, "docs", "listings", f));
let bad = 0;
for (const file of files) {
  const text = await readFile(file, "utf8");
  const found = new Set([...text.matchAll(/\/v1\/[a-z0-9\-\/]+/gi)].map((m) => m[0].replace(/[)".,]+$/, "")));
  for (const path of found) {
    if (!all.has(path)) { bad++; console.log("UNKNOWN", path, "in", file.split(/[\\/]/).pop()); }
  }
}
console.log(bad === 0 ? "endpoint check: all documented paths exist in a live spec" : "endpoint check: " + bad + " unknown path(s)");
console.log("known routes:", all.size);