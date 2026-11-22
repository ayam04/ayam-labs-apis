import pathlib, re
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")
note = ('<div style="border:1px solid #3a2a1a;background:rgba(251,191,36,.06);border-radius:12px;padding:16px 18px;margin:22px 0">'
        '<p style="margin:0;color:var(--text-dim);font-size:.92rem"><b style="color:#fbbf24">Measured limit, 2026-11-22:</b> '
        'pdf.js costs roughly 30&nbsp;ms of CPU per page, and this deployment terminates a request at about 500&nbsp;ms. '
        'A 16-page document therefore died mid-extraction and Cloudflare answered with an HTML page. '
        '<code>/v1/pdf/text</code> now extracts up to 8 pages per call and sets <code>"truncated": true</code>; '
        'fetch more with <code>/v1/pdf/pages?pages=9-16</code>. Ranges are capped at 8 pages for the same reason, DOCX and '
        'HTML are unaffected, and a paid Workers plan would lift the ceiling.</p></div>')
p = PUB / "docparse.html"
t = p.read_text(encoding="utf-8")
t = re.sub(r'<div style="border:1px solid #3a2a1a;[\s\S]*?</div>', note, t, count=1)
p.write_text(t, encoding="utf-8")
print("docparse note:", "Measured limit, 2026-11-22" in t)

g = PUB / "guides-pdf-text.html"
t = g.read_text(encoding="utf-8")
m = re.search(r'<p style="color:#fbbf24;margin:0 0 16px;font-size:\.92rem"><b>[^<]*</b>[\s\S]*?</p>', t)
short = ('<p style="color:#fbbf24;margin:0 0 16px;font-size:.92rem"><b>Measured limit:</b> about 30&nbsp;ms of CPU per page, '
         'with the deployment terminating around 500&nbsp;ms, so <code>/v1/pdf/text</code> returns the first 8 pages and sets '
         '<code>truncated: true</code>. Page ranges are capped at 8 too; call again with <code>?pages=9-16</code> for the rest. '
         'DOCX and HTML are unaffected.</p>')
if m:
    t = t.replace(m.group(0), short, 1)
    g.write_text(t, encoding="utf-8")
    print("guide note updated")
