/**
 * Redaction: mask, label or hash every accepted finding and rebuild the text.
 * Pure and synchronous; the hash style uses the local SHA-256 so the output is
 * identical in workerd and in tests.
 */
import { scanText, type Finding, type RiskSummary, type ScanResult, type Span } from "./pii";
import type { PiiType } from "./detectors";
import { shortHash } from "./sha256";

export const REDACTION_STYLES = ["mask", "label", "hash"] as const;
export type RedactionStyle = (typeof REDACTION_STYLES)[number];

export interface RedactOptions {
  types?: readonly PiiType[];
  minConfidence?: number;
  style?: RedactionStyle;
  keepLast?: number;
}

export interface HashEntry {
  hash: string;
  type: PiiType;
  occurrences: number;
  firstStart: number;
}

export interface RedactResult {
  redactedText: string;
  style: RedactionStyle;
  keepLast: number;
  replacementCount: number;
  findings: Finding[];
  counts: Record<string, number>;
  spans: Span[];
  risk: RiskSummary;
  truncated: boolean;
  changed: boolean;
  /** Only present for style "hash": deterministic value fingerprint to fingerprint map. */
  mapping?: HashEntry[];
}

/**
 * Keep the last `keepLast` characters of a value and mask the rest with "*".
 * At least one character is always masked so a short value cannot leak whole.
 */
export function maskValue(value: string, keepLast: number): string {
  if (value.length === 0) return "";
  const keep = Math.max(0, Math.min(keepLast, value.length - 1));
  return "*".repeat(value.length - keep) + value.slice(value.length - keep);
}

export function redactText(text: string, options: RedactOptions = {}): RedactResult {
  const style: RedactionStyle = options.style ?? "mask";
  const keepLast = Math.max(0, Math.min(8, options.keepLast ?? 4));
  const scan: ScanResult = scanText(text, { types: options.types, minConfidence: options.minConfidence });

  const labels = new Map<string, string>();
  const counters = new Map<PiiType, number>();
  const hashes = new Map<string, HashEntry>();

  const replacements = scan.findings.map((finding) => {
    const key = finding.type + ":" + finding.value;
    if (style === "mask") return maskValue(finding.value, keepLast);
    if (style === "label") {
      const existing = labels.get(key);
      if (existing) return existing;
      const index = (counters.get(finding.type) ?? 0) + 1;
      counters.set(finding.type, index);
      const label = "[" + finding.type + "_" + index + "]";
      labels.set(key, label);
      return label;
    }
    const hash = shortHash(finding.value);
    const entry = hashes.get(hash);
    if (entry) {
      entry.occurrences += 1;
    } else {
      hashes.set(hash, { hash, type: finding.type, occurrences: 1, firstStart: finding.start });
    }
    return "[" + finding.type + "_" + hash + "]";
  });

  let cursor = 0;
  let redactedText = "";
  for (let i = 0; i < scan.findings.length; i++) {
    const finding = scan.findings[i];
    redactedText += text.slice(cursor, finding.start) + replacements[i];
    cursor = finding.end;
  }
  redactedText += text.slice(cursor);

  const result: RedactResult = {
    redactedText,
    style,
    keepLast: style === "mask" ? keepLast : 0,
    replacementCount: scan.findings.length,
    findings: scan.findings,
    counts: scan.counts,
    spans: scan.spans,
    risk: scan.risk,
    truncated: scan.truncated,
    changed: scan.findings.length > 0,
  };

  if (style === "hash") {
    result.mapping = [...hashes.values()].sort((a, b) => a.firstStart - b.firstStart);
  }
  return result;
}
