/**
 * Transparent, stable audit scoring.
 *
 * Every check has a fixed weight and the weights sum to exactly 100, so a page
 * that passes everything scores 100. Points per check: pass = full weight,
 * warn = half the weight rounded up, fail = 0. The response lists every check so
 * a caller can see exactly why a page lost points.
 */

export type CheckStatus = "pass" | "warn" | "fail";

export interface ScoreCheck {
  id: string;
  label: string;
  status: CheckStatus;
  weight: number;
  points: number;
  message: string;
}

export interface ScoreResult {
  value: number;
  grade: "A" | "B" | "C" | "D" | "F";
  passed: number;
  warned: number;
  failed: number;
  checks: ScoreCheck[];
}

export const CHECK_WEIGHTS: ReadonlyArray<{ id: string; label: string; weight: number }> = [
  { id: "https", label: "HTTPS", weight: 10 },
  { id: "title", label: "Title tag", weight: 15 },
  { id: "meta-description", label: "Meta description", weight: 12 },
  { id: "canonical", label: "Canonical URL", weight: 8 },
  { id: "lang", label: "Language attribute", weight: 5 },
  { id: "h1", label: "Single H1", weight: 8 },
  { id: "headings", label: "Heading structure", weight: 6 },
  { id: "image-alt", label: "Image alt text", weight: 8 },
  { id: "internal-links", label: "Internal links", weight: 6 },
  { id: "structured-data", label: "Structured data", weight: 6 },
  { id: "open-graph", label: "Open Graph tags", weight: 6 },
  { id: "twitter-card", label: "Twitter card tags", weight: 4 },
  { id: "viewport", label: "Mobile viewport", weight: 3 },
  { id: "charset", label: "Character encoding", weight: 3 },
];

export const TOTAL_WEIGHT: number = CHECK_WEIGHTS.reduce((sum, check) => sum + check.weight, 0);

export interface ScoreInput {
  https: boolean;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  canonicalSameSite: boolean;
  lang: string | null;
  headingCounts: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number };
  imageCount: number;
  imagesMissingAlt: number;
  internalLinks: number;
  jsonLdBlocks: number;
  jsonLdValidBlocks: number;
  jsonLdTypes: number;
  openGraph: { title: boolean; description: boolean; image: boolean };
  twitter: { card: boolean; title: boolean; description: boolean };
  viewport: boolean;
  charset: boolean;
}

const TITLE_MIN = 15;
const TITLE_MAX = 60;
const DESCRIPTION_MIN = 70;
const DESCRIPTION_MAX = 160;
const VALID_LANG = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i;

function weightOf(id: string): number {
  const entry = CHECK_WEIGHTS.find((check) => check.id === id);
  return entry ? entry.weight : 0;
}

function pointsFor(weight: number, status: CheckStatus): number {
  if (status === "pass") return weight;
  if (status === "warn") return Math.ceil(weight / 2);
  return 0;
}

function check(id: string, status: CheckStatus, message: string): ScoreCheck {
  const entry = CHECK_WEIGHTS.find((item) => item.id === id);
  const weight = entry ? entry.weight : 0;
  const label = entry ? entry.label : id;
  return { id, label, status, weight, points: pointsFor(weight, status), message };
}

