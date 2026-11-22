/**
 * PII scanning: pattern + checksum detection, overlap resolution and risk scoring.
 * Everything here is pure and synchronous so it can be unit tested in node and
 * runs unchanged in workerd.
 */
import {
  base58Check,
  cardBrand,
  datePlausible,
  digitsOnly,
  hasContext,
  highEntropyToken,
  ibanCheck,
  ipv4Valid,
  ipv6Valid,
  luhnValid,
  ssnValid,
  urlValid,
} from "./validators";
import { DETECTOR_BY_ID, PII_TYPES, type PiiType } from "./detectors";
import { MAX_FINDING_VALUE_CHARS, MAX_FINDINGS_OUTPUT } from "./limits";

export interface Finding {
  type: PiiType;
  value: string;
  start: number;
  end: number;
  confidence: number;
  validator?: string;
  detail?: string;
  valueTruncated?: boolean;
}

export interface Span {
  start: number;
  end: number;
  length: number;
  types: PiiType[];
}

export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface RiskSummary {
  level: RiskLevel;
  score: number;
  detectedTypes: PiiType[];
}

export interface ScanOptions {
  types?: readonly PiiType[];
  minConfidence?: number;
}

export interface ScanResult {
  findings: Finding[];
  counts: Record<string, number>;
  spans: Span[];
  risk: RiskSummary;
  truncated: boolean;
  textLength: number;
}

const MAX_CANDIDATES = 20000;

type Candidate = Omit<Finding, "valueTruncated">;

const ALL_TYPES: readonly PiiType[] = PII_TYPES;

/* ------------------------------------------------------------------ helpers */

function each(text: string, pattern: RegExp, visit: (match: RegExpExecArray) => void): void {
  const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
  const regex = new RegExp(pattern.source, flags);
  let match: RegExpExecArray | null;
  let guard = 0;
  while ((match = regex.exec(text)) !== null) {
    visit(match);
    if (match.index === regex.lastIndex) regex.lastIndex += 1;
    if (++guard > MAX_CANDIDATES) break;
  }
}

