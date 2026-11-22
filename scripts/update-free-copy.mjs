import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = join(process.argv[2], "public");

const edits = [
  // pricing page tier table: turn the free row into pay as you go
  ["pricing.html",
    '<tr><td class="path">Basic</td><td class="mono" style="color:var(--text)">$0</td><td class="mono">25</td>',
    '<tr><td class="path">Pay as you go</td><td class="mono" style="color:var(--text)">$0.05/call</td><td class="mono">metered</td>'],
  ["pricing.html",
    'One pricing shape across all five products means you can budget once and add a second API without a procurement cycle. Free tier is real, not a teaser that expires.',
    'One pricing shape across all five products means you can budget once and add a second API without a procurement cycle. No free tier: a pay-as-you-go rate of $0.05 per call, then monthly plans once the volume justifies one.'],
  // home page
  ["index.html", '<h2 style="margin-bottom:10px">Start on the free tier</h2>', '<h2 style="margin-bottom:10px">Start with pay as you go</h2>'],
  ["index.html",
    'Every API has a free plan with a real quota, so you can wire it up and test it before paying anything. Upgrade from the same listing in one click.',
    '$0.05 a call, no monthly minimum. Wire up the integration, see exactly what it costs, then move to a monthly plan when the volume makes it cheaper. Both happen on the same listing in one click.'],
  ["index.html", '<h3 style="font-size:1rem">Subscribe on RapidAPI</h3><p>Pick the free tier, get a key immediately.', '<h3 style="font-size:1rem">Subscribe on RapidAPI</h3><p>Pick pay as you go, get a key immediately.'],
  // build log article
  ["blog-five-apis.html",
    'The free tier is deliberately small: 25 requests a month. Not because I want to be stingy, but because a free tier that covers the use case kills the paid tier. 100 calls is enough to wire the integration, hit every endpoint and see real output. It is not enough to run a list cleaning job in production.',
    'There is no free tier. The entry plan is pay as you go at $0.05 a call with no monthly minimum, then monthly plans at $25, $75 and $150 once volume makes them cheaper. A free tier that covers the real use case kills the paid one, and a free tier too small to evaluate anything is just a teaser. Metering solves both: you pay for exactly what you test.'],
  ["blog-five-apis.html", 'Try one on the free tier</h2><p style="margin:0;max-width:52ch">25 requests a month, every endpoint, no sales call.', 'Try one at $0.05 a call</h2><p style="margin:0;max-width:52ch">Every endpoint, metered, no monthly minimum and no sales call.'],
];

const changed = new Map();
for (const [file, from, to] of edits) {
  const path = join(dir, file);
  const html = changed.get(path) ?? await readFile(path, "utf8");
  if (!html.includes(from)) { console.log("MISS", file, from.slice(0, 50)); changed.set(path, html); continue; }
  changed.set(path, html.split(from).join(to));
}
for (const [path, html] of changed) { await writeFile(path, html, "utf8"); console.log("written", path.split("\\").pop()); }