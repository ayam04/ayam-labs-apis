import pathlib, re
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
note = ('<div style="border:1px solid #3a2a1a;background:rgba(251,191,36,.06);border-radius:12px;padding:16px 18px;margin:22px 0">'
        '<p style="margin:0;color:var(--text-dim);font-size:.92rem"><b style="color:#fbbf24">Measured limit, 2026-11-22:</b> '
        'this worker runs with a 10&nbsp;ms CPU budget per request, confirmed from the runtime log '
        '(<code>cpuTime 10ms, outcome exceededCpu</code>). A full extraction of a dense document above 400&nbsp;KB exceeds it, '
        'so since this build <code>/v1/pdf/text</code> refuses those with a 413 and a readable reason instead of dying as a '
        'Cloudflare page. <code>/v1/pdf/pages?pages=1-4</code> still extracts a slice, and DOCX, HTML and the metadata route '
        'are unaffected. On a paid Workers plan the budget is 30&nbsp;s and the cap can go.</p></div>')
p = PUB / "docparse.html"
t = p.read_text(encoding="utf-8")
t = re.sub(r'<div style="border:1px solid #3a2a1a;[\s\S]*?</div>', note, t, count=1)
p.write_text(t, encoding="utf-8")
print("docparse note updated")

g = PUB / "guides-pdf-text.html"
t = g.read_text(encoding="utf-8")
m = re.search(r'<p style="color:#fbbf24;margin:0 0 16px;font-size:\.92rem"><b>Known (issue|limit):</b>[\s\S]*?</p>', t)
short = ('<p style="color:#fbbf24;margin:0 0 16px;font-size:.92rem"><b>Measured limit:</b> the worker has a 10&nbsp;ms CPU budget '
         '(from the runtime log: <code>cpuTime 10ms, outcome exceededCpu</code>), so since 2026-11-22 <code>/v1/pdf/text</code> '
         'returns a 413 with a reason for dense documents above 400&nbsp;KB instead of a Cloudflare error. '
         'Use <code>/v1/pdf/pages?pages=1-4</code> for a slice. DOCX and HTML are unaffected.</p>')
if m:
    t = t.replace(m.group(0), short, 1)
    g.write_text(t, encoding="utf-8")
    print("guide note updated")
