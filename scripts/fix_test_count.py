import pathlib

ROOT = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace")
SITE = ROOT / "marketing" / "site" / "public"
DOCS = ROOT / "docs"

OLD = "470"
NEW = "473"

# site pages and the article that is queued for publishing
targets = list(SITE.glob("*.html")) + [DOCS / "marketing" / "article.md", ROOT / ".tmp" / "article-devto.md", ROOT / ".tmp" / "article-body.txt"]
changed = []
for f in targets:
    if not f.exists():
        continue
    t = f.read_text(encoding="utf-8")
    if "470" not in t:
        continue
    # only touch test-count phrasing, not arbitrary numbers
    before = t
    for old, new in [
        ("470 tests", "473 tests"),
        ("470 unit tests", "473 unit tests"),
        ("470 passing", "473 passing"),
        ("**470**", "**473**"),
    ]:
        t = t.replace(old, new)
    if t != before:
        f.write_text(t, encoding="utf-8")
        changed.append(f.name)

print("updated:", changed)
leftover = []
for f in list(SITE.glob("*.html")) + list(DOCS.glob("*.md")):
    t = f.read_text(encoding="utf-8", errors="ignore")
    if "470 test" in t or "470 unit" in t:
        leftover.append(f.name)
print("still claiming 470 tests:", leftover)
