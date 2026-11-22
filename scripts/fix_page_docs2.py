import pathlib, re

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
DOCS = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\docs")

p = PUB / "docparse.html"
t = p.read_text(encoding="utf-8")
t = t.replace(
  "8MB input, 100 pages per request, explicit truncation flags. Predictable cost, no surprise bills when someone uploads a 900 page scan.",
  "8MB input, 4 pages per request because of a measured CPU limit, explicit truncation flags. Predictable cost, no surprise bills when someone uploads a 900 page scan.")
p.write_text(t, encoding="utf-8")
print("product page fixed:", "100 pages per request" not in t)

targets = list(DOCS.glob("listings/*docparse*.md")) + [DOCS / "DEMAND.md"]
for f in targets:
    if not f.exists():
        continue
    t = f.read_text(encoding="utf-8")
    before = t
    t = t.replace("100 pages per PDF request", "4 pages per PDF request")
    t = t.replace("Up to 100 pages", "Up to 4 pages")
    t = t.replace("more than 100 pages", "more pages than one call extracts")
    t = t.replace("100-page PDF extracts in roughly 3 seconds", "4-page extraction takes roughly a second")
    t = t.replace("Accepts a 100 page file", "Accepts 8 MB files")
    if t != before:
        f.write_text(t, encoding="utf-8")
        print(f.name, "updated")
print("remaining 100-page mentions:", [f.name for f in targets if f.exists() and re.search(r"100 pa", f.read_text(encoding="utf-8"))])
