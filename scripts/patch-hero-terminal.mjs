// Puts the real response example into each product page hero terminal.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = process.argv[2];
const slugs = ["emailcheck", "seo-audit", "docparse", "ai-text", "pii-shield"];
const MAX_LINES = 9;

for (const slug of slugs) {
  const path = join(dir, slug + ".html");
  let html = await readFile(path, "utf8");

  const curlMatch = html.match(new RegExp('<pre id="curl-' + slug + '">([\\s\\S]*?)</pre>'));
  const resMatch = html.match(new RegExp('<pre id="res-' + slug + '">([\\s\\S]*?)</pre>'));
  if (!curlMatch || !resMatch) {
    console.log("skipped", slug, "missing blocks");
    continue;
  }
  const curl = curlMatch[1].trim().replace(/&amp;/g, "&");
  const responseLines = resMatch[1].split("\n");
  const head = responseLines.slice(0, MAX_LINES).join("\n");
  const clipped = responseLines.length > MAX_LINES ? "\n  ..." : "";

  const body =
    '<div class="body"><pre><span class="tok-cmd">$</span> ' +
    curl +
    '</pre><pre class="dim">' +
    head +
    clipped +
    "</pre></div>";

  const replaced = html.replace(/<div class="body">[\s\S]*?<\/div>/, body);
  if (replaced === html) {
    console.log("no change", slug);
    continue;
  }
  await writeFile(path, replaced, "utf8");
  console.log("patched hero terminal:", slug);
}
