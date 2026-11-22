import pathlib, re
PUB = pathlib.Path(r"C:\Users\ayamu\OneDrive\Documents\git uploads\api-marketplace\marketing\site\public")

new_note = ('<div style="border:1px solid #3a2a1a;background:rgba(251,191,36,.06);border-radius:12px;padding:16px 18px;margin:22px 0">'
            '<p style="margin:0;color:var(--text-dim);font-size:.92rem"><b style="color:#fbbf24">Known issue, measured 2026-11-22:</b> '
            'extraction of some dense, multi-page PDFs intermittently returns a Cloudflare 503 (error 1102, an HTML page rather than our '
            'JSON envelope). Over the last seven days that was 20 of 823 docparse requests. DOCX, HTML, metadata and small PDFs are '
            'unaffected, and the same file can succeed on one attempt and fail on the next. Retrying, or splitting the document with '
            '<code>/v1/pdf/pages</code>, works around it. Cause is still under investigation and I would rather say so than guess.</p></div>')

p = PUB / "docparse.html"
t = p.read_text(encoding="utf-8")
t = re.sub(r'<div style="border:1px solid #3a2a1a;[\s\S]*?</div>', new_note, t, count=1)
p.write_text(t, encoding="utf-8")
print("docparse note replaced:", "Known issue, measured" in t)

g = PUB / "guides-pdf-text.html"
t = g.read_text(encoding="utf-8")
short_old = re.search(r'<p style="color:#fbbf24;margin:0 0 16px;font-size:\.92rem"><b>Known limit:</b>[\s\S]*?</p>', t)
short_new = ('<p style="color:#fbbf24;margin:0 0 16px;font-size:.92rem"><b>Known issue:</b> some dense multi-page PDFs '
             'intermittently return a Cloudflare 503 (error 1102) instead of JSON, 20 of 823 requests over the last week. '
             'Retry, or split the file with <code>/v1/pdf/pages</code>. DOCX and HTML are unaffected.</p>')
if short_old:
    t = t.replace(short_old.group(0), short_new, 1)
    g.write_text(t, encoding="utf-8")
    print("guide note replaced")
