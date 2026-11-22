import { collapseWhitespace } from "./entities";
import { isSameRegistrableDomain, resolveHref } from "./urls";

/**
 * HTMLRewriter collectors. One focused collector per endpoint: the audit needs
 * counts, the metadata endpoint needs the head tags, the links endpoint needs
 * every anchor with its text. Handlers are element/text based; "onEndTag" closes
 * the accumulated text for anchors and headings.
 *
 * HTMLRewriter exists in the Worker runtime but not in vitest/node, which is why
 * this module has no unit tests: every pure helper it depends on is tested in
 * test/*.test.ts.
 */

export const MAX_META_TAGS = 200;
export const MAX_LINK_TAGS = 300;
export const MAX_LISTED_LINKS = 500;

export interface MetaRecord {
  name: string | null;
  property: string | null;
  content: string | null;
  charset: string | null;
  httpEquiv: string | null;
}

export interface LinkRecord {
  rel: string[];
  href: string | null;
  hreflang: string | null;
  sizes: string | null;
  type: string | null;
}

export type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export const HEADING_LEVELS: HeadingLevel[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

export type HeadingCounts = Record<HeadingLevel, number>;
export type HeadingTexts = Record<HeadingLevel, string[]>;

export interface HeadingFacts {
  counts: HeadingCounts;
  texts: HeadingTexts;
}

export interface AnchorFacts {
  total: number;
  internal: number;
  external: number;
  other: number;
  nofollow: number;
  sponsored: number;
  ugc: number;
  emptyText: number;
}

export interface AuditFacts {
  lang: string | null;
  title: string | null;
  metas: MetaRecord[];
  links: LinkRecord[];
  headings: HeadingFacts;
  imageCount: number;
  imagesMissingAlt: number;
  imagesEmptyAlt: number;
  anchors: AnchorFacts;
  metaTagCount: number;
  linkTagCount: number;
}

export interface MetaFacts {
  lang: string | null;
  title: string | null;
  metas: MetaRecord[];
  links: LinkRecord[];
  metaTagCount: number;
  linkTagCount: number;
}

export interface LinkEntryRecord {
  href: string;
  url: string | null;
  type: "internal" | "external" | "other";
  text: string;
  rel: string[];
  target: string | null;
  nofollow: boolean;
}

export interface LinkFacts {
  total: number;
  internal: number;
  external: number;
  other: number;
  nofollow: number;
  sponsored: number;
  ugc: number;
  emptyText: number;
  relCounts: { nofollow: number; sponsored: number; ugc: number; noopener: number; noreferrer: number; other: number };
  links: LinkEntryRecord[];
}

export function splitRel(value: string | null): string[] {
  if (!value) return [];
  const parts = value.toLowerCase().split(/\s+/);
  const rels: string[] = [];
  for (const part of parts) {
    if (part.length > 0 && !rels.includes(part)) rels.push(part);
  }
  return rels;
}

function emptyHeadingFacts(): HeadingFacts {
  return {
    counts: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    texts: { h1: [], h2: [], h3: [], h4: [], h5: [], h6: [] },
  };
}

function transformsToResponse(rewriter: HTMLRewriter, html: string): Response {
  return rewriter.transform(new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } }));
}

function readMeta(element: Element): MetaRecord {
  const content = element.getAttribute("content");
  return {
    name: element.getAttribute("name"),
    property: element.getAttribute("property"),
    content: content === null ? null : content.slice(0, 2000),
    charset: element.getAttribute("charset"),
    httpEquiv: element.getAttribute("http-equiv"),
  };
}

function readLink(element: Element): LinkRecord {
  const href = element.getAttribute("href");
  return {
    rel: splitRel(element.getAttribute("rel")),
    href: href === null ? null : href.slice(0, 2048),
    hreflang: element.getAttribute("hreflang"),
    sizes: element.getAttribute("sizes"),
    type: element.getAttribute("type"),
  };
}

function registerMetaAndLinks(rewriter: HTMLRewriter, metas: MetaRecord[], links: LinkRecord[]): { metaTagCount: number; linkTagCount: number } {
  const counters = { metaTagCount: 0, linkTagCount: 0 };
  rewriter.on("meta", {
    element(element) {
      counters.metaTagCount += 1;
      if (metas.length < MAX_META_TAGS) metas.push(readMeta(element));
    },
  });
  rewriter.on("link", {
    element(element) {
      counters.linkTagCount += 1;
      if (links.length < MAX_LINK_TAGS) links.push(readLink(element));
    },
  });
  return counters;
}

