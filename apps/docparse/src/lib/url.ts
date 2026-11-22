const BLOCKED_SCHEMES = /^(?:javascript|data|vbscript|file|blob|about|jar|chrome|opera|view-source):/i;

/**
 * Resolves a link or image URL found in HTML and drops anything unsafe or
 * unusable (javascript:, data:, in-page anchors, oversized URLs). Relative
 * URLs are resolved against `baseUrl` when one is known.
 */
export function sanitizeHref(raw: string | null | undefined, baseUrl?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  if (trimmed.startsWith("#")) return null;
  if (BLOCKED_SCHEMES.test(trimmed)) return null;
  try {
    const url = baseUrl ? new URL(trimmed, baseUrl) : new URL(trimmed);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
    if (url.protocol === "mailto:" || url.protocol === "tel:") return url.toString();
    return null;
  } catch {
    return null;
  }
}

/** Like sanitizeHref but restricted to http(s), for markdown image sources. */
export function sanitizeImageSrc(raw: string | null | undefined, baseUrl?: string | null): string | null {
  const resolved = sanitizeHref(raw, baseUrl);
  if (!resolved) return null;
  return /^https?:/i.test(resolved) ? resolved : null;
}
