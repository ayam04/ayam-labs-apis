import pathlib
p = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public\guides-redact-pdf.html")
t = p.read_text(encoding="utf-8")
t = t.replace("https://docparse.p.rapidapi.com/v1/extract", "https://docparse.p.rapidapi.com/v1/pdf/text")
t = t.replace("const text = extracted.pages.map((p) =&gt; p.text).join('\\n\\n');",
              "// the text field holds the joined pages; pageText holds the per-page array\nconst text = extracted.pageText.map((p) =&gt; p.text).join('\\n\\n');")
p.write_text(t, encoding="utf-8")
print("guide path fixed:", "/v1/extract" not in t)
print("uses per-page field:", "pageText" in t)
