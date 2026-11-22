/**
 * Pure checksum / structure validators. No IO, no runtime globals: every function
 * here runs identically in workerd and in node, so they are unit tested directly.
 */
import { sha256Bytes } from "./sha256";

/** Luhn (mod 10) checksum used by payment cards. */
export function luhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48;
    if (double) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
    double = !double;
  }
  return sum % 10 === 0;
}

export interface CardBrand {
  id: string;
  label: string;
}

/**
 * Brand from the issuer identification number. Order matters: Amex/JCB/Discover
 * prefixes are checked before the generic Visa 4 prefix.
 */
export function cardBrand(digits: string): CardBrand | null {
  const first2 = Number(digits.slice(0, 2));
  const first4 = Number(digits.slice(0, 4));
  const first6 = Number(digits.slice(0, 6));

  if (digits.length === 15 && (first2 === 34 || first2 === 37)) return { id: "amex", label: "American Express" };
  if (digits.length === 16 && first2 >= 51 && first2 <= 55) return { id: "mastercard", label: "Mastercard" };
  if (digits.length === 16 && first4 >= 2221 && first4 <= 2720) return { id: "mastercard", label: "Mastercard" };
  if (digits.length === 16 && (first4 === 6011 || first2 === 65)) return { id: "discover", label: "Discover" };
  if (digits.length === 16 && first2 === 64 && first4 >= 6440 && first4 <= 6499) return { id: "discover", label: "Discover" };
  if (digits.length === 16 && first4 >= 3528 && first4 <= 3589) return { id: "jcb", label: "JCB" };
  if ((digits.length === 13 || digits.length === 16 || digits.length === 19) && digits[0] === "4") {
    return { id: "visa", label: "Visa" };
  }
  return null;
}

/** ISO 3166-1 alpha-2 codes that participate in IBAN. */
const IBAN_COUNTRIES = new Set(
  (
    "AD AE AL AT AZ BA BE BG BH BR BY CH CR CY CZ DE DK DO EE EG ES FI FO FR GB GE GI GL GR GT HR HU IE IL IQ IS IT JO KW KZ LB LC LI LT LU LV MC MD ME MK MR MT MU NL NO PK PL PS PT QA RO RS SA SC SE SI SK SM ST SV TL TN TR UA VA VG XK"
  ).split(" "),
);

export interface IbanCheck {
  valid: boolean;
  compact: string;
  country: string | null;
  /** Reason the value was rejected, useful for the detector's optional detail field. */
  reason: string | null;
}

/**
 * IBAN validation: 15-34 characters, two letter country code from the IBAN
 * register, two check digits, then mod-97 over the rearranged value.
 */
export function ibanCheck(raw: string): IbanCheck {
  const compact = raw.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) {
    return { valid: false, compact, country: null, reason: "shape" };
  }
  if (compact.length < 15 || compact.length > 34) return { valid: false, compact, country: null, reason: "length" };
  const country = compact.slice(0, 2);
  if (!IBAN_COUNTRIES.has(country)) return { valid: false, compact, country, reason: "country" };

  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const mapped = code >= 65 && code <= 90 ? String(code - 55) : char;
    for (const digit of mapped) remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97;
  }
  if (remainder !== 1) return { valid: false, compact, country, reason: "mod97" };
  return { valid: true, compact, country, reason: null };
}

/** US Social Security number rules: area 001-899 minus 666, group != 00, serial != 0000. */
export function ssnValid(value: string): boolean {
  const match = /^(\d{3})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) return false;
  const area = Number(match[1]);
  const group = Number(match[2]);
  const serial = Number(match[3]);
  if (area === 0 || area === 666 || area >= 900) return false;
  if (group === 0) return false;
  if (serial === 0) return false;
  return true;
}

export function ipv4Valid(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part.startsWith("0")) return false;
    if (Number(part) > 255) return false;
  }
  return true;
}

