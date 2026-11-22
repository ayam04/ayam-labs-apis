import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  emptyPdfMetadata,
  isPasswordError,
  metadataFromPdfInfo,
  normalizePdfDate,
  readPdfInfo,
  AUTO_PDF_MAX_BYTES,
  guardPdfCpuBudget,
} from "../src/lib/pdf";

const buildPdf = async (title: string, pages = 2): Promise<Uint8Array> => {
  const document = await PDFDocument.create();
  document.setTitle(title);
  document.setAuthor("DocParse test suite");
  document.setProducer("pdf-lib");
  document.setCreator("vitest");
  document.setCreationDate(new Date("2024-01-02T03:04:05.000Z"));
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pages; index += 1) {
    const page = document.addPage([300, 200]);
    page.drawText("page " + (index + 1), { x: 20, y: 150, size: 12, font, color: rgb(0, 0, 0) });
  }
  return await document.save();
};

describe("normalizePdfDate", () => {
  it("converts pdf date syntax with a positive offset to iso utc", () => {
    expect(normalizePdfDate("D:20240101120000+05'30'")).toBe("2024-01-01T06:30:00.000Z");
  });

  it("handles the trailing Z form and missing parts", () => {
    expect(normalizePdfDate("D:20240101120000Z")).toBe("2024-01-01T12:00:00.000Z");
    expect(normalizePdfDate("D:2024")).toBe("2024-01-01T00:00:00.000Z");
  });

  it("passes through parseable non standard strings", () => {
    expect(normalizePdfDate("2024-03-04T05:06:07Z")).toBe("2024-03-04T05:06:07.000Z");
  });

  it("returns null for empty values", () => {
    expect(normalizePdfDate(null)).toBeNull();
    expect(normalizePdfDate("   ")).toBeNull();
  });
});

describe("metadataFromPdfInfo", () => {
  it("maps the pdfjs info dictionary keys", () => {
    expect(
      metadataFromPdfInfo({
        Title: " A title ",
        Author: "An author",
        Producer: "pdfTeX",
        Creator: "LaTeX",
        CreationDate: "D:20200601000000Z",
      }),
    ).toEqual({
      title: "A title",
      author: "An author",
      producer: "pdfTeX",
      creator: "LaTeX",
      creationDate: "2020-06-01T00:00:00.000Z",
    });
  });

  it("returns nulls for a missing dictionary", () => {
    expect(metadataFromPdfInfo(null)).toEqual(emptyPdfMetadata());
  });
});

describe("isPasswordError", () => {
  it("recognises the pdfjs PasswordException", () => {
    const error = new Error("No password given");
    error.name = "PasswordException";
    expect(isPasswordError(error)).toBe(true);
  });

  it("recognises password wording in a message", () => {
    expect(isPasswordError(new Error("Incorrect Password"))).toBe(true);
  });

  it("is false for unrelated errors", () => {
    expect(isPasswordError(new Error("Invalid PDF structure"))).toBe(false);
    expect(isPasswordError(null)).toBe(false);
  });
});

describe("readPdfInfo", () => {
  it("reads page count, metadata and version from a real pdf", async () => {
    const bytes = await buildPdf("Quarterly report", 3);
    const info = await readPdfInfo(bytes);
    expect(info.pageCount).toBe(3);
    expect(info.pdfVersion).toBe("1.7");
    expect(info.encrypted).toBe(false);
    expect(info.fileSizeBytes).toBe(bytes.byteLength);
    expect(info.metadata.title).toBe("Quarterly report");
    expect(info.metadata.author).toBe("DocParse test suite");
    expect(info.metadata.creationDate).toBe("2024-01-02T03:04:05.000Z");
  });

  it("rejects a non pdf payload with 422 before parsing", async () => {
    const bytes = new TextEncoder().encode("<html>not a pdf</html>");
    await expect(readPdfInfo(bytes)).rejects.toMatchObject({ status: 422, code: "UNSUPPORTED_MEDIA" });
  });
});

describe('PDF CPU budget guard', () => {
  it('refuses a large document on the full-extraction path', () => {
    const big = new Uint8Array(AUTO_PDF_MAX_BYTES + 1);
    expect(() => guardPdfCpuBudget(big, null)).toThrowError(/too large to extract in one pass/i);
    try {
      guardPdfCpuBudget(big, null);
    } catch (error) {
      const err = error as { status?: number; code?: string };
      expect(err.status).toBe(413);
      expect(err.code).toBe('PAYLOAD_TOO_LARGE');
    }
  });
  it('lets a page selection through, whatever the size', () => {
    const big = new Uint8Array(AUTO_PDF_MAX_BYTES + 1);
    expect(() => guardPdfCpuBudget(big, '1-4')).not.toThrow();
  });
  it('lets documents under the threshold through', () => {
    const small = new Uint8Array(1024);
    expect(() => guardPdfCpuBudget(small, null)).not.toThrow();
  });
});