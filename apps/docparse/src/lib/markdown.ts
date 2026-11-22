import { LIMITS } from "./limits";
import { collapseSpaces, countWords, truncateText } from "./text";
import { sanitizeHref, sanitizeImageSrc } from "./url";
import { rewriteHtml } from "./html";

/**
 * HTML to markdown with HTMLRewriter. A small sink collects chunks, keeps
 * list/quote/table state and trims marker spacing; `normalizeMarkdown` then
 * fixes blank lines, drops empty links and removes stray tag-like text.
 */

const SKIP_SELECTOR =
  "head, script, style, noscript, template, svg, math, nav, header, footer, aside, form, iframe, object, canvas, button, select, textarea";

const PARAGRAPH_SELECTOR = "p, div, section, article, main, figure, figcaption, address, details, summary, dl, dt, dd, fieldset";

const MAX_TITLE_CHARS = 300;
const MAX_ALT_CHARS = 200;

export interface HtmlMarkdownResult {
  markdown: string;
  title: string | null;
  characters: number;
  words: number;
  truncated: boolean;
}

export interface MarkdownOptions {
  baseUrl?: string | null;
  maxChars?: number;
}

const TAG_LIKE = /<\/?[a-z][a-z0-9-]*(?:\s[^>\n]{0,200})?\/?>/gi;
const EMPTY_LINK = /[ \t]*!?\[\]\([^)\s]*\)[ \t]*/g;

/**
 * Cleans the raw markdown: trims trailing whitespace, collapses two or more
 * blank lines, drops empty links/images, removes tag-like leftovers outside
 * fenced code blocks and strips leading/trailing blank lines.
 */
