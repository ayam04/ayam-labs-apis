// Regenerates apps/emailcheck/src/data/disposable.json from the public blocklist.
// Source: https://github.com/disposable-email-domains/disposable-email-domains (MIT).
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE =
  process.env.DISPOSABLE_LIST_URL ??
  "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/main/disposable_email_blocklist.conf";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../apps/emailcheck/src/data/disposable.json");

const response = await fetch(SOURCE);
if (!response.ok) throw new Error("download failed: " + response.status);
const raw = await response.text();
const domains = [
  ...new Set(
    raw
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line && !line.startsWith("#") && /^[a-z0-9.-]+\.[a-z]{2,}$/.test(line)),
  ),
].sort();

await mkdir(dirname(target), { recursive: true });
await writeFile(target, JSON.stringify({ source: SOURCE, count: domains.length, blocklist: domains.join("\n") }), "utf8");
console.log("wrote " + domains.length + " domains to " + target);