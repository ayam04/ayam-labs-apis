/**
 * Pure parsers for meta-level page data: robots meta directives and JSON-LD
 * blocks. Both are unit tested with hand written fixtures.
 */

import { collapseWhitespace } from "./entities";

export interface RobotsMeta {
  raw: string | null;
  index: boolean;
  follow: boolean;
  directives: string[];
}

/** Parses a robots meta tag (`index, follow`, `noindex`, `none`, `noarchive`...). */
export function parseRobotsMeta(value: string | null | undefined): RobotsMeta {
  const raw = value === null || value === undefined ? null : collapseWhitespace(String(value));
  if (raw === null || raw.length === 0) {
    return { raw, index: true, follow: true, directives: [] };
  }
  const directives = raw
    .toLowerCase()
    .split(/[,\s]+/)
    .map((directive) => directive.trim())
    .filter((directive) => directive.length > 0);

  let index = true;
  let follow = true;
  for (const directive of directives) {
    if (directive === "none") {
      index = false;
      follow = false;
      continue;
    }
    if (directive === "noindex" || directive === "noindex,follow") index = false;
    if (directive === "nofollow" || directive === "index,nofollow") follow = false;
  }
  return { raw, index, follow, directives };
}

export interface JsonLdSummary {
  type: string | null;
  name: string | null;
  headline: string | null;
  description: string | null;
  url: string | null;
  author: string | null;
  datePublished: string | null;
}

export interface JsonLdBlockResult {
  valid: boolean;
  types: string[];
  keys: string[];
  summary: JsonLdSummary;
  error: string | null;
}

const MAX_TYPES = 20;
const MAX_KEYS = 25;
const MAX_SUMMARY_CHARS = 200;
const MAX_NODES = 50;

function emptySummary(): JsonLdSummary {
  return { type: null, name: null, headline: null, description: null, url: null, author: null, datePublished: null };
}

function readString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = collapseWhitespace(value);
    return trimmed.length > 0 ? trimmed.slice(0, MAX_SUMMARY_CHARS) : null;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function readNamed(value: unknown): string | null {
  if (typeof value === "string") return readString(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const name = readNamed(item);
      if (name !== null) return name;
    }
    return null;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readString(record.name) ?? readString(record["@id"]);
  }
  return null;
}

function readType(value: unknown): string | null {
  if (typeof value === "string") return readString(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim().length > 0) return item.trim().slice(0, MAX_SUMMARY_CHARS);
    }
  }
  return null;
}

function collectNodes(value: unknown, depth: number, output: Array<Record<string, unknown>>): void {
  if (depth > 4 || output.length >= MAX_NODES) return;
  if (Array.isArray(value)) {
    for (const item of value) collectNodes(item, depth + 1, output);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  output.push(record);
  if (record["@graph"] !== undefined) collectNodes(record["@graph"], depth + 1, output);
}

/** Parses one JSON-LD block and extracts the types plus a small readable summary. */
export function summarizeJsonLdBlock(raw: string): JsonLdBlockResult {
  const result: JsonLdBlockResult = { valid: false, types: [], keys: [], summary: emptySummary(), error: null };
  const text = String(raw ?? "").trim();
  if (text.length === 0) {
    result.error = "Block is empty";
    return result;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    result.error = "Block is not valid JSON";
    return result;
  }
  result.valid = true;

  const nodes: Array<Record<string, unknown>> = [];
  collectNodes(parsed, 0, nodes);

  const types: string[] = [];
  const keys: string[] = [];
  for (const node of nodes) {
    const type = node["@type"];
    if (typeof type === "string" && types.length < MAX_TYPES && !types.includes(type)) types.push(type);
    if (Array.isArray(type)) {
      for (const entry of type) {
        if (typeof entry === "string" && types.length < MAX_TYPES && !types.includes(entry)) types.push(entry);
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "@context") continue;
      if (keys.length >= MAX_KEYS) break;
      if (!keys.includes(key)) keys.push(key);
    }
  }

  const primary = nodes.find((node) => readString(node.name) !== null || readString(node.headline) !== null) ?? nodes[0];
  if (primary) {
    result.summary = {
      type: readType(primary["@type"]),
      name: readString(primary.name),
      headline: readString(primary.headline),
      description: readString(primary.description),
      url: readString(primary.url) ?? readString(primary["@id"]),
      author: readNamed(primary.author),
      datePublished: readString(primary.datePublished),
    };
  }
  result.types = types;
  result.keys = keys;
  return result;
}
