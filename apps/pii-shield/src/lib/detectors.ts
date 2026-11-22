/**
 * Detector catalogue: the single source of truth for what /v1/types advertises
 * and what the scanner can emit. Keep this list and the scanner in sync; the
 * unit tests assert that every id has metadata.
 */

export const PII_TYPES = [
  "EMAIL",
  "PHONE",
  "CREDIT_CARD",
  "IBAN",
  "SSN",
  "IPV4",
  "IPV6",
  "URL",
  "DATE_OF_BIRTH",
  "PASSPORT",
  "DRIVERS_LICENSE",
  "POSTAL_ADDRESS",
  "PERSON_NAME",
  "API_KEY",
  "JWT",
  "CRYPTO_WALLET",
  "MAC_ADDRESS",
  "GITHUB_TOKEN",
  "AWS_KEY",
] as const;

export type PiiType = (typeof PII_TYPES)[number];

export interface ConfidenceRange {
  min: number;
  max: number;
}

export interface DetectorMeta {
  /** Stable detector id, exactly the value returned in `findings[].type`. */
  id: PiiType;
  label: string;
  description: string;
  example: string;
  /** Named validator the detector applies, or null when the match is pattern only. */
  validator: string | null;
  confidenceRange: ConfidenceRange;
  /** Contribution of a single hit to the 0-100 risk score. */
  riskWeight: number;
  /** Tie-break rank during overlap resolution. Higher wins against equal confidence. */
  specificity: number;
}

