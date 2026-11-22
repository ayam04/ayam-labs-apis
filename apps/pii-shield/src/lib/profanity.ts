/**
 * Profanity / toxicity screening with a hand written lexicon and obfuscation
 * recovery (leetspeak, repeated letters, punctuation separators).
 *
 * The lexicon intentionally contains ordinary profanity, sexual and promotional
 * spam vocabulary only. No racial, ethnic or homophobic slurs are shipped, so the
 * API cannot echo them back to a caller.
 */
import { MAX_PROFANITY_OUTPUT } from "./limits";

export const PROFANITY_LANGS = ["en", "es", "fr", "de"] as const;
export type ProfanityLang = (typeof PROFANITY_LANGS)[number];

export const SEVERITIES = ["low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const TERM_CATEGORIES = ["profanity", "sexual", "promotional"] as const;
export type TermCategory = (typeof TERM_CATEGORIES)[number];

interface TermEntry {
  term: string;
  severity: Severity;
  category: TermCategory;
  lang: ProfanityLang;
}

type TermTuple = readonly [term: string, severity: Severity, category: TermCategory];

const LEXICON_SOURCE: Record<ProfanityLang, readonly TermTuple[]> = {
  en: [
    ["damn", "low", "profanity"],
    ["dammit", "low", "profanity"],
    ["goddamn", "medium", "profanity"],
    ["hell", "low", "profanity"],
    ["crap", "low", "profanity"],
    ["crappy", "low", "profanity"],
    ["suck", "low", "profanity"],
    ["sucks", "low", "profanity"],
    ["idiot", "low", "profanity"],
    ["idiotic", "low", "profanity"],
    ["moron", "low", "profanity"],
    ["jerk", "low", "profanity"],
    ["twit", "low", "profanity"],
    ["wtf", "low", "profanity"],
    ["shit", "medium", "profanity"],
    ["shitty", "medium", "profanity"],
    ["bullshit", "medium", "profanity"],
    ["bitch", "medium", "profanity"],
    ["bitching", "medium", "profanity"],
    ["bastard", "medium", "profanity"],
    ["ass", "medium", "profanity"],
    ["asses", "medium", "profanity"],
    ["asshole", "medium", "profanity"],
    ["arse", "medium", "profanity"],
    ["arsehole", "medium", "profanity"],
    ["dick", "medium", "profanity"],
    ["dickhead", "medium", "profanity"],
    ["piss", "medium", "profanity"],
    ["pissed", "medium", "profanity"],
    ["prick", "medium", "profanity"],
    ["wanker", "medium", "profanity"],
    ["bollocks", "medium", "profanity"],
    ["twat", "medium", "profanity"],
    ["douche", "medium", "profanity"],
    ["douchebag", "medium", "profanity"],
    ["jackass", "medium", "profanity"],
    ["dumbass", "medium", "profanity"],
    ["asswipe", "medium", "profanity"],
    ["shitshow", "medium", "profanity"],
    ["fuck", "high", "profanity"],
    ["fucked", "high", "profanity"],
    ["fucking", "high", "profanity"],
    ["fucker", "high", "profanity"],
    ["fuckers", "high", "profanity"],
    ["fuckface", "high", "profanity"],
    ["fuckwit", "high", "profanity"],
    ["motherfucker", "high", "profanity"],
    ["clusterfuck", "high", "profanity"],
    ["cunt", "high", "profanity"],
    ["cocksucker", "high", "profanity"],
    ["prickface", "high", "profanity"],
    ["porn", "medium", "sexual"],
    ["porno", "medium", "sexual"],
    ["pornography", "medium", "sexual"],
    ["nsfw", "low", "sexual"],
    ["nude", "low", "sexual"],
    ["nudes", "low", "sexual"],
    ["nudity", "low", "sexual"],
    ["xxx", "medium", "sexual"],
    ["hentai", "medium", "sexual"],
    ["blowjob", "high", "sexual"],
    ["handjob", "high", "sexual"],
    ["dildo", "medium", "sexual"],
    ["vibrator", "low", "sexual"],
    ["orgy", "medium", "sexual"],
    ["threesome", "medium", "sexual"],
    ["escort", "low", "sexual"],
    ["camgirl", "medium", "sexual"],
    ["onlyfans", "medium", "sexual"],
    ["milf", "medium", "sexual"],
    ["cumshot", "high", "sexual"],
    ["viagra", "low", "promotional"],
    ["cialis", "low", "promotional"],
    ["levitra", "low", "promotional"],
    ["casino", "low", "promotional"],
    ["betting", "low", "promotional"],
    ["jackpot", "low", "promotional"],
  ],
  es: [
    ["mierda", "medium", "profanity"],
    ["mierdas", "medium", "profanity"],
    ["joder", "medium", "profanity"],
    ["jodete", "medium", "profanity"],
    ["jodido", "medium", "profanity"],
    ["coño", "medium", "profanity"],
    ["cojones", "medium", "profanity"],
    ["cabron", "medium", "profanity"],
    ["cabrón", "medium", "profanity"],
    ["gilipollas", "medium", "profanity"],
    ["hostia", "medium", "profanity"],
    ["pendejo", "medium", "profanity"],
    ["pendeja", "medium", "profanity"],
    ["verga", "medium", "profanity"],
    ["chingar", "medium", "profanity"],
    ["chingada", "high", "profanity"],
    ["chingado", "high", "profanity"],
    ["culero", "medium", "profanity"],
    ["polla", "high", "profanity"],
    ["follar", "high", "profanity"],
    ["puta", "high", "profanity"],
    ["puto", "high", "profanity"],
    ["putas", "high", "profanity"],
    ["putos", "high", "profanity"],
    ["porno", "medium", "sexual"],
    ["tetas", "low", "sexual"],
    ["desnudo", "low", "sexual"],
    ["desnuda", "low", "sexual"],
    ["viagra", "low", "promotional"],
    ["casino", "low", "promotional"],
  ],
  fr: [
    ["merde", "medium", "profanity"],
    ["putain", "medium", "profanity"],
    ["bordel", "low", "profanity"],
    ["connard", "high", "profanity"],
    ["connasse", "high", "profanity"],
    ["salope", "high", "profanity"],
    ["enculé", "high", "profanity"],
    ["encule", "high", "profanity"],
    ["enculer", "high", "profanity"],
    ["enculé", "high", "profanity"],
    ["foutre", "medium", "profanity"],
    ["foutu", "medium", "profanity"],
    ["chier", "medium", "profanity"],
    ["chiant", "low", "profanity"],
    ["nique", "high", "profanity"],
    ["niquer", "high", "profanity"],
    ["branleur", "medium", "profanity"],
    ["couille", "medium", "profanity"],
    ["couilles", "medium", "profanity"],
    ["bite", "high", "profanity"],
    ["pute", "high", "profanity"],
    ["putes", "high", "profanity"],
    ["porno", "medium", "sexual"],
    ["nichon", "low", "sexual"],
    ["nu", "low", "sexual"],
    ["viagra", "low", "promotional"],
    ["casino", "low", "promotional"],
  ],
  de: [
    ["scheiße", "medium", "profanity"],
    ["scheisse", "medium", "profanity"],
    ["scheiss", "medium", "profanity"],
    ["kacke", "low", "profanity"],
    ["verdammt", "low", "profanity"],
    ["mist", "low", "profanity"],
    ["dummkopf", "low", "profanity"],
    ["blödmann", "low", "profanity"],
    ["arsch", "medium", "profanity"],
    ["arschloch", "high", "profanity"],
    ["fick", "high", "profanity"],
    ["ficken", "high", "profanity"],
    ["gefickt", "high", "profanity"],
    ["hure", "high", "profanity"],
    ["wichser", "high", "profanity"],
    ["fotze", "high", "profanity"],
    ["schwanz", "medium", "profanity"],
    ["verpiss", "medium", "profanity"],
    ["porno", "medium", "sexual"],
    ["nackt", "low", "sexual"],
    ["viagra", "low", "promotional"],
    ["casino", "low", "promotional"],
  ],
};

/* --------------------------------------------------------- normalisation */

const ACCENT_FOLD: Record<string, string> = {
  ß: "ss",
  ø: "o",
  æ: "ae",
  œ: "oe",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
};

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  $: "s",
  "!": "i",
  "|": "i",
};

