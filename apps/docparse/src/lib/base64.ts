import { ApiError, ErrorCode } from "@api/core";

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Splits an optional `data:<mime>;base64,` prefix off a base64 payload and
 * reports the declared media type.
 */
export function splitDataUrl(input: string): { mediaType: string | null; payload: string } {
  const match = /^data:([^;,]*)(?:;[^,]*)?;base64,/i.exec(input);
  if (!match) return { mediaType: null, payload: input };
  return { mediaType: (match[1] ?? "").trim().toLowerCase() || null, payload: input.slice(match[0].length) };
}

/** Removes whitespace/newlines that clients insert when wrapping base64. */
export function compactBase64(input: string): string {
  return input.replace(/\s+/g, "");
}

/** Byte length a base64 string decodes to, without decoding it. */
export function estimateBase64Bytes(encoded: string): number {
  const compact = compactBase64(encoded);
  if (compact.length === 0) return 0;
  let padding = 0;
  if (compact.endsWith("==")) padding = 2;
  else if (compact.endsWith("=")) padding = 1;
  const bytes = Math.floor((compact.length * 3) / 4) - padding;
  return bytes > 0 ? bytes : 0;
}

function padBase64(input: string): string {
  const remainder = input.length % 4;
  if (remainder === 0) return input;
  if (remainder === 1) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Body is not valid base64", {
      hint: "Base64 length must be a multiple of four once padding is accounted for.",
    });
  }
  return input + "=".repeat(4 - remainder);
}

/**
 * Decodes base64 with a hard byte cap. The size is estimated from the encoded
 * length before `atob` runs, so an oversized payload is rejected before the
 * decoded buffer is allocated.
 */
export function decodeBase64Capped(input: string, maxBytes: number): Uint8Array {
  const { payload } = splitDataUrl(input);
  const compact = compactBase64(payload);
  if (compact.length === 0) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "The base64 field is empty");
  }
  const urlSafe = compact.replace(/-/g, "+").replace(/_/g, "/");
  if (!BASE64_PATTERN.test(urlSafe)) {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Body is not valid base64", {
      hint: "Pass standard base64 (peek with Buffer.from(str, 'base64') or btoa) or a data: URL with a ;base64, marker.",
    });
  }
  const estimated = estimateBase64Bytes(urlSafe);
  if (estimated > maxBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Decoded payload is too large (${estimated} bytes)`, {
      hint: `Maximum supported document size is ${maxBytes} bytes. Send the file as multipart/form-data or a url instead of base64.`,
    });
  }
  const normalized = padBase64(urlSafe);
  let binary: string;
  try {
    binary = atob(normalized);
  } catch {
    throw new ApiError(400, ErrorCode.INVALID_INPUT, "Body is not valid base64");
  }
  if (binary.length > maxBytes) {
    throw new ApiError(413, ErrorCode.PAYLOAD_TOO_LARGE, `Decoded payload is too large (${binary.length} bytes)`, {
      hint: `Maximum supported document size is ${maxBytes} bytes.`,
    });
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Encodes bytes as standard base64 (used by tests and examples). */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(index, index + step)) as unknown as number[]);
  }
  return btoa(binary);
}
