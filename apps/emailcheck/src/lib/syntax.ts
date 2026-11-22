const LOCAL_PATTERN = /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/i;
const DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export interface SyntaxResult {
  valid: boolean;
  email: string;
  localPart: string | null;
  domain: string | null;
  normalized: string | null;
  canonical: string | null;
  problems: string[];
  didYouMean: string | null;
}

/** Popular consumer domains used for the "did you mean" suggestion. */
const POPULAR_DOMAINS = [
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "yahoo.co.uk", "ymail.com", "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com", "pm.me", "aol.com", "zoho.com", "gmx.com",
  "gmx.de", "mail.com", "yandex.com", "yandex.ru", "qq.com", "163.com", "126.com",
  "hey.com", "fastmail.com", "tutanota.com", "web.de", "naver.com",
];

/** Explicit misspellings that Levenshtein would not always catch first. */
const KNOWN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gamil.com": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yhaoo.com": "yahoo.com",
  "outlok.com": "outlook.com",
  "outllook.com": "outlook.com",
  "outlook.co": "outlook.com",
  "icloud.co": "icloud.com",
  "iclod.com": "icloud.com",
  "protonmai.com": "protonmail.com",
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = new Array<number>(cols);
  let current = new Array<number>(cols);
  for (let j = 0; j < cols; j++) previous[j] = j;
  for (let i = 1; i < rows; i++) {
    current[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + cost;
      current[j] = Math.min(deletion, insertion, substitution);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[cols - 1] ?? 0;
}

/** Returns the corrected domain when the input is one or two edits from a popular provider. */
export function suggestDomain(domain: string): string | null {
  const lower = domain.toLowerCase();
  const direct = KNOWN_TYPOS[lower];
  if (direct) return direct;
  // Never "correct" a domain that is already a known-good provider.
  if (POPULAR_DOMAINS.includes(lower)) return null;
  const tld = lower.split(".").pop() ?? "";
  let best: { candidate: string; distance: number } | null = null;
  for (const candidate of POPULAR_DOMAINS) {
    const candidateTld = candidate.split(".").pop() ?? "";
    if (candidateTld !== tld) continue;
    if (Math.abs(lower.length - candidate.length) > 2) continue;
    const distance = levenshtein(lower, candidate);
    if (distance === 0 || distance > 2) continue;
    if (!best || distance < best.distance) best = { candidate, distance };
  }
  return best?.candidate ?? null;
}

/** Converts an internationalised domain to punycode without throwing. */
function toAsciiDomain(domain: string): string {
  if (/^[ -~]+$/.test(domain)) return domain.toLowerCase();
  try {
    return new URL(`http://${domain}`).hostname.toLowerCase();
  } catch {
    return domain.toLowerCase();
  }
}

export function checkSyntax(rawInput: string): SyntaxResult {
  const trimmed = String(rawInput ?? "").trim();
  const problems: string[] = [];
  const result: SyntaxResult = {
    valid: false,
    email: trimmed,
    localPart: null,
    domain: null,
    normalized: null,
    canonical: null,
    problems,
    didYouMean: null,
  };

  if (!trimmed) {
    problems.push("Email address is empty");
    return result;
  }
  if (trimmed.length > 320) {
    problems.push("Email address exceeds 320 characters");
    return result;
  }
  if (trimmed.includes(" ")) {
    problems.push("Email address contains whitespace");
    return result;
  }
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at !== trimmed.indexOf("@")) {
    problems.push(at <= 0 ? "Missing local part before @" : "Multiple @ symbols");
    return result;
  }
  const local = trimmed.slice(0, at);
  const rawDomain = trimmed.slice(at + 1);
  if (!rawDomain) {
    problems.push("Missing domain after @");
    return result;
  }
  const domain = toAsciiDomain(rawDomain);
  if (local.length > 64) problems.push("Local part exceeds 64 characters");
  if (domain.length > 255) problems.push("Domain exceeds 255 characters");
  if (trimmed.length > 254) problems.push("Email address exceeds 254 characters");
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    problems.push("Local part has misplaced or consecutive dots");
  }
  if (!LOCAL_PATTERN.test(local)) {
    problems.push("Local part contains invalid characters");
  }
  const labels = domain.split(".");
  if (labels.length < 2) problems.push("Domain must contain a dot and a TLD");
  for (const label of labels) {
    if (!DOMAIN_LABEL.test(label)) problems.push(`Invalid domain label: "${label}"`);
  }
  const tld = labels[labels.length - 1] ?? "";
  if (!/^[a-z]{2,63}$/.test(tld) && !tld.startsWith("xn--")) {
    problems.push(`Invalid top level domain: "${tld}"`);
  }

  result.localPart = local;
  result.domain = domain;
  if (problems.length > 0) return result;

  result.valid = true;
  result.normalized = `${local}@${domain}`;
  const suggestion = suggestDomain(domain);
  if (suggestion && suggestion !== domain) {
    result.didYouMean = `${local}@${suggestion}`;
  }
  // Gmail ignores dots and everything after a "+" in the local part.
  const dotless = domain === "gmail.com" || domain === "googlemail.com";
  const baseLocal = dotless ? local.split("+")[0]?.replace(/\./g, "") ?? local : local.split("+")[0] ?? local;
  result.canonical = `${baseLocal}@${domain}`;
  return result;
}

/** Heuristic for gibberish / machine generated local parts. */
export function looksRandom(localPart: string): boolean {
  const local = localPart.split("+")[0] ?? localPart;
  if (local.length < 10) return false;
  const unique = new Set(local.toLowerCase()).size;
  const digits = (local.match(/\d/g) ?? []).length;
  const hasVowel = /[aeiou]/i.test(local);
  const entropyRatio = unique / local.length;
  const digitRatio = digits / local.length;
  return (!hasVowel && local.length >= 10) || (entropyRatio > 0.62 && digitRatio > 0.2 && local.length >= 16);
}
