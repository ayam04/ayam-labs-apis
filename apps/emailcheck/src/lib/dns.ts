/** DNS-over-HTTPS lookups (Cloudflare resolver). No extra bindings required. */

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const CACHE_ORIGIN = "https://dns-cache.emailcheck.internal";

export type DnsStatus = "ok" | "nxdomain" | "error";

export interface MxRecord {
  exchange: string;
  priority: number;
}

export interface TxtRecord {
  value: string;
}

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohJson {
  Status: number;
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
}

const TYPE_CODE: Record<string, number> = { A: 1, NS: 2, CNAME: 5, SOA: 6, MX: 15, TXT: 16, AAAA: 28 };

async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  const cacheKey = `${CACHE_ORIGIN}/${key}`;
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) return (await hit.json()) as T;
    } catch {
      /* cache read is best effort */
    }
  }
  const value = await load();
  if (cache) {
    try {
      await cache.put(
        cacheKey,
        new Response(JSON.stringify(value), {
          headers: { "content-type": "application/json", "cache-control": `max-age=${ttlSeconds}` },
        }),
      );
    } catch {
      /* cache write is best effort */
    }
  }
  return value;
}

async function doh(name: string, type: string, timeoutMs = 5000): Promise<DohJson | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(DOH_ENDPOINT);
    url.searchParams.set("name", name);
    url.searchParams.set("type", type);
    const response = await fetch(url.toString(), {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return (await response.json()) as DohJson;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseMx(answers: DohAnswer[]): MxRecord[] {
  const records: MxRecord[] = [];
  for (const answer of answers) {
    if (answer.type !== TYPE_CODE.MX) continue;
    const trimmed = answer.data.trim();
    const space = trimmed.indexOf(" ");
    const priority = Number(trimmed.slice(0, space));
    const exchange = trimmed.slice(space + 1).replace(/\.$/, "").toLowerCase();
    records.push({ exchange, priority: Number.isFinite(priority) ? priority : 0 });
  }
  return records.sort((a, b) => a.priority - b.priority);
}

function unquoteTxt(data: string): string {
  const strings = data.match(/"([^"]*)"/g);
  if (strings && strings.length > 0) return strings.map((part) => part.slice(1, -1)).join("");
  return data.trim();
}

export interface MxLookup {
  status: DnsStatus;
  records: MxRecord[];
  nullMx: boolean;
}

export async function lookupMx(domain: string): Promise<MxLookup> {
  return cached<MxLookup>(`mx/${domain}`, 600, async () => {
    const json = await doh(domain, "MX");
    if (!json) return { status: "error" as DnsStatus, records: [], nullMx: false };
    if (json.Status === 3) return { status: "nxdomain" as DnsStatus, records: [], nullMx: false };
    const records = parseMx(json.Answer ?? []);
    const nullMx = records.some((record) => record.exchange === "" || record.exchange === ".");
    return {
      status: records.length > 0 ? ("ok" as DnsStatus) : ("ok" as DnsStatus),
      records: records.filter((record) => record.exchange !== "" && record.exchange !== "."),
      nullMx,
    };
  });
}

export interface AddressLookup {
  status: DnsStatus;
  addresses: string[];
}

export async function lookupAddresses(domain: string): Promise<AddressLookup> {
  return cached<AddressLookup>(`a/${domain}`, 600, async () => {
    const [v4, v6] = await Promise.all([doh(domain, "A"), doh(domain, "AAAA")]);
    if (!v4 && !v6) return { status: "error" as DnsStatus, addresses: [] };
    if (v4?.Status === 3) return { status: "nxdomain" as DnsStatus, addresses: [] };
    const addresses = [...(v4?.Answer ?? []), ...(v6?.Answer ?? [])]
      .filter((answer) => answer.type === TYPE_CODE.A || answer.type === TYPE_CODE.AAAA)
      .map((answer) => answer.data.trim());
    return { status: "ok" as DnsStatus, addresses };
  });
}

export interface TxtLookup {
  status: DnsStatus;
  records: string[];
}

export async function lookupTxt(name: string): Promise<TxtLookup> {
  return cached<TxtLookup>(`txt/${name}`, 900, async () => {
    const json = await doh(name, "TXT");
    if (!json) return { status: "error" as DnsStatus, records: [] };
    if (json.Status === 3) return { status: "nxdomain" as DnsStatus, records: [] };
    const records = (json.Answer ?? [])
      .filter((answer) => answer.type === TYPE_CODE.TXT)
      .map((answer) => unquoteTxt(answer.data));
    return { status: "ok" as DnsStatus, records };
  });
}

export interface NsLookup {
  status: DnsStatus;
  records: string[];
}

export async function lookupNs(domain: string): Promise<NsLookup> {
  return cached<NsLookup>(`ns/${domain}`, 3600, async () => {
    const json = await doh(domain, "NS");
    if (!json) return { status: "error" as DnsStatus, records: [] };
    if (json.Status === 3) return { status: "nxdomain" as DnsStatus, records: [] };
    const records = (json.Answer ?? [])
      .filter((answer) => answer.type === TYPE_CODE.NS)
      .map((answer) => answer.data.replace(/\.$/, "").toLowerCase());
    return { status: "ok" as DnsStatus, records };
  });
}

/** Checks a handful of common DKIM selectors; returns the first that publishes a key. */
export async function lookupDkim(domain: string, selectors: string[] = ["default", "google", "selector1", "k1"]): Promise<Array<{ selector: string; found: boolean }>> {
  const results = await Promise.all(
    selectors.map(async (selector) => {
      const txt = await lookupTxt(`${selector}._domainkey.${domain}`);
      const found = txt.records.some((record) => /v=DKIM1|k=rsa|p=/.test(record));
      return { selector, found };
    }),
  );
  return results;
}

export function extractSpf(records: string[]): string | null {
  return records.find((record) => record.toLowerCase().startsWith("v=spf1")) ?? null;
}

export function extractDmarc(records: string[]): string | null {
  return records.find((record) => record.toLowerCase().startsWith("v=dmarc1")) ?? null;
}