/**
 * IPv6 validation without parsing libraries: at most one "::" run, 1-4 hex digits
 * per group, exactly 8 groups when uncompressed and fewer when compressed.
 */
export function ipv6Valid(value: string): boolean {
  if (!value.includes(":")) return false;
  if (value.includes(":::")) return false;
  const [head, tail, extra] = value.split("::");
  if (extra !== undefined) return false;
  const headGroups = head.length > 0 ? head.split(":") : [];
  const tailGroups = tail !== undefined && tail.length > 0 ? tail.split(":") : [];
  for (const group of [...headGroups, ...tailGroups]) {
    if (!/^[0-9A-Fa-f]{1,4}$/.test(group)) return false;
  }
  const groupCount = headGroups.length + tailGroups.length;
  if (tail === undefined) return groupCount === 8;
  if (groupCount >= 8) return false;
  return true;
}

export function urlValid(value: string): boolean {
  if (value.length > 2048) return false;
  try {
    const parsed = new URL(value);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const host = parsed.hostname;
    if (host.length === 0) return false;
    if (host.startsWith("[") && host.endsWith("]")) return ipv6Valid(host.slice(1, -1));
    if (host.includes(".")) return true;
    return host === "localhost";
  } catch {
    return false;
  }
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export function daysInMonth(year: number, month: number): number {
  if (month === 2 && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return 29;
  return DAYS_IN_MONTH[month - 1] ?? 0;
}

export function datePlausible(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface Base58CheckResult {
  valid: boolean;
  version: number | null;
}

/** Bitcoin base58check: payload + first 4 bytes of double SHA-256. */
export function base58Check(raw: string): Base58CheckResult {
  if (raw.length < 26 || raw.length > 35) return { valid: false, version: null };
  const bytes: number[] = [0];
  for (const char of raw) {
    let carry = BASE58_ALPHABET.indexOf(char);
    if (carry < 0) return { valid: false, version: null };
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  let leadingZeros = 0;
  for (const char of raw) {
    if (char === "1") leadingZeros++;
    else break;
  }
  const decoded = new Uint8Array(leadingZeros + bytes.length);
  for (let i = 0; i < bytes.length; i++) decoded[decoded.length - 1 - i] = bytes[i];
  if (decoded.length !== 25) return { valid: false, version: null };

  const payload = decoded.slice(0, 21);
  const checksum = decoded.slice(21);
  const first = sha256Bytes(payload);
  const second = sha256Bytes(first);
  for (let i = 0; i < 4; i++) {
    if (checksum[i] !== second[i]) return { valid: false, version: null };
  }
  const version = payload[0];
  if (version !== 0x00 && version !== 0x05) return { valid: false, version };
  return { valid: true, version };
}

/** Shannon entropy in bits per character. */
export function shannonEntropy(value: string): number {
  if (value.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }
  return Math.round(entropy * 100) / 100;
}

export interface EntropyVerdict {
  ok: boolean;
  entropy: number;
  classes: number;
  distinct: number;
}

/**
 * High entropy token heuristic used by the API_KEY detector: at least two of
 * {lowercase, uppercase, digit} and a per character entropy above 3 bits.
 * Deliberately conservative and reported with low confidence.
 */
export function highEntropyToken(value: string): EntropyVerdict {
  const entropy = shannonEntropy(value);
  const distinct = new Set(value).size;
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  const hasDigit = /\d/.test(value);
  const classes = [hasLower, hasUpper, hasDigit].filter(Boolean).length;
  const ok = value.length >= 32 && classes >= 2 && entropy >= 3 && distinct >= 10;
  return { ok, entropy, classes, distinct };
}

/** Strip everything but digits. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Look for a keyword in the window before (and optionally after) a span. */
export function hasContext(
  text: string,
  start: number,
  end: number,
  keywords: readonly string[],
  before = 40,
  after = 12,
): boolean {
  const window = text.slice(Math.max(0, start - before), Math.min(text.length, end + after)).toLowerCase();
  return keywords.some((keyword) => window.includes(keyword));
}
