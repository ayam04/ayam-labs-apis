import pathlib, re

APP = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\apps\docparse")

# the example must fit inside the cap it documents: 1,3,5 is three pages
replacements = [
    (APP / "src" / "schemas.ts", [
        ('example: "1,3,5-7"', 'example: "1,3,5"'),
    ]),
    (APP / "src" / "index.ts", [
        ("?pages=1,3,5-7", "?pages=1,3,5"),
    ]),
    (APP / "src" / "lib" / "ranges.ts", [
        ('/** Compact echo of the request, e.g. "1,3,5-7". */', '/** Compact echo of the request, e.g. "1,3,5". */'),
        ("such as \"1,3,5-7\" (or \"1, 3, 5-7\", \"2-2\")", "such as \"1,3,5\" (or \"1-4\", \"2-4\")"),
        ("?pages=1,3,5-7." , "?pages=1,3,5."),
        ("such as 1,3,5-7.", "such as 1,3,5."),
        ("?pages=1,3,5-7.", "?pages=1,3,5."),
        ('[1,3,5,6,7] -> "1,3,5-7"', '[1,2,3,5] -> "1-3,5"'),
    ]),
    (APP / "test" / "ranges.test.ts", [
        ('it("expands the documented example 1,3,5-7", () => {', 'it("expands the documented example 1,3,5", () => {'),
        ('const parsed = parsePageRanges("1,3,5-7");', 'const parsed = parsePageRanges("1,3,5");'),
        ('expect(parsed.ranges).toBe("1,3,5-7");', 'expect(parsed.ranges).toBe("1,3,5");'),
    ]),
]

for path, pairs in replacements:
    t = path.read_text(encoding="utf-8")
    before = t
    for old, new in pairs:
        t = t.replace(old, new)
    path.write_text(t, encoding="utf-8")
    print(path.name, "changed" if t != before else "unchanged")

# the ranges doc comment for formatPageRanges
p = APP / "src" / "lib" / "ranges.ts"
t = p.read_text(encoding="utf-8")
t = t.replace('/** Renders page numbers as a compact range string: [1,3,5,6,7] -> "1,3,5-7". */',
              '/** Renders page numbers as a compact range string: [1,2,3,5] -> "1-3,5". */')
p.write_text(t, encoding="utf-8")
print("range comment:", "1-3,5" in t)
