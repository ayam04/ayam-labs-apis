import pathlib
p = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public\guides-redact-pdf.html")
t = p.read_text(encoding="utf-8")
t = t.replace("// the text field holds the joined pages; pageText holds the per-page array", "// text is the joined document, pages is one string per page")
t = t.replace("const text = extracted.pageText.map((p) =&gt; p.text).join('\\n\\n');", "const text = extracted.pages.join('\\n\\n');")
p.write_text(t, encoding="utf-8")
print("uses pages.join:", "extracted.pages.join" in t)
print("no pageText:", "pageText" not in t)