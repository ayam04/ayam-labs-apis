// Adds JSON-LD structured data to every page (Organization + per product SoftwareApplication).
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const dir = process.argv[2];
const host = process.argv[3];
const base = "https://" + host;

const products = {
  "emailcheck.html": { name: "EmailCheck API", desc: "Email verification: syntax, MX DNS, disposable domains, role accounts, typo detection and deliverability scoring." },
  "seo-audit.html": { name: "SEO Audit API", desc: "On-page SEO audit for any URL: titles, meta, headings, links, structured data, readability and a weighted score." },
  "docparse.html": { name: "DocParse API", desc: "Extract clean text from PDF, DOCX and HTML: per page text, metadata and markdown conversion." },
  "ai-text.html": { name: "TextMind API", desc: "Keywords, entities, sentiment and language detection, plus summaries, rewrites, zero-shot labels and translation." },
  "pii-shield.html": { name: "PII Shield API", desc: "Detect and redact PII with Luhn, mod-97 and base58check validators, plus profanity and spam screening." },
};

const org = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Ayam Labs",
  url: base + "/",
  logo: base + "/favicon.svg",
  sameAs: ["https://github.com/ayam04"],
};

for (const file of (await readdir(dir)).filter((f) => f.endsWith(".html"))) {
  const path = join(dir, file);
  let html = await readFile(path, "utf8");
  if (html.includes("application/ld+json")) continue;

  const blocks = [org];
  const product = products[file];
  if (product) {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: product.name,
      description: product.desc,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any (HTTP API)",
      url: base + "/" + file,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "100 requests per month free, paid plans from $25/month" },
      publisher: { "@type": "Organization", name: "Ayam Labs" },
    });
  }
  if (file === "blog-five-apis.html") {
    blocks.push({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Five APIs on Cloudflare Workers, and the four bugs that nearly shipped",
      datePublished: "2026-11-21",
      author: { "@type": "Organization", name: "Ayam Labs" },
      mainEntityOfPage: base + "/blog-five-apis.html",
    });
  }

  const script = blocks.map((b) => '<script type="application/ld+json">' + JSON.stringify(b) + "</script>").join("\n");
  html = html.replace("</head>", script + "\n</head>");
  await writeFile(path, html, "utf8");
  console.log("ld+json:", file);
}