/** Builds the per-check breakdown for a page. */
export function buildChecks(input: ScoreInput): ScoreCheck[] {
  const checks: ScoreCheck[] = [];

  checks.push(
    input.https
      ? check("https", "pass", "Page is served over HTTPS.")
      : check("https", "fail", "Page is served over plain HTTP, so browsers flag it as not secure."),
  );

  const title = input.title ? input.title.trim() : "";
  if (title.length === 0) {
    checks.push(check("title", "fail", "No title tag was found."));
  } else if (title.length < TITLE_MIN) {
    checks.push(check("title", "warn", "Title is " + title.length + " characters; aim for " + TITLE_MIN + "-" + TITLE_MAX + "."));
  } else if (title.length > TITLE_MAX) {
    checks.push(check("title", "warn", "Title is " + title.length + " characters; search results truncate around " + TITLE_MAX + "."));
  } else {
    checks.push(check("title", "pass", "Title is " + title.length + " characters, inside the " + TITLE_MIN + "-" + TITLE_MAX + " range."));
  }

  const description = input.metaDescription ? input.metaDescription.trim() : "";
  if (description.length === 0) {
    checks.push(check("meta-description", "fail", "No meta description was found."));
  } else if (description.length < DESCRIPTION_MIN) {
    checks.push(
      check("meta-description", "warn", "Meta description is " + description.length + " characters; aim for " + DESCRIPTION_MIN + "-" + DESCRIPTION_MAX + "."),
    );
  } else if (description.length > DESCRIPTION_MAX) {
    checks.push(
      check("meta-description", "warn", "Meta description is " + description.length + " characters; snippets truncate around " + DESCRIPTION_MAX + "."),
    );
  } else {
    checks.push(
      check("meta-description", "pass", "Meta description is " + description.length + " characters, inside the recommended range."),
    );
  }

  if (!input.canonical) {
    checks.push(check("canonical", "fail", "No canonical link element was found."));
  } else if (!input.canonicalSameSite) {
    checks.push(check("canonical", "warn", "Canonical is not an absolute same-site URL: " + input.canonical));
  } else {
    checks.push(check("canonical", "pass", "Canonical is set and stays on the same site."));
  }

  if (!input.lang) {
    checks.push(check("lang", "fail", "The <html> element has no lang attribute."));
  } else if (!VALID_LANG.test(input.lang)) {
    checks.push(check("lang", "warn", 'lang="' + input.lang + '" is not a standard language tag such as "en" or "en-GB".'));
  } else {
    checks.push(check("lang", "pass", 'lang="' + input.lang + '".'));
  }

  const h1 = input.headingCounts.h1;
  if (h1 === 0) {
    checks.push(check("h1", "fail", "The page has no H1 heading."));
  } else if (h1 > 1) {
    checks.push(check("h1", "warn", "The page has " + h1 + " H1 headings; one per page is the convention."));
  } else {
    checks.push(check("h1", "pass", "The page has exactly one H1."));
  }

  const totalHeadings =
    input.headingCounts.h1 +
    input.headingCounts.h2 +
    input.headingCounts.h3 +
    input.headingCounts.h4 +
    input.headingCounts.h5 +
    input.headingCounts.h6;
  if (totalHeadings === 0) {
    checks.push(check("headings", "fail", "The page has no headings at all."));
  } else if (input.headingCounts.h2 === 0) {
    checks.push(check("headings", "warn", "The page has no H2 headings, so sections are not outlined."));
  } else if (totalHeadings < 3) {
    checks.push(check("headings", "warn", "Only " + totalHeadings + " heading(s); longer pages usually need more structure."));
  } else {
    checks.push(check("headings", "pass", totalHeadings + " headings across " + headingDepth(input.headingCounts) + " levels."));
  }

  if (input.imageCount === 0) {
    checks.push(check("image-alt", "pass", "The page has no images, so there is nothing to describe."));
  } else if (input.imagesMissingAlt === 0) {
    checks.push(check("image-alt", "pass", "All " + input.imageCount + " images declare an alt attribute."));
  } else {
    const ratio = input.imagesMissingAlt / input.imageCount;
    const message = input.imagesMissingAlt + " of " + input.imageCount + " images have no alt attribute (" + Math.round(ratio * 100) + "%).";
    checks.push(check("image-alt", ratio <= 0.25 ? "warn" : "fail", message));
  }

  if (input.internalLinks >= 3) {
    checks.push(check("internal-links", "pass", input.internalLinks + " internal links were found."));
  } else if (input.internalLinks > 0) {
    checks.push(check("internal-links", "warn", "Only " + input.internalLinks + " internal link(s); more helps crawlers and users."));
  } else {
    checks.push(check("internal-links", "fail", "No internal links were found."));
  }

  if (input.jsonLdValidBlocks > 0 && input.jsonLdTypes > 0) {
    checks.push(check("structured-data", "pass", input.jsonLdValidBlocks + " valid JSON-LD block(s) with " + input.jsonLdTypes + " type(s)."));
  } else if (input.jsonLdBlocks > 0) {
    checks.push(check("structured-data", "warn", input.jsonLdBlocks + " JSON-LD block(s) found but none parsed into a usable type."));
  } else {
    checks.push(check("structured-data", "fail", "No JSON-LD structured data was found."));
  }

  const ogPresent = [input.openGraph.title, input.openGraph.description, input.openGraph.image].filter(Boolean).length;
  if (ogPresent === 3) {
    checks.push(check("open-graph", "pass", "og:title, og:description and og:image are all present."));
  } else if (ogPresent > 0) {
    checks.push(check("open-graph", "warn", "Only " + ogPresent + " of og:title, og:description and og:image are present."));
  } else {
    checks.push(check("open-graph", "fail", "No Open Graph tags were found."));
  }

  if (input.twitter.card && (input.twitter.title || input.twitter.description)) {
    checks.push(check("twitter-card", "pass", "Twitter card is declared with a title or description."));
  } else if (input.twitter.card) {
    checks.push(check("twitter-card", "warn", "twitter:card is set but there is no twitter:title or twitter:description."));
  } else {
    checks.push(check("twitter-card", "fail", "No twitter:card tag was found."));
  }

  checks.push(
    input.viewport
      ? check("viewport", "pass", "A viewport meta tag is present.")
      : check("viewport", "fail", "No viewport meta tag, so mobile browsers render a desktop layout."),
  );

  checks.push(
    input.charset ? check("charset", "pass", "The document declares a character encoding.") : check("charset", "fail", "No charset declaration was found."),
  );

  return checks;
}

function headingDepth(counts: ScoreInput["headingCounts"]): number {
  const levels = [counts.h1, counts.h2, counts.h3, counts.h4, counts.h5, counts.h6];
  return levels.filter((count) => count > 0).length;
}

export function gradeFor(score: number): ScoreResult["grade"] {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/** Sums the checks into the final 0-100 score. */
export function evaluateAudit(input: ScoreInput): ScoreResult {
  const checks = buildChecks(input);
  let value = 0;
  let passed = 0;
  let warned = 0;
  let failed = 0;
  for (const entry of checks) {
    value += entry.points;
    if (entry.status === "pass") passed += 1;
    else if (entry.status === "warn") warned += 1;
    else failed += 1;
  }
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return { value: clamped, grade: gradeFor(clamped), passed, warned, failed, checks };
}

/** Convenience for tests and docs: the weight of one check id. */
export function weightFor(id: string): number {
  return weightOf(id);
}
