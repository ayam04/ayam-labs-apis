import { extractDmarc, extractSpf, lookupAddresses, lookupDkim, lookupMx, lookupNs, lookupTxt } from "./dns";
import { detectProvider, isFreeProvider } from "./providers";
import { isDisposableDomain } from "./verify";

export interface DomainReport {
  domain: string;
  resolves: boolean;
  mx: { found: boolean; records: Array<{ exchange: string; priority: number }> };
  addresses: string[];
  nameservers: string[];
  provider: string | null;
  classification: { disposable: boolean; freeProvider: boolean };
  emailAuth: {
    spf: { found: boolean; record: string | null; policy: string | null };
    dmarc: { found: boolean; record: string | null; policy: string | null };
    dkimSelectors: Array<{ selector: string; found: boolean }>;
  };
  durationMs: number;
}

export async function inspectDomain(rawDomain: string, options: { dkim?: boolean } = {}): Promise<DomainReport> {
  const started = Date.now();
  const domain = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  const [mx, addresses, ns, rootTxt, dmarcTxt, dkim] = await Promise.all([
    lookupMx(domain),
    lookupAddresses(domain),
    lookupNs(domain),
    lookupTxt(domain),
    lookupTxt(`_dmarc.${domain}`),
    options.dkim === false ? Promise.resolve([]) : lookupDkim(domain),
  ]);

  const spf = extractSpf(rootTxt.records);
  const dmarc = extractDmarc(dmarcTxt.records);
  const spfPolicy = spf ? (/\b(-|~|\+|\?)(all)\b/.exec(spf)?.[0] ?? null) : null;
  const dmarcPolicy = dmarc ? (/(?:^|;)\s*p\s*=\s*(none|quarantine|reject)/i.exec(dmarc)?.[1]?.toLowerCase() ?? null) : null;

  return {
    domain,
    resolves: mx.status !== "nxdomain" && addresses.status !== "nxdomain",
    mx: { found: mx.records.length > 0, records: mx.records },
    addresses: addresses.addresses,
    nameservers: ns.records,
    provider: detectProvider(mx.records),
    classification: { disposable: isDisposableDomain(domain), freeProvider: isFreeProvider(domain) },
    emailAuth: {
      spf: { found: Boolean(spf), record: spf, policy: spfPolicy },
      dmarc: {
        found: Boolean(dmarc),
        record: dmarc,
        policy: dmarcPolicy,
      },
      dkimSelectors: dkim,
    },
    durationMs: Date.now() - started,
  };
}
