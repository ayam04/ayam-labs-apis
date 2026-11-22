/**
 * HTML entity decoding and whitespace normalisation. Kept in its own module so
 * both the pure HTML helpers and the JSON-LD/robots parsers can use it.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ensp: " ", emsp: " ",
  thinsp: " ", copy: "\u00a9", reg: "\u00ae", trade: "\u2122", hellip: "\u2026",
  mdash: "\u2014", ndash: "\u2013", lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c",
  rdquo: "\u201d", laquo: "\u00ab", raquo: "\u00bb", bull: "\u2022", middot: "\u00b7",
  deg: "\u00b0", plusmn: "\u00b1", times: "\u00d7", divide: "\u00f7", frac12: "\u00bd",
  frac14: "\u00bc", frac34: "\u00be", euro: "\u20ac", pound: "\u00a3", yen: "\u00a5",
  cent: "\u00a2", sect: "\u00a7", para: "\u00b6", dagger: "\u2020", permil: "\u2030",
  larr: "\u2190", rarr: "\u2192", uarr: "\u2191", darr: "\u2193", harr: "\u2194",
  infin: "\u221e", ne: "\u2260", le: "\u2264", ge: "\u2265", asymp: "\u2248",
  iexcl: "\u00a1", iquest: "\u00bf", aacute: "\u00e1", eacute: "\u00e9", iacute: "\u00ed",
  oacute: "\u00f3", uacute: "\u00fa", ntilde: "\u00f1", uuml: "\u00fc", ouml: "\u00f6",
  auml: "\u00e4", szlig: "\u00df", ccedil: "\u00e7", agrave: "\u00e0", egrave: "\u00e8",
  ecirc: "\u00ea", ocirc: "\u00f4", AElig: "\u00c6", aelig: "\u00e6", oslash: "\u00f8",
};

function isPrintableCodePoint(code: number): boolean {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return false;
  if (code >= 0xd800 && code <= 0xdfff) return false;
  if (code === 0 || code === 11 || code === 12) return false;
  return true;
}

/** Decodes named and numeric HTML entities. Unknown entities are left untouched. */
export function decodeEntities(input: string): string {
  if (!input || input.indexOf("&") === -1) return input;
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]{1,31});/gi, (match: string, body: string) => {
    if (body.charAt(0) === "#") {
      const hex = body.charAt(1).toLowerCase() === "x";
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return isPrintableCodePoint(code) ? String.fromCodePoint(code) : match;
    }
    const named = NAMED_ENTITIES[body];
    if (named !== undefined) return named;
    const lower = NAMED_ENTITIES[body.toLowerCase()];
    return lower !== undefined ? lower : match;
  });
}

/** Collapses all whitespace runs (including nbsp/zero-width) into single spaces. */
export function collapseWhitespace(value: string): string {
  return String(value ?? "").replace(/[\s\u00a0\u200b\ufeff]+/g, " ").trim();
}
