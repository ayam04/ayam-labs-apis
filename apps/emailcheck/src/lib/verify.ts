import { checkSyntax, looksRandom } from "./syntax";
import { lookupAddresses, lookupMx } from "./dns";
import { detectProvider, isFreeProvider, isRoleAccount } from "./providers";
import blocklist from "../data/disposable.json";

const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set(
  (blocklist as { blocklist: string }).blocklist.split("\n").map((domain) => domain.trim()).filter(Boolean),
);

export type Deliverability = "deliverable" | "risky" | "undeliverable" | "unknown";

export interface MxRecordOut {
  exchange: string;
  priority: number;
}

export interface VerificationResult {
  email: string;
  normalized: string | null;
  canonical: string | null;
  validFormat: boolean;
  localPart: string | null;
  domain: string | null;
  score: number;
  deliverability: Deliverability;
  flags: {
    disposable: boolean;
    roleAccount: boolean;
    freeProvider: boolean;
    randomLocalPart: boolean;
    hasMx: boolean;
    hasARecord: boolean;
    nullMx: boolean;
    possibleTypo: boolean;
  };
  provider: string | null;
  didYouMean: string | null;
  mxRecords: MxRecordOut[];
  reasons: string[];
  durationMs: number;
}

export function isDisposableDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  if (DISPOSABLE_DOMAINS.has(lower)) return true;
  const parent = lower.split(".").slice(-2).join(".");
  return DISPOSABLE_DOMAINS.has(parent);
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Verifies an address using syntax analysis + live DNS (MX / A).
 * Mailbox existence is NOT confirmed (no SMTP handshake is possible from the edge),
 * so results describe domain deliverability and address risk, not inbox presence.
 */
export async function verifyEmail(input: string): Promise<VerificationResult> {
  const started = Date.now();
  const syntax = checkSyntax(input);
  const reasons: string[] = [];

  const flags: VerificationResult["flags"] = {
    disposable: false,
    roleAccount: false,
    freeProvider: false,
    randomLocalPart: false,
    hasMx: false,
    hasARecord: false,
    nullMx: false,
    possibleTypo: false,
  };

  if (!syntax.valid) {
    for (const problem of syntax.problems) reasons.push(problem);
    return {
      email: syntax.email,
      normalized: syntax.normalized,
      canonical: null,
      validFormat: false,
      localPart: syntax.localPart,
      domain: syntax.domain,
      score: 0,
      deliverability: "undeliverable",
      flags,
      provider: null,
      didYouMean: syntax.didYouMean,
      mxRecords: [],
      reasons,
      durationMs: Date.now() - started,
    };
  }

  const domain = syntax.domain as string;
  const localPart = syntax.localPart as string;

  flags.disposable = isDisposableDomain(domain);
  flags.roleAccount = isRoleAccount(localPart);
  flags.freeProvider = isFreeProvider(domain);
  flags.randomLocalPart = looksRandom(localPart);
  flags.possibleTypo = Boolean(syntax.didYouMean);

  const [mx, addresses] = await Promise.all([lookupMx(domain), lookupAddresses(domain)]);
  flags.hasMx = mx.records.length > 0;
  flags.hasARecord = addresses.addresses.length > 0;
  flags.nullMx = mx.nullMx;

  if (mx.status === "error" && addresses.status === "error") {
    reasons.push("DNS lookup failed; the domain could not be checked");
    return {
      email: syntax.email,
      normalized: syntax.normalized,
      canonical: syntax.canonical,
      validFormat: true,
      localPart,
      domain,
      score: 0,
      deliverability: "unknown",
      flags,
      provider: null,
      didYouMean: syntax.didYouMean,
      mxRecords: [],
      reasons,
      durationMs: Date.now() - started,
    };
  }

  let score = 100;

  if (mx.status === "nxdomain" && addresses.status === "nxdomain") {
    reasons.push("Domain does not exist in DNS");
    return {
      email: syntax.email,
      normalized: syntax.normalized,
      canonical: syntax.canonical,
      validFormat: true,
      localPart,
      domain,
      score: 0,
      deliverability: "undeliverable",
      flags,
      provider: null,
      didYouMean: syntax.didYouMean,
      mxRecords: [],
      reasons,
      durationMs: Date.now() - started,
    };
  }

  if (flags.nullMx) {
    score = 3;
    reasons.push("Domain publishes a null MX record (RFC 7505): it does not accept email");
  } else if (!flags.hasMx && flags.hasARecord) {
    score -= 35;
    reasons.push("No MX record; mail may fall back to the A record (legacy delivery)");
  } else if (!flags.hasMx && !flags.hasARecord) {
    score = 5;
    reasons.push("Domain has neither MX nor A records; it cannot receive email");
  }

  if (flags.disposable) {
    score = Math.min(score, 25);
    reasons.push("Domain is a known disposable / temporary email provider");
  }
  if (flags.roleAccount) {
    score -= 25;
    reasons.push("Local part looks like a role account (e.g. info@, support@) rather than a person");
  }
  if (flags.freeProvider) {
    score -= 12;
    reasons.push("Domain is a free consumer mailbox provider");
  }
  if (flags.randomLocalPart) {
    score -= 15;
    reasons.push("Local part looks machine generated (high entropy, few vowels)");
  }
  if (flags.possibleTypo && syntax.didYouMean) {
    score -= 15;
    reasons.push(`Domain looks like a typo of a popular provider; did you mean ${syntax.didYouMean.split("@")[1]}?`);
  }

  score = clamp(score);
  let deliverability: Deliverability;
  if (flags.nullMx || (!flags.hasMx && !flags.hasARecord)) {
    deliverability = "undeliverable";
  } else if (flags.disposable) {
    deliverability = "risky";
  } else if (score >= 75) {
    deliverability = "deliverable";
  } else if (score >= 45) {
    deliverability = "risky";
  } else {
    deliverability = "undeliverable";
  }

  return {
    email: syntax.email,
    normalized: syntax.normalized,
    canonical: syntax.canonical,
    validFormat: true,
    localPart,
    domain,
    score,
    deliverability,
    flags,
    provider: flags.hasMx ? detectProvider(mx.records) : null,
    didYouMean: syntax.didYouMean,
    mxRecords: mx.records.map((record) => ({ exchange: record.exchange, priority: record.priority })),
    reasons,
    durationMs: Date.now() - started,
  };
}

/** Runs verification with bounded concurrency for bulk requests. */
export async function verifyMany(emails: string[], concurrency = 8): Promise<VerificationResult[]> {
  const results = new Array<VerificationResult>(emails.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, emails.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= emails.length) return;
      try {
        results[index] = await verifyEmail(emails[index] as string);
      } catch (error) {
        results[index] = {
          email: String(emails[index]),
          normalized: null,
          canonical: null,
          validFormat: false,
          localPart: null,
          domain: null,
          score: 0,
          deliverability: "unknown",
          flags: {
            disposable: false, roleAccount: false, freeProvider: false, randomLocalPart: false,
            hasMx: false, hasARecord: false, nullMx: false, possibleTypo: false,
          },
          provider: null,
          didYouMean: null,
          mxRecords: [],
          reasons: [error instanceof Error ? error.message : "Verification failed"],
          durationMs: 0,
        };
      }
    }
  });
  await Promise.all(workers);
  return results;
}