export const DETECTORS: readonly DetectorMeta[] = [
  {
    id: "EMAIL",
    label: "Email address",
    description: "RFC-shaped address: local part up to 64 chars, dotted domain with a 2-24 letter TLD.",
    example: "jane.doe+news@example.com",
    validator: "email-syntax",
    confidenceRange: { min: 0.9, max: 0.99 },
    riskWeight: 22,
    specificity: 70,
  },
  {
    id: "PHONE",
    label: "Phone number",
    description: "International (+), parenthesised or separator formatted numbers with 9-15 digits.",
    example: "+1 (555) 123-4567",
    validator: "phone-shape",
    confidenceRange: { min: 0.7, max: 0.9 },
    riskWeight: 18,
    specificity: 40,
  },
  {
    id: "CREDIT_CARD",
    label: "Payment card number",
    description: "13-19 digit primary account number that passes the Luhn checksum, with issuer brand detection.",
    example: "4111 1111 1111 1111",
    validator: "luhn",
    confidenceRange: { min: 0.9, max: 0.97 },
    riskWeight: 42,
    specificity: 95,
  },
  {
    id: "IBAN",
    label: "IBAN",
    description: "15-34 character IBAN with a registered country code that passes the ISO 13616 mod-97 check.",
    example: "GB82 WEST 1234 5698 7654 32",
    validator: "iban-mod97",
    confidenceRange: { min: 0.97, max: 0.97 },
    riskWeight: 36,
    specificity: 95,
  },
  {
    id: "SSN",
    label: "US Social Security number",
    description: "NNN-NN-NNNN with area 001-899 (excluding 666), group not 00 and serial not 0000.",
    example: "123-45-6789",
    validator: "ssn-structure",
    confidenceRange: { min: 0.82, max: 0.82 },
    riskWeight: 42,
    specificity: 90,
  },
  {
    id: "IPV4",
    label: "IPv4 address",
    description: "Four dotted octets, each 0-255 without leading zeros. Version-like strings can match.",
    example: "203.0.113.42",
    validator: "ipv4-octets",
    confidenceRange: { min: 0.88, max: 0.88 },
    riskWeight: 10,
    specificity: 60,
  },
  {
    id: "IPV6",
    label: "IPv6 address",
    description: "Hex groups separated by colons, with optional single :: compression and at most 8 groups.",
    example: "2001:db8::1",
    validator: "ipv6-groups",
    confidenceRange: { min: 0.82, max: 0.82 },
    riskWeight: 10,
    specificity: 60,
  },
  {
    id: "URL",
    label: "URL",
    description: "Absolute http(s) or www URL, trimmed of trailing punctuation and validated by the URL parser.",
    example: "https://example.com/reset?token=abc123",
    validator: "url-parse",
    confidenceRange: { min: 0.92, max: 0.92 },
    riskWeight: 6,
    specificity: 75,
  },
  {
    id: "DATE_OF_BIRTH",
    label: "Date (birth date candidate)",
    description:
      "ISO, day-first numeric or month-name date within 1900-2100. Confidence rises when a birth keyword is nearby, so a bare date stays low.",
    example: "1990-04-17",
    validator: "date-plausibility",
    confidenceRange: { min: 0.5, max: 0.78 },
    riskWeight: 20,
    specificity: 35,
  },
  {
    id: "PASSPORT",
    label: "Passport number",
    description: "6-12 alphanumeric characters that immediately follow a passport label such as 'passport no'.",
    example: "Passport No: X1234567",
    validator: "context-label",
    confidenceRange: { min: 0.72, max: 0.72 },
    riskWeight: 34,
    specificity: 80,
  },
  {
    id: "DRIVERS_LICENSE",
    label: "Driver's licence number",
    description: "5-14 alphanumeric characters that follow a licence label. Format is country specific, so the label is required.",
    example: "Driver's License: D1234567",
    validator: "context-label",
    confidenceRange: { min: 0.68, max: 0.68 },
    riskWeight: 26,
    specificity: 75,
  },
  {
    id: "POSTAL_ADDRESS",
    label: "Postal address",
    description: "House number plus a street name ending in a recognised street suffix, with an optional unit.",
    example: "1600 Pennsylvania Ave NW",
    validator: "street-suffix",
    confidenceRange: { min: 0.62, max: 0.62 },
    riskWeight: 16,
    specificity: 45,
  },
  {
    id: "PERSON_NAME",
    label: "Person name (heuristic)",
    description:
      "A recognised given name followed by a capitalised surname, or a name after a title such as Mr/Dr. Low confidence by design: use minConfidence to filter.",
    example: "Jane Doe",
    validator: "name-dictionary",
    confidenceRange: { min: 0.45, max: 0.72 },
    riskWeight: 8,
    specificity: 20,
  },
  {
    id: "API_KEY",
    label: "API key or secret (heuristic)",
    description:
      "32+ character token with at least two character classes and 3+ bits of entropy per character. Heuristic only, reported at low confidence.",
    example: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
    validator: "entropy",
    confidenceRange: { min: 0.4, max: 0.55 },
    riskWeight: 38,
    specificity: 55,
  },
  {
    id: "JWT",
    label: "JSON Web Token",
    description: "Three base64url segments whose header starts with eyJ (the base64 encoding of '{').",
    example: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    validator: "jwt-structure",
    confidenceRange: { min: 0.95, max: 0.95 },
    riskWeight: 34,
    specificity: 92,
  },
  {
    id: "CRYPTO_WALLET",
    label: "Crypto wallet address",
    description: "Ethereum 0x address, Bitcoin base58check address (checksum verified) or bc1 bech32 address.",
    example: "0x52908400098527886E0F7030069857D2E4169EE7",
    validator: "base58check / hex",
    confidenceRange: { min: 0.85, max: 0.9 },
    riskWeight: 30,
    specificity: 88,
  },
  {
    id: "MAC_ADDRESS",
    label: "MAC address",
    description: "Six colon or hyphen separated hex octets.",
    example: "00:1A:2B:3C:4D:5E",
    validator: "mac-octets",
    confidenceRange: { min: 0.9, max: 0.9 },
    riskWeight: 10,
    specificity: 65,
  },
  {
    id: "GITHUB_TOKEN",
    label: "GitHub token",
    description: "GitHub fine-grained or classic prefixed token: gh[pousr]_ followed by 36+ base62 characters.",
    example: "ghp_aBcD1234eFgH5678iJkL9012mNoP3456qRsT",
    validator: "github-prefix",
    confidenceRange: { min: 0.99, max: 0.99 },
    riskWeight: 42,
    specificity: 98,
  },
  {
    id: "AWS_KEY",
    label: "AWS access key id",
    description: "AKIA followed by 16 uppercase letters or digits. Temporary ASIA session keys are not detected.",
    example: "AKIAIOSFODNN7EXAMPLE",
    validator: "aws-akia-prefix",
    confidenceRange: { min: 0.99, max: 0.99 },
    riskWeight: 46,
    specificity: 98,
  },
];

export const DETECTOR_BY_ID: ReadonlyMap<PiiType, DetectorMeta> = new Map(DETECTORS.map((detector) => [detector.id, detector]));
