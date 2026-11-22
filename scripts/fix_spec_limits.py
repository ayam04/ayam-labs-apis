import pathlib, re

SRC = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\apps\docparse\src")

def patch(path, pairs):
    p = SRC / path
    t = p.read_text(encoding="utf-8")
    before = t
    for old, new in pairs:
        t = t.replace(old, new)
    p.write_text(t, encoding="utf-8")
    print(path, "changed" if t != before else "NO CHANGE")

patch("index.ts", [
    ("Text extraction stops at 100 pages and the response reports truncated=true.",
     "Text extraction stops at \" + LIMITS.maxPdfPages + \" pages per call and the response reports truncated=true; fetch further pages with /v1/pdf/pages."),
    ("comma separated, up to 100 pages)",
     "comma separated, up to \" + LIMITS.maxSelectedPages + \" pages per call)"),
    ("Encrypted files return 422. Up to 100 pages per extraction.",
     "Encrypted files return 422. Up to \" + LIMITS.maxPdfPages + \" pages per extraction."),
])

patch("config.ts", [
    ("8 MB input, 100 pages per PDF request, 5 MB of fetched HTML",
     "8 MB input, \" + LIMITS.maxPdfPages + \" pages per PDF request, 5 MB of fetched HTML"),
])

patch("schemas.ts", [
    ("Up to 100 pages and 64 tokens per call, page numbers 1-10000.",
     "Up to \" + LIMITS.maxSelectedPages + \" pages and 64 tokens per call, page numbers 1-10000."),
    ("True when the PDF had more than 100 pages, or the text exceeded 1,000,000 characters.",
     "True when the PDF had more pages than one call extracts, or the text exceeded 1,000,000 characters."),
])
