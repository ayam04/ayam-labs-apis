import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { findZipEntry, listZipEntryNames, readZipEntry } from "../src/lib/zip";
import {
  blocksToText,
  decodeXmlEntities,
  documentXmlToBlocks,
  extractDocxText,
  headingLevelFromStyle,
  parseTagAttributes,
  tableToMarkdown,
} from "../src/lib/docx";
import type { DocxBlock } from "../src/lib/docx";

const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Quarterly report</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Revenue grew </w:t></w:r><w:r><w:t>12%</w:t></w:r><w:r><w:t xml:space="preserve"> year on year.</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Highlights</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>North region</w:t></w:r></w:p>
    <w:p><w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Germany</w:t></w:r></w:p>
    <w:p><w:r><w:t>&amp; entity test</w:t></w:r><w:r><w:tab/><w:t>after tab</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>Region</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Revenue</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>North</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>1200 | 300</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
    <w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:t>Appendix</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`;

describe("decodeXmlEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeXmlEntities("a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;")).toBe("a & b < c > d \"e\" 'f'");
    expect(decodeXmlEntities("&#65;&#x42;&#8212;")).toBe("AB\u2014");
  });

  it("leaves text without entities untouched", () => {
    expect(decodeXmlEntities("plain text")).toBe("plain text");
  });
});

describe("parseTagAttributes", () => {
  it("parses namespaced attributes", () => {
    expect(parseTagAttributes(' w:val="Heading1" xml:space="preserve"')).toEqual({
      "w:val": "Heading1",
      "xml:space": "preserve",
    });
  });

  it("supports single quoted values", () => {
    expect(parseTagAttributes(" w:val='2'")).toEqual({ "w:val": "2" });
  });

  it("returns an empty object when there are no attributes", () => {
    expect(parseTagAttributes("")).toEqual({});
  });
});

describe("headingLevelFromStyle", () => {
  it("maps the built-in heading styles", () => {
    expect(headingLevelFromStyle("Heading1")).toBe(1);
    expect(headingLevelFromStyle("Heading3")).toBe(3);
    expect(headingLevelFromStyle("Title")).toBe(1);
    expect(headingLevelFromStyle("Subtitle")).toBe(2);
  });

  it("maps localized spellings word writes for heading 2", () => {
    expect(headingLevelFromStyle("berschrift2")).toBe(2);
    expect(headingLevelFromStyle("Titre1")).toBe(1);
  });

  it("returns null for body text styles", () => {
    expect(headingLevelFromStyle("Normal")).toBeNull();
    expect(headingLevelFromStyle(null)).toBeNull();
    expect(headingLevelFromStyle("")).toBeNull();
  });
});

describe("documentXmlToBlocks", () => {
  const parsed = documentXmlToBlocks(DOCUMENT_XML);

  it("captures heading, paragraph, list and table blocks in order", () => {
    const kinds = parsed.blocks.map((block) => (block.kind === "table" ? "table" : block.headingLevel !== null ? "h" : block.listLevel !== null ? "li" : "p"));
    expect(kinds).toEqual(["h", "p", "h", "li", "li", "p", "table", "h"]);
  });

  it("joins runs of the same paragraph and decodes entities", () => {
    const paragraph = parsed.blocks[1];
    expect(paragraph).toMatchObject({ kind: "paragraph", text: "Revenue grew 12% year on year.", headingLevel: null });
    const entity = parsed.blocks[5];
    expect(entity).toMatchObject({ text: "& entity test after tab" });
  });

  it("keeps list nesting levels", () => {
    const first = parsed.blocks[3];
    const nested = parsed.blocks[4];
    expect(first).toMatchObject({ listLevel: 0, text: "North region" });
    expect(nested).toMatchObject({ listLevel: 1, text: "Germany" });
  });

  it("reads table rows and cells", () => {
    const table = parsed.blocks.find((block): block is Extract<DocxBlock, { kind: "table" }> => block.kind === "table");
    expect(table?.rows).toEqual([
      ["Region", "Revenue"],
      ["North", "1200 | 300"],
    ]);
  });

  it("treats numId 0 as plain text, not a list", () => {
    const xml = '<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr></w:pPr><w:r><w:t>Plain</w:t></w:r></w:p>';
    const block = documentXmlToBlocks(xml).blocks[0];
    expect(block).toMatchObject({ text: "Plain", listLevel: null });
  });

  it("uses outline levels when no style is set", () => {
    const xml = '<w:p><w:pPr><w:outlineLvl w:val="2"/></w:pPr><w:r><w:t>Third level</w:t></w:r></w:p>';
    expect(documentXmlToBlocks(xml).blocks[0]).toMatchObject({ headingLevel: 3 });
  });

  it("ignores empty paragraphs and deleted text", () => {
    const xml =
      '<w:p><w:pPr/></w:p><w:p><w:del><w:r><w:delText>gone</w:delText></w:r></w:del></w:p>';
    expect(documentXmlToBlocks(xml).blocks).toEqual([]);
  });
});

describe("blocksToText", () => {
  it("renders the documented shape", () => {
    const text = blocksToText(documentXmlToBlocks(DOCUMENT_XML).blocks);
    expect(text).toBe(
      [
        "# Quarterly report",
        "",
        "Revenue grew 12% year on year.",
        "",
        "## Highlights",
        "",
        "- North region",
        "  - Germany",
        "",
        "& entity test after tab",
        "",
        "| Region | Revenue |",
        "| --- | --- |",
        "| North | 1200 \\| 300 |",
        "",
        "# Appendix",
      ].join("\n"),
    );
  });

  it("returns an empty string for no blocks", () => {
    expect(blocksToText([])).toBe("");
  });
});

describe("tableToMarkdown", () => {
  it("pads short rows and escapes pipes", () => {
    expect(tableToMarkdown([["a", "b", "c"], ["d"]])).toBe("| a | b | c |\n| --- | --- | --- |\n| d |  |  |");
  });

  it("returns an empty string for empty tables", () => {
    expect(tableToMarkdown([])).toBe("");
  });
});

describe("zip helpers", () => {
  const files = {
    "word/document.xml": strToU8(DOCUMENT_XML),
    "[Content_Types].xml": strToU8("<Types/>"),
    "word/stored.txt": [strToU8("plain stored"), { level: 0 as const }] as [Uint8Array, { level: 0 }],
  };
  const archive = zipSync(files);

  it("locates an entry through the central directory", () => {
    const entry = findZipEntry(archive, "word/document.xml");
    expect(entry).not.toBeNull();
    expect(entry?.method).toBe(8);
    expect(entry?.uncompressedSize).toBe(strToU8(DOCUMENT_XML).length);
  });

  it("inflates an entry back to the original bytes", () => {
    const entry = findZipEntry(archive, "word/document.xml");
    expect(entry).not.toBeNull();
    const inflated = readZipEntry(archive, entry as NonNullable<typeof entry>, 1024 * 1024);
    expect(new TextDecoder().decode(inflated)).toBe(DOCUMENT_XML);
  });

  it("reads stored entries without inflating", () => {
    const entry = findZipEntry(archive, "word/stored.txt");
    expect(entry?.method).toBe(0);
    expect(new TextDecoder().decode(readZipEntry(archive, entry as NonNullable<typeof entry>, 1024))).toBe("plain stored");
  });

  it("lists entry names", () => {
    expect(listZipEntryNames(archive).sort()).toEqual(["[Content_Types].xml", "word/document.xml", "word/stored.txt"]);
  });

  it("returns null for missing entries and non zips", () => {
    expect(findZipEntry(archive, "word/missing.xml")).toBeNull();
    expect(findZipEntry(new Uint8Array(32), "word/document.xml")).toBeNull();
  });

  it("enforces the uncompressed size cap", () => {
    const entry = findZipEntry(archive, "word/document.xml");
    expect(() => readZipEntry(archive, entry as NonNullable<typeof entry>, 10)).toThrowError(/too large/);
  });
});

describe("extractDocxText", () => {
  it("runs the whole pipeline on a zip built in the test", () => {
    const archive = zipSync({
      "word/document.xml": strToU8(DOCUMENT_XML),
      "[Content_Types].xml": strToU8("<Types/>"),
    });
    const result = extractDocxText(archive);
    expect(result.text.startsWith("# Quarterly report")).toBe(true);
    expect(result.paragraphs).toBe(7);
    expect(result.headings).toBe(3);
    expect(result.listItems).toBe(2);
    expect(result.tables).toBe(1);
    expect(result.words).toBeGreaterThan(10);
    expect(result.characters).toBe(result.text.length);
    expect(result.truncated).toBe(false);
  });

  it("rejects a file that is not a zip with 422", () => {
    try {
      extractDocxText(strToU8("this is not a docx"));
      throw new Error("expected a 422");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(422);
      expect((error as { code?: string }).code).toBe("UNSUPPORTED_MEDIA");
    }
  });

  it("rejects a zip without word/document.xml", () => {
    const archive = zipSync({ "word/styles.xml": strToU8("<styles/>") });
    expect(() => extractDocxText(archive)).toThrowError(/word\/document\.xml/);
  });
});
