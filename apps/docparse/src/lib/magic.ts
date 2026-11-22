/**
 * Byte level sniffing helpers. Everything here is pure and runs in any JS
 * runtime, which keeps the format checks testable without workerd.
 */

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04
const ZIP_MAGIC_EMPTY = [0x50, 0x4b, 0x05, 0x06]; // empty archive
const ZIP_MAGIC_SPANNED = [0x50, 0x4b, 0x07, 0x08];

function matchesAt(bytes: Uint8Array, offset: number, pattern: number[]): boolean {
  if (offset < 0 || offset + pattern.length > bytes.length) return false;
  for (let index = 0; index < pattern.length; index += 1) {
    if (bytes[offset + index] !== pattern[index]) return false;
  }
  return true;
}

/** Finds an ASCII needle in a byte array. Returns -1 when absent. */
export function indexOfAscii(bytes: Uint8Array, needle: string, start = 0): number {
  if (needle.length === 0) return -1;
  const limit = bytes.length - needle.length;
  for (let index = Math.max(0, start); index <= limit; index += 1) {
    if (bytes[index] !== needle.charCodeAt(0)) continue;
    let matched = true;
    for (let offset = 1; offset < needle.length; offset += 1) {
      if (bytes[index + offset] !== needle.charCodeAt(offset)) {
        matched = false;
        break;
      }
    }
    if (matched) return index;
  }
  return -1;
}

/**
 * True when "%PDF-" appears in the first 1 KB. PDF readers tolerate leading
 * junk, so a strict offset check would reject otherwise valid files.
 */
export function looksLikePdf(bytes: Uint8Array): boolean {
  const head = bytes.subarray(0, Math.min(bytes.length, 1024));
  return indexOfAscii(head, "%PDF-") >= 0;
}

/** True when the file starts with a zip signature (DOCX, XLSX, PPTX, ZIP). */
export function looksLikeZip(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    matchesAt(bytes, 0, ZIP_MAGIC) || matchesAt(bytes, 0, ZIP_MAGIC_EMPTY) || matchesAt(bytes, 0, ZIP_MAGIC_SPANNED)
  );
}

/**
 * Reads the PDF version from the "%PDF-1.7" header. Returns null when the
 * header is malformed.
 */
export function readPdfVersion(bytes: Uint8Array): string | null {
  const head = bytes.subarray(0, Math.min(bytes.length, 1024));
  const offset = indexOfAscii(head, "%PDF-");
  if (offset < 0) return null;
  let version = "";
  for (let index = offset + 5; index < head.length && version.length < 6; index += 1) {
    const char = String.fromCharCode(head[index] as number);
    if (/[0-9.]/.test(char)) version += char;
    else break;
  }
  return /^\d\.\d$/.test(version) ? version : null;
}

/**
 * Heuristic encryption check: scans for the `/Encrypt` dictionary key that
 * every password protected PDF carries in its trailer. Cheap (no parsing) and
 * only used to report the `encrypted` flag; extraction itself is delegated to
 * pdf.js, which refuses files that need a password.
 */
export function detectPdfEncryption(bytes: Uint8Array): boolean {
  return indexOfAscii(bytes, "/Encrypt") >= 0;
}

/** True when the first bytes look like an HTML or XML document. */
export function looksLikeHtml(input: string): boolean {
  const head = input.slice(0, 2048).trimStart().toLowerCase();
  // A JSON body that happens to contain markup is not HTML.
  if (head.startsWith("{") || head.startsWith("[") || head.startsWith('"')) return false;
  if (!head.startsWith("<") && !head.includes("<body") && !head.includes("<p>")) return false;
  return head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<body") || head.includes("<p>");
}
