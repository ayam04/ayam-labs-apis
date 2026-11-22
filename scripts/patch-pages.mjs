// Injects the app.js script tag + no-JS safe reveal flag into every page.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const dir = process.argv[2];
const files = (await readdir(dir)).filter((name) => name.endsWith(".html"));

const SCRIPT_TAG = '<script src="/app.js" defer></script>\n</body>';
const JS_FLAG = '<script>document.documentElement.className += " js";</script>\n';

for (const file of files) {
  const path = join(dir, file);
  let html = await readFile(path, "utf8");

  if (!html.includes('src="/app.js"')) {
    html = html.replace("</body>", SCRIPT_TAG);
  }
  if (!html.includes('className += " js"')) {
    html = html.replace("</head>", JS_FLAG + "</head>");
  }
  await writeFile(path, html, "utf8");
  console.log("patched", file);
}