export function normalizeMarkdown(input: string): string {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;
  let blanks = 0;
  for (const rawLine of lines) {
    const isFence = /^\s*```/.test(rawLine);
    if (inFence) {
      out.push(rawLine.replace(/[ \t]+$/, ""));
      if (isFence) inFence = false;
      continue;
    }
    const stripped = rawLine.replace(/[ \t]+$/, "");
    if (isFence) {
      inFence = true;
      blanks = 0;
      out.push(stripped);
      continue;
    }
    const line = stripped
      .replace(TAG_LIKE, "")
      .replace(EMPTY_LINK, " ")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+$/, "");
    const normalizedLine = line === " " ? "" : line;
    if (normalizedLine === "") {
      blanks += 1;
      if (blanks > 1) continue;
      out.push("");
      continue;
    }
    blanks = 0;
    out.push(normalizedLine);
  }
  while (out.length > 0 && out[0] === "") out.shift();
  while (out.length > 0 && out[out.length - 1] === "") out.pop();
  return out.join("\n");
}

/** Collects markdown chunks while tracking list, quote, table and code state. */
class MarkdownSink {
  private readonly parts: string[] = [];
  private lastChar = "";
  private atLineStart = true;
  private afterOpenMarker = false;
  private quoteDepth = 0;
  private skipDepth = 0;
  private codeDepth = 0;
  private codeParts: string[] = [];
  private codeLang: string | null = null;
  private listStack: Array<{ ordered: boolean; index: number }> = [];
  private tableDepth = 0;
  private rowIndex = 0;
  private cellCount = 0;

  get skipping(): boolean {
    return this.skipDepth > 0;
  }

  get inCode(): boolean {
    return this.codeDepth > 0;
  }

  get inTable(): boolean {
    return this.tableDepth > 0;
  }

  get listDepth(): number {
    return this.listStack.length;
  }

  enterSkip(): void {
    this.skipDepth += 1;
  }

  leaveSkip(): void {
    this.skipDepth = Math.max(0, this.skipDepth - 1);
  }

  toString(): string {
    return this.parts.join("");
  }

  text(raw: string): void {
    if (this.skipDepth > 0 || !raw) return;
    if (this.codeDepth > 0) {
      this.codeParts.push(raw);
      return;
    }
    let collapsed = raw.replace(/\s+/g, " ");
    if (this.afterOpenMarker) {
      collapsed = collapsed.replace(/^ /, "");
      this.afterOpenMarker = false;
    }
    if (collapsed) this.write(collapsed, true);
  }

  openMarker(value: string): void {
    if (this.skipDepth > 0 || this.codeDepth > 0) return;
    this.write(value, false);
    this.afterOpenMarker = true;
  }

  closeMarker(value: string): void {
    if (this.skipDepth > 0 || this.codeDepth > 0) return;
    this.trimTrailingSpaces();
    this.write(value, false);
    this.afterOpenMarker = false;
  }

  /** Raw block punctuation (table pipes, fences, list bullets). */
  punct(value: string): void {
    if (this.skipDepth > 0 || this.codeDepth > 0 || !value) return;
    this.write(value, false);
  }

  blockBreak(): void {
    if (this.skipDepth > 0 || this.codeDepth > 0 || this.tableDepth > 0) return;
    this.newlines(2);
  }

  lineBreak(): void {
    if (this.skipDepth > 0 || this.codeDepth > 0) return;
    this.newlines(1);
  }

  enterQuote(): void {
    this.quoteDepth += 1;
  }

  leaveQuote(): void {
    this.quoteDepth = Math.max(0, this.quoteDepth - 1);
  }

  enterList(ordered: boolean): void {
    this.listStack.push({ ordered, index: 0 });
  }

  leaveList(): void {
    this.listStack.pop();
  }

  writeListItem(): void {
    if (this.skipDepth > 0 || this.codeDepth > 0) return;
    const context = this.listStack[this.listStack.length - 1];
    const indent = "  ".repeat(Math.max(0, this.listStack.length - 1));
    let marker = "- ";
    if (context && context.ordered) {
      context.index += 1;
      marker = `${context.index}. `;
    }
    this.write(indent + marker, false);
  }

  startCode(): void {
    if (this.skipDepth > 0) return;
    this.blockBreak();
    this.codeDepth = 1;
    this.codeParts = [];
    this.codeLang = null;
  }

  setCodeLang(language: string | null): void {
    if (language && this.codeDepth > 0) this.codeLang = language;
  }

  endCode(): void {
    if (this.codeDepth === 0) return;
    this.codeDepth = 0;
    if (this.skipDepth > 0) {
      this.codeParts = [];
      return;
    }
    const code = this.codeParts.join("").replace(/^\n+/, "").replace(/\s+$/, "");
    this.codeParts = [];
    const fence = "```";
    this.newlines(2);
    this.punct(`${fence}${this.codeLang ?? ""}`);
    this.punct("\n");
    if (code) {
      this.punct(code);
      this.punct("\n");
    }
    this.punct(fence);
    this.newlines(2);
  }

  startTable(): void {
    if (this.skipDepth > 0) return;
    this.tableDepth += 1;
    this.rowIndex = 0;
    this.cellCount = 0;
  }

  endTable(): void {
    if (this.skipDepth > 0) return;
    this.tableDepth = Math.max(0, this.tableDepth - 1);
    if (this.tableDepth === 0) this.rowIndex = 0;
  }

  startRow(): void {
    if (this.skipDepth > 0 || this.tableDepth !== 1) return;
    this.newlines(1);
    this.punct("|");
    this.cellCount = 0;
  }

  countCell(): void {
    if (this.cellCount < 64) this.cellCount += 1;
  }

  endRow(): void {
    if (this.skipDepth > 0 || this.tableDepth !== 1) return;
    // Cells terminate themselves with " |", so the row only needs its newline.
    this.punct("\n");
    if (this.rowIndex === 0 && this.cellCount > 0) {
      this.punct(`|${" --- |".repeat(this.cellCount)}`);
      this.punct("\n");
    }
    this.rowIndex += 1;
    this.atLineStart = true;
  }

  private write(value: string, collapse: boolean): void {
    if (!value) return;
    let chunk = value;
    if (this.atLineStart) {
      if (collapse) chunk = chunk.replace(/^[ \t]+/, "");
      if (!chunk) return;
      if (this.quoteDepth > 0) this.push(`${"> ".repeat(this.quoteDepth)}`);
      this.atLineStart = false;
    }
    if (collapse && this.lastChar === " " && chunk.startsWith(" ")) chunk = chunk.slice(1);
    if (chunk) this.push(chunk);
  }

  private push(value: string): void {
    if (!value) return;
    this.parts.push(value);
    this.lastChar = value[value.length - 1] ?? "";
  }

  private newlines(count: number): void {
    this.trimTrailingSpaces();
    const existing = this.countTrailingNewlines();
    for (let index = existing; index < count; index += 1) this.push("\n");
    if (count > 0) this.atLineStart = true;
  }

  private countTrailingNewlines(): number {
    let count = 0;
    for (let index = this.parts.length - 1; index >= 0; index -= 1) {
      const part = this.parts[index] as string;
      let cursor = part.length - 1;
      while (cursor >= 0 && part[cursor] === "\n") {
        count += 1;
        cursor -= 1;
      }
      if (cursor >= 0) break;
    }
    return count;
  }

  private trimTrailingSpaces(): void {
    for (;;) {
      if (this.parts.length === 0) {
        this.lastChar = "";
        return;
      }
      const last = this.parts[this.parts.length - 1] as string;
      const trimmed = last.replace(/[ \t]+$/, "");
      if (trimmed === last) return;
      if (trimmed.length === 0) {
        this.parts.pop();
        const next = this.parts[this.parts.length - 1];
        this.lastChar = next ? (next[next.length - 1] ?? "") : "";
        continue;
      }
      this.parts[this.parts.length - 1] = trimmed;
      this.lastChar = trimmed[trimmed.length - 1] ?? "";
      return;
    }
  }
}

function escapeAlt(value: string): string {
  return collapseSpaces(value).trim().slice(0, MAX_ALT_CHARS).replace(/[[\]]/g, "");
}

/**
 * Converts HTML to markdown: headings, bold/italic, links, images, lists,
 * blockquotes, fenced code blocks, horizontal rules, pipe tables and
 * paragraphs. Scripts, styles, navigation and other chrome are dropped.
 */
