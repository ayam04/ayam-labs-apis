import pathlib, re

PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

# 1. compare-pricing: the per-page claim is now false for documents over 4 pages
c = PUB / "compare-pricing.html"
t = c.read_text(encoding="utf-8")
old_para = re.search(r'<p style="color:var\(--text-dim\);margin:0 0 16px">DocParse bills per call[\s\S]*?</p>', t)
new_para = ('<p style="color:var(--text-dim);margin:0 0 16px">DocParse bills per call, and each call extracts up to 4 pages '
            'because of a measured CPU limit (see the note on the DocParse page). That makes a one-call document $0.05 and a '
            '100-page document 25 calls, or $1.25: <b>$0.0125 per page</b>. Against the per-page vendors that is about 17x '
            'PennyOCR ($0.00075) and about 17x AWS Textract ($0.0015), and roughly three times cheaper than Sidian ($0.04). '
            'This paragraph used to claim $0.0005 per page. That number assumed a 100-page call, which the CPU limit does not '
            'allow, so it is corrected here rather than quietly left standing.</p>')
if old_para:
    t = t.replace(old_para.group(0), new_para, 1)
    c.write_text(t, encoding="utf-8")
    print("compare-pricing paragraph corrected")

# table row for docparse, if the generated row still claims parity
row = re.search(r"<tr><td><b>DocParse[^<]*</b></td>[\s\S]*?</tr>", t)
if row:
    print("docparse row today:", re.sub(r"<[^>]+>", " | ", row.group(0))[:180])

# 2. docparse FAQ: 100 pages per request is no longer true
d = PUB / "docparse.html"
t = d.read_text(encoding="utf-8")
t = t.replace(
  "8MB or 100 pages per request, whichever comes first. Larger documents should be split or fetched page ranges with /v1/pdf/pages.",
  "8MB, and up to 4 pages per request. The cap comes from a measured CPU budget: pdf.js costs about 30ms of CPU per page and the deployment terminates a request near 500ms, so four pages (188-223ms) is the reliable size. Longer documents are fetched in slices with /v1/pdf/pages?pages=5-8 and so on.")
d.write_text(t, encoding="utf-8")
print("docparse FAQ updated:", "up to 4 pages per request" in t)
