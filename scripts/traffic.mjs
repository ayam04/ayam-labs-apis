import { readFileSync } from "node:fs";
import { join } from "node:path";

// Weekly traffic report from Cloudflare zone analytics (no dashboard needed).
const ZONE = "9a2d366ea542a56e54e9e51b2e4365bf";
const cfg = readFileSync(join(process.env.APPDATA, "xdg.config", ".wrangler", "config", "default.toml"), "utf8");
const token = cfg.match(/oauth_token = "([^"]+)"/)[1];
const days = Number(process.argv[2] || 7);
const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 19) + "Z";

async function gql(query) {
  const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const j = await res.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300));
  return j.data.viewer.zones[0];
}

const hosts = await gql(`query { viewer { zones(filter: {zoneTag: "${ZONE}"}) { httpRequestsAdaptiveGroups(limit: 40, filter: {datetime_geq: "${since}"}, orderBy: [count_DESC]) { count dimensions { clientRequestHTTPHost } } } } }`);
console.log(`requests by host, last ${days} days`);
for (const g of hosts.httpRequestsAdaptiveGroups) {
  const h = g.dimensions.clientRequestHTTPHost || "?";
  if (!h.includes("ayamk.in")) continue;
  console.log("  " + h.padEnd(34) + String(g.count).padStart(8));
}

const site = await gql(`query { viewer { zones(filter: {zoneTag: "${ZONE}"}) { httpRequestsAdaptiveGroups(limit: 20, filter: {datetime_geq: "${since}", clientRequestHTTPHost: "labs.ayamk.in"}, orderBy: [count_DESC]) { count dimensions { clientRequestPath edgeResponseStatus } } } } }`);
console.log("\ntop paths on labs.ayamk.in");
const paths = site.httpRequestsAdaptiveGroups.filter((g) => !g.dimensions.clientRequestPath.startsWith("/cdn-cgi"));
for (const g of paths.slice(0, 14)) {
  console.log("  " + String(g.count).padStart(6) + "  " + g.dimensions.edgeResponseStatus + "  " + g.dimensions.clientRequestPath.slice(0, 40));
}

for (const host of ["emailcheck.ayamk.in", "seo-audit.ayamk.in", "docparse.ayamk.in", "textmind.ayamk.in", "piishield.ayamk.in"]) {
  const r = await gql(`query { viewer { zones(filter: {zoneTag: "${ZONE}"}) { httpRequestsAdaptiveGroups(limit: 6, filter: {datetime_geq: "${since}", clientRequestHTTPHost: "${host}"}, orderBy: [count_DESC]) { count dimensions { clientRequestPath edgeResponseStatus } } } } }`);
  const rows = r.httpRequestsAdaptiveGroups;
  const total = rows.reduce((a, g) => a + g.count, 0);
  const auth = rows.filter((g) => g.dimensions.edgeResponseStatus === 401).reduce((a, g) => a + g.count, 0);
  console.log(`\n${host}: ${total} requests in top ${rows.length} paths, ${auth} rejected with 401`);
}