import pathlib
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

edits = [
    ("pii-shield.html", '<a class="btn" href="/reference-pii-shield">Full API reference</a>',
     '<a class="btn" href="/guides-redact-pdf">Redact a PDF</a>'),
    ("docparse.html", '<a class="btn" href="/reference-docparse">Full API reference</a>',
     '<a class="btn" href="/guides-redact-pdf">Redact the output</a>'),
]
for name, anchor, added in edits:
    p = PUB / name
    t = p.read_text(encoding="utf-8")
    if "guides-redact-pdf" in t:
        print(name, "already linked")
        continue
    if anchor in t:
        t = t.replace(anchor, anchor + "\n          " + added, 1)
        p.write_text(t, encoding="utf-8")
        print(name, "linked")
    else:
        print(name, "ANCHOR MISSING")
