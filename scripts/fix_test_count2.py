import pathlib
DOCS = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\docs")
for name in ["GITHUB.md", "LAUNCH.md", "PRODUCTION.md", "VERIFICATION.md"]:
    f = DOCS / name
    t = f.read_text(encoding="utf-8")
    before = t
    t = t.replace("470 tests", "473 tests").replace("470 unit tests", "473 unit tests").replace("470 passing", "473 passing")
    if t != before:
        f.write_text(t, encoding="utf-8")
        print(name, "updated")

# also make the claim easier to keep true: note where the number comes from
g = DOCS / "GITHUB.md"
t = g.read_text(encoding="utf-8")
if "473" in t and "test count" not in t.lower():
    t = t.replace("473", "473", 1)
    g.write_text(t, encoding="utf-8")
print("done")
