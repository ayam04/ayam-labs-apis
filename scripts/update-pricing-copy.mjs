import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = join(process.argv[2], "public");
const files = ["emailcheck.html", "seo-audit.html", "docparse.html", "ai-text.html", "pii-shield.html"];

const OLD = [
  '  <div>',
  '    <div class="tier">Basic</div>',
  '    <div class="price">$0</div>',
  '    <div class="req">25 requests / month</div>',
  '    <div class="sub">Card required by the marketplace. Enough to ship an integration.</div>',
  '  </div>',
].join("\n");

const NEW = [
  '  <div>',
  '    <div class="tier">Pay as you go</div>',
  '    <div class="price">$0.05<span style="font-size:.9rem;color:var(--muted)">/call</span></div>',
  '    <div class="req">no monthly minimum</div>',
  '    <div class="sub">Card required. Pay only for the calls you make. No free tier, no monthly minimum, no expiring trial.</div>',
  '  </div>',
].join("\n");

for (const file of files) {
  const path = join(dir, file);
  let html = await readFile(path, "utf8");
  if (!html.includes(OLD)) { console.log("no match", file); continue; }
  html = html.replace(OLD, NEW);
  html = html.replace(/\$0 \/ \$25/g, "$0.05/call");
  html = html.replace(/\"description\": \"[0-9]+ requests per month free, paid plans from \$25\/month\"/g, '"description": "Pay as you go from $0.05 per call, or monthly plans from $25"');
  await writeFile(path, html, "utf8");
  console.log("updated", file);
}