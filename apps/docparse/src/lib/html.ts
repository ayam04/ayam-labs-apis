import { LIMITS } from "./limits";
import { cleanDocumentText, collapseSpaces, countWords, firstByline, truncateText } from "./text";
import { sanitizeHref } from "./url";

/**
 * Readable text extraction with HTMLRewriter. Head, scripts, styles, chrome
 * (nav/header/footer/aside) and forms are skipped, block elements become line
 * breaks, everything else contributes text. No regex based HTML parsing.
 */

const SKIP_SELECTOR =
  "head, script, style, noscript, template, svg, math, nav, header, footer, aside, form, iframe, object, canvas, button, select, textarea";

const BLOCK_SELECTOR =
  "p, div, section, article, main, figure, figcaption, blockquote, pre, li, tr, td, th, h1, h2, h3, h4, h5, h6, ul, ol, dl, dt, dd, table, address, details, summary";

/** Void elements have no end tag, so they are handled without onEndTag. */
const VOID_BLOCK_SELECTOR = "br, hr";

const MAX_LINK_TEXT = 200;

export interface HtmlLink {
  text: string;
  href: string;
}

export interface HtmlTextResult {
  title: string | null;
  byline: string | null;
  text: string;
  characters: number;
  words: number;
  links: HtmlLink[];
  truncated: boolean;
}

export interface HtmlTextOptions {
  includeLinks?: boolean;
  maxChars?: number;
  baseUrl?: string | null;
}

/** Wraps fragments so the universal html selector always has a document. */
export function ensureHtmlDocument(input: string): string {
  if (/<html[\s>]/i.test(input)) return input;
  return `<!doctype html><html><head><title></title></head><body>${input}</body></html>`;
}

/** Runs an HTMLRewriter handler set over a string and returns the text side channel. */
export async function rewriteHtml(input: string, rewriter: HTMLRewriter): Promise<void> {
  const response = new Response(ensureHtmlDocument(input), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  // .text() drains the transformed stream; the handlers collected what we need.
  await rewriter.transform(response).text();
}

/**
 * Extracts the main readable text of an HTML document with its title, a
 * byline-ish opening paragraph and, on request, the outbound links.
 */
export async function htmlToText(input: string, options: HtmlTextOptions = {}): Promise<HtmlTextResult> {
  const includeLinks = options.includeLinks === true;
  const maxChars = options.maxChars ?? LIMITS.maxTextChars;
  const baseUrl = options.baseUrl ?? null;
  const chunks: string[] = [];
  let skipDepth = 0;
  let titleBuffer = "";
  let headingBuffer = "";
  let activeLink: HtmlLink | null = null;
  const links: HtmlLink[] = [];
  const seenHrefs = new Set<string>();

  const finishLink = (): void => {
    if (!activeLink) return;
    const text = collapseSpaces(activeLink.text).trim().slice(0, MAX_LINK_TEXT);
    if (text.length > 0 && !seenHrefs.has(activeLink.href) && links.length < LIMITS.maxLinks) {
      seenHrefs.add(activeLink.href);
      links.push({ text, href: activeLink.href });
    }
    activeLink = null;
  };

  const rewriter = new HTMLRewriter()
    .on(SKIP_SELECTOR, {
      element(element) {
        skipDepth += 1;
        element.onEndTag(() => {
          skipDepth = Math.max(0, skipDepth - 1);
        });
      },
    })
    .on("title", {
      text(text) {
        titleBuffer += text.text;
      },
    })
    .on("h1", {
      text(text) {
        headingBuffer += text.text;
      },
    })
    .on(BLOCK_SELECTOR, {
      element(element) {
        if (skipDepth > 0) return;
        chunks.push("\n");
        element.onEndTag(() => {
          if (skipDepth === 0) chunks.push("\n");
        });
      },
    })
    .on(VOID_BLOCK_SELECTOR, {
      element(element) {
        if (skipDepth > 0) return;
        chunks.push(element.tagName === "hr" ? "\n\n" : "\n");
      },
    })
    .on("a[href]", {
      element(element) {
        if (skipDepth > 0 || !includeLinks) return;
        const href = sanitizeHref(element.getAttribute("href"), baseUrl);
        if (!href) return;
        activeLink = { text: "", href };
        element.onEndTag(() => finishLink());
      },
    })
    .on("html", {
      text(text) {
        if (skipDepth > 0) return;
        chunks.push(text.text);
        if (activeLink) activeLink.text += text.text;
      },
    });

  await rewriteHtml(input, rewriter);

  const cleaned = cleanDocumentText(chunks.join(""));
  const capped = truncateText(cleaned, maxChars);
  const title = collapseSpaces(titleBuffer).trim().slice(0, 300) || collapseSpaces(headingBuffer).trim().slice(0, 300) || null;
  return {
    title,
    byline: firstByline(capped.text),
    text: capped.text,
    characters: capped.text.length,
    words: countWords(capped.text),
    links,
    truncated: capped.truncated,
  };
}