/** Full audit facts: head tags, headings, images, anchors and language. */
export async function collectAuditFacts(html: string, pageUrl: string): Promise<AuditFacts> {
  let baseHost = "";
  try {
    baseHost = new URL(pageUrl).hostname;
  } catch {
    baseHost = "";
  }

  const metas: MetaRecord[] = [];
  const links: LinkRecord[] = [];
  const facts: AuditFacts = {
    lang: null,
    title: null,
    metas,
    links,
    headings: emptyHeadingFacts(),
    imageCount: 0,
    imagesMissingAlt: 0,
    imagesEmptyAlt: 0,
    anchors: { total: 0, internal: 0, external: 0, other: 0, nofollow: 0, sponsored: 0, ugc: 0, emptyText: 0 },
    metaTagCount: 0,
    linkTagCount: 0,
  };

  let titleBuffer = "";
  let titleTagCount = 0;
  let activeAnchor: { text: string } | null = null;
  const activeHeading: Partial<Record<HeadingLevel, { text: string }>> = {};

  const rewriter = new HTMLRewriter();

  rewriter.on("html", {
    element(element) {
      const lang = element.getAttribute("lang");
      if (lang !== null) facts.lang = lang.slice(0, 35);
    },
  });

  rewriter.on("title", {
    element() {
      titleTagCount += 1;
    },
    text(chunk) {
      if (titleBuffer.length < 2000) titleBuffer += chunk.text;
    },
  });

  const counters = registerMetaAndLinks(rewriter, metas, links);

  for (const level of HEADING_LEVELS) {
    rewriter.on(level, {
      element(element) {
        facts.headings.counts[level] += 1;
        const buffer = { text: "" };
        activeHeading[level] = buffer;
        element.onEndTag(() => {
          const text = collapseWhitespace(buffer.text).slice(0, 200);
          const list = facts.headings.texts[level];
          if (list.length < 3) list.push(text);
          if (activeHeading[level] === buffer) delete activeHeading[level];
        });
      },
      text(chunk) {
        const buffer = activeHeading[level];
        if (buffer !== undefined && buffer.text.length < 600) buffer.text += chunk.text;
      },
    });
  }

  rewriter.on("img", {
    element(element) {
      facts.imageCount += 1;
      if (!element.hasAttribute("alt")) {
        facts.imagesMissingAlt += 1;
      } else if ((element.getAttribute("alt") ?? "").trim().length === 0) {
        facts.imagesEmptyAlt += 1;
      }
    },
  });

  rewriter.on("a", {
    element(element) {
      facts.anchors.total += 1;
      const rel = splitRel(element.getAttribute("rel"));
      if (rel.includes("nofollow")) facts.anchors.nofollow += 1;
      if (rel.includes("sponsored")) facts.anchors.sponsored += 1;
      if (rel.includes("ugc")) facts.anchors.ugc += 1;

      const resolved = resolveHref(element.getAttribute("href") ?? "", pageUrl);
      if (resolved.kind === "http" && resolved.url !== null) {
        let host = "";
        try {
          host = new URL(resolved.url).hostname;
        } catch {
          host = "";
        }
        if (host.length > 0 && baseHost.length > 0 && isSameRegistrableDomain(host, baseHost)) facts.anchors.internal += 1;
        else facts.anchors.external += 1;
      } else {
        facts.anchors.other += 1;
      }

      const buffer = { text: "" };
      activeAnchor = buffer;
      element.onEndTag(() => {
        if (collapseWhitespace(buffer.text).length === 0) facts.anchors.emptyText += 1;
        if (activeAnchor === buffer) activeAnchor = null;
      });
    },
    text(chunk) {
      if (activeAnchor !== null && activeAnchor.text.length < 2000) activeAnchor.text += chunk.text;
    },
  });

  await transformsToResponse(rewriter, html).text();

  facts.title = titleBuffer.length > 0 ? collapseWhitespace(titleBuffer).slice(0, 1000) : null;
  facts.metaTagCount = counters.metaTagCount;
  facts.linkTagCount = counters.linkTagCount;
  if (titleTagCount === 0) facts.title = null;
  return facts;
}

