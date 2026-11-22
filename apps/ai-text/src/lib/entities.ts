/**
 * Deterministic entity extraction.
 *
 * Every pattern is a hand written regular expression with a mandatory
 * validation step. There is no model and no network call: the same input always
 * produces the same output.
 *
 * Spans are [start, end) and use JavaScript string indices, i.e. UTF-16 code
 * units. Slicing the input with them always returns the reported value.
 *
 * Overlapping matches are resolved by type priority (a URL beats an email that
 * happens to sit inside it, a date beats a phone number that looks like a
 * date), then by start position, then by the longer match.
 */
export type EntityType =
  | "email"
  | "url"
  | "phone"
  | "date"
  | "money"
  | "percent"
  | "hashtag"
  | "mention"
  | "ipv4"
  | "iban"
  | "uuid";

export interface Entity {
  type: EntityType;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface EntityCounts {
  email: number;
  url: number;
  phone: number;
  date: number;
  money: number;
  percent: number;
  hashtag: number;
  mention: number;
  ipv4: number;
  iban: number;
  uuid: number;
}

export interface EntityResult {
  entities: Entity[];
  counts: EntityCounts;
  total: number;
  truncated: boolean;
}

/** Confidence assigned to each pattern, documented per type in the OpenAPI schema. */
const CONFIDENCE: Readonly<Record<EntityType, number>> = {
  email: 0.98,
  url: 0.96,
  phone: 0.6,
  date: 0.85,
  money: 0.9,
  percent: 0.97,
  hashtag: 0.95,
  mention: 0.93,
  ipv4: 0.97,
  iban: 0.9,
  uuid: 0.99,
};

const PRIORITY: Readonly<Record<EntityType, number>> = {
  url: 100,
  email: 96,
  uuid: 92,
  iban: 88,
  ipv4: 84,
  date: 76,
  percent: 70,
  money: 64,
  phone: 48,
  mention: 24,
  hashtag: 20,
};

export const MAX_ENTITIES = 200;
/** Per-type cap so a wall of URLs cannot crowd out emails or dates. */
export const MAX_ENTITIES_PER_TYPE = 50;
const MAX_CANDIDATES = 2000;

const MONTHS =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

const CURRENCY_CODES =
  "USD|EUR|GBP|INR|JPY|CNY|RMB|AUD|CAD|CHF|BRL|MXN|RUB|KRW|TRY|ZAR|SGD|HKD|NZD|SEK|NOK|DKK|PLN";

interface Extractor {
  type: EntityType;
  source: string;
  flags: string;
  validate?: (value: string) => boolean;
  clean?: (value: string) => string;
}

const EXTRACTORS: readonly Extractor[] = [
  {
    type: "url",
    source: "(?:https?:\\/\\/|www\\.)[^\\s<>\"']+",
    flags: "gi",
    clean: (value) => value.replace(/[.,;:!?'"]+$/, "").replace(/[)\]}]$/, ""),
    validate: (value) => {
      const withoutScheme = value.replace(/^https?:\/\//i, "");
      const host = withoutScheme.split(/[/?#]/)[0];
      return host.includes(".") && host.length > 3;
    },
  },
  {
    type: "email",
    source: "[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}",
    flags: "g",
    validate: (value) => {
      const at = value.lastIndexOf("@");
      const local = value.slice(0, at);
      const domain = value.slice(at + 1);
      if (!local || !domain) return false;
      if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
      if (!domain.includes(".") || domain.endsWith(".") || domain.includes("..")) return false;
      return domain.split(".").every((label) => label.length > 0 && label.length <= 63);
    },
  },
  {
    type: "uuid",
    source: "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
    flags: "g",
  },
  {
    type: "iban",
    source: "\\b[A-Z]{2}\\d{2}[A-Z0-9]{11,30}\\b",
    flags: "g",
    validate: (value) => isValidIban(value),
  },
  {
    type: "ipv4",
    source: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b",
    flags: "g",
    validate: (value) => value.split(".").every((part) => Number(part) <= 255),
  },
  {
    type: "date",
    source: "\\b\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])\\b",
    flags: "g",
  },
  {
    type: "date",
    source: "\\b(?:0?[1-9]|[12]\\d|3[01])[\\/.-](?:0?[1-9]|1[0-2])[\\/.-](?:\\d{4}|\\d{2})\\b",
    flags: "g",
  },
  {
    type: "date",
    source: "\\b" + MONTHS + "\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b",
    flags: "gi",
  },
  {
    type: "date",
    source: "\\b\\d{1,2}(?:st|nd|rd|th)?\\s+" + MONTHS + "\\.?,?\\s+\\d{4}\\b",
    flags: "gi",
  },
  {
    type: "date",
    source: "\\b" + MONTHS + "\\.?\\s+\\d{4}\\b",
    flags: "gi",
  },
  {
    type: "percent",
    source: "-?\\d+(?:[.,]\\d+)?\\s?(?:%|\\bpercent\\b|\\bper cent\\b)",
    flags: "gi",
  },
  {
    type: "money",
    source: "(?:US\\$|[$\\u20AC\\u00A3\\u00A5\\u20B9\\u20BD\\u20A9\\u20AA]|\\b(?:" + CURRENCY_CODES + ")\\b)\\s?-?\\d[\\d,]*(?:\\.\\d+)?(?:\\s?(?:[kKmMbB]n?|million|billion|trillion)\\b)?",
    flags: "g",
    validate: (value) => /\d/.test(value) && value.replace(/\D/g, "").length > 0,
  },
  {
    type: "money",
    source: "\\b\\d[\\d,]*(?:\\.\\d+)?\\s?(?:" + CURRENCY_CODES + "|dollars?|euros?|pounds?|rupees?|yen|yuan|cents?)\\b",
    flags: "gi",
  },
  {
    type: "phone",
    source:
      "(?:\\+\\d{1,3}[\\s.-]?(?:\\(\\d{1,5}\\)[\\s.-]?)?\\d(?:[\\d\\s.-]{3,13}\\d))|(?:\\(\\d{3}\\)[\\s.-]?\\d{3}[\\s.-]?\\d{4})|(?:\\b\\d{3}[\\s.-]\\d{3}[\\s.-]\\d{4}\\b)",
    flags: "g",
    validate: (value) => {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) return false;
      if (!/[+\s.()-]/.test(value)) return false;
      return !/^\d{4}-\d{1,2}-\d{1,2}$/.test(value);
    },
  },
  {
    type: "mention",
    source: "@[A-Za-z0-9_]{2,30}\\b",
    flags: "g",
  },
  {
    type: "hashtag",
    source: "#[\\p{L}\\p{N}_]{2,50}",
    flags: "gu",
  },
];

/** ISO 13616 mod-97 checksum. A checksum failure rejects the IBAN candidate. */
export function isValidIban(value: string): boolean {
  if (value.length < 15 || value.length > 34) return false;
  const rearranged = value.slice(4) + value.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const code = character.charCodeAt(0);
    const expanded = code >= 65 && code <= 90 ? String(code - 55) : character;
    for (const digit of expanded) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

function emptyCounts(): EntityCounts {
  return { email: 0, url: 0, phone: 0, date: 0, money: 0, percent: 0, hashtag: 0, mention: 0, ipv4: 0, iban: 0, uuid: 0 };
}

export function extractEntities(text: string): EntityResult {
  const candidates: Entity[] = [];
  let truncated = false;

  for (const extractor of EXTRACTORS) {
    if (candidates.length >= MAX_CANDIDATES) {
      truncated = true;
      break;
    }
    const pattern = new RegExp(extractor.source, extractor.flags);
    let match: RegExpExecArray | null = pattern.exec(text);
    while (match !== null && candidates.length < MAX_CANDIDATES) {
      const raw = match[0];
      const value = extractor.clean ? extractor.clean(raw) : raw;
      if (value.length > 0 && (!extractor.validate || extractor.validate(value))) {
        candidates.push({
          type: extractor.type,
          value,
          start: match.index,
          end: match.index + value.length,
          confidence: CONFIDENCE[extractor.type],
        });
      }
      match = pattern.exec(text);
    }
  }

  candidates.sort(
    (a, b) =>
      PRIORITY[b.type] - PRIORITY[a.type] ||
      a.start - b.start ||
      b.end - b.start - (a.end - a.start),
  );

  const accepted: Entity[] = [];
  const acceptedPerType: Partial<Record<EntityType, number>> = {};
  for (const candidate of candidates) {
    if (accepted.length >= MAX_ENTITIES) {
      truncated = true;
      break;
    }
    if ((acceptedPerType[candidate.type] ?? 0) >= MAX_ENTITIES_PER_TYPE) {
      truncated = true;
      continue;
    }
    const overlaps = accepted.some((entity) => candidate.start < entity.end && entity.start < candidate.end);
    if (overlaps) continue;
    acceptedPerType[candidate.type] = (acceptedPerType[candidate.type] ?? 0) + 1;
    accepted.push(candidate);
  }

  accepted.sort((a, b) => a.start - b.start || a.end - b.end);

  const counts = emptyCounts();
  for (const entity of accepted) counts[entity.type] += 1;

  return { entities: accepted, counts, total: accepted.length, truncated };
}