/** Lowercase, strip combining accents and apply the leetspeak map. */
export function normalizeWord(raw: string): string {
  let folded = "";
  const lowered = raw.toLowerCase();
  for (const char of lowered) {
    if (ACCENT_FOLD[char] !== undefined) {
      folded += ACCENT_FOLD[char];
      continue;
    }
    folded += char.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  let out = "";
  for (const char of folded) out += LEET[char] ?? char;
  return out;
}

/** Collapse runs of the same character longer than \`minRun\` down to one. */
export function squeezeRuns(value: string, minRun: number): string {
  if (minRun <= 1) return value;
  let out = "";
  let index = 0;
  while (index < value.length) {
    const char = value[index];
    let run = 1;
    while (index + run < value.length && value[index + run] === char) run++;
    out += run >= minRun ? char : value.slice(index, index + run);
    index += run;
  }
  return out;
}

const SUFFIXES = ["ers", "ing", "ies", "ed", "es", "er", "in", "s", "y"];
const COMPOUND_PREFIXES = ["mother", "bull", "cluster", "super", "mega"];
const COMPOUND_TAILS = ["head", "face", "wit", "tard", "stick", "hole", "bag", "show"];
const MIN_STEM = 3;

interface Dictionary {
  lang: ProfanityLang;
  entries: Map<string, TermEntry>;
  /** Longest key length, used to skip hopeless tokens early. */
  maxLength: number;
}

function buildDictionary(lang: ProfanityLang): Dictionary {
  const entries = new Map<string, TermEntry>();
  for (const [term, severity, category] of LEXICON_SOURCE[lang]) {
    const key = normalizeWord(term);
    if (!key) continue;
    if (!entries.has(key)) entries.set(key, { term: key, severity, category, lang });
  }
  let maxLength = 0;
  for (const key of entries.keys()) maxLength = Math.max(maxLength, key.length);
  return { lang, entries, maxLength };
}

const DICTIONARIES: Record<ProfanityLang, Dictionary> = {
  en: buildDictionary("en"),
  es: buildDictionary("es"),
  fr: buildDictionary("fr"),
  de: buildDictionary("de"),
};

function lookupExact(dictionary: Dictionary, form: string): TermEntry | null {
  return dictionary.entries.get(form) ?? null;
}

function lookupWithStems(dictionary: Dictionary, form: string): TermEntry | null {
  const direct = lookupExact(dictionary, form);
  if (direct) return direct;
  for (const suffix of SUFFIXES) {
    if (!form.endsWith(suffix)) continue;
    const stem = form.slice(0, form.length - suffix.length);
    if (stem.length < MIN_STEM) continue;
    const hit = lookupExact(dictionary, stem);
    if (hit) return hit;
  }
  for (const tail of COMPOUND_TAILS) {
    if (!form.endsWith(tail)) continue;
    const stem = form.slice(0, form.length - tail.length);
    if (stem.length < MIN_STEM) continue;
    const hit = lookupExact(dictionary, stem);
    if (hit) return hit;
  }
  return null;
}

function matchToken(dictionary: Dictionary, token: string): TermEntry | null {
  const base = normalizeWord(token);
  if (base.length === 0) return null;
  const forms = [base];
  const squeezed3 = squeezeRuns(base, 3);
  const squeezed2 = squeezeRuns(base, 2);
  if (squeezed3 !== base) forms.push(squeezed3);
  if (squeezed2 !== base && !forms.includes(squeezed2)) forms.push(squeezed2);

  for (const form of forms) {
    if (form.length > dictionary.maxLength + 6) {
      // still allow compound prefixes such as mother + fucker
      for (const prefix of COMPOUND_PREFIXES) {
        if (!form.startsWith(prefix)) continue;
        const rest = form.slice(prefix.length);
        const hit = lookupWithStems(dictionary, rest);
        if (hit) return hit;
      }
      continue;
    }
    const hit = lookupWithStems(dictionary, form);
    if (hit) return hit;
    for (const prefix of COMPOUND_PREFIXES) {
      if (!form.startsWith(prefix)) continue;
      const rest = form.slice(prefix.length);
      if (rest.length < MIN_STEM) continue;
      const prefixed = lookupWithStems(dictionary, rest);
      if (prefixed) return prefixed;
    }
  }
  return null;
}

/* -------------------------------------------------------------- scanning */

export interface ProfanityMatch {
  term: string;
  matched: string;
  start: number;
  end: number;
  severity: Severity;
  category: TermCategory;
  lang: ProfanityLang;
  masked: string;
  snippet: string;
  obfuscated: boolean;
}

export interface ProfanityCounts {
  low: number;
  medium: number;
  high: number;
}

export interface ProfanityResult {
  isProfane: boolean;
  score: number;
  highestSeverity: Severity | null;
  counts: ProfanityCounts;
  matches: ProfanityMatch[];
  languages: ProfanityLang[];
  truncated: boolean;
}

const SEVERITY_POINTS: Record<Severity, number> = { low: 10, medium: 25, high: 50 };
const SEVERITY_RANK: Record<Severity, number> = { low: 1, medium: 2, high: 3 };

const TOKEN_RE = /[\p{L}\p{N}@$!|]+/gu;
/**
 * Single character separator runs such as "f.u.c.k". The pattern only needs one
 * alternative per character, which keeps the scan linear on large inputs.
 */
const SPACED_RE = /(?<![0-9A-Za-z\u00c0-\u024f])(?:[0-9A-Za-z\u00c0-\u024f][.\-_*~'\u200b]){2,}[0-9A-Za-z\u00c0-\u024f]*/g;

function maskTerm(value: string): string {
  if (value.length <= 1) return "*".repeat(value.length);
  return value[0] + "*".repeat(value.length - 1);
}

function buildSnippet(text: string, start: number, end: number, masked: string): string {
  const from = Math.max(0, start - 25);
  const to = Math.min(text.length, end + 25);
  const prefix = text.slice(from, start).replace(/\s+/g, " ");
  const suffix = text.slice(end, to).replace(/\s+/g, " ");
  return (from > 0 ? "..." : "") + prefix + masked + suffix + (to < text.length ? "..." : "");
}

function toMatch(
  text: string,
  start: number,
  end: number,
  entry: TermEntry,
  obfuscated: boolean,
): ProfanityMatch {
  const matched = text.slice(start, end);
  const masked = maskTerm(matched);
  return {
    term: entry.term,
    matched,
    start,
    end,
    severity: entry.severity,
    category: entry.category,
    lang: entry.lang,
    masked,
    snippet: buildSnippet(text, start, end, masked),
    obfuscated,
  };
}

/** Screen text against the lexicon of every requested language. */
export function checkProfanity(text: string, langs: readonly ProfanityLang[] = ["en"]): ProfanityResult {
  const requested = langs.length > 0 ? langs : (["en"] as const);
  const dictionaries = requested.map((lang) => DICTIONARIES[lang]).filter(Boolean);

  const found: ProfanityMatch[] = [];
  const seen = new Set<string>();
  const cache = new Map<string, TermEntry | null>();
  let maxLexiconLength = 0;
  for (const dictionary of dictionaries) maxLexiconLength = Math.max(maxLexiconLength, dictionary.maxLength);

  for (const match of text.matchAll(TOKEN_RE)) {
    const raw = match[0];
    const trimmed = raw.replace(/^[!|]+/, "").replace(/[!|]+$/, "");
    if (trimmed.length < 3) continue;
    // Compound prefixes and suffixes add at most a handful of characters.
    if (trimmed.length > maxLexiconLength + 12) continue;

    let entry = cache.get(trimmed);
    if (entry === undefined) {
      entry = null;
      for (const dictionary of dictionaries) {
        const hit = matchToken(dictionary, trimmed);
        if (hit) {
          entry = hit;
          break;
        }
      }
      cache.set(trimmed, entry);
    }
    if (!entry) continue;

    const start = raw.startsWith(trimmed) ? match.index : match.index + (raw.length - trimmed.length);
    const end = start + trimmed.length;
    const key = start + ":" + end;
    if (seen.has(key)) continue;
    seen.add(key);
    const obfuscated = normalizeWord(trimmed) !== trimmed.toLowerCase();
    found.push(toMatch(text, start, end, entry, obfuscated));
  }

  // Obfuscation recovery for values split by single punctuation characters: f.u.c.k
  for (const match of text.matchAll(SPACED_RE)) {
    const raw = match[0].replace(/[.\-_*~'\u200b]+$/, "");
    const separators = (raw.match(/[.\-_*~'\u200b]/g) ?? []).length;
    if (separators < 2) continue;
    const joined = raw.replace(/[^0-9A-Za-z\u00c0-\u024f]+/g, "");
    if (joined.length < 4) continue;
    const normalized = squeezeRuns(normalizeWord(joined), 3);
    for (const dictionary of dictionaries) {
      const entry = lookupExact(dictionary, normalized);
      if (!entry) continue;
      const start = match.index;
      const end = start + raw.length;
      const key = start + ":" + end;
      if (seen.has(key)) continue;
      const overlapsExisting = found.some((existing) => start < existing.end && existing.start < end);
      if (overlapsExisting) break;
      seen.add(key);
      found.push(toMatch(text, start, end, entry, true));
      break;
    }
  }

  found.sort((a, b) => a.start - b.start || a.end - b.end);
  const truncated = found.length > MAX_PROFANITY_OUTPUT;
  const matches = truncated ? found.slice(0, MAX_PROFANITY_OUTPUT) : found;

  const counts: ProfanityCounts = { low: 0, medium: 0, high: 0 };
  let score = 0;
  let highest: Severity | null = null;
  for (const match of matches) {
    counts[match.severity] += 1;
    score += SEVERITY_POINTS[match.severity];
    if (highest === null || SEVERITY_RANK[match.severity] > SEVERITY_RANK[highest]) highest = match.severity;
  }

  return {
    isProfane: matches.length > 0,
    score: Math.min(100, score),
    highestSeverity: highest,
    counts,
    matches,
    languages: [...requested],
    truncated,
  };
}

/** Exposure for tests and diagnostics: the normalised lexicon of one language. */
export function lexiconTerms(lang: ProfanityLang): string[] {
  return [...DICTIONARIES[lang].entries.keys()].sort();
}
