import pathlib

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
DOCS = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\docs")

p = PUB / "docparse.html"
t = p.read_text(encoding="utf-8")
before = t
t = t.replace(
  "8MB input, 100 pages per request, explicit truncation flags. Predictable cost per call.",
  "8MB input, 4 pages per request (a measured CPU limit), explicit truncation flags. Predictable cost per call.")
p.write_text(t, encoding="utf-8")
print("docparse page:", "changed" if t != before else "no match")

fixes = {
    "docparse-long.md": [("A 100-page PDF extracts in roughly 3 seconds. A 16-page paper takes under a second.",
                          "A four-page extraction takes roughly a second. Longer documents are fetched in four-page slices with /v1/pdf/pages.")],
    "docparse.md": [("8 MB per PDF or DOCX, 100 pages per PDF request, 500,000 characters for an inline HTML field, 5 MB of fetched HTML",
                     "8 MB per PDF or DOCX, 4 pages per PDF request, 500,000 characters for an inline HTML field, 5 MB of fetched HTML"),
                    ("The document had more than 100 pages, or the extracted text passed 1,000,000 characters. pagesReturn",
                     "The document had more pages than one call extracts, or the text passed 1,000,000 characters. pagesReturn")],
    "DEMAND.md": [("| DocParse, 100-page PDF | page | **$0.0005** per page | $0.00075 | at parity with the cheapest OCR",
                   "| DocParse, 100-page PDF | page | **$0.0125** per page (4 pages per call) | $0.00075 | 17x the cheapest OCR")],
    "listings/docparse.md": [("100 pages", "4 pages")],
}
for name, pairs in fixes.items():
    f = DOCS / name
    if not f.exists():
        print(name, "missing")
        continue
    t = f.read_text(encoding="utf-8")
    before = t
    for old, new in pairs:
        t = t.replace(old, new)
    if t != before:
        f.write_text(t, encoding="utf-8")
        print(name, "updated")
    else:
        print(name, "no change")
