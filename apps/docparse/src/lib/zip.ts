import { inflateSync } from "fflate";
import { ApiError, ErrorCode } from "@api/core";

/**
 * Minimal zip reader. Only what a .docx needs: locate one entry through the
 * central directory, then inflate exactly that entry. Nothing is written to
 * disk and the uncompressed size is checked against a cap before inflating,
 * so a small archive cannot expand into a huge buffer silently.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
const MAX_COMMENT = 0xffff;

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflate. */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  encrypted: boolean;
}

function readUint16(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return -1;
  return (bytes[offset] as number) | ((bytes[offset + 1] as number) << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return -1;
  return (
    ((bytes[offset] as number) |
      ((bytes[offset + 1] as number) << 8) |
      ((bytes[offset + 2] as number) << 16) |
      ((bytes[offset + 3] as number) << 24)) >>>
    0
  );
}

function decodeAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let index = 0; index < length; index += 1) {
    const byte = bytes[offset + index];
    if (byte === undefined) break;
    out += String.fromCharCode(byte);
  }
  return out;
}

/** Byte range of the central directory, or null when the archive is malformed. */
function findEndOfCentralDirectory(bytes: Uint8Array): { offset: number; entries: number; directoryOffset: number } | null {
  if (bytes.length < EOCD_MIN_SIZE) return null;
  const earliest = Math.max(0, bytes.length - EOCD_MIN_SIZE - MAX_COMMENT);
  for (let offset = bytes.length - EOCD_MIN_SIZE; offset >= earliest; offset -= 1) {
    if (readUint32(bytes, offset) !== EOCD_SIGNATURE) continue;
    const entries = readUint16(bytes, offset + 10);
    const directoryOffset = readUint32(bytes, offset + 16);
    if (entries < 0 || directoryOffset < 0 || directoryOffset >= bytes.length) continue;
    return { offset, entries, directoryOffset };
  }
  return null;
}

/**
 * Finds an entry by exact name. Returns null when the name is absent, when the
 * archive uses ZIP64 sizes, or when the archive cannot be read.
 */
export function findZipEntry(bytes: Uint8Array, name: string): ZipEntry | null {
  const eocd = findEndOfCentralDirectory(bytes);
  if (!eocd) return null;
  let cursor = eocd.directoryOffset;
  const limit = Math.min(bytes.length, eocd.offset);
  for (let index = 0; index < eocd.entries; index += 1) {
    if (cursor + 46 > limit || readUint32(bytes, cursor) !== CENTRAL_SIGNATURE) return null;
    const flags = readUint16(bytes, cursor + 8);
    const method = readUint16(bytes, cursor + 10);
    const compressedSize = readUint32(bytes, cursor + 20);
    const uncompressedSize = readUint32(bytes, cursor + 24);
    const nameLength = readUint16(bytes, cursor + 28);
    const extraLength = readUint16(bytes, cursor + 30);
    const commentLength = readUint16(bytes, cursor + 32);
    const localHeaderOffset = readUint32(bytes, cursor + 42);
    if (nameLength < 0 || localHeaderOffset < 0) return null;
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localHeaderOffset === 0xffffffff) {
      return null; // ZIP64 archives are out of scope for an 8 MB upload
    }
    const entryName = decodeAscii(bytes, cursor + 46, nameLength);
    if (entryName === name) {
      return {
        name: entryName,
        method,
        compressedSize,
        uncompressedSize,
        localHeaderOffset,
        encrypted: (flags & 1) === 1,
      };
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

/** Every entry name in the archive (used to build helpful error messages). */
export function listZipEntryNames(bytes: Uint8Array, maxEntries = 200): string[] {
  const eocd = findEndOfCentralDirectory(bytes);
  if (!eocd) return [];
  const names: string[] = [];
  let cursor = eocd.directoryOffset;
  const limit = Math.min(bytes.length, eocd.offset);
  for (let index = 0; index < eocd.entries && index < maxEntries; index += 1) {
    if (cursor + 46 > limit || readUint32(bytes, cursor) !== CENTRAL_SIGNATURE) break;
    const nameLength = readUint16(bytes, cursor + 28);
    const extraLength = readUint16(bytes, cursor + 30);
    const commentLength = readUint16(bytes, cursor + 32);
    if (nameLength < 0) break;
    names.push(decodeAscii(bytes, cursor + 46, nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

/**
 * Inflates one entry into memory. `maxBytes` is checked against the central
 * directory size before decompression and against the real output afterwards.
 */
export function readZipEntry(bytes: Uint8Array, entry: ZipEntry, maxBytes: number): Uint8Array {
  if (entry.encrypted) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "This archive is encrypted and cannot be read", {
      hint: "Remove the password protection and upload the file again.",
    });
  }
  if (entry.uncompressedSize > maxBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Uncompressed entry is too large (${entry.uncompressedSize} bytes)`, {
      hint: `The uncompressed size of ${entry.name} must stay under ${maxBytes} bytes.`,
    });
  }
  const headerOffset = entry.localHeaderOffset;
  if (readUint32(bytes, headerOffset) !== LOCAL_SIGNATURE) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "The zip central directory does not match the file", {
      hint: "The file is probably truncated or not a real .docx.",
    });
  }
  const nameLength = readUint16(bytes, headerOffset + 26);
  const extraLength = readUint16(bytes, headerOffset + 28);
  if (nameLength < 0 || extraLength < 0) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "Malformed zip local header");
  }
  const dataStart = headerOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataStart < 0 || dataEnd > bytes.length) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "Zip entry data is out of bounds");
  }
  const compressed = bytes.subarray(dataStart, dataEnd);
  if (entry.method === 0) {
    if (compressed.length > maxBytes) {
      throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, "Uncompressed entry is too large");
    }
    return compressed.slice();
  }
  if (entry.method !== 8) {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, `Unsupported zip compression method ${entry.method}`, {
      hint: "Only stored (0) and deflate (8) entries are supported, which covers every real .docx.",
    });
  }
  let inflated: Uint8Array;
  try {
    inflated = inflateSync(compressed);
  } catch {
    throw new ApiError(422, ErrorCode.UNSUPPORTED_MEDIA, "Could not decompress the document body", {
      hint: "The .docx is corrupt or uses an unsupported compression variant.",
    });
  }
  if (inflated.length > maxBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Uncompressed entry is too large (${inflated.length} bytes)`, {
      hint: `The uncompressed size of ${entry.name} must stay under ${maxBytes} bytes.`,
    });
  }
  return inflated;
}