export async function htmlToMarkdown(input: string, options: MarkdownOptions = {}): Promise<HtmlMarkdownResult> {
  const baseUrl = options.baseUrl ?? null;
  const sink = new MarkdownSink();
  let titleBuffer = "";
  let headingBuffer = "";

  const rewriter = new HTMLRewriter()
    .on(SKIP_SELECTOR, {
      element(element) {
        sink.enterSkip();
        element.onEndTag(() => sink.leaveSkip());
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
    .on("html", {
      text(text) {
        sink.text(text.text);
      },
    })
    .on(PARAGRAPH_SELECTOR, {
      element(element) {
        if (sink.skipping) return;
        if (sink.listDepth > 0) sink.lineBreak();
        else sink.blockBreak();
        element.onEndTag(() => {
          if (sink.listDepth > 0) sink.lineBreak();
          else sink.blockBreak();
        });
      },
    })
    .on("h1, h2, h3, h4, h5, h6", {
      element(element) {
        if (sink.skipping) return;
        const level = Number.parseInt(element.tagName.slice(1), 10) || 1;
        sink.blockBreak();
        sink.punct(`${"#".repeat(Math.min(Math.max(level, 1), 6))} `);
        element.onEndTag(() => sink.blockBreak());
      },
    })
    .on("blockquote", {
      element(element) {
        if (sink.skipping) return;
        sink.blockBreak();
        sink.enterQuote();
        element.onEndTag(() => {
          sink.leaveQuote();
          sink.blockBreak();
        });
      },
    })
    .on("ul, ol", {
      element(element) {
        if (sink.skipping) return;
        sink.blockBreak();
        sink.enterList(element.tagName === "ol");
        element.onEndTag(() => {
          sink.leaveList();
          sink.blockBreak();
        });
      },
    })
    .on("li", {
      element(element) {
        if (sink.skipping) return;
        sink.lineBreak();
        sink.writeListItem();
        element.onEndTag(() => sink.lineBreak());
      },
    })
    .on("pre", {
      element(element) {
        if (sink.skipping) return;
        sink.startCode();
        element.onEndTag(() => sink.endCode());
      },
    })
    .on("pre code[class]", {
      element(element) {
        const className = element.getAttribute("class") ?? "";
        const match = /(?:^|\s)language-([A-Za-z0-9+#._-]+)/.exec(className);
        if (match) sink.setCodeLang(match[1] ?? null);
      },
    })
    .on("code", {
      element(element) {
        if (sink.skipping || sink.inCode) return;
        sink.openMarker("`");
        element.onEndTag(() => sink.closeMarker("`"));
      },
    })
    .on("strong, b", {
      element(element) {
        if (sink.skipping) return;
        sink.openMarker("**");
        element.onEndTag(() => sink.closeMarker("**"));
      },
    })
    .on("em, i", {
      element(element) {
        if (sink.skipping) return;
        sink.openMarker("*");
        element.onEndTag(() => sink.closeMarker("*"));
      },
    })
    .on("del, s, strike", {
      element(element) {
        if (sink.skipping) return;
        sink.openMarker("~~");
        element.onEndTag(() => sink.closeMarker("~~"));
      },
    })
    .on("a", {
      element(element) {
        if (sink.skipping) return;
        const href = sanitizeHref(element.getAttribute("href"), baseUrl);
        if (!href) return;
        sink.openMarker("[");
        element.onEndTag(() => sink.closeMarker(`](${href})`));
      },
    })
    .on("img", {
      element(element) {
        if (sink.skipping) return;
        const alt = escapeAlt(element.getAttribute("alt") ?? "");
        const src = sanitizeImageSrc(element.getAttribute("src"), baseUrl);
        if (src) sink.punct(`![${alt}](${src})`);
        else if (alt) sink.text(alt);
      },
    })
    .on("br", {
      element() {
        sink.lineBreak();
      },
    })
    .on("hr", {
      element() {
        sink.blockBreak();
        sink.punct("---");
        sink.blockBreak();
      },
    })
    .on("table", {
      element(element) {
        if (sink.skipping) return;
        sink.blockBreak();
        sink.startTable();
        element.onEndTag(() => {
          sink.endTable();
          sink.blockBreak();
        });
      },
    })
    .on("tr", {
      element(element) {
        if (sink.skipping) return;
        sink.startRow();
        element.onEndTag(() => sink.endRow());
      },
    })
    .on("td, th", {
      element(element) {
        if (sink.skipping) return;
        sink.punct(" ");
        sink.countCell();
        element.onEndTag(() => sink.punct(" |"));
      },
    });

  await rewriteHtml(input, rewriter);

  const markdown = normalizeMarkdown(sink.toString());
  const capped = truncateText(markdown, options.maxChars ?? LIMITS.maxTextChars);
  const title =
    collapseSpaces(titleBuffer).trim().slice(0, MAX_TITLE_CHARS) ||
    collapseSpaces(headingBuffer).trim().slice(0, MAX_TITLE_CHARS) ||
    null;
  return {
    markdown: capped.text,
    title,
    characters: capped.text.length,
    words: countWords(capped.text),
    truncated: capped.truncated,
  };
}