const EMAIL_RE =
  /(?<![\w.%+\-])[A-Za-z0-9!#$%&'*+/=?^_\x60{|}~.\-]{1,64}@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}(?![\w\-])/g;
const URL_RE = /(?<![\w@])(?:https?:\/\/|www\.)[^\s<>"'\x60{}|\\^\[\]]{2,2048}/gi;
const PHONE_INTL_RE = /(?<![\w.])\+\d{1,3}(?:[ .\-]?\(?\d{1,4}\)?){2,6}(?![\w])/g;
const PHONE_PARENS_RE = /(?<![\w.])\(\d{2,4}\)[ .\-]?\d{3,4}[ .\-]?\d{3,4}(?![\w])/g;
const PHONE_SEP_RE = /(?<![\w.])\d{2,4}[ .\-]\d{2,4}[ .\-]\d{2,4}(?:[ .\-]\d{1,4})?(?!\w)(?!\.\d)/g;
const CARD_RE = /(?<![\w.\-])(?:\d[ \-]?){12,18}\d(?![\w])/g;
const IBAN_RE = /(?<![\w])[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?(?![\w])/g;
const SSN_RE = /(?<![\w\-])\d{3}-\d{2}-\d{4}(?![\w\-])/g;
const IPV4_RE = /(?<![\w.])(?:\d{1,3}\.){3}\d{1,3}(?![\w.])/g;
const IPV6_RE = /(?<![\w:.%])(?:[0-9A-Fa-f]{0,4}:){2,7}[0-9A-Fa-f]{0,4}(?![\w:.])/g;
const MAC_RE = /(?<![\w:])(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}(?![\w:])/g;
const DOB_ISO_RE = /(?<![\w\-])(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?![\w\-])/g;
const DOB_NUMERIC_RE = /(?<![\w/\-.])(?:0?[1-9]|[12]\d|3[01])[/.\-](?:0?[1-9]|1[0-2])[/.\-](?:19|20)\d{2}(?![\w/\-.])/g;
const DOB_MONTH_RE =
  /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?[ ]+\d{1,2}(?:st|nd|rd|th)?,?[ ]+(?:19|20)\d{2}\b/g;
const PASSPORT_RE =
  /\b(?:passport|pass(?:port)?[ ]*(?:no|number|#)|passeport|reisepass|pasaporte)[\s:.#\-]{0,8}([A-Za-z0-9]{6,12})(?![A-Za-z0-9])/gi;
const LICENSE_RE =
  /\b(?:driver'?s?[ ]*licen[cs]e|driving[ ]*licen[cs]e|licen[cs]e[ ]*(?:no|number|#)|dl[ ]*(?:no|number|#))[\s:.#\-]{0,8}([A-Z0-9][A-Z0-9\-]{4,13})(?![A-Za-z0-9])/gi;
const ADDRESS_RE =
  /(?<![\w])\d{1,6}[ \t]+[A-Za-z][A-Za-z'.\- ]{1,40}?\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|place|pl|terrace|ter|highway|hwy|parkway|pkwy|circle|cir|square|sq)\b\.?(?:[ \t]+(?:n|s|e|w|ne|nw|se|sw)\b)?(?:,[ ]*[A-Z][A-Za-z.\- ]{1,30})?(?:[ \t]*(?:apt|apartment|suite|ste|unit|fl|floor)\.?[ \t]*[A-Za-z0-9\-]{1,6})?/gi;
const TITLE_NAME_RE =
  /\b(?:Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Sr|Sra|Herr|Frau|Monsieur|Madame)\.?[ ]+([A-Z][a-z]{1,20})(?:[ ]+([A-Z][a-z'\-]{1,24}))?/g;
const CAP_WORD_RE = /\b[A-Z][a-z][a-z'\-]{0,23}\b/g;
const API_KEY_RE = /(?<![\w+\/=])([A-Za-z0-9_\-+\/]{32,200})(?![\w+\/=])/g;
const JWT_RE =
  /(?<![\w.\-])eyJ[A-Za-z0-9_-]{4,2000}\.[A-Za-z0-9_-]{4,2000}(?:\.[A-Za-z0-9_-]{0,2000})?(?![\w\-])/g;
const ETH_RE = /(?<![\w])(0x[a-fA-F0-9]{40})(?![\w])/g;
const BTC_RE = /(?<![\w])[13][a-km-zA-HJ-NP-Z1-9]{25,34}(?![\w])/g;
const BECH32_RE = /(?<![\w])(bc1[a-z0-9]{25,62})(?![\w])/g;
const GITHUB_RE = /(?<![\w])(gh[pousr]_[A-Za-z0-9]{36,255})(?![\w])/g;
const AWS_RE = /(?<![\w])(AKIA[0-9A-Z]{16})(?![\w])/g;

const BIRTH_KEYWORDS = ["date of birth", "dob", "d.o.b", "born", "birth", "birthday", "bday"];

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Common given names used by the PERSON_NAME heuristic. Lowercase. */
const FIRST_NAMES = new Set(
  (
    "aaron abdul abigail adam adrian ahmed aisha alan albert alexander alexis alice alicia ali amanda amber amelia amy ana andre andrea andrew angela anna anthony antonio arjun arthur ashley austin barbara beatrix benjamin bernard beverly billy blake bobby bradley brandon brenda brian brittany bruce bryan caleb camila carl carlos carmen carol caroline carolyn catherine charles charlotte cheryl chloe christian christina christine christopher clara claude cody colin connor craig cynthia daniel danielle david dean deborah debra denise dennis derek diana diane diego dmitri dolores donald donna doris dorothy douglas dylan edward elena elijah elizabeth ella ellen emily emma eric erica erik esther ethan eugene eva evan evelyn fatima felix fernando frances francis francisco frank frederick gabriel gary george gerald giulia gloria grace gregory gustav hannah hans harold harry heather helen henry hiroshi holly hugo ian isaac isabel ivan jack jacob jacqueline james jan jane janet janice jason jean jeffrey jennifer jeremy jerry jesse jessica joan joe joel johannes john johnny jonathan jordan jose joseph joshua joyce juan judith judy julia julian julie justin karen katherine kathleen kathryn kayla keith kelly kenneth kevin kimberly klaus kristen kyle lauren lawrence laura leah leo leonard linda mario maria marilyn mark martha martin marvin mary mateo matthew maureen max maxwell megan melissa michelle miguel mike miriam molly monica muhammad nancy natalie nathan nicholas nicole noah noel olga olivia omar oscar pamela patricia patrick paul pedro peter philip pierre priya rachel ralph randy ray raymond rebecca regina richard rita robert roberta roger ronald rose roy russell ruth sabine samantha samuel sandra sara sarah scott sean sebastian sergio sharon shirley simon sofia sophia stanley stephanie stephen steven susan tammy tanya teresa terry thelma theodore theresa thomas timothy tina todd tomas tracy tyler valerie vanessa veronica victor victoria vincent virginia walter wayne wei wendy william willie yuki zoe"
  ).split(" "),
);

/** Words that commonly follow a capitalised token but are not surnames. */
const NAME_STOPWORDS = new Set(
  (
    "account accounts active admin alert api app application application support available aws azure backend bank business card cards central chrome client cloud code company config contact customer customers data database day days dear default demo dev development different docs document domain east email empty enabled error errors europe event failed false fast file files first free frontend full gmail google great group groups hello help high host https inc info integration invoice invoices item items last latest less level line link linkedin linux list live local london low mail manager map menu message meta microsoft mobile mode money monthly more name net new next north note notice notion office open order orders org other page pages paid paris partner password payment payments pending please portal post premium price pricing private pro product production profile program project public query quick read ready received record records report request reset review road role sales sample san search secret server servers service services settings setup shopify slack small social software south square standard start state states status step storage store stripe success support system table target team tech test then there this ticket time tokyo total tracking training true type united update upgrade usage user users valid value version warning web website weekly west windows wordpress work working write york zoom"
  ).split(" "),
);

/* --------------------------------------------------------------- detectors */

function phoneCandidate(raw: string): { value: string; confidence: number } | null {
  const digits = digitsOnly(raw);
  if (digits.length < 9 || digits.length > 15) return null;
  if (new Set(digits).size < 3) return null;
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(raw)) return null;
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/.test(raw)) return null;
  if (ipv4Valid(raw) || /^[0-9A-Fa-f]{2}([:-][0-9A-Fa-f]{2}){5}$/.test(raw)) return null;

  if (raw.startsWith("+")) return { value: raw, confidence: 0.9 };
  if (raw.includes("(") && raw.includes(")")) return { value: raw, confidence: 0.85 };
  if (/^\d{3}[ .\-]\d{3}[ .\-]\d{4}$/.test(raw)) return { value: raw, confidence: 0.85 };
  if (/^1[ .\-]\d{3}[ .\-]\d{3}[ .\-]\d{4}$/.test(raw)) return { value: raw, confidence: 0.85 };
  const separators = (raw.match(/[ .\-]/g) ?? []).length;
  if (separators >= 2 && digits.length >= 10) return { value: raw, confidence: 0.72 };
  return null;
}

function emailCandidate(raw: string): { value: string; confidence: number } | null {
  const value = raw.replace(/[.,;:]+$/, "");
  const at = value.lastIndexOf("@");
  if (at <= 0 || at === value.length - 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || domain.length > 253) return null;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  const labels = domain.split(".");
  if (labels.length < 2) return null;
  if (labels.some((label) => label.length === 0 || label.length > 63)) return null;
  const tld = labels[labels.length - 1];
  if (!/^[A-Za-z]{2,24}$/.test(tld)) return null;
  return { value, confidence: 0.99 };
}

function dateConfidence(text: string, start: number, end: number): number {
  return hasContext(text, start, end, BIRTH_KEYWORDS) ? 0.78 : 0.5;
}

function collectCandidates(text: string, enabled: ReadonlySet<PiiType>): Candidate[] {
  const out: Candidate[] = [];

  if (enabled.has("EMAIL")) {
    each(text, EMAIL_RE, (m) => {
      const result = emailCandidate(m[0]);
      if (result) {
        out.push({
          type: "EMAIL",
          value: result.value,
          start: m.index,
          end: m.index + result.value.length,
          confidence: result.confidence,
          validator: "email-syntax",
        });
      }
    });
  }

  if (enabled.has("URL")) {
    each(text, URL_RE, (m) => {
      let value = m[0];
      while (value.length > 0 && ".,;:!?)]}'\u00bb".includes(value[value.length - 1])) value = value.slice(0, -1);
      const candidate = /^www\./i.test(value) ? "https://" + value : value;
      if (!urlValid(candidate)) return;
      out.push({ type: "URL", value, start: m.index, end: m.index + value.length, confidence: 0.92, validator: "url-parse" });
    });
  }

  if (enabled.has("PHONE")) {
    for (const pattern of [PHONE_INTL_RE, PHONE_PARENS_RE, PHONE_SEP_RE]) {
      each(text, pattern, (m) => {
        const result = phoneCandidate(m[0]);
        if (result && result.value === m[0]) {
          out.push({
            type: "PHONE",
            value: result.value,
            start: m.index,
            end: m.index + result.value.length,
            confidence: result.confidence,
            validator: "phone-shape",
          });
        }
      });
    }
  }

  if (enabled.has("CREDIT_CARD")) {
    each(text, CARD_RE, (m) => {
      const digits = digitsOnly(m[0]);
      if (digits.length < 13 || digits.length > 19) return;
      if (!luhnValid(digits)) return;
      const brand = cardBrand(digits);
      const value = m[0].trimEnd();
      out.push({
        type: "CREDIT_CARD",
        value,
        start: m.index,
        end: m.index + value.length,
        confidence: brand ? 0.97 : 0.9,
        validator: "luhn",
        detail: brand ? brand.id : "unknown-issuer",
      });
    });
  }

  if (enabled.has("IBAN")) {
    each(text, IBAN_RE, (m) => {
      const result = ibanCheck(m[0]);
      if (!result.valid) return;
      out.push({
        type: "IBAN",
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: 0.97,
        validator: "iban-mod97",
        detail: result.country ?? undefined,
      });
    });
  }

  if (enabled.has("SSN")) {
    each(text, SSN_RE, (m) => {
      if (!ssnValid(m[0])) return;
      out.push({ type: "SSN", value: m[0], start: m.index, end: m.index + m[0].length, confidence: 0.82, validator: "ssn-structure" });
    });
  }

  if (enabled.has("IPV4")) {
    each(text, IPV4_RE, (m) => {
      if (!ipv4Valid(m[0])) return;
      out.push({ type: "IPV4", value: m[0], start: m.index, end: m.index + m[0].length, confidence: 0.88, validator: "ipv4-octets" });
    });
  }

  if (enabled.has("IPV6")) {
    each(text, IPV6_RE, (m) => {
      const value = m[0];
      if (!ipv6Valid(value)) return;
      if ((value.match(/[0-9A-Fa-f]/g) ?? []).length < 3) return;
      out.push({ type: "IPV6", value, start: m.index, end: m.index + value.length, confidence: 0.82, validator: "ipv6-groups" });
    });
  }

  if (enabled.has("MAC_ADDRESS")) {
    each(text, MAC_RE, (m) => {
      out.push({
        type: "MAC_ADDRESS",
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: 0.9,
        validator: "mac-octets",
      });
    });
  }

  if (enabled.has("DATE_OF_BIRTH")) {
    each(text, DOB_ISO_RE, (m) => {
      const parts = m[0].split("-").map(Number);
      if (!datePlausible(parts[0], parts[1], parts[2])) return;
      out.push({
        type: "DATE_OF_BIRTH",
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: dateConfidence(text, m.index, m.index + m[0].length),
        validator: "date-plausibility",
        detail: "iso",
      });
    });
    each(text, DOB_NUMERIC_RE, (m) => {
      const parts = m[0].split(/[/.\-]/).map(Number);
      if (!datePlausible(parts[2], parts[1], parts[0])) return;
      out.push({
        type: "DATE_OF_BIRTH",
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: dateConfidence(text, m.index, m.index + m[0].length),
        validator: "date-plausibility",
        detail: "day-first",
      });
    });
    each(text, DOB_MONTH_RE, (m) => {
      const match = /^([A-Za-z]+)\.?[ ]+(\d{1,2})[a-z]{0,2},?[ ]+(\d{4})$/.exec(m[0]);
      if (!match) return;
      const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
      const day = Number(match[2]);
      const year = Number(match[3]);
      if (month === undefined || !datePlausible(year, month, day)) return;
      out.push({
        type: "DATE_OF_BIRTH",
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: dateConfidence(text, m.index, m.index + m[0].length),
        validator: "date-plausibility",
        detail: "month-name",
      });
    });
  }

  if (enabled.has("PASSPORT")) {
    each(text, PASSPORT_RE, (m) => {
      const value = m[1];
      const end = m.index + m[0].length;
      out.push({
        type: "PASSPORT",
        value,
        start: end - value.length,
        end,
        confidence: 0.72,
        validator: "context-label",
        detail: "label",
      });
    });
  }

  if (enabled.has("DRIVERS_LICENSE")) {
    each(text, LICENSE_RE, (m) => {
      const value = m[1];
      if (value.length < 5 || value.length > 14) return;
      if (!/[0-9]/.test(value)) return;
      const end = m.index + m[0].length;
      out.push({
        type: "DRIVERS_LICENSE",
        value,
        start: end - value.length,
        end,
        confidence: 0.68,
        validator: "context-label",
        detail: "label",
      });
    });
  }

  if (enabled.has("POSTAL_ADDRESS")) {
    each(text, ADDRESS_RE, (m) => {
      const value = m[0].trim().replace(/[,;:]$/, "");
      if (value.length < 8 || value.length > 120) return;
      out.push({
        type: "POSTAL_ADDRESS",
        value,
        start: m.index,
        end: m.index + value.length,
        confidence: 0.62,
        validator: "street-suffix",
      });
    });
  }

  if (enabled.has("PERSON_NAME")) {
    each(text, TITLE_NAME_RE, (m) => {
      const first = m[1];
      const last = m[2];
      const value = last ? first + " " + last : first;
      const end = m.index + m[0].length;
      out.push({
        type: "PERSON_NAME",
        value,
        start: end - value.length,
        end,
        confidence: last ? 0.72 : 0.5,
        validator: "name-dictionary",
        detail: "title",
      });
    });
    // Adjacent capitalised words: "Owner Jane Doe" must still yield "Jane Doe",
    // so the pair scan walks the word list instead of a greedy pair regex.
    const capitals: { word: string; start: number; end: number }[] = [];
    each(text, CAP_WORD_RE, (m) => {
      capitals.push({ word: m[0], start: m.index, end: m.index + m[0].length });
    });
    for (let i = 0; i + 1 < capitals.length; i++) {
      const first = capitals[i];
      const second = capitals[i + 1];
      if (second.start - first.end !== 1) continue;
      if (!/^[ \t]$/.test(text.slice(first.end, second.start))) continue;
      if (first.word.length > 16) continue;
      const lowerFirst = first.word.toLowerCase();
      if (!FIRST_NAMES.has(lowerFirst)) continue;
      if (NAME_STOPWORDS.has(lowerFirst)) continue;
      if (NAME_STOPWORDS.has(second.word.toLowerCase())) continue;
      out.push({
        type: "PERSON_NAME",
        value: first.word + " " + second.word,
        start: first.start,
        end: second.end,
        confidence: 0.45,
        validator: "name-dictionary",
        detail: "dictionary",
      });
    }
  }

  if (enabled.has("API_KEY")) {
    each(text, API_KEY_RE, (m) => {
      const token = m[1];
      if (token.length < 32) return;
      const verdict = highEntropyToken(token);
      if (!verdict.ok) return;
      out.push({
        type: "API_KEY",
        value: token,
        start: m.index,
        end: m.index + token.length,
        confidence: verdict.classes === 3 && token.length >= 48 ? 0.55 : 0.4,
        validator: "entropy",
        detail: "entropy " + verdict.entropy.toFixed(1),
      });
    });
  }

  if (enabled.has("JWT")) {
    each(text, JWT_RE, (m) => {
      const value = m[0];
      const segments = value.split(".");
      if (segments.length !== 3) return;
      if (!segments[0].startsWith("eyJ")) return;
      if (segments[1].length < 4) return;
      out.push({
        type: "JWT",
        value,
        start: m.index,
        end: m.index + value.length,
        confidence: 0.95,
        validator: "jwt-structure",
      });
    });
  }

  if (enabled.has("CRYPTO_WALLET")) {
    each(text, ETH_RE, (m) => {
      const value = m[1];
      if (new Set(value.slice(2).toLowerCase()).size < 4) return;
      out.push({
        type: "CRYPTO_WALLET",
        value,
        start: m.index,
        end: m.index + value.length,
        confidence: 0.9,
        validator: "hex-address",
        detail: "ethereum",
      });
    });
    each(text, BTC_RE, (m) => {
      const check = base58Check(m[0]);
      if (!check.valid) return;
      out.push({
        type: "CRYPTO_WALLET",
        value: m[0],
        start: m.index,
        end: m.index + m[0].length,
        confidence: 0.9,
        validator: "base58check",
        detail: check.version === 5 ? "bitcoin-p2sh" : "bitcoin-p2pkh",
      });
    });
    each(text, BECH32_RE, (m) => {
      const value = m[1];
      if (!/^bc1[02-9ac-hj-np-z]{11,71}$/.test(value)) return;
      out.push({
        type: "CRYPTO_WALLET",
        value,
        start: m.index,
        end: m.index + value.length,
        confidence: 0.85,
        validator: "bech32-shape",
        detail: "bitcoin-bech32",
      });
    });
  }

  if (enabled.has("GITHUB_TOKEN")) {
    each(text, GITHUB_RE, (m) => {
      out.push({
        type: "GITHUB_TOKEN",
        value: m[1],
        start: m.index,
        end: m.index + m[1].length,
        confidence: 0.99,
        validator: "github-prefix",
      });
    });
  }

  if (enabled.has("AWS_KEY")) {
    each(text, AWS_RE, (m) => {
      out.push({
        type: "AWS_KEY",
        value: m[1],
        start: m.index,
        end: m.index + m[1].length,
        confidence: 0.99,
        validator: "aws-akia-prefix",
      });
    });
  }

  return out;
}

/* ---------------------------------------------------------------- overlap */

/**
 * Greedy overlap resolution: candidates are ranked by confidence, then detector
 * specificity, then span length; anything colliding with an accepted span is
 * dropped. The result is ordered by start offset.
 */
export function resolveOverlaps(candidates: readonly Candidate[]): Candidate[] {
  const ranked = [...candidates].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const specA = DETECTOR_BY_ID.get(a.type)?.specificity ?? 0;
    const specB = DETECTOR_BY_ID.get(b.type)?.specificity ?? 0;
    if (specB !== specA) return specB - specA;
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    if (lenB !== lenA) return lenB - lenA;
    return a.start - b.start;
  });

  const accepted: Candidate[] = [];
  for (const candidate of ranked) {
    const collides = accepted.some((kept) => candidate.start < kept.end && kept.start < candidate.end);
    if (!collides) accepted.push(candidate);
  }
  return accepted.sort((a, b) => a.start - b.start || a.end - b.end);
}

/* ------------------------------------------------------------------- risk */

export function scoreFindings(findings: readonly Finding[]): RiskSummary {
  const byType = new Map<PiiType, number>();
  for (const finding of findings) byType.set(finding.type, (byType.get(finding.type) ?? 0) + 1);
  let total = 0;
  for (const [type, count] of byType) {
    const weight = DETECTOR_BY_ID.get(type)?.riskWeight ?? 10;
    total += weight * (1 + Math.min(0.5, (count - 1) * 0.1));
  }
  const score = Math.min(100, Math.round(total));
  const level: RiskLevel = score === 0 ? "none" : score < 20 ? "low" : score < 50 ? "medium" : score < 75 ? "high" : "critical";
  const detectedTypes = [...byType.keys()].sort();
  return { level, score, detectedTypes };
}

/** Merge accepted findings into non overlapping redaction spans. */
export function buildSpans(findings: readonly Finding[]): Span[] {
  const spans: Span[] = [];
  for (const finding of findings) {
    const last = spans[spans.length - 1];
    if (last && finding.start <= last.end) {
      last.end = Math.max(last.end, finding.end);
      last.length = last.end - last.start;
      if (!last.types.includes(finding.type)) last.types.push(finding.type);
      continue;
    }
    spans.push({ start: finding.start, end: finding.end, length: finding.end - finding.start, types: [finding.type] });
  }
  return spans;
}

/* ------------------------------------------------------------------- scan */

export function scanText(text: string, options: ScanOptions = {}): ScanResult {
  const requested = options.types && options.types.length > 0 ? options.types : ALL_TYPES;
  const enabled = new Set<PiiType>(requested);
  const minConfidence = options.minConfidence ?? 0;

  const candidates = collectCandidates(text, enabled).filter((candidate) => candidate.confidence >= minConfidence);
  const resolved = resolveOverlaps(candidates);
  const truncated = resolved.length > MAX_FINDINGS_OUTPUT;
  const kept = truncated ? resolved.slice(0, MAX_FINDINGS_OUTPUT) : resolved;

  const findings: Finding[] = kept.map((candidate) => {
    const confidence = round2(candidate.confidence);
    if (candidate.value.length <= MAX_FINDING_VALUE_CHARS) return { ...candidate, confidence };
    return { ...candidate, value: candidate.value.slice(0, MAX_FINDING_VALUE_CHARS), valueTruncated: true, confidence };
  });

  const counts: Record<string, number> = {};
  for (const finding of findings) counts[finding.type] = (counts[finding.type] ?? 0) + 1;

  return {
    findings,
    counts,
    spans: buildSpans(findings),
    risk: scoreFindings(findings),
    truncated,
    textLength: text.length,
  };
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
