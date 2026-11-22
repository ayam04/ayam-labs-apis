import { ApiError, ErrorCode } from "@api/core";
import { LIMITS } from "./limits";
import { looksLikeZip } from "./magic";
import { findZipEntry, listZipEntryNames, readZipEntry } from "./zip";
import { countWords, normalizeUnicode, truncateText } from "./text";

/**
 * .docx to text/markdown. The zip is read by `./zip`, then word/document.xml
 * is walked with a small tag scanner (no DOM, no XML parser dependency) that
 * keeps paragraphs, heading styles, list markers and tables.
 */

export type DocxBlock =
  | { kind: "paragraph"; text: string; headingLevel: number | null; listLevel: number | null }
  | { kind: "table"; rows: string[][] };

export interface ParsedDocx {
  blocks: DocxBlock[];
  /** True when the block/row caps were hit. */
  truncated: boolean;
}

export interface DocxSummary {
  paragraphs: number;
  headings: number;
  listItems: number;
  tables: number;
  characters: number;
  words: number;
}

const TAG_PATTERN = /<(\/?)([A-Za-z0-9_:.\-]+)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
const ENTITY_PATTERN = /&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos|nbsp);/g;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decodes the XML entities that appear in WordprocessingML text runs. */
export function decodeXmlEntities(input: string): string {
  if (!input.includes("&")) return input;
  return input.replace(ENTITY_PATTERN, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** Parses the attribute list of one tag into a lowercase-keyed map. */
export function parseTagAttributes(raw: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([A-Za-z0-9_:.\-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null = pattern.exec(raw);
  while (match) {
    const key = (match[1] ?? "").toLowerCase();
    attributes[key] = match[2] ?? match[3] ?? "";
    match = pattern.exec(raw);
  }
  return attributes;
}

/**
 * Maps a Word paragraph style id to a markdown heading level. Handles the
 * built-in "Heading1".."Heading9", "Title", "Subtitle" and the localized
 * "heading 1" spellings Word writes `w:styleId` as.
 */
export function headingLevelFromStyle(styleId: string | null | undefined): number | null {
  if (!styleId) return null;
  const normalized = styleId.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return null;
  if (normalized === "title") return 1;
  if (normalized === "subtitle") return 2;
  const numbered = /(?:heading|kop|berschrift|titre|titulo|encabezado|zaglavie|naglowek)([1-9])/.exec(normalized);
  if (numbered) return Number(numbered[1]);
  const trailing = /^h([1-6])$/.exec(normalized);
  if (trailing) return Number(trailing[1]);
  return null;
}

function cleanParagraphText(input: string): string {
  const normalized = normalizeUnicode(input).replace(/[^\S\n]+/g, " ");
  return normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");
}

interface ParagraphState {
  raw: string;
  styleId: string | null;
  outlineLevel: number | null;
  hasNumbering: boolean;
  numberingLevel: number | null;
  numberingId: string | null;
}

function newParagraphState(): ParagraphState {
  return { raw: "", styleId: null, outlineLevel: null, hasNumbering: false, numberingLevel: null, numberingId: null };
}

/**
 * Converts `word/document.xml` into an ordered list of paragraph and table
 * blocks. Headings, list levels and table cells are preserved; every other
 * piece of XML (styles, drawing objects, field codes) is dropped.
 */
export function documentXmlToBlocks(xml: string): ParsedDocx {
  const blocks: DocxBlock[] = [];
  let truncated = false;
  let paragraph: ParagraphState | null = null;
  let inTextRun = false;
  let lastIndex = 0;
  let tableDepth = 0;
  let currentTable: { rows: string[][] } | null = null;
  let currentRow: string[] | null = null;
  let currentCell: string[] | null = null;

  const appendText = (chunk: string): void => {
    if (!chunk || !paragraph) return;
    paragraph.raw += chunk;
  };

  const finalizeParagraph = (): void => {
    if (!paragraph) return;
    const text = cleanParagraphText(paragraph.raw);
    const headingFromStyle = headingLevelFromStyle(paragraph.styleId);
    const headingFromOutline =
      paragraph.outlineLevel !== null && paragraph.outlineLevel >= 0 && paragraph.outlineLevel <= 8
        ? paragraph.outlineLevel + 1
        : null;
    const headingLevel = headingFromStyle ?? headingFromOutline;
    const listLevel =
      paragraph.hasNumbering && paragraph.numberingId !== "0" ? (paragraph.numberingLevel ?? 0) : null;
    if (text.length > 0) {
      if (currentCell) {
        if (currentCell.length < LIMITS.maxDocxCells * 4) currentCell.push(text);
      } else if (tableDepth === 0) {
        if (blocks.length < LIMITS.maxDocxBlocks) {
          blocks.push({ kind: "paragraph", text, headingLevel, listLevel });
        } else {
          truncated = true;
        }
      }
    }
    paragraph = null;
  };

  const finalizeCell = (): void => {
    if (!currentCell || !currentRow) return;
    const cellText = cleanParagraphText(currentCell.join(" \n "));
    if (currentRow.length < LIMITS.maxDocxCells) currentRow.push(cellText);
    currentCell = null;
  };

  const finalizeRow = (): void => {
    if (!currentRow || !currentTable) {
      currentRow = null;
      return;
    }
    finalizeCell();
    const cells = currentRow;
    currentRow = null;
    const hasContent = cells.some((cell) => cell.trim().length > 0);
    if (!hasContent) return;
    if (currentTable.rows.length >= LIMITS.maxDocxRows) {
      truncated = true;
      return;
    }
    currentTable.rows.push(cells);
  };

  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null = TAG_PATTERN.exec(xml);
  while (match) {
    if (inTextRun) {
      const text = xml.slice(lastIndex, match.index);
      if (text) appendText(decodeXmlEntities(text));
    }
    lastIndex = TAG_PATTERN.lastIndex;
    const closing = match[1] === "/";
    const rawName = match[2] ?? "";
    const attributesRaw = match[3] ?? "";
    const selfClosing = match[4] === "/";
    const localName = (rawName.includes(":") ? rawName.slice(rawName.indexOf(":") + 1) : rawName).toLowerCase();

    if (closing) {
      switch (localName) {
        case "t":
          inTextRun = false;
          break;
        case "p":
          finalizeParagraph();
          break;
        case "tc":
          if (tableDepth === 1) finalizeCell();
          break;
        case "tr":
          if (tableDepth === 1) finalizeRow();
          break;
        case "tbl":
          if (tableDepth > 0) tableDepth -= 1;
          if (tableDepth === 0 && currentTable) {
            if (currentTable.rows.length > 0 && blocks.length < LIMITS.maxDocxBlocks) {
              blocks.push({ kind: "table", rows: currentTable.rows });
            }
            currentTable = null;
          }
          break;
        default:
          break;
      }
      match = TAG_PATTERN.exec(xml);
      continue;
    }

    const attributes = parseTagAttributes(attributesRaw);
    switch (localName) {
      case "t":
        inTextRun = true;
        break;
      case "p":
        finalizeParagraph();
        paragraph = newParagraphState();
        break;
      case "pstyle":
        if (paragraph) paragraph.styleId = attributes["w:val"] ?? attributes["val"] ?? null;
        break;
      case "outlinelvl":
        if (paragraph) {
          const value = Number.parseInt(attributes["w:val"] ?? attributes["val"] ?? "", 10);
          if (Number.isFinite(value)) paragraph.outlineLevel = value;
        }
        break;
      case "numpr":
        if (paragraph) paragraph.hasNumbering = true;
        break;
      case "ilvl":
        if (paragraph) {
          const value = Number.parseInt(attributes["w:val"] ?? attributes["val"] ?? "", 10);
          if (Number.isFinite(value) && value >= 0 && value <= 8) paragraph.numberingLevel = value;
        }
        break;
      case "numid":
        if (paragraph) paragraph.numberingId = attributes["w:val"] ?? attributes["val"] ?? null;
        break;
      case "tab":
        appendText(" ");
        break;
      case "br":
      case "cr":
        appendText(" ");
        break;
      case "nobreakhyphen":
        appendText("-");
        break;
      case "tbl":
        tableDepth += 1;
        if (tableDepth === 1) currentTable = { rows: [] };
        break;
      case "tr":
        if (tableDepth === 1) currentRow = [];
        break;
      case "tc":
        if (tableDepth === 1) currentCell = [];
        break;
      default:
        break;
    }
    if (selfClosing && localName === "t") inTextRun = false;
    match = TAG_PATTERN.exec(xml);
  }
  finalizeParagraph();
  return { blocks, truncated };
}

function escapeTableCell(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim().slice(0, 500);
  return compact.replace(/\|/g, "\\|");
}

/** Renders table rows as a GitHub flavoured pipe table. Best effort only. */
export function tableToMarkdown(rows: string[][]): string {
  const cleaned = rows
    .filter((row) => row.length > 0)
    .map((row) => row.map(escapeTableCell));
  if (cleaned.length === 0) return "";
  const width = Math.max(...cleaned.map((row) => row.length));
  const pad = (row: string[]): string[] => [...row, ...Array.from({ length: width - row.length }, () => "")];
  const lines: string[] = [];
  const header = pad(cleaned[0] as string[]);
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${Array.from({ length: width }, () => "---").join(" | ")} |`);
  for (let index = 1; index < cleaned.length; index += 1) {
    lines.push(`| ${pad(cleaned[index] as string[]).join(" | ")} |`);
  }
  return lines.join("\n");
}

/**
 * Renders blocks as newline separated text where headings keep their markdown
 * prefix ("#"), list items become "- " and tables become pipe tables.
 */
export function blocksToText(blocks: DocxBlock[]): string {
  let output = "";
  let previousWasListItem = false;
  for (const block of blocks) {
    let chunk: string | null = null;
    let isListItem = false;
    if (block.kind === "paragraph") {
      if (block.headingLevel !== null) {
        chunk = `${"#".repeat(Math.min(block.headingLevel, 6))} ${block.text}`;
      } else if (block.listLevel !== null) {
        chunk = `${"  ".repeat(Math.min(block.listLevel, 3))}- ${block.text}`;
        isListItem = true;
      } else {
        chunk = block.text;
      }
    } else {
      const table = tableToMarkdown(block.rows);
      if (table) chunk = table;
    }
    if (chunk === null) continue;
    if (output.length > 0) output += previousWasListItem && isListItem ? "\n" : "\n\n";
    output += chunk;
    previousWasListItem = isListItem;
  }
  return output.trim();
}

/** Counts what the document contained, for the response metadata. */
export function summarizeBlocks(blocks: DocxBlock[], text: string): DocxSummary {
  let paragraphs = 0;
  let headings = 0;
  let listItems = 0;
  let tables = 0;
  for (const block of blocks) {
    if (block.kind === "table") {
      tables += 1;
      continue;
    }
    paragraphs += 1;
    if (block.headingLevel !== null) headings += 1;
    else if (block.listLevel !== null) listItems += 1;
  }
  return { paragraphs, headings, listItems, tables, characters: text.length, words: countWords(text) };
}

export interface DocxExtraction extends DocxSummary {
  text: string;
  truncated: boolean;
}

/** Full .docx pipeline: signature check, unzip, XML walk, text rendering. */
export function extractDocxText(bytes: Uint8Array): DocxExtraction {
  if (!looksLikeZip(bytes)) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "This file is not a .docx document", {
      hint: "A .docx is a zip archive and must start with the PK signature (50 4B 03 04). For legacy .doc files, save as .docx first.",
    });
  }
  const entry = findZipEntry(bytes, "word/document.xml");
  if (!entry) {
    const names = listZipEntryNames(bytes, 50);
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "This zip archive does not contain word/document.xml", {
      hint: "Only WordprocessingML (.docx) files are supported. For legacy .doc or .rtf, convert to .docx first.",
      details: names.slice(0, 20),
    });
  }
  const xmlBytes = readZipEntry(bytes, entry, LIMITS.maxDocxXmlBytes);
  const xml = new TextDecoder().decode(xmlBytes);
  const { blocks, truncated: blocksTruncated } = documentXmlToBlocks(xml);
  const rendered = blocksToText(blocks);
  const { text, truncated: textTruncated } = truncateText(rendered, LIMITS.maxTextChars);
  const summary = summarizeBlocks(blocks, text);
  return { ...summary, text, truncated: blocksTruncated || textTruncated };
}
