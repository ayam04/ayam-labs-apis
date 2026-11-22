interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  EMAILCHECK_SECRET?: string;
  SEO_SECRET?: string;
  DOCPARSE_SECRET?: string;
  AITEXT_SECRET?: string;
  PII_SECRET?: string;
}

const HOSTS: Record<string, string> = {
  emailcheck: "https://emailcheck.ayamk.in",
  "seo-audit": "https://seo-audit.ayamk.in",
  docparse: "https://docparse.ayamk.in",
  "ai-text": "https://textmind.ayamk.in",
  "pii-shield": "https://piishield.ayamk.in",
};

const SECRETS: Record<string, keyof Env> = {
  emailcheck: "EMAILCHECK_SECRET",
  "seo-audit": "SEO_SECRET",
  docparse: "DOCPARSE_SECRET",
  "ai-text": "AITEXT_SECRET",
  "pii-shield": "PII_SECRET",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function underLimit(ip: string, app: string, budget = 10): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const key = new Request("https://demo-limit.ayamk.in/" + encodeURIComponent(app) + "/" + encodeURIComponent(ip) + "/" + day);
  const cache = caches.default;
  const hit = await cache.match(key);
  const used = hit ? Number((await hit.text()) || "0") : 0;
  if (used >= budget) return false;
  await cache.put(key, new Response(String(used + 1), { headers: { "cache-control": "max-age=86400" } }));
  return true;
}

function bad(message: string) {
  return json({ error: message }, 400);
}

async function callUpstream(app: string, secret: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(HOSTS[app] + path, {
    ...init,
    headers: {
      "x-rapidapi-proxy-secret": secret,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    signal: AbortSignal.timeout(20000),
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/demo/")) {
      if (request.method !== "POST") return json({ error: "POST only" }, 405);

      const app = url.pathname.replace("/api/demo/", "").split("/")[0];
      if (!HOSTS[app]) return json({ error: "unknown demo" }, 404);

      const secretName = SECRETS[app];
      const secret = env[secretName] as string | undefined;
      if (!secret) return json({ error: "demo not configured" }, 503);

      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      if (!(await underLimit(ip, app))) {
        return json({ error: "Demo limit reached for today. Open the listing on RapidAPI for a key." }, 429);
      }

      let body: any = {};
      try {
        body = await request.json();
      } catch {
        return bad("Send a JSON body");
      }

      try {
        if (app === "emailcheck") {
          const email = String(body.email || "").trim();
          if (!email || email.length > 254) return bad("A valid email is required");
          const r = await callUpstream(app, secret, "/v1/verify?email=" + encodeURIComponent(email));
          return json(await r.json(), r.status);
        }

        if (app === "seo-audit") {
          const target = String(body.url || "").trim();
          if (!/^https?:\/\//i.test(target) || target.length > 2000) return bad("Enter a full http(s) URL");
          const r = await callUpstream(app, secret, "/v1/audit?url=" + encodeURIComponent(target));
          return json(await r.json(), r.status);
        }

        if (app === "docparse") {
          const target = String(body.url || "").trim();
          if (!/^https?:\/\//i.test(target) || target.length > 2000) return bad("Enter a full http(s) URL");
          const path = /\.pdf($|\?)/i.test(target) ? "/v1/pdf/text" : "/v1/html/text";
          const r = await callUpstream(app, secret, path, { method: "POST", body: JSON.stringify({ url: target }) });
          return json(await r.json(), r.status);
        }

        if (app === "ai-text") {
          const text = String(body.text || "").trim();
          if (!text || text.length > 5000) return bad("Text must be 1-5000 characters");
          const [sentimentRes, keywordsRes] = await Promise.all([
            callUpstream(app, secret, "/v1/sentiment", { method: "POST", body: JSON.stringify({ text }) }),
            callUpstream(app, secret, "/v1/keywords", { method: "POST", body: JSON.stringify({ text }) }),
          ]);
          const sentiment = await sentimentRes.json();
          const keywords = await keywordsRes.json();
          return json({ sentiment, keywords }, sentimentRes.status);
        }

        if (app === "pii-shield") {
          const text = String(body.text || "").trim();
          if (!text || text.length > 5000) return bad("Text must be 1-5000 characters");
          const r = await callUpstream(app, secret, "/v1/redact", { method: "POST", body: JSON.stringify({ text }) });
          return json(await r.json(), r.status);
        }
      } catch (err) {
        return json({ error: "Upstream failed or timed out. Try again." }, 504);
      }

      return json({ error: "unknown demo" }, 404);
    }

    return env.ASSETS.fetch(request);
  },
};