/** Head-only facts for /v1/meta. */
export async function collectMetaFacts(html: string): Promise<MetaFacts> {
  const metas: MetaRecord[] = [];
  const links: LinkRecord[] = [];
  let lang: string | null = null;
  let titleBuffer = "";
  let titleTagCount = 0;

  const rewriter = new HTMLRewriter();
  rewriter.on("html", {
    element(element) {
      const value = element.getAttribute("lang");
      if (value !== null) lang = value.slice(0, 35);
    },
  });
  rewriter.on("title", {
    element() {
      titleTagCount += 1;
    },
    text(chunk) {
      if (titleBuffer.length < 2000) titleBuffer += chunk.text;
    },
  });
  const counters = registerMetaAndLinks(rewriter, metas, links);

  await transformsToResponse(rewriter, html).text();

  return {
    lang,
    title: titleTagCount > 0 && titleBuffer.length > 0 ? collapseWhitespace(titleBuffer).slice(0, 1000) : null,
    metas,
    links,
    metaTagCount: counters.metaTagCount,
    linkTagCount: counters.linkTagCount,
  };
}

/** Anchor extraction for /v1/links: counts every anchor, lists the first 500. */
export async function collectLinkFacts(html: string, pageUrl: string): Promise<LinkFacts> {
  let baseHost = "";
  try {
    baseHost = new URL(pageUrl).hostname;
  } catch {
    baseHost = "";
  }

  const facts: LinkFacts = {
    total: 0,
    internal: 0,
    external: 0,
    other: 0,
    nofollow: 0,
    sponsored: 0,
    ugc: 0,
    emptyText: 0,
    relCounts: { nofollow: 0, sponsored: 0, ugc: 0, noopener: 0, noreferrer: 0, other: 0 },
    links: [],
  };

  let active: { record: LinkEntryRecord; text: string } | null = null;

  const rewriter = new HTMLRewriter();
  rewriter.on("a", {
    element(element) {
      facts.total += 1;
      const rel = splitRel(element.getAttribute("rel"));
      const href = element.getAttribute("href") ?? "";
      const resolved = resolveHref(href, pageUrl);

      let type: LinkEntryRecord["type"] = "other";
      if (resolved.kind === "http" && resolved.url !== null) {
        let host = "";
        try {
          host = new URL(resolved.url).hostname;
        } catch {
          host = "";
        }
        type = host.length > 0 && baseHost.length > 0 && isSameRegistrableDomain(host, baseHost) ? "internal" : "external";
      }

      if (type === "internal") facts.internal += 1;
      else if (type === "external") facts.external += 1;
      else facts.other += 1;

      if (rel.includes("nofollow")) {
        facts.nofollow += 1;
        facts.relCounts.nofollow += 1;
      }
      if (rel.includes("sponsored")) {
        facts.sponsored += 1;
        facts.relCounts.sponsored += 1;
      }
      if (rel.includes("ugc")) {
        facts.ugc += 1;
        facts.relCounts.ugc += 1;
      }
      if (rel.includes("noopener")) facts.relCounts.noopener += 1;
      if (rel.includes("noreferrer")) facts.relCounts.noreferrer += 1;
      if (rel.some((token) => !["nofollow", "sponsored", "ugc", "noopener", "noreferrer"].includes(token))) {
        facts.relCounts.other += 1;
      }

      if (facts.links.length >= MAX_LISTED_LINKS) return;

      const record: LinkEntryRecord = {
        href: resolved.href,
        url: resolved.url,
        type,
        text: "",
        rel,
        target: element.getAttribute("target"),
        nofollow: rel.includes("nofollow"),
      };
      facts.links.push(record);
      const buffer = { record, text: "" };
      active = buffer;
      element.onEndTag(() => {
        record.text = collapseWhitespace(buffer.text).slice(0, 300);
        if (record.text.length === 0) facts.emptyText += 1;
        if (active === buffer) active = null;
      });
    },
    text(chunk) {
      if (active !== null && active.text.length < 2000) active.text += chunk.text;
    },
  });

  await transformsToResponse(rewriter, html).text();
  return facts;
}